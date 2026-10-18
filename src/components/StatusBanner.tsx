import { relogin } from "../lib/api";
import { useStatus } from "../lib/status";

export function StatusBanner() {
  const s = useStatus();
  if (s.authRequired) {
    return (
      <div className="banner banner-warn" role="alert">
        <span>
          ログインの有効期限が切れました。解答は端末に保存されています。再ログインしてください
          {s.pending > 0 && `(送信待ち ${s.pending} 件はログイン後に自動送信)`}
        </span>
        <button onClick={relogin}>再ログイン</button>
      </div>
    );
  }
  if (!s.online) {
    return (
      <div className="banner banner-offline" role="status">
        オフラインです。解答は端末に保存され、{s.pending > 0 ? `送信待ち ${s.pending} 件は` : ""}
        オンライン復帰時に自動で送信されます
      </div>
    );
  }
  if (s.pending > 0) {
    return (
      <div className="banner banner-info" role="status">
        {s.syncing ? "送信中…" : `送信待ち ${s.pending} 件`}
      </div>
    );
  }
  return null;
}
