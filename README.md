# 応用情報 午後 採点アプリ

応用情報技術者試験・午後(記述式)の過去問を iPad で解き、GitHub Actions 上の Claude に採点・添削させる個人用 PWA。
要件定義: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)

```
[iPad PWA] ──Cloudflare Access(GitHub ログイン)──▶ [Cloudflare Pages + Functions]
                                                     │ GitHub API (PAT は Functions の Secret のみ)
                                                     ▼
                                      [データリポジトリ(private)] ──push──▶ [Actions + Claude Code が採点]
```

- アプリは「問題表示・解答・保存」だけ。採点ルールはデータリポジトリの `CLAUDE.md`
- iPad にトークンは置かない。GitHub へのアクセスはすべて Pages Functions 経由
- データリポジトリの雛形は [`data-repo-template/`](data-repo-template/) (別リポジトリとして作成する)

## 構成

```
src/                 PWA (Vite + React + TypeScript)
  pages/             問題一覧 / 解答 / 採点結果 / 履歴 / 集計
  lib/db.ts          IndexedDB (問題キャッシュ・書きかけ・送信待ちキュー)
  lib/outbox.ts      送信待ちキューの自動再送
functions/api/       Cloudflare Pages Functions
  _middleware.ts     全 API で Access JWT を検証 (失敗 401 / メール不一致 403)
  questions/         GET /api/questions, /api/questions/:year-season/:qNN
  answers.ts         POST /api/answers (answers/ 配下にのみ commit)
  results.ts         GET /api/results?question=
  history.ts         GET /api/history
  stats.ts           GET /api/stats
  assets/            GET /api/assets/* (questions/ 配下の画像のみ)
  login.ts           GET /api/login (SW を通らない再ログイン用 URL)
shared/              アプリと Functions で共通の型・パス検証・問題パーサ
data-repo-template/  データリポジトリの雛形 (CLAUDE.md, grade.yml, サンプル問題)
scripts/             アイコン生成・GitHub API モック
```

## API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/questions` | 問題一覧 (採点済み・解答回数・最高点つき) |
| GET | `/api/questions/:id` | 問題本文。解答例・講評は `?reveal=1` のときだけ返す |
| POST | `/api/answers` | 解答を `answers/<id>/<YYYYMMDD-HHmm>.json` に commit |
| GET | `/api/results?question=` | 採点結果一覧 (添削 md 込み) |
| GET | `/api/history` | 全解答と採点状況 |
| GET | `/api/stats` | `stats/summary.json` |

- 書き込みパスはサーバ側で組み立て、`answers/` 配下以外には書けない (問題 ID は `^\d{4}-(spring|autumn)/q\d{2}$` のみ)
- 解答には `client_id` を含め、再送で同じ解答が二重 commit されないようにしている
- GitHub からの読み取りは GraphQL でまとめて 1 リクエスト (Workers のサブリクエスト上限対策)

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars   # 値を設定

# A) 実際のデータリポジトリ (PAT) を使う
npm run dev:api     # wrangler pages dev (Functions, :8788)
npm run dev         # Vite (:5173, /api は :8788 へプロキシ)

# B) PAT なしでローカルの雛形をデータとして使う
node scripts/mock-github.mjs data-repo-template   # :9999
#   .dev.vars に GITHUB_API_URL=http://localhost:9999 を追加してから A) と同じ手順

npm test            # vitest
npm run typecheck
npm run build
```

`DEV_BYPASS_AUTH=true` は localhost からのリクエストでのみ JWT 検証を省略する。本番には設定しないこと。

## デプロイ・初期設定

[docs/SETUP.md](docs/SETUP.md) を参照(Cloudflare Access・Pages・PAT・データリポジトリの手作業セットアップ)。
問題ファイルの書き方は [docs/QUESTION_FORMAT.md](docs/QUESTION_FORMAT.md)。

## 現状の制限

- v2 の機能(本番モード、正答率グラフからの戦略提案、復習キュー、再採点リクエスト)は未実装
- オフライン時、問題文中の画像は表示されない(Service Worker は `/api/*` をキャッシュしない方針のため)
