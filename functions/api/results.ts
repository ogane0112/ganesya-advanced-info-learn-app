import type { Fn } from "./_lib/env";
import { buildResults } from "./_lib/data";
import { readTrees } from "./_lib/github";
import { error, json } from "./_lib/http";
import { isQuestionId } from "../../shared/ids";

// GET /api/results?question=2024-spring/q03  その問題の採点結果一覧 (新しい順)
export const onRequestGet: Fn = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("question");
  if (!isQuestionId(q)) return error(400, "question is required");
  const {
    trees: [files],
  } = await readTrees(env, [{ dir: `results/${q}`, depth: 1, withText: true }]);
  return json({ items: buildResults(files) });
};
