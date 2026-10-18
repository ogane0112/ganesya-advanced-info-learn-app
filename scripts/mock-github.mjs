// ローカル開発・E2E 用の GitHub API モック。指定ディレクトリをデータリポジトリとして扱う
// 使い方: node scripts/mock-github.mjs <data-dir> [port=9999]
//   wrangler 側は GITHUB_API_URL=http://localhost:9999 を設定する
// Functions が使う範囲 (GraphQL の object(expression:) 読み取り / Contents API の取得・新規作成) だけを実装
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "data-repo-template");
const port = Number(process.argv[3] ?? 9999);
const TEXT_EXT = /\.(md|json|txt|ya?ml|csv)$/i;

function safe(p) {
  const full = resolve(root, p);
  if (full !== root && !full.startsWith(root + "/")) throw new Error("outside root");
  return full;
}

function entries(dir) {
  return readdirSync(dir)
    .filter((n) => !n.startsWith("."))
    .map((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return { name, type: "tree", object: { entries: entries(p) } };
      return { name, type: "blob", object: { text: TEXT_EXT.test(name) ? readFileSync(p, "utf8") : null } };
    });
}

function readBody(req) {
  return new Promise((ok) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => ok(Buffer.concat(chunks)));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  try {
    if (req.method === "POST" && url.pathname === "/graphql") {
      const { variables } = JSON.parse(String(await readBody(req)));
      const repository = {};
      for (const [k, v] of Object.entries(variables)) {
        if (!/^[tf]\d+$/.test(k)) continue;
        const p = safe(String(v).replace(/^[^:]*:/, ""));
        if (!existsSync(p)) repository[k] = null;
        else if (statSync(p).isDirectory()) repository[k] = k[0] === "t" ? { entries: entries(p) } : null;
        else repository[k] = k[0] === "f" ? { text: readFileSync(p, "utf8") } : {};
      }
      return send(200, { data: { repository } });
    }
    const m = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(url.pathname);
    if (m) {
      const p = safe(decodeURIComponent(m[1]));
      if (req.method === "GET") {
        if (!existsSync(p) || statSync(p).isDirectory()) return send(404, { message: "Not Found" });
        return send(200, readFileSync(p), "application/octet-stream");
      }
      if (req.method === "PUT") {
        const body = JSON.parse(String(await readBody(req)));
        if (existsSync(p)) return send(422, { message: "sha wasn't supplied" });
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, Buffer.from(body.content, "base64"));
        console.log(`commit: ${body.message}`);
        return send(201, { content: { path: m[1] } });
      }
    }
    send(404, { message: "Not Found" });
  } catch (e) {
    send(400, { message: String(e) });
  }
}).listen(port, () => console.log(`mock GitHub on http://localhost:${port} (data: ${root})`));
