// GitHub から読んだファイル群を API レスポンスへ整形する純粋関数群
import { parseQuestion } from "../../../shared/question";
import { isQuestionId, resultPathFor } from "../../../shared/ids";
import type {
  AnswerPayload,
  GradeResult,
  HistoryEntry,
  QuestionListItem,
  ResultEntry,
  StatsSummary,
} from "../../../shared/types";
import type { RepoFile } from "./github";

function safeJson<T>(text: string | undefined): T | undefined {
  if (text == null) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** questions/2024-spring/q03.md → 2024-spring/q03 */
export function questionIdFromPath(path: string): string | null {
  const m = /^questions\/(\d{4}-(?:spring|autumn)\/q\d{2})\.md$/.exec(path);
  return m && isQuestionId(m[1]) ? m[1] : null;
}

/** answers|results/<id>/<stamp>.<ext> → id */
function idOfAttempt(path: string, root: "answers" | "results", ext: string): string | null {
  const m = new RegExp(`^${root}/(\\d{4}-(?:spring|autumn)/q\\d{2})/\\d{8}-\\d{4,6}\\.${ext}$`).exec(path);
  return m ? m[1] : null;
}

export function buildQuestionList(
  questionFiles: RepoFile[],
  answerFiles: RepoFile[],
  resultFiles: RepoFile[],
  statsText: string | undefined,
): { items: QuestionListItem[]; errors: string[] } {
  const stats = safeJson<StatsSummary>(statsText);
  const attempts = new Map<string, number>();
  for (const f of answerFiles) {
    const id = idOfAttempt(f.path, "answers", "json");
    if (id) attempts.set(id, (attempts.get(id) ?? 0) + 1);
  }
  const graded = new Set(resultFiles.map((f) => idOfAttempt(f.path, "results", "json")).filter(Boolean));
  const items: QuestionListItem[] = [];
  const errors: string[] = [];
  for (const f of questionFiles) {
    const id = questionIdFromPath(f.path);
    if (!id || f.text == null) continue;
    try {
      const { body: _b, subquestions: _s, ...meta } = parseQuestion(id, f.text);
      const s = stats?.questions?.[id];
      items.push({
        ...meta,
        graded: graded.has(id),
        attempts: attempts.get(id) ?? 0,
        best: s?.best != null && s.max != null ? { total: s.best, max: s.max } : undefined,
      });
    } catch (e) {
      errors.push(`${f.path}: ${(e as Error).message}`);
    }
  }
  items.sort((a, b) => b.year - a.year || (a.season === b.season ? 0 : a.season === "autumn" ? -1 : 1) || a.number - b.number);
  return { items, errors };
}

export function buildResults(files: RepoFile[]): ResultEntry[] {
  const md = new Map(files.filter((f) => f.path.endsWith(".md")).map((f) => [f.path.replace(/\.md$/, ".json"), f.text]));
  const out: ResultEntry[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".json")) continue;
    const result = safeJson<GradeResult>(f.text);
    if (!result || !Array.isArray(result.items)) continue;
    out.push({ path: f.path, result, comment_md: md.get(f.path) });
  }
  return out.sort((a, b) => b.path.localeCompare(a.path));
}

export function buildHistory(answerFiles: RepoFile[], resultFiles: RepoFile[]): HistoryEntry[] {
  const results = new Map(resultFiles.filter((f) => f.path.endsWith(".json")).map((f) => [f.path, f.text]));
  const out: HistoryEntry[] = [];
  for (const f of answerFiles) {
    const id = idOfAttempt(f.path, "answers", "json");
    if (!id) continue;
    const ans = safeJson<AnswerPayload>(f.text);
    const rp = resultPathFor(f.path);
    const res = rp ? safeJson<GradeResult>(results.get(rp)) : undefined;
    out.push({
      question: id,
      answer_file: f.path,
      answered_at: ans?.answered_at ?? "",
      result_file: res && rp ? rp : undefined,
      total: res?.total,
      max: res?.max,
    });
  }
  return out.sort((a, b) => b.answered_at.localeCompare(a.answered_at) || b.answer_file.localeCompare(a.answer_file));
}
