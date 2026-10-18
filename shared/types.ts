// アプリ・Functions・データリポジトリで共通のデータ形式 (REQUIREMENTS.md 準拠)

export type Season = "spring" | "autumn";
export type SubQuestionType = "fill" | "short" | "numeric";

export interface SubQuestion {
  id: string;
  text: string;
  type: SubQuestionType;
  limit?: number;
  points?: number;
  /** 以下は採点用。問題取得 API では reveal=1 のときだけ返す */
  answer?: string;
  alt_answers?: string[];
  notes?: string;
}

export interface QuestionMeta {
  /** 例: "2024-spring/q03" */
  id: string;
  year: number;
  season: Season;
  number: number;
  field: string;
  title?: string;
  /** 出典表示の上書き (サンプル問題など) */
  source?: string;
}

export interface Question extends QuestionMeta {
  /** 本文 (Markdown) */
  body: string;
  subquestions: SubQuestion[];
}

export interface QuestionListItem extends QuestionMeta {
  graded: boolean;
  attempts: number;
  best?: { total: number; max: number };
}

export interface AnswerPayload {
  question: string;
  answered_at: string;
  elapsed_sec: number;
  mode: "single" | "exam";
  answers: Record<string, string>;
  /** 再送時の重複 commit 防止用 */
  client_id: string;
}

export type Verdict = "correct" | "partial" | "wrong";

export interface ResultItem {
  id: string;
  score: number;
  max: number;
  verdict: Verdict;
  matched_points?: string[];
  missing_points?: string[];
  feedback?: string;
  improved_answer?: string;
}

export interface GradeResult {
  question: string;
  answer_file: string;
  total: number;
  max: number;
  items: ResultItem[];
}

export interface ResultEntry {
  path: string;
  result: GradeResult;
  /** 添削コメント (results/**.md) */
  comment_md?: string;
}

export interface HistoryEntry {
  question: string;
  answer_file: string;
  answered_at: string;
  result_file?: string;
  total?: number;
  max?: number;
}

export interface StatsSummary {
  updated_at?: string;
  fields?: Record<string, { attempts: number; score: number; max: number; rate?: number }>;
  questions?: Record<
    string,
    { field?: string; attempts: number; best?: number; latest?: number; max?: number }
  >;
}
