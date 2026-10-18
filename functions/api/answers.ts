import type { Fn } from "./_lib/env";
import { createFile, readText } from "./_lib/github";
import { error, json } from "./_lib/http";
import { answerPath, questionPath, stampFromIso } from "../../shared/ids";
import { parseQuestion } from "../../shared/question";
import type { AnswerPayload } from "../../shared/types";
import { MAX_BODY_BYTES, validateAnswerPayload } from "../../shared/validate";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

// POST /api/answers  解答を answers/<id>/<YYYYMMDD-HHmm>.json に commit する
// パスはサーバ側で組み立てるので answers/ 配下以外には書けない
export const onRequestPost: Fn = async ({ request, env }) => {
  if (!sameOrigin(request)) return error(403, "cross-origin request");
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return error(415, "content-type must be application/json");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, "body too large");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return error(400, "invalid json");
  }
  let payload: AnswerPayload;
  try {
    payload = validateAnswerPayload(raw);
  } catch (e) {
    return error(400, (e as Error).message);
  }

  const md = await readText(env, questionPath(payload.question));
  if (md == null) return error(404, `question not found: ${payload.question}`);
  const ids = new Set(parseQuestion(payload.question, md).subquestions.map((s) => s.id));
  try {
    payload = validateAnswerPayload(payload, ids);
  } catch (e) {
    return error(400, (e as Error).message);
  }

  const content = JSON.stringify(payload, null, 2) + "\n";
  // 同じ分に別の解答があれば秒まで付けたファイル名で再試行
  for (const withSeconds of [false, true]) {
    const stamp = stampFromIso(payload.answered_at, withSeconds);
    const path = answerPath(payload.question, stamp);
    const r = await createFile(env, path, content, `answer: ${payload.question} (${stamp})`);
    if (r === "created") return json({ path, status: "created" }, 201);

    const existing = await readText(env, path);
    if (existing == null) return error(502, "failed to create file");
    try {
      // 再送 (前回の commit が実は成功していた) なら成功扱い
      if ((JSON.parse(existing) as AnswerPayload).client_id === payload.client_id) {
        return json({ path, status: "exists" }, 200);
      }
    } catch {
      /* 別の解答として扱う */
    }
  }
  return error(409, "an answer with the same timestamp already exists");
};
