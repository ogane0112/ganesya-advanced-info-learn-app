// 過去問道場 (応用情報技術者試験ドットコム) から午後問題のページ HTML と図版画像を保存する
//
// 使い方:
//   node scripts/fetch-apsiken.mjs --year 2024 --season spring              # 問1〜問11
//   node scripts/fetch-apsiken.mjs --year 2024 --season spring --q 1,3      # 指定の問だけ
//   node scripts/fetch-apsiken.mjs --year 2024 --season spring --dry-run    # URL 確認だけ
// 出力: apsiken-raw/<year>-<season>/qNN.html と qNN/<画像>、apsiken-raw/manifest.json
//
// ここでは保存だけを行い、問題文の抽出は Claude が IMPORT.md に従って行う (解説は取り込まない)。
// robots.txt を確認し、禁止されていれば中止する。アクセスは 3 秒間隔。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const BASE = "https://www.ap-siken.com/";
const UA = "ap-pm-study-fetcher/1.0 (personal study; low rate)";
const WAIT_MS = 3000;

function parseArgs(argv) {
  const a = { out: "apsiken-raw", dryRun: false, base: BASE, q: "1-11" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === "--year") a.year = Number(v());
    else if (k === "--season") a.season = v();
    else if (k === "--q") a.q = v();
    else if (k === "--dir") a.dir = v(); // 例: 06_haru (自動推定が合わないとき)
    else if (k === "--out") a.out = v();
    else if (k === "--base") a.base = v(); // テスト用
    else if (k === "--dry-run") a.dryRun = true;
    else throw new Error(`unknown option: ${k}`);
  }
  if (!a.year || !["spring", "autumn"].includes(a.season)) throw new Error("--year と --season spring|autumn を指定してください");
  return a;
}

/** "1-11" / "1,3,5" → [1, 3, 5] */
export function parseQuestionList(s) {
  const out = new Set();
  for (const part of s.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw new Error(`--q の形式が不正: ${s}`);
    for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) if (n >= 1 && n <= 11) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}

/** 年度・期 → 過去問道場の回ディレクトリ候補 (例: 2024 spring → 06_haru) */
export function termDirs(year, season) {
  const reiwa = year - 2018;
  const heisei = year - 1988;
  if (year === 2019) return season === "spring" ? ["31_haru"] : ["01_aki"];
  if (year === 2020) return season === "spring" ? [] : ["02_oct", "02_aki"]; // 2020 年春期は中止、秋期は 10 月実施
  if (year === 2011 && season === "spring") return ["23_tokubetsu", "23_haru"];
  const n = String(year >= 2020 ? reiwa : heisei).padStart(2, "0");
  return [`${n}_${season === "spring" ? "haru" : "aki"}`];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
const textCache = new Map();
async function get(url, binary = false) {
  if (!binary && textCache.has(url)) return textCache.get(url);
  const wait = last + WAIT_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  if (binary) return Buffer.from(await res.arrayBuffer());
  const text = await res.text();
  textCache.set(url, text);
  return text;
}

/** robots.txt の User-agent: * グループの Disallow を返す (簡易パーサ) */
export function disallowedPaths(robots) {
  const rules = [];
  let applies = false;
  let inGroup = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (/^user-agent$/i.test(key)) {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value === "*") applies = true;
    } else {
      inGroup = false;
      if (applies && /^disallow$/i.test(key) && value) rules.push(value);
    }
  }
  return rules;
}

export function isAllowed(path, rules) {
  return !rules.some((r) => path.startsWith(r.replace(/\*.*$/, "")));
}

/** 本文中の画像 (同一サイト・png/jpg/gif/svg/webp) */
export function imageUrls(html, pageUrl) {
  const base = new URL(pageUrl);
  const urls = new Set();
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const u = new URL(m[1], pageUrl);
    if (u.host === base.host && /\.(png|jpe?g|gif|svg|webp)$/i.test(u.pathname)) urls.add(u.href);
  }
  return [...urls];
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const qs = parseQuestionList(a.q);
  const robots = (await get(new URL("/robots.txt", a.base).href)) ?? "";
  const rules = disallowedPaths(robots);

  const dirs = a.dir ? [a.dir] : termDirs(a.year, a.season);
  if (!dirs.length) throw new Error(`${a.year} ${a.season} の試験はありません`);
  let dir = null;
  for (const d of dirs) {
    const probe = new URL(`kakomon/${d}/pm01.html`, a.base);
    if (!isAllowed(probe.pathname, rules)) throw new Error(`robots.txt で禁止されています: ${probe.pathname}`);
    if (a.dryRun || (await get(probe.href)) != null) {
      dir = d;
      break;
    }
  }
  if (!dir) throw new Error(`回のページが見つかりません (試した: ${dirs.join(", ")})。--dir で指定してください`);

  const term = `${a.year}-${a.season}`;
  const outDir = join(a.out, term);
  const manifestPath = join(a.out, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  let saved = 0;
  for (const n of qs) {
    const nn = String(n).padStart(2, "0");
    const url = new URL(`kakomon/${dir}/pm${nn}.html`, a.base);
    if (!isAllowed(url.pathname, rules)) throw new Error(`robots.txt で禁止されています: ${url.pathname}`);
    console.log(`問${n}: ${url.href}`);
    if (a.dryRun) continue;
    const html = await get(url.href);
    if (html == null) {
      console.log("  ページなし");
      continue;
    }
    mkdirSync(join(outDir, `q${nn}`), { recursive: true });
    writeFileSync(join(outDir, `q${nn}.html`), html);
    const images = [];
    for (const img of imageUrls(html, url.href)) {
      const path = new URL(img).pathname;
      if (!isAllowed(path, rules)) continue;
      const data = await get(img, true);
      if (!data) continue;
      const file = join(outDir, `q${nn}`, basename(path));
      writeFileSync(file, data);
      images.push({ url: img, file });
    }
    console.log(`  保存: ${join(outDir, `q${nn}.html`)} (画像 ${images.length})`);
    (manifest[term] ??= {})[`q${nn}`] = { url: url.href, images, fetched_at: new Date().toISOString() };
    saved++;
  }
  if (!a.dryRun) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    if (saved === 0) {
      console.error("1 ページも保存できませんでした");
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
