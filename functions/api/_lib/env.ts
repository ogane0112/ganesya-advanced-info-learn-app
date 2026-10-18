export interface Env {
  /** Fine-grained PAT (データリポジトリ限定・Contents read/write) */
  GITHUB_TOKEN: string;
  /** "owner/name" */
  DATA_REPO: string;
  DATA_BRANCH?: string;
  /** 省略時 https://api.github.com (テスト用モックや GHES 向け) */
  GITHUB_API_URL?: string;
  /** 例: your-team.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN: string;
  /** Access アプリケーションの Application Audience (AUD) Tag */
  ACCESS_AUD: string;
  ALLOWED_EMAIL: string;
  /** "true" かつ localhost からのリクエストのときだけ JWT 検証を省略 */
  DEV_BYPASS_AUTH?: string;
}

export interface AuthData extends Record<string, unknown> {
  email: string;
}

export type Fn = PagesFunction<Env, string, AuthData>;
