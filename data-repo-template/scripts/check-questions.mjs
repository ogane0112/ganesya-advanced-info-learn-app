// questions/**/*.md がアプリで読める形式かを検証する (アプリ側 shared/question.ts と同じ解釈)
// 使い方: node scripts/check-questions.mjs [ファイル or ディレクトリ ...]  (省略時 questions/ 全体)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const TYPES = ["fill", "short", "numeric"];
const ID_RE = /^[\p{L}\p{N}_.\-()（）]{1,32}$/u;
const PATH_RE = /^questions\/(\d{4})-(spring|autumn)\/q(\d{2})\.md$/;

function walk(p) {
  if (!existsSync(p)) return [];
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => walk(join(p, n)));
}

function sections(md) {
  const out = new Map();
  const heads = [...md.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
  heads.forEach((h, i) => out.set(h[1], md.slice(h.index + h[0].length, heads[i + 1]?.index ?? md.length).trim()));
  return out;
}

function check(path) {
  const errs = [];
  const warns = [];
  const m = PATH_RE.exec(path);
  if (!m) return { errs: [`パスが questions/<年度>-<spring|autumn>/qNN.md の形式ではありません`], warns };
  const md = readFileSync(path, "utf8");
  const fmm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!fmm) return { errs: ["frontmatter がありません"], warns };
  let fm;
  try {
    fm = parse(fmm[1]);
  } catch (e) {
    return { errs: [`frontmatter の YAML が不正: ${e.message}`], warns };
  }
  if (fm.year !== Number(m[1])) errs.push(`year (${fm.year}) がパスと不一致`);
  if (fm.season !== m[2]) errs.push(`season (${fm.season}) がパスと不一致`);
  if (fm.number !== Number(m[3])) errs.push(`number (${fm.number}) がパスと不一致`);
  if (typeof fm.field !== "string" || !fm.field) errs.push("field がありません");

  const sec = sections(md.slice(fmm[0].length));
  if (!sec.get("本文")) errs.push("「## 本文」がない、または空です");
  const raw = sec.get("設問");
  if (!raw) return { errs: [...errs, "「## 設問」がありません"], warns };
  const fence = /^```(?:ya?ml)?\r?\n([\s\S]*?)\r?\n```\s*$/.exec(raw.trim());
  let list;
  try {
    list = parse(fence ? fence[1] : raw);
  } catch (e) {
    return { errs: [...errs, `設問の YAML が不正: ${e.message}`], warns };
  }
  if (!Array.isArray(list) || list.length === 0) return { errs: [...errs, "設問が YAML のリストではありません"], warns };

  const ids = new Set();
  let total = 0;
  list.forEach((s, i) => {
    const where = `設問 #${i + 1} (${s?.id ?? "?"})`;
    const id = s?.id == null ? "" : String(s.id);
    if (!ID_RE.test(id)) errs.push(`${where}: id が不正`);
    if (ids.has(id)) errs.push(`${where}: id が重複`);
    ids.add(id);
    if (!TYPES.includes(s.type)) errs.push(`${where}: type は fill / short / numeric`);
    if (!s.text) errs.push(`${where}: text がありません`);
    if (s.answer == null || s.answer === "") errs.push(`${where}: answer がありません`);
    if (s.type === "short" && typeof s.limit !== "number") warns.push(`${where}: 記述なのに limit がありません`);
    if (s.limit != null && typeof s.limit !== "number") errs.push(`${where}: limit は数値`);
    if (typeof s.points !== "number") errs.push(`${where}: points がありません`);
    else total += s.points;
    if (s.alt_answers != null && !Array.isArray(s.alt_answers)) errs.push(`${where}: alt_answers はリスト`);
  });
  if (total !== 20) warns.push(`配点合計が ${total} 点です (IPA 午後は 1 問 20 点)`);
  for (const img of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const src = img[1];
    if (/^(https?:|data:|\/)/.test(src)) continue;
    const p = join(path, "..", src);
    if (!existsSync(p)) errs.push(`画像がありません: ${src}`);
    else if (!/^[\w.\-/]+$/.test(src)) errs.push(`画像パスに使えない文字: ${src} (英数字 . - _ のみ)`);
  }
  return { errs, warns };
}

const targets = process.argv.slice(2);
const files = (targets.length ? targets : ["questions"]).flatMap(walk).filter((p) => p.endsWith(".md"));
let bad = 0;
for (const f of files.sort()) {
  const { errs, warns } = check(f);
  if (errs.length) bad++;
  const mark = errs.length ? "NG" : warns.length ? "WARN" : "OK";
  console.log(`${mark} ${f}`);
  for (const e of errs) console.log(`   error: ${e}`);
  for (const w of warns) console.log(`   warn:  ${w}`);
}
console.log(`${files.length} files, ${bad} with errors`);
process.exit(bad ? 1 : 0);
