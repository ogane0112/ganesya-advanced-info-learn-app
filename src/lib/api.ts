import { setStatus } from "./status";
import type {
  AnswerPayload,
  HistoryEntry,
  Question,
  QuestionListItem,
  ResultEntry,
  StatsSummary,
} from "../../shared/types";

/** Access セッション切れ (401/403、ログインページへのリダイレクト、HTML 応答) */
export class AuthRequiredError extends Error {}
/** 通信不可 */
export class NetworkError extends Error {}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // redirect: manual にしないと、Access のログインページへのリダイレクトが
    // CORS エラーになり通信不可と区別できない
    res = await fetch(path, { ...init, credentials: "same-origin", redirect: "manual", cache: "no-store" });
  } catch (e) {
    setStatus({ online: false });
    throw new NetworkError((e as Error).message);
  }
  setStatus({ online: true });
  const type = res.headers.get("content-type") ?? "";
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403 || (res.ok && !type.includes("json"))) {
    setStatus({ authRequired: true });
    throw new AuthRequiredError(`auth required (${res.status})`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`);
  setStatus({ authRequired: false });
  return body as T;
}

const enc = (id: string) => id.split("/").map(encodeURIComponent).join("/");

export const api = {
  questions: () => request<{ items: QuestionListItem[]; errors: string[] }>("/api/questions"),
  question: (id: string, reveal = false) => request<Question>(`/api/questions/${enc(id)}${reveal ? "?reveal=1" : ""}`),
  results: (id: string) => request<{ items: ResultEntry[] }>(`/api/results?question=${encodeURIComponent(id)}`),
  history: () => request<{ items: HistoryEntry[] }>("/api/history"),
  stats: () => request<StatsSummary>("/api/stats"),
  submit: (payload: AnswerPayload) =>
    request<{ path: string; status: "created" | "exists" }>("/api/answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

/** Service Worker を通らない /api/login を経由して Access の再ログインを起こす */
export function relogin() {
  const back = location.pathname + location.search;
  location.href = `/api/login?return=${encodeURIComponent(back)}`;
}
