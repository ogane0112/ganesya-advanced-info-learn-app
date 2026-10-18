import { isQuestionId } from "./ids";
import type { AnswerPayload } from "./types";

export const MAX_ANSWER_CHARS = 2000;
export const MAX_BODY_BYTES = 64 * 1024;

/** 提出された解答 JSON を検証し、保存する形に正規化する。不正なら Error */
export function validateAnswerPayload(raw: unknown, allowedIds?: Set<string>): AnswerPayload {
  if (!raw || typeof raw !== "object") throw new Error("body must be an object");
  const r = raw as Record<string, unknown>;
  if (!isQuestionId(r.question)) throw new Error("invalid question");
  if (typeof r.answered_at !== "string" || Number.isNaN(Date.parse(r.answered_at))) {
    throw new Error("invalid answered_at");
  }
  const elapsed = r.elapsed_sec;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 24 * 3600) {
    throw new Error("invalid elapsed_sec");
  }
  const mode = r.mode ?? "single";
  if (mode !== "single" && mode !== "exam") throw new Error("invalid mode");
  if (typeof r.client_id !== "string" || !/^[\w-]{8,64}$/.test(r.client_id)) throw new Error("invalid client_id");
  if (!r.answers || typeof r.answers !== "object" || Array.isArray(r.answers)) throw new Error("invalid answers");

  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.answers as Record<string, unknown>)) {
    if (!/^[\p{L}\p{N}_.\-()（）]{1,32}$/u.test(k)) throw new Error(`invalid answer id: ${k}`);
    if (allowedIds && !allowedIds.has(k)) throw new Error(`unknown answer id: ${k}`);
    if (typeof v !== "string") throw new Error(`answer ${k} must be a string`);
    if (v.length > MAX_ANSWER_CHARS) throw new Error(`answer ${k} is too long`);
    answers[k] = v;
  }
  return {
    question: r.question,
    answered_at: r.answered_at,
    elapsed_sec: Math.round(elapsed),
    mode,
    answers,
    client_id: r.client_id,
  };
}
