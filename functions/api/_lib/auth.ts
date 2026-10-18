import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";

const jwksCache = new Map<string, JWTVerifyGetKey>();

function jwks(teamDomain: string): JWTVerifyGetKey {
  let set = jwksCache.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, set);
  }
  return set;
}

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 500; message: string };

function isLocalhost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

export function emailAllowed(email: unknown, allowed: string): boolean {
  return typeof email === "string" && !!allowed && email.trim().toLowerCase() === allowed.trim().toLowerCase();
}

/**
 * Cloudflare Access の JWT (Cf-Access-Jwt-Assertion) を検証する。
 * Access をすり抜けた直アクセス対策として、署名・発行者・AUD・メールを確認。
 */
export async function authenticate(request: Request, env: Env, getKey?: JWTVerifyGetKey): Promise<AuthResult> {
  const url = new URL(request.url);
  if (env.DEV_BYPASS_AUTH === "true" && isLocalhost(url)) {
    return { ok: true, email: env.ALLOWED_EMAIL || "dev@localhost" };
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALLOWED_EMAIL) {
    return { ok: false, status: 500, message: "server auth is not configured" };
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return { ok: false, status: 401, message: "missing access token" };

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getKey ?? jwks(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    }));
  } catch {
    return { ok: false, status: 401, message: "invalid access token" };
  }
  if (!emailAllowed(payload.email, env.ALLOWED_EMAIL)) {
    return { ok: false, status: 403, message: "forbidden" };
  }
  return { ok: true, email: String(payload.email) };
}
