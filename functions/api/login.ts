import type { Fn } from "./_lib/env";

// GET /api/login?return=/path
// Service Worker を経由しない URL として用意。Access の再ログイン後にアプリへ戻す
export const onRequestGet: Fn = async ({ request }) => {
  const ret = new URL(request.url).searchParams.get("return") ?? "/";
  const safe = ret.startsWith("/") && !ret.startsWith("//") && !ret.startsWith("/\\") ? ret : "/";
  return new Response(null, { status: 302, headers: { location: safe, "cache-control": "no-store" } });
};
