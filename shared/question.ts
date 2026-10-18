import { parse as parseYaml } from "yaml";
import type { Question, QuestionMeta, SubQuestion, SubQuestionType } from "./types";
import { parseQuestionId } from "./ids";

const TYPES: SubQuestionType[] = ["fill", "short", "numeric"];

function splitFrontmatter(md: string): { fm: Record<string, unknown>; rest: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { fm: {}, rest: md };
  const fm = parseYaml(m[1]);
  return { fm: fm && typeof fm === "object" ? (fm as Record<string, unknown>) : {}, rest: md.slice(m[0].length) };
}

/** "## 見出し" 単位に分割 */
function splitSections(md: string): Map<string, string> {
  const sections = new Map<string, string>();
  const re = /^##[ \t]+(.+?)[ \t]*$/gm;
  const heads: { name: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) heads.push({ name: m[1], start: m.index, end: re.lastIndex });
  heads.forEach((h, i) => {
    const next = heads[i + 1]?.start ?? md.length;
    sections.set(h.name, md.slice(h.end, next).trim());
  });
  return sections;
}

function stripFence(s: string): string {
  const m = /^```(?:ya?ml)?\r?\n([\s\S]*?)\r?\n```\s*$/.exec(s.trim());
  return m ? m[1] : s;
}

function toSubQuestion(raw: unknown, idx: number): SubQuestion {
  if (!raw || typeof raw !== "object") throw new Error(`設問 #${idx + 1} の形式が不正です`);
  const r = raw as Record<string, unknown>;
  const id = r.id == null ? "" : String(r.id);
  if (!id) throw new Error(`設問 #${idx + 1} に id がありません`);
  const type = (TYPES as string[]).includes(String(r.type)) ? (r.type as SubQuestionType) : "short";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    id,
    text: r.text == null ? "" : String(r.text),
    type,
    limit: num(r.limit),
    points: num(r.points),
    answer: r.answer == null ? undefined : String(r.answer),
    alt_answers: Array.isArray(r.alt_answers) ? r.alt_answers.map(String) : undefined,
    notes: r.notes == null ? undefined : String(r.notes),
  };
}

export function parseQuestion(id: string, md: string): Question {
  const { fm, rest } = splitFrontmatter(md);
  const idParts = parseQuestionId(id);
  if (!idParts) throw new Error(`invalid question id: ${id}`);
  const sections = splitSections(rest);
  const subRaw = sections.get("設問");
  const list = subRaw ? parseYaml(stripFence(subRaw)) : [];
  if (!Array.isArray(list)) throw new Error("「## 設問」は YAML のリストで書いてください");
  const meta: QuestionMeta = {
    id,
    year: typeof fm.year === "number" ? fm.year : idParts.year,
    season: fm.season === "autumn" || fm.season === "spring" ? fm.season : idParts.season,
    number: typeof fm.number === "number" ? fm.number : idParts.number,
    field: typeof fm.field === "string" ? fm.field : "未分類",
    title: typeof fm.title === "string" ? fm.title : undefined,
    source: typeof fm.source === "string" ? fm.source : undefined,
  };
  return { ...meta, body: sections.get("本文") ?? "", subquestions: list.map(toSubQuestion) };
}

export function stripAnswers(q: Question): Question {
  return {
    ...q,
    subquestions: q.subquestions.map(({ answer: _a, alt_answers: _b, notes: _c, ...rest }) => rest),
  };
}

export function seasonLabel(season: string): string {
  return season === "spring" ? "春期" : season === "autumn" ? "秋期" : season;
}

/** 出典表示用: 「令和6年度 春期 午後 問3」 (2019年春期は平成31年度) */
export function sourceLabel(q: Pick<QuestionMeta, "year" | "season" | "number" | "source">): string {
  if (q.source) return q.source;
  const heisei = q.year < 2019 || (q.year === 2019 && q.season === "spring");
  const n = heisei ? q.year - 1988 : q.year - 2018;
  const era = heisei ? `平成${n}年度` : `令和${n === 1 ? "元" : n}年度`;
  return `${era} ${seasonLabel(q.season)} 午後 問${q.number}`;
}
