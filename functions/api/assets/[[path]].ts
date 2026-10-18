import type { Fn } from "../_lib/env";
import { readRaw } from "../_lib/github";
import { error } from "../_lib/http";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// GET /api/assets/<path>  questions/ 配下の画像だけを返す (問題文の図表用)
export const onRequestGet: Fn = async ({ params, env }) => {
  const segs = Array.isArray(params.path) ? params.path : [params.path];
  if (!segs.length || segs.some((s) => !s || s === "." || s === ".." || !/^[\w.\-]+$/.test(s))) {
    return error(400, "invalid path");
  }
  const ext = segs[segs.length - 1].split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return error(400, "unsupported file type");
  const res = await readRaw(env, `questions/${segs.join("/")}`);
  if (!res) return error(404, "not found");
  return new Response(res.body, {
    headers: {
      "content-type": type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      // SVG 内スクリプト対策
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
};
