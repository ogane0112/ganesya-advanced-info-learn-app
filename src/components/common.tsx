import { sourceLabel } from "../../shared/question";
import type { QuestionMeta, Verdict } from "../../shared/types";

export function Source({ q }: { q: Pick<QuestionMeta, "year" | "season" | "number" | "source"> }) {
  return <span className="source">出典: {q.source ?? `IPA 応用情報技術者試験 ${sourceLabel(q)}`}</span>;
}

const VERDICT: Record<Verdict, string> = { correct: "正解", partial: "部分点", wrong: "不正解" };

export function VerdictBadge({ v }: { v: Verdict }) {
  return <span className={`badge badge-${v}`}>{VERDICT[v] ?? v}</span>;
}

export function Score({ total, max }: { total: number; max: number }) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <span className={`score ${pct >= 60 ? "score-pass" : "score-fail"}`}>
      {total}/{max}
      <small> ({pct}%)</small>
    </span>
  );
}

/** "2024-spring/q03" → "/q/2024-spring/q03" */
export function questionHref(id: string, suffix = "") {
  return `/q/${id}${suffix}`;
}

export function resultHref(id: string, answerFile?: string) {
  return questionHref(id, "/results") + (answerFile ? `?answer=${encodeURIComponent(answerFile)}` : "");
}

export function formatDateTime(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}

export function formatElapsed(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
