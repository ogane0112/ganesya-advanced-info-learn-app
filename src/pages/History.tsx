import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HistoryEntry } from "../../shared/types";
import { formatDateTime, resultHref, Score } from "../components/common";
import { api } from "../lib/api";
import { outbox, type OutboxItem } from "../lib/db";
import { useStatus } from "../lib/status";

export function History() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const status = useStatus();

  useEffect(() => {
    void outbox.all().then(setPending);
  }, [status.pending]);

  useEffect(() => {
    api
      .history()
      .then((r) => setItems(r.items))
      .catch((e) => setErr((e as Error).message));
  }, [status.pending]);

  return (
    <div className="page">
      <h1>履歴</h1>
      {pending.length > 0 && (
        <>
          <h2>送信待ち</h2>
          <ul className="hlist">
            {pending.map((p) => (
              <li key={p.client_id}>
                <Link to={resultHref(p.payload.question) + `?client=${encodeURIComponent(p.client_id)}`}>
                  {p.payload.question}
                </Link>
                <span>{formatDateTime(p.payload.answered_at)}</span>
                <span className={p.last_error ? "error" : "muted"}>{p.last_error ? `エラー: ${p.last_error}` : "送信待ち"}</span>
                {p.last_error && (
                  <button
                    className="secondary small"
                    onClick={async () => {
                      if (!confirm("この解答を送信待ちから削除しますか?")) return;
                      await outbox.remove(p.client_id);
                      setPending(await outbox.all());
                    }}
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {err && !items && <p className="note">履歴を取得できませんでした({err})</p>}
      {items == null ? (
        !err && <p className="muted">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="muted">まだ解答がありません。</p>
      ) : (
        <ul className="hlist">
          {items.map((h) => (
            <li key={h.answer_file}>
              <Link to={resultHref(h.question, h.answer_file)}>{h.question}</Link>
              <span>{formatDateTime(h.answered_at)}</span>
              {h.total != null && h.max != null ? <Score total={h.total} max={h.max} /> : <span className="muted">採点待ち</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
