// public/icon.svg から PNG アイコンを生成する (Playwright の Chromium を使用)
// 実行: NODE_PATH=$(npm root -g) node scripts/gen-icons.mjs
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// グローバルの playwright を NODE_PATH から解決する
const { chromium } = createRequire(import.meta.url)("playwright");

const svg = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  // iOS は角丸を自前で付けるので余白なしの正方形
  ["apple-touch-icon.png", 180],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#1f4e8c">${svg.replace("<svg", `<svg width="${size}" height="${size}" style="display:block"`)}</body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: false });
}
await browser.close();
