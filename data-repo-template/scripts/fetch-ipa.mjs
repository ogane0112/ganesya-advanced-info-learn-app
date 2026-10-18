// IPA 公式サイトから応用情報技術者試験 午後の 問題冊子 / 解答例 / 採点講評 PDF を取得する
//
// 使い方:
//   node scripts/fetch-ipa.mjs --year 2024 --season spring     # 1回分
//   node scripts/fetch-ipa.mjs --from 2019 --to 2025           # 範囲
//   node scripts/fetch-ipa.mjs --year 2024 --dry-run           # 見つけたリンクの表示だけ
//   node scripts/fetch-ipa.mjs --year 2024 --kinds ans         # 解答例だけ (qs,ans,cmnt から選択)
// 出力: ipa-pdf/<year>-<season>/{qs,ans,cmnt}.pdf と ipa-pdf/manifest.json
//
// 年度ページ https://www.ipa.go.jp/shiken/mondai-kaiotu/<year><era><nn>.html から PDF リンクを探す。
// ファイル名 (…_ap_pm_qs.pdf 等) で判定し、合わなければリンク直前の文言
// (応用情報技術者 / 午後 / 問題冊子・解答例・採点講評 / 春期・秋期) で判定する。
// サーバに負荷をかけないよう 1 リクエストごとに待機する。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://www.ipa.go.jp/shiken/mondai-kaiotu/";
const UA = "ap-pm-study-fetcher/1.0 (personal study; low rate)";
const WAIT_MS = 1500;
const KINDS = { qs: "問題冊子", ans: "解答例", cmnt: "採点講評" };

function parseArgs(argv) {
  const a = { out: "ipa-pdf", dryRun: false, base: BASE, kinds: Object.keys(KINDS) };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === "--year") a.from = a.to = Number(v());
    else if (k === "--from") a.from = Number(v());
    else if (k === "--to") a.to = Number(v());
    else if (k === "--season") a.season = v();
    else if (k === "--out") a.out = v();
    else if (k === "--kinds") a.kinds = v().split(",").map((s) => s.trim());
    else if (k === "--base") a.base = v(); // テスト用
    else if (k === "--dry-run") a.dryRun = true;
    else throw new Error(`unknown option: ${k}`);
  }
  if (!a.from || !a.to) throw new Error("--year か --from/--to を指定してください");
  if (a.season && !["spring", "autumn"].includes(a.season)) throw new Error("--season は spring / autumn");
  if (!a.kinds.length || a.kinds.some((k) => !KINDS[k])) throw new Error("--kinds は qs,ans,cmnt から選択");
  return a;
}

/** 2024 → "2024r06"、2019 → ["2019h31"]、2018 → "2018h30" */
export function yearPageSlugs(year) {
  if (year >= 2020) return [`${year}r${String(year - 2018).padStart(2, "0")}`];
  if (year === 2019) return ["2019h31", "2019r01"];
  return [`${year}h${String(year - 1988).padStart(2, "0")}`];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, binary = false) {
  await sleep(WAIT_MS);
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
}

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

function lastIndexOfAny(text, words) {
  let best = { i: -1, w: null };
  for (const w of words) {
    const i = text.lastIndexOf(w);
    if (i > best.i) best = { i, w };
  }
  return best;
}

/** ファイル名から判定: 2024r06h_ap_pm_qs.pdf / 2019h31h_ap_pm_ans.pdf / 2020r02o_ap_pm_cmnt.pdf など */
export function classifyByFilename(href) {
  const m = /(\d{4})[hr]\d{2}([hao])_ap_pm_(qs|ans|cmnt)\.pdf$/i.exec(href);
  if (!m) return null;
  return { year: Number(m[1]), season: m[2].toLowerCase() === "h" ? "spring" : "autumn", kind: m[3].toLowerCase() };
}

/** 年度ページの HTML から AP 午後の PDF リンクを抽出 */
export function extractLinks(html, pageUrl, year) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = new URL(m[1], pageUrl).href;
    const byName = classifyByFilename(url);
    if (byName) {
      out.push({ ...byName, url, by: "filename" });
      continue;
    }
    // 文言で判定: リンク直前の文脈で最後に出てきた試験区分が応用情報か
    const before = strip(html.slice(Math.max(0, m.index - 4000), m.index));
    const label = strip(m[2]);
    const exam = lastIndexOfAny(before, [
      "応用情報技術者",
      "基本情報技術者",
      "情報セキュリティマネジメント",
      "ITパスポート",
      "高度試験",
      "ITストラテジスト",
      "システムアーキテクト",
      "プロジェクトマネージャ",
      "ネットワークスペシャリスト",
      "データベーススペシャリスト",
      "エンベデッドシステムスペシャリスト",
      "ITサービスマネージャ",
      "システム監査技術者",
      "情報処理安全確保支援士",
    ]);
    if (exam.w !== "応用情報技術者") continue;
    const near = before.slice(-300) + " " + label;
    const part = lastIndexOfAny(near, ["午前", "午後"]);
    if (part.w !== "午後") continue;
    const kindWord = Object.values(KINDS).find((w) => label.includes(w)) ?? lastIndexOfAny(near, Object.values(KINDS)).w;
    const kind = Object.keys(KINDS).find((k) => KINDS[k] === kindWord);
    if (!kind) continue;
    const s = lastIndexOfAny(before, ["春期", "秋期", "10月"]);
    const season = s.w === "春期" ? "spring" : s.w ? "autumn" : null;
    if (!season) continue;
    out.push({ year, season, kind, url, by: "context" });
  }
  // 同じ (season, kind) はファイル名一致を優先して1つに
  const seen = new Map();
  for (const l of out) {
    const key = `${l.year}-${l.season}-${l.kind}`;
    if (!seen.has(key) || (seen.get(key).by !== "filename" && l.by === "filename")) seen.set(key, l);
  }
  return [...seen.values()];
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const manifestPath = join(a.out, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  let found = 0;
  for (let year = a.from; year <= a.to; year++) {
    for (const slug of yearPageSlugs(year)) {
      const pageUrl = new URL(`${slug}.html`, a.base).href;
      const html = await get(pageUrl);
      if (!html) {
        console.log(`- ${pageUrl}: ページなし`);
        continue;
      }
      const links = extractLinks(html, pageUrl, year).filter((l) => (!a.season || l.season === a.season) && a.kinds.includes(l.kind));
      console.log(`- ${pageUrl}: ${links.length} 件`);
      for (const l of links) {
        found++;
        const dir = join(a.out, `${l.year}-${l.season}`);
        const file = join(dir, `${l.kind}.pdf`);
        console.log(`    ${l.year}-${l.season} ${KINDS[l.kind]} (${l.by}) ${l.url}`);
        if (a.dryRun) continue;
        if (existsSync(file)) continue;
        const pdf = await get(l.url, true);
        if (!pdf) {
          console.log(`      404`);
          continue;
        }
        if (pdf.subarray(0, 4).toString() !== "%PDF") throw new Error(`PDF ではありません: ${l.url}`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, pdf);
        (manifest[`${l.year}-${l.season}`] ??= {})[l.kind] = { url: l.url, page: pageUrl, fetched_at: new Date().toISOString() };
      }
    }
  }
  if (!a.dryRun) {
    mkdirSync(a.out, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  if (found === 0) {
    console.error("PDF が見つかりませんでした。年度ページの構成が変わった可能性があります (--dry-run で確認)");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
