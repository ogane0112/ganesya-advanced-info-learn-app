# セットアップ手順

要件定義「進め方」「手作業のセットアップ」に対応する手順。上から順に進める。

## 1. データリポジトリを作る (private)

1. GitHub で private リポジトリを新規作成(例: `ap-data`)
2. このリポジトリの `data-repo-template/` の中身をそのままコピーして push
   ```bash
   cp -r data-repo-template/. ../ap-data/
   cd ../ap-data && git add -A && git commit -m "init" && git push origin main
   ```
3. Claude のトークンを Actions シークレットに登録
   - 手元で `claude setup-token` を実行し、表示された OAuth トークンをコピー
   - データリポジトリ → Settings → Secrets and variables → Actions → `CLAUDE_CODE_OAUTH_TOKEN` として登録
4. Settings → Actions → General → Workflow permissions を「Read and write permissions」にする

### 採点の動作確認(アプリより先に)

```bash
mkdir -p answers/2024-spring/q03
cat > answers/2024-spring/q03/20261018-2330.json <<'JSON'
{
  "question": "2024-spring/q03",
  "answered_at": "2026-10-18T23:30:00+09:00",
  "elapsed_sec": 1650,
  "mode": "single",
  "answers": { "1-ア": "mid+1", "1-イ": "mid-1", "2": "7", "3": "整列されていること", "4": "追加のたびに並べ替えが必要だから" },
  "client_id": "manual-test-0001"
}
JSON
git add answers && git commit -m "answer: test" && git push
```

Actions の `grade` が走り、`results/2024-spring/q03/20261018-2330.json` と `.md`、`stats/summary.json` が commit されれば OK。
(Actions を使わずに、Claude Code / Claude アプリでデータリポジトリを開いて「採点して」でも同じ結果になる)

## 2. GitHub アカウント・PAT

1. GitHub → Settings → Password and authentication でパスキーを登録し、2FA を有効にする。プライマリメールが検証済みであることを確認
2. Settings → Developer settings → Fine-grained personal access tokens → Generate new token
   - Repository access: **Only select repositories** → データリポジトリのみ
   - Permissions: **Contents: Read and write**(Metadata: Read は自動)。他は付けない
   - Expiration: 期限を設定(期限切れ前に再発行してシークレットを更新)

## 3. Cloudflare Pages

1. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git で**このアプリリポジトリ**を選択
   - Build command: `npm run build`
   - Build output directory: `dist`
2. Settings → Variables and Secrets(Production と Preview の両方)
   | 名前 | 種類 | 値 |
   |---|---|---|
   | `GITHUB_TOKEN` | Secret | 手順2の PAT |
   | `DATA_REPO` | 変数 | `あなたのGitHubユーザー名/ap-data` |
   | `DATA_BRANCH` | 変数 | `main` |
   | `ACCESS_TEAM_DOMAIN` | 変数 | `<チーム名>.cloudflareaccess.com` |
   | `ACCESS_AUD` | 変数 | 手順4で表示される Application Audience (AUD) Tag |
   | `ALLOWED_EMAIL` | 変数 | GitHub のプライマリメール |
   - `DEV_BYPASS_AUTH` は**設定しない**
3. 再デプロイ(環境変数は次のデプロイから有効)

## 4. Cloudflare Zero Trust (Access)

1. Zero Trust → Settings → Authentication → Login methods → Add new → **GitHub**(GitHub 側で OAuth App を作り Client ID/Secret を設定)。One-time PIN など他の方法は使わない
2. Access → Applications → Add an application → **Self-hosted**
   - Application domain: `<プロジェクト名>.pages.dev` と、プレビュー用に `*.<プロジェクト名>.pages.dev` の2つを登録(カスタムドメインを使う場合はそれも)
   - Session Duration: **1 week**
   - Login methods: **GitHub のみ**にチェック、**Instant Auth** をオン
3. Policy(Action: Allow)
   - Include: **Emails** = 自分の GitHub プライマリメール(1件のみ)
   - Require: **Login Methods** = GitHub
   - Everyone やメールドメイン指定のルールは作らない
4. 作成後、アプリの Overview に表示される **Application Audience (AUD) Tag** を Pages の `ACCESS_AUD` に設定
5. (任意)Access の独立 MFA(TOTP)を2段目として追加

### 確認

- 別ブラウザ / シークレットウィンドウで `https://<プロジェクト>.pages.dev/` を開き、GitHub ログインを要求されること
- `curl https://<プロジェクト>.pages.dev/api/questions` が Access のログインページへリダイレクトされること
- Access を通さず Functions に届いた場合も 401 になること(JWT 検証)

## 5. iPad

1. Safari でアプリの URL を開いて GitHub(パスキー)でログイン
2. 共有 → 「ホーム画面に追加」で PWA としてインストール
3. 一覧を一度開くと問題が端末にキャッシュされ、オフラインでも解答できる

## トラブルシュート

| 症状 | 原因と対処 |
|---|---|
| 「再ログインしてください」が出る | Access のセッション切れ。ボタンで再ログインすれば送信待ちの解答は自動送信される |
| API が 500 `... is not configured` | Pages の環境変数が未設定 or 再デプロイしていない |
| API が 403 | `ALLOWED_EMAIL` と Access でログインしたメールが不一致 |
| API が 502 `GitHub ...` | PAT の期限切れ・権限不足・`DATA_REPO` の誤り |
| 採点結果が来ない | データリポジトリの Actions のログを確認。`CLAUDE_CODE_OAUTH_TOKEN` の期限、Workflow permissions |
