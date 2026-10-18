import type { Env } from "./env";
import { HttpError } from "./http";

function api(env: Env): string {
  return (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
}

function repoParts(env: Env): { owner: string; name: string } {
  const [owner, name] = (env.DATA_REPO || "").split("/");
  if (!owner || !name) throw new HttpError(500, "DATA_REPO is not configured");
  return { owner, name };
}

function branch(env: Env): string {
  return env.DATA_BRANCH || "main";
}

function headers(env: Env, accept = "application/vnd.github+json"): HeadersInit {
  if (!env.GITHUB_TOKEN) throw new HttpError(500, "GITHUB_TOKEN is not configured");
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept,
    "user-agent": "ap-pm-grader",
    "x-github-api-version": "2022-11-28",
  };
}

async function graphql<T>(env: Env, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${api(env)}/graphql`, {
    method: "POST",
    headers: { ...headers(env), "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new HttpError(502, `GitHub GraphQL ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) {
    throw new HttpError(502, `GitHub GraphQL: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
  }
  return body.data;
}

export interface RepoFile {
  path: string;
  /** テキストを要求したときだけ。バイナリは undefined */
  text?: string;
}

interface GqlEntry {
  name: string;
  type: "blob" | "tree" | "commit";
  object?: { text?: string | null; entries?: GqlEntry[] } | null;
}

function entriesFragment(depth: number, withText: boolean): string {
  const blob = withText ? "... on Blob { text }" : "";
  const sub = depth > 1 ? `... on Tree { ${entriesFragment(depth - 1, withText)} }` : "";
  const object = blob || sub ? ` object { ${blob} ${sub} }` : "";
  return `entries { name type${object} }`;
}

function flatten(prefix: string, entries: GqlEntry[] | undefined, out: RepoFile[]) {
  for (const e of entries ?? []) {
    const path = `${prefix}/${e.name}`;
    if (e.type === "tree") flatten(path, e.object?.entries, out);
    else if (e.type === "blob") out.push({ path, text: e.object?.text ?? undefined });
  }
}

export interface TreeRequest {
  /** リポジトリルートからのディレクトリ (例: "questions") */
  dir: string;
  depth: number;
  withText: boolean;
}

/**
 * 複数ディレクトリ・ファイルを GraphQL 1リクエストでまとめて読む。
 * ディレクトリが存在しなければ空配列。
 */
export async function readTrees(
  env: Env,
  trees: TreeRequest[],
  files: string[] = [],
): Promise<{ trees: RepoFile[][]; files: (string | undefined)[] }> {
  const { owner, name } = repoParts(env);
  const ref = branch(env);
  const vars: Record<string, unknown> = { owner, name };
  const defs = ["$owner: String!", "$name: String!"];
  const parts: string[] = [];
  trees.forEach((t, i) => {
    vars[`t${i}`] = `${ref}:${t.dir}`;
    defs.push(`$t${i}: String!`);
    parts.push(`t${i}: object(expression: $t${i}) { ... on Tree { ${entriesFragment(t.depth, t.withText)} } }`);
  });
  files.forEach((f, i) => {
    vars[`f${i}`] = `${ref}:${f}`;
    defs.push(`$f${i}: String!`);
    parts.push(`f${i}: object(expression: $f${i}) { ... on Blob { text } }`);
  });
  const query = `query(${defs.join(", ")}) { repository(owner: $owner, name: $name) { ${parts.join("\n")} } }`;
  const data = await graphql<{ repository: Record<string, { entries?: GqlEntry[]; text?: string | null } | null> | null }>(
    env,
    query,
    vars,
  );
  const repo = data.repository;
  if (!repo) throw new HttpError(502, "data repository not found");
  return {
    trees: trees.map((t, i) => {
      const out: RepoFile[] = [];
      flatten(t.dir, repo[`t${i}`]?.entries, out);
      return out;
    }),
    files: files.map((_, i) => repo[`f${i}`]?.text ?? undefined),
  };
}

export async function readText(env: Env, path: string): Promise<string | undefined> {
  return (await readTrees(env, [], [path])).files[0];
}

/** バイナリを含む生ファイル取得 (画像など) */
export async function readRaw(env: Env, path: string): Promise<Response | null> {
  const { owner, name } = repoParts(env);
  const url = `${api(env)}/repos/${owner}/${name}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch(env))}`;
  const res = await fetch(url, { headers: headers(env, "application/vnd.github.raw") });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `GitHub ${res.status}`);
  return res;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 新規ファイルとして commit。既に存在すれば "exists" */
export async function createFile(env: Env, path: string, content: string, message: string): Promise<"created" | "exists"> {
  const { owner, name } = repoParts(env);
  const url = `${api(env)}/repos/${owner}/${name}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(env), "content-type": "application/json" },
    body: JSON.stringify({ message, content: utf8ToBase64(content), branch: branch(env) }),
  });
  if (res.status === 201 || res.status === 200) return "created";
  // sha 無しで既存パスに PUT すると 422
  if (res.status === 422) return "exists";
  if (res.status === 409) throw new HttpError(503, "GitHub conflict, retry later");
  throw new HttpError(502, `GitHub ${res.status}`);
}
