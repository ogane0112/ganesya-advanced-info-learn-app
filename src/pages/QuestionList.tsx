import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { seasonLabel, sourceLabel } from "../../shared/question";
import type { QuestionListItem } from "../../shared/types";
import { questionHref } from "../components/common";
import { api, AuthRequiredError, NetworkError } from "../lib/api";
import { cache, drafts } from "../lib/db";

/** 一覧取得後、未キャッシュの問題本文を順次取得してオフラインでも解けるようにする */
async function prefetch(items: QuestionListItem[]) {
  const have = await cache.cachedQuestionIds();
  for (const it of items) {
    if (have.has(it.id)) continue;
    try {
      await cache.setQuestion(await api.question(it.id));
    } catch (e) {
      if (e instanceof AuthRequiredError || e instanceof NetworkError) return;
    }
  }
}

export function QuestionList() {
  const [items, setItems] = useState<QuestionListItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [year, setYear] = useState("");
  const [season, setSeason] = useState("");
  const [field, setField] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await cache.getList();
      if (cached && alive) setItems(cached);
      setDraftIds(await drafts.ids());
      try {
        const r = await api.questions();
        if (!alive) return;
        setItems(r.items);
        setErrors(r.errors);
        setOffline(false);
        await cache.setList(r.items);
        void prefetch(r.items);
      } catch {
        if (alive) setOffline(true);
        if (!cached && alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const years = useMemo(() => [...new Set(items?.map((i) => i.year))].sort((a, b) => b - a), [items]);
  const fields = useMemo(() => [...new Set(items?.map((i) => i.field))].sort(), [items]);
  const shown = (items ?? []).filter(
    (i) => (!year || String(i.year) === year) && (!season || i.season === season) && (!field || i.field === field),
  );

  return (
    <div className="page">
      <h1>問題一覧</h1>
      <div className="filters">
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="年度">
          <option value="">すべての年度</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="期">
          <option value="">春期・秋期</option>
          <option value="spring">春期</option>
          <option value="autumn">秋期</option>
        </select>
        <select value={field} onChange={(e) => setField(e.target.value)} aria-label="分野">
          <option value="">すべての分野</option>
          {fields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      {offline && <p className="note">オフラインのため、端末に保存済みの一覧を表示しています。</p>}
      {errors.length > 0 && (
        <details className="note note-error">
          <summary>読み込めなかった問題ファイルがあります ({errors.length})</summary>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
      {items == null ? (
        <p className="muted">読み込み中…</p>
      ) : shown.length === 0 ? (
        <p className="muted">問題がありません。</p>
      ) : (
        <ul className="qlist">
          {shown.map((q) => (
            <li key={q.id}>
              <Link to={questionHref(q.id)} className="qcard">
                <div className="qcard-head">
                  <span className="qno">問{q.number}</span>
                  <span className="field">{q.field}</span>
                  {q.number === 1 && <span className="tag">必須</span>}
                </div>
                <div className="qcard-title">{q.title ?? sourceLabel(q)}</div>
                <div className="qcard-meta">
                  <span>
                    {q.year}年 {seasonLabel(q.season)}
                  </span>
                  {q.graded && <span className="mark-graded">✓ 採点済み</span>}
                  {q.attempts > 0 && <span>解答 {q.attempts} 回</span>}
                  {q.best && (
                    <span>
                      最高 {q.best.total}/{q.best.max}
                    </span>
                  )}
                  {draftIds.has(q.id) && <span className="mark-draft">書きかけ</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
