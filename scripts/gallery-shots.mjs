// UI ギャラリーの全シナリオを端末サイズ・テーマ別に撮影する
// 使い方: npm run gallery (別ターミナル) → npm run gallery:shots [-- --base http://localhost:5173 --out gallery-shots]
// 出力: <out>/<scenario>__<device>__<theme>.png と <out>/index.json
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const base = opt("base", "http://localhost:5173");
const out = opt("out", "gallery-shots");
const themes = opt("themes", "light,dark").split(",");

const DEVICES = [
  { id: "ipad-landscape", label: "iPad 横", w: 1180, h: 820, touch: true },
  { id: "ipad-portrait", label: "iPad 縦", w: 820, h: 1180, touch: true },
  { id: "iphone", label: "iPhone", w: 390, h: 844, touch: true },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

// シナリオ一覧はページから取得する (scenarios.ts と二重管理しない)
const probe = await browser.newPage();
await probe.goto(`${base}/gallery.html`);
const list = await probe.evaluate(async () => {
  const m = await import("/src/gallery/scenarios.ts");
  return m.scenarios.map(({ id, group, title, note }) => ({ id, group, title, note }));
});
await probe.close();

const shots = [];
for (const theme of themes) {
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1, hasTouch: d.touch });
    for (const s of list) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (dlg) => dlg.dismiss());
      await page.goto(`${base}/gallery.html?scenario=${s.id}&theme=${theme}`);
      await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });
      const file = `${s.id}__${d.id}__${theme}.png`;
      await page.screenshot({ path: join(out, file) });
      shots.push({ ...s, device: d.id, deviceLabel: d.label, w: d.w, h: d.h, theme, file, errors });
      if (errors.length) console.warn(`! ${file}: ${errors.join(" / ")}`);
      await page.close();
    }
    await ctx.close();
    console.log(`${theme} / ${d.label}: ${list.length} shots`);
  }
}
await browser.close();
writeFileSync(join(out, "index.json"), JSON.stringify(shots, null, 2));
console.log(`done: ${shots.length} → ${out}/`);
