import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { describe, expect, it } from "vitest";
import { authenticate } from "../functions/api/_lib/auth";
import { buildHistory, buildQuestionList, buildResults } from "../functions/api/_lib/data";
import type { Env } from "../functions/api/_lib/env";

const env: Env = {
  GITHUB_TOKEN: "t",
  DATA_REPO: "me/data",
  ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
  ACCESS_AUD: "aud123",
  ALLOWED_EMAIL: "Me@Example.com",
};

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? `https://${env.ACCESS_TEAM_DOMAIN}`)
      .setAudience(opts.aud ?? env.ACCESS_AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "1h")
      .sign(privateKey);
  return { keys, sign };
}

const req = (token?: string, url = "https://ap.example.com/api/questions") =>
  new Request(url, { headers: token ? { "cf-access-jwt-assertion": token } : {} });

describe("authenticate", () => {
  it("accepts a valid token for the allowed email (case-insensitive)", async () => {
    const { keys, sign } = await setup();
    const r = await authenticate(req(await sign({ email: "me@example.com" })), env, keys);
    expect(r).toEqual({ ok: true, email: "me@example.com" });
  });

  it("returns 401 without a token", async () => {
    const { keys } = await setup();
    expect(await authenticate(req(), env, keys)).toMatchObject({ ok: false, status: 401 });
  });

  it("returns 401 for wrong audience, issuer, or expired token", async () => {
    const { keys, sign } = await setup();
    for (const opts of [{ aud: "other" }, { iss: "https://evil.example.com" }, { exp: "-1m" }]) {
      const r = await authenticate(req(await sign({ email: "me@example.com" }, opts)), env, keys);
      expect(r).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("returns 401 for a token signed by another key", async () => {
    const { keys } = await setup();
    const other = await setup();
    const r = await authenticate(req(await other.sign({ email: "me@example.com" })), env, keys);
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("returns 403 for another email", async () => {
    const { keys, sign } = await setup();
    const r = await authenticate(req(await sign({ email: "someone@example.com" })), env, keys);
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("only bypasses on localhost when DEV_BYPASS_AUTH is set", async () => {
    const dev = { ...env, DEV_BYPASS_AUTH: "true" };
    expect(await authenticate(req(undefined, "http://localhost:8788/api/x"), dev)).toMatchObject({ ok: true });
    const { keys } = await setup();
    expect(await authenticate(req(undefined, "https://ap.example.com/api/x"), dev, keys)).toMatchObject({
      ok: false,
      status: 401,
    });
  });
});

describe("data shaping", () => {
  const qmd = `---\nyear: 2024\nseason: spring\nnumber: 3\nfield: アルゴリズム\n---\n## 本文\nx\n## 設問\n- id: "1"\n  text: t\n  type: fill\n`;
  const result = (total: number) =>
    JSON.stringify({ question: "2024-spring/q03", answer_file: "", total, max: 50, items: [] });

  it("builds the question list with graded marks and attempts", () => {
    const { items, errors } = buildQuestionList(
      [
        { path: "questions/2024-spring/q03.md", text: qmd },
        { path: "questions/2024-spring/q04.md", text: "---\nfield: [\n---" },
        { path: "questions/2024-spring/img/fig.png" },
      ],
      [{ path: "answers/2024-spring/q03/20261018-2330.json" }, { path: "answers/2024-spring/q03/20261019-0800.json" }],
      [{ path: "results/2024-spring/q03/20261018-2330.json" }],
      JSON.stringify({ questions: { "2024-spring/q03": { attempts: 1, best: 40, max: 50 } } }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "2024-spring/q03", graded: true, attempts: 2, best: { total: 40, max: 50 } });
    expect(errors).toHaveLength(1);
  });

  it("pairs result json with markdown comments, newest first", () => {
    const r = buildResults([
      { path: "results/2024-spring/q03/20261018-2330.json", text: result(30) },
      { path: "results/2024-spring/q03/20261018-2330.md", text: "# comment" },
      { path: "results/2024-spring/q03/20261019-0800.json", text: result(40) },
      { path: "results/2024-spring/q03/broken.json", text: "{" },
    ]);
    expect(r.map((e) => e.result.total)).toEqual([40, 30]);
    expect(r[1].comment_md).toBe("# comment");
  });

  it("builds history with scores", () => {
    const h = buildHistory(
      [
        { path: "answers/2024-spring/q03/20261018-2330.json", text: JSON.stringify({ answered_at: "2026-10-18T23:30:00+09:00" }) },
        { path: "answers/2024-spring/q03/20261019-0800.json", text: JSON.stringify({ answered_at: "2026-10-19T08:00:00+09:00" }) },
      ],
      [{ path: "results/2024-spring/q03/20261018-2330.json", text: result(30) }],
    );
    expect(h[0]).toMatchObject({ answered_at: "2026-10-19T08:00:00+09:00", total: undefined });
    expect(h[1]).toMatchObject({ total: 30, max: 50, result_file: "results/2024-spring/q03/20261018-2330.json" });
  });
});
