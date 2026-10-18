// UI ギャラリー用: window.fetch を差し替えて /api/* に固定データを返す
import type { ApiData, ApiMode } from "./scenarios";
import * as fx from "./fixtures";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export function installMockApi(mode: ApiMode, data: ApiData) {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    if (mode === "loading") return new Promise<Response>(() => {});
    if (mode === "offline") throw new TypeError("Failed to fetch");
    if (mode === "auth") return json({ error: "missing access token" }, 401);

    const p = url.pathname;
    if (p === "/api/questions") return json(data.questions);
    if (p.startsWith("/api/questions/")) {
      const reveal = url.searchParams.get("reveal") === "1";
      const q = fx.question;
      return json(reveal ? q : { ...q, subquestions: q.subquestions.map(({ answer: _a, alt_answers: _b, notes: _c, ...s }) => s) });
    }
    if (p === "/api/results") return json(data.results);
    if (p === "/api/history") return json(data.history);
    if (p === "/api/stats") return json(data.stats);
    if (p === "/api/answers") return json({ path: fx.ANSWER_FILE, status: "created" }, 201);
    return json({ error: "not found" }, 404);
  };
}
