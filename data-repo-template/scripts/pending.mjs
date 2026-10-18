// 未採点の解答 (answers/ にあり results/ に同名 JSON がないもの) を列挙する
// 使い方: node scripts/pending.mjs
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const pending = walk("answers")
  .filter((p) => /^answers\/\d{4}-(spring|autumn)\/q\d{2}\/\d{8}-\d{4,6}\.json$/.test(p))
  .filter((p) => !existsSync(p.replace(/^answers\//, "results/")))
  .sort();

for (const p of pending) console.log(p);
if (pending.length === 0) console.error("未採点の解答はありません");
