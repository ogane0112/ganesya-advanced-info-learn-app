import type { Fn } from "./_lib/env";
import { buildHistory } from "./_lib/data";
import { readTrees } from "./_lib/github";
import { json } from "./_lib/http";

// GET /api/history  すべての解答と採点状況 (新しい順)
export const onRequestGet: Fn = async ({ env }) => {
  const {
    trees: [answers, results],
  } = await readTrees(env, [
    { dir: "answers", depth: 3, withText: true },
    { dir: "results", depth: 3, withText: true },
  ]);
  return json({ items: buildHistory(answers, results) });
};
