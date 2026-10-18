import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StatsSummary } from "../../shared/types";
import { formatDateTime, questionHref } from "../components/common";
import { api } from "../lib/api";

function Bar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="bar" aria-label={`${pct}%`}>
      <div className="bar-track">
        <div className={`bar-fill ${pct >= 60 ? "pass" : "fail"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

export function Stats() {
  const [s, setS] = useState<StatsSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api
      .stats()
      .then(setS)
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div className="page">集計を取得できませんでした({err})</div>;
  if (!s) return <div className="page muted">読み込み中…</div>;
  const fields = Object.entries(s.fields ?? {}).sort((a, b) => (a[1].rate ?? 0) - (b[1].rate ?? 0));
  const questions = Object.entries(s.questions ?? {}).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="page">
      <h1>分野別集計</h1>
      {s.updated_at && <p className="muted">更新: {formatDateTime(s.updated_at)}</p>}
      {fields.length === 0 ? (
        <p className="muted">まだ採点データがありません。</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>分野</th>
              <th>解答数</th>
              <th>得点</th>
              <th>正答率</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([name, f]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{f.attempts}</td>
                <td>
                  {f.score}/{f.max}
                </td>
                <td>
                  <Bar rate={f.rate ?? (f.max ? f.score / f.max : 0)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {questions.length > 0 && (
        <>
          <h2>問題別</h2>
          <table className="table">
            <thead>
              <tr>
                <th>問題</th>
                <th>分野</th>
                <th>回数</th>
                <th>最高</th>
                <th>直近</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(([id, q]) => (
                <tr key={id}>
                  <td>
                    <Link to={questionHref(id)}>{id}</Link>
                  </td>
                  <td>{q.field}</td>
                  <td>{q.attempts}</td>
                  <td>{q.best != null ? `${q.best}/${q.max ?? "?"}` : "-"}</td>
                  <td>{q.latest != null ? `${q.latest}/${q.max ?? "?"}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
