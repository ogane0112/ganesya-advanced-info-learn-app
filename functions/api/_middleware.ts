import { authenticate } from "./_lib/auth";
import type { Fn } from "./_lib/env";
import { error, HttpError } from "./_lib/http";

// /api/* すべてで Access JWT を検証し、ハンドラの例外を JSON エラーに変換する
export const onRequest: Fn = async (ctx) => {
  const auth = await authenticate(ctx.request, ctx.env);
  if (!auth.ok) return error(auth.status, auth.message);
  ctx.data.email = auth.email;
  try {
    return await ctx.next();
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message);
    console.error(e);
    return error(500, "internal error");
  }
};
