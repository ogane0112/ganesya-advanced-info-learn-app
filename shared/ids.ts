// 問題ID・ファイルパスの検証。書き込みパスは必ずここを通して組み立てる

const QUESTION_ID_RE = /^(\d{4})-(spring|autumn)\/q(\d{2})$/;
const STAMP_RE = /^\d{8}-\d{4}(?:\d{2})?$/;

export function isQuestionId(id: unknown): id is string {
  return typeof id === "string" && QUESTION_ID_RE.test(id);
}

export function parseQuestionId(id: string) {
  const m = QUESTION_ID_RE.exec(id);
  if (!m) return null;
  return { year: Number(m[1]), season: m[2] as "spring" | "autumn", number: Number(m[3]) };
}

export function questionPath(id: string): string {
  if (!isQuestionId(id)) throw new Error(`invalid question id: ${id}`);
  return `questions/${id}.md`;
}

/** answered_at (ISO8601) を JST の YYYYMMDD-HHmm に変換 */
export function stampFromIso(iso: string, withSeconds = false): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`invalid date: ${iso}`);
  const d = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const base = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  return withSeconds ? base + p(d.getUTCSeconds()) : base;
}

export function answerPath(id: string, stamp: string): string {
  if (!isQuestionId(id) || !STAMP_RE.test(stamp)) throw new Error("invalid answer path");
  return `answers/${id}/${stamp}.json`;
}

/** answers/<id>/<stamp>.json → results/<id>/<stamp>.json */
export function resultPathFor(answerFile: string): string | null {
  const m = /^answers\/(\d{4}-(?:spring|autumn)\/q\d{2})\/(\d{8}-\d{4,6})\.json$/.exec(answerFile);
  return m ? `results/${m[1]}/${m[2]}.json` : null;
}

/** 現在時刻を +09:00 付き ISO8601 で */
export function nowJstIso(date = new Date()): string {
  const d = new Date(date.getTime() + 9 * 3600 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, "+09:00");
}
