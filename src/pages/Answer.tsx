import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nowJstIso } from "../../shared/ids";
import { sourceLabel } from "../../shared/question";
import { countChars } from "../../shared/text";
import type { SubQuestion } from "../../shared/types";
import { formatElapsed, questionHref, Source } from "../components/common";
import { Markdown } from "../components/Markdown";
import { drafts, enqueueSubmission, type Draft } from "../lib/db";
import { flushOutbox, refreshPending } from "../lib/outbox";
import { useQuestion } from "../lib/useQuestion";

const TYPE_LABEL: Record<SubQuestion["type"], string> = { fill: "穴埋め", short: "記述", numeric: "数値" };

function AnswerField({
  sq,
  value,
  onChange,
}: {
  sq: SubQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = countChars(value);
  const over = sq.limit != null && n > sq.limit;
  const common = {
    id: `ans-${sq.id}`,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    // スクリブル(Apple Pencil 手書き)は標準の input/textarea でそのまま使える
    autoComplete: "off",
    autoCorrect: "off",
    spellCheck: false,
  };
  return (
    <div className={`sq ${over ? "sq-over" : ""}`}>
      <label htmlFor={common.id} className="sq-head">
        <span className="sq-id">設問{sq.id}</span>
        <span className="sq-type">{TYPE_LABEL[sq.type]}</span>
        {sq.points != null && <span className="sq-points">{sq.points}点</span>}
      </label>
      {sq.text && <Markdown text={sq.text} />}
      {sq.type === "short" ? (
        <textarea {...common} rows={Math.min(6, Math.max(2, Math.ceil((sq.limit ?? 40) / 25)))} />
      ) : (
        <input {...common} type="text" inputMode={sq.type === "numeric" ? "decimal" : "text"} />
      )}
      <div className={`counter ${over ? "counter-over" : ""}`}>
        {n}
        {sq.limit != null && ` / ${sq.limit}字`}
        {over && " 字数超過"}
      </div>
    </div>
  );
}

export function Answer({ id }: { id: string }) {
  const { question, error } = useQuestion(id);
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"body" | "answer">("body");
  const [running, setRunning] = useState(true);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;

  useEffect(() => {
    let alive = true;
    drafts.get(id).then((d) => {
      if (!alive) return;
      setDraft(d ?? { question: id, answers: {}, elapsed_sec: 0, client_id: crypto.randomUUID(), updated_at: Date.now() });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // タイマー: 画面が見えている間だけ進める
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setDraft((d) => (d ? { ...d, elapsed_sec: d.elapsed_sec + 1 } : d));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  // 下書きの自動保存 (入力は即時、タイマーは5秒ごと)
  const lastSaved = useRef<string>("");
  useEffect(() => {
    if (!draft) return;
    const key = JSON.stringify(draft.answers);
    const changed = key !== lastSaved.current;
    if (!changed && draft.elapsed_sec % 5 !== 0) return;
    const t = setTimeout(
      () => {
        lastSaved.current = key;
        void drafts.put({ ...draft, updated_at: Date.now() });
      },
      changed ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [draft]);

  // 離脱時にも保存
  useEffect(() => {
    const save = () => {
      if (draftRef.current) void drafts.put({ ...draftRef.current, updated_at: Date.now() });
    };
    document.addEventListener("visibilitychange", save);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", save);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, []);

  const setAnswer = useCallback((sid: string, v: string) => {
    setDraft((d) => (d ? { ...d, answers: { ...d.answers, [sid]: v } } : d));
  }, []);

  const submit = async () => {
    if (!question || !draft) return;
    const empty = question.subquestions.filter((s) => !draft.answers[s.id]?.trim());
    const over = question.subquestions.filter((s) => s.limit != null && countChars(draft.answers[s.id] ?? "") > s.limit);
    const warn = [
      empty.length ? `未解答: ${empty.map((s) => s.id).join(", ")}` : "",
      over.length ? `字数超過: ${over.map((s) => s.id).join(", ")}` : "",
    ].filter(Boolean);
    if (!confirm([...warn, "提出して採点を依頼しますか?"].join("\n"))) return;

    const answers: Record<string, string> = {};
    for (const s of question.subquestions) answers[s.id] = draft.answers[s.id] ?? "";
    const payload = {
      question: id,
      answered_at: nowJstIso(),
      elapsed_sec: draft.elapsed_sec,
      mode: "single" as const,
      answers,
      client_id: draft.client_id,
    };
    draftRef.current = null;
    await enqueueSubmission(payload);
    await refreshPending();
    void flushOutbox();
    navigate(questionHref(id, `/results?client=${encodeURIComponent(payload.client_id)}`));
  };

  const discard = async () => {
    if (!confirm("書きかけの解答とタイマーを消去しますか?")) return;
    await drafts.delete(id);
    lastSaved.current = "";
    setDraft({ question: id, answers: {}, elapsed_sec: 0, client_id: crypto.randomUUID(), updated_at: Date.now() });
  };

  if (error && !question) return <div className="page">問題を読み込めませんでした: {error}</div>;
  if (!question || !draft) return <div className="page muted">読み込み中…</div>;

  const baseDir = id.split("/")[0];
  return (
    <div className="solve" data-tab={tab}>
      <div className="solve-bar">
        <Link to="/" className="back">
          ← 一覧
        </Link>
        <div className="solve-title">
          {sourceLabel(question)} {question.field}
        </div>
        <button className="timer" onClick={() => setRunning((r) => !r)} title="タップで一時停止/再開">
          {running ? "⏱" : "⏸"} {formatElapsed(draft.elapsed_sec)}
        </button>
        <Link to={questionHref(id, "/results")} className="link-btn">
          結果
        </Link>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "body"} onClick={() => setTab("body")}>
          問題文
        </button>
        <button role="tab" aria-selected={tab === "answer"} onClick={() => setTab("answer")}>
          解答
        </button>
      </div>
      <section className="pane pane-body">
        {question.title && <h2>{question.title}</h2>}
        <Markdown text={question.body} baseDir={baseDir} />
        <p>
          <Source q={question} />
        </p>
      </section>
      <section className="pane pane-answer">
        {question.subquestions.map((sq) => (
          <AnswerField key={sq.id} sq={sq} value={draft.answers[sq.id] ?? ""} onChange={(v) => setAnswer(sq.id, v)} />
        ))}
        <div className="actions">
          <button className="secondary" onClick={discard}>
            消去
          </button>
          <button className="primary" onClick={submit}>
            提出して採点
          </button>
        </div>
      </section>
    </div>
  );
}
