import type { Fn } from "../_lib/env";
import { buildQuestionList } from "../_lib/data";
import { readText, readTrees } from "../_lib/github";
import { error, json } from "../_lib/http";
import { isQuestionId, questionPath } from "../../../shared/ids";
import { parseQuestion, stripAnswers } from "../../../shared/question";

// GET /api/questions            問題一覧
// GET /api/questions/:year/:q   問題本文 (?reveal=1 で解答例・講評も含める)
export const onRequestGet: Fn = async ({ params, request, env }) => {
  const segs = (Array.isArray(params.path) ? params.path : params.path ? [params.path] : []).filter(Boolean);

  if (segs.length === 0) {
    const {
      trees: [questions, answers, results],
      files: [stats],
    } = await readTrees(
      env,
      [
        { dir: "questions", depth: 2, withText: true },
        { dir: "answers", depth: 3, withText: false },
        { dir: "results", depth: 3, withText: false },
      ],
      ["stats/summary.json"],
    );
    return json(buildQuestionList(questions, answers, results, stats));
  }

  const id = segs.join("/");
  if (!isQuestionId(id)) return error(400, "invalid question id");
  const md = await readText(env, questionPath(id));
  if (md == null) return error(404, "question not found");
  const q = parseQuestion(id, md);
  const reveal = new URL(request.url).searchParams.get("reveal") === "1";
  return json(reveal ? q : stripAnswers(q));
};
