import { api, ApiError, AuthRequiredError, NetworkError } from "./api";
import { outbox } from "./db";
import { getStatus, setStatus } from "./status";

let running: Promise<void> | null = null;

export async function refreshPending() {
  setStatus({ pending: await outbox.count() });
}

/** 送信待ちキューを古い順に送る。認証切れ・通信不可なら中断して次の機会に再送 */
export function flushOutbox(): Promise<void> {
  running ??= (async () => {
    setStatus({ syncing: true });
    try {
      const items = (await outbox.all()).sort((a, b) => a.created_at - b.created_at);
      for (const item of items) {
        try {
          const r = await api.submit(item.payload);
          await outbox.markSent(item.client_id, r.path);
        } catch (e) {
          if (e instanceof AuthRequiredError || e instanceof NetworkError) break;
          // 4xx は再送しても通らないのでエラーとして残す (消さない)
          await outbox.markError(item.client_id, e instanceof ApiError ? e.message : String(e));
        }
      }
    } finally {
      await refreshPending();
      setStatus({ syncing: false });
      running = null;
    }
  })();
  return running;
}

export function startOutboxSync() {
  void flushOutbox();
  window.addEventListener("online", () => {
    setStatus({ online: true });
    void flushOutbox();
  });
  window.addEventListener("offline", () => setStatus({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getStatus().pending > 0) void flushOutbox();
  });
  // 取りこぼし対策の定期再送
  setInterval(() => {
    if (getStatus().pending > 0 && navigator.onLine) void flushOutbox();
  }, 60_000);
}
