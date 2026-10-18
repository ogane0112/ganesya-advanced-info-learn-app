import type { Fn } from "./_lib/env";
import { readText } from "./_lib/github";
import { json } from "./_lib/http";

// GET /api/stats  stats/summary.json (未作成なら空)
export const onRequestGet: Fn = async ({ env }) => {
  const text = await readText(env, "stats/summary.json");
  let summary = {};
  try {
    summary = text ? JSON.parse(text) : {};
  } catch {
    summary = {};
  }
  return json(summary);
};
