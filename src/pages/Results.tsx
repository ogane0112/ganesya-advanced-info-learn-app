import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resultPathFor } from "../../shared/ids";
import { sourceLabel } from "../../shared/question";
import type { ResultEntry, SubQuestion } from "../../shared/types";
import { formatDateTime, questionHref, Score, Source, VerdictBadge } from "../components/common";
import { Markdown } from "../components/Markdown";
import { api, AuthRequiredError, NetworkError } from "../lib/api";
import { cache, submissions, type Submission } from "../lib/db";
import { useStatus } from "../lib/status";
import { useQuestion } from "../lib/useQuestion";

const POLL_MS = 30_000;

function stampOf(path: string) {
  const m = /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})?\.json$/.exec(path);
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}` : path;
}

function ResultDetail({
  entry,
  subs,
  answers,
}: {
  entry: ResultEntry;
  subs: Map<string, SubQuestion>;
  answers?: Record<string, string>;
}) {
  const r = entry.result;
  return (
    <div className="result">
      <div className="result-head">
        <Score total={r.total} max={r.max} />
        <span className="muted">{stampOf(entry.path)} の解答</span>
      </div>
      {r.items.map((it) => {
        const sq = subs.get(it.id);
        return (
          <div key={it.id} className={`ritem ritem-${it.verdict}`}>
            <div className="ritem-head">
              <span className="sq-id">設問{it.id}</span>
              <VerdictBadge v={it.verdict} />
              <span className="ritem-score">
                {it.score}/{it.max}
              </span>
            </div>
            {answers?.[it.id] != null && (
              <div className="kv">
                <span>あなたの解答</span>
                <p className="mine">{answers[it.id] || "(未解答)"}</p>
              </div>
            )}
            {sq?.answer && (
              <div className="kv">
                <span>解答例</span>
                <p>
                  {sq.answer}
                  {sq.alt_answers?.length ? ` (別解: ${sq.alt_answers.join(" / ")})` : ""}
                </p>
              </div>
            )}
            {!!it.matched_points?.length && (
              <div className="kv">
                <span>押さえた論点</span>
                <ul>
                  {it.matched_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!it.missing_points?.length && (
              <div className="kv">
                <span>足りない論点</span>
                <ul>
                  {it.missing_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {it.feedback && (
              <div className="kv">
                <span>添削</span>
                <p>{it.feedback}</p>
              </div>
            )}
            {it.improved_answer && (
              <div className="kv">
                <span>改善例</span>
                <p className="improved">{it.improved_answer}</p>
              </div>
            )}
          </div>
        );
      })}
      {entry.comment_md && (
        <details className="comment">
          <summary>添削コメント全文</summary>
          <Markdown text={entry.comment_md} />
        </details>
      )}
    </div>
  );
}

export function Results({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const clientId = params.get("client");
  const answerParam = params.get("answer");
  const { question } = useQuestion(id, true);
  const status = useStatus();
  const [items, setItems] = useState<ResultEntry[] | null>(null);
  const [mine, setMine] = useState<Submission[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  // 端末の提出記録 (送信待ち → 送信済みの path が入る)
  useEffect(() => {
    void submissions.byQuestion(id).then(setMine);
  }, [id, status.pending, tick]);

  const target = useMemo(() => {
    const sub = clientId ? mine.find((s) => s.client_id === clientId) : undefined;
    return { sub, answerFile: answerParam ?? sub?.path };
  }, [mine, clientId, answerParam]);
  const targetResult = target.answerFile ? resultPathFor(target.answerFile) : null;
  const found = items?.find((e) => e.path === targetResult);
  const waiting = !!(clientId || answerParam) && !found;

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await cache.getResults(id);
      if (cached && alive) setItems((v) => v ?? cached);
      try {
        const r = await api.results(id);
        if (!alive) return;
        setItems(r.items);
        setLastChecked(new Date());
        await cache.setResults(id, r.items);
      } catch (e) {
        if (!(e instanceof AuthRequiredError || e instanceof NetworkError)) console.error(e);
        if (alive && !cached) setItems((v) => v ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, tick]);

  // 採点待ちの間だけ 30 秒ごとにポーリング
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, [waiting]);

  const subs = useMemo(() => new Map(question?.subquestions.map((s) => [s.id, s])), [question]);
  const answersFor = (path: string) =>
    mine.find((s) => s.path && resultPathFor(s.path) === path)?.payload.answers;

  const selected = found ?? (clientId || answerParam ? undefined : items?.[0]);

  return (
    <div className="page">
      <div className="page-head">
        <Link to={questionHref(id)} className="back">
          ← 問題へ
        </Link>
        <h1>採点結果</h1>
      </div>
      <p className="muted">
        {question ? `${sourceLabel(question)} ${question.field}` : id} {question && <Source q={question} />}
      </p>

      {waiting && (
        <div className="waiting">
          {target.sub && !target.sub.path ? (
            <p>
              解答は端末に保存済みで、送信待ちです。
              {status.authRequired ? "再ログイン後に送信されます。" : !status.online ? "オンラインになると送信されます。" : "送信中…"}
            </p>
          ) : (
            <p>
              採点中です。結果が届くまで {POLL_MS / 1000} 秒ごとに確認します
              {lastChecked && `(最終確認 ${lastChecked.toLocaleTimeString("ja-JP")})`}。
            </p>
          )}
          <button className="secondary" onClick={() => setTick((n) => n + 1)}>
            今すぐ確認
          </button>
        </div>
      )}

      {selected && (
        <ResultDetail entry={selected} subs={subs} answers={answersFor(selected.path)} />
      )}

      {items && items.length > 0 && (
        <>
          <h2>これまでの採点</h2>
          <ul className="rlist">
            {items.map((e) => (
              <li key={e.path} className={e === selected ? "active" : ""}>
                <button
                  className="linklike"
                  onClick={() => setParams({ answer: e.result.answer_file || e.path.replace(/^results/, "answers") })}
                >
                  {stampOf(e.path)}
                </button>
                <Score total={e.result.total} max={e.result.max} />
              </li>
            ))}
          </ul>
        </>
      )}
      {items && items.length === 0 && !waiting && <p className="muted">まだ採点結果がありません。</p>}
      {mine.some((s) => !s.path) && !waiting && (
        <p className="note">
          送信待ちの解答があります({mine.filter((s) => !s.path).map((s) => formatDateTime(s.payload.answered_at)).join(", ")})。
        </p>
      )}
    </div>
  );
}
