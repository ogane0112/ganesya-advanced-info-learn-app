// results/ 配下の全採点結果から stats/summary.json を作り直す (冪等)
// 使い方: node scripts/update-stats.mjs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function fieldOf(questionId) {
  const p = `questions/${questionId}.md`;
  if (!existsSync(p)) return "未分類";
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(p, "utf8"));
  const m = fm && /^field:\s*["']?(.+?)["']?\s*$/m.exec(fm[1]);
  return m ? m[1] : "未分類";
}

const fields = {};
const questions = {};
const files = walk("results")
  .filter((p) => /^results\/\d{4}-(spring|autumn)\/q\d{2}\/\d{8}-\d{4,6}\.json$/.test(p))
  .sort();

for (const p of files) {
  let r;
  try {
    r = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    console.error(`skip (invalid json): ${p}`);
    continue;
  }
  const id = r.question;
  const field = fieldOf(id);
  const f = (fields[field] ??= { attempts: 0, score: 0, max: 0, rate: 0 });
  f.attempts += 1;
  f.score += r.total;
  f.max += r.max;
  const q = (questions[id] ??= { field, attempts: 0, best: 0, latest: 0, max: r.max });
  q.attempts += 1;
  q.best = Math.max(q.best, r.total);
  q.latest = r.total; // ファイル名順 = 時系列順
  q.max = r.max;
}
for (const f of Object.values(fields)) f.rate = f.max ? Math.round((f.score / f.max) * 1000) / 1000 : 0;

const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "+09:00");
writeFileSync("stats/summary.json", JSON.stringify({ updated_at: now, fields, questions }, null, 2) + "\n");
console.log(`stats/summary.json updated (${files.length} results)`);
