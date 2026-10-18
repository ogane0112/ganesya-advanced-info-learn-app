# 応用情報 午後 採点アプリ 要件定義(v0.3)

## 目的
応用情報技術者試験・午後(記述式)の過去問をiPadで解き、Claudeに採点・添削させて弱点を潰す個人用アプリ。

## 全体構成
```
[iPad PWA]
   │ ① Cloudflare Access(GitHubログイン=パスキー)
   ▼
[Cloudflare Pages + Pages Functions]  ← GitHubトークンはここ(Secret)だけに置く
   │ ② GitHub API で解答をcommit / 問題・結果を取得
   ▼
[GitHub データリポジトリ(private)]
   │ ③ push で起動
   ▼
[GitHub Actions + Claude Code] CLAUDE.md の採点ルールで採点 → results/ にcommit
```
- **アプリは「問題表示・解答・保存」だけ**を担当し、採点ロジックは持たない
- 採点はリポジトリ内の指示ファイル(CLAUDE.md)に従ってClaudeが行う
- 自宅PCは不要
- **iPadにはトークンを一切置かない**。GitHubへのアクセスはすべてPages Functions経由

## 認証(Cloudflare Access)
- アプリ全体(静的ファイル・`/api/*`ともに)を Access のセルフホストアプリケーションで保護
- ログイン方法: GitHub をIdPに設定し、GitHubアカウント側をパスキーでログインする設定にする
  - 補足: Access 自体の独立MFAは TOTP とハードウェアセキュリティキーのみ対応。iPadのパスキーをそのまま使うならIdP側(GitHub)で担保するのが確実
  - 必要ならAccessの独立MFA(TOTP)を2段目として追加
- **自分のGitHubアカウント以外はアクセス不可**にする
  - アプリの「ログイン方法」は GitHub のみ有効。One-time PIN など他のIdPは無効化し、Instant Auth(IdP選択画面をスキップ)をオン
  - ポリシー(Allow)
    - Include: Emails = 自分のGitHubアカウントのプライマリメール(1件のみ)
    - Require: Login Methods = GitHub
  - Include と Require を組み合わせ、「GitHubでログインし、かつ自分のメール」の両方を満たす場合だけ通す(同じメールでも他の方法でログインした場合は弾く)
  - Everyone や メールドメイン指定のルールは作らない
  - GitHubアカウント側: パスキー登録 + 2FA有効、プライマリメールは検証済みのもの
- Pages Functions 側でもJWTの `email` クレームが許可メール(環境変数 `ALLOWED_EMAIL`)と一致するか確認し、不一致は403
- セッション有効期間: 1週間程度(カフェで毎回ログインしなくて済むように)
- Pages Functions 側でも `Cf-Access-Jwt-Assertion` ヘッダーのJWTを検証する(チームドメインの公開鍵・AUDを照合)。Accessをすり抜けた直アクセス対策
- `*.pages.dev` のプレビューURLも Access の対象に含める

## リポジトリ構成(2つに分ける)
### 1. アプリリポジトリ(private可)
- PWA + Pages Functions。Cloudflare Pages にGit連携でデプロイ
- 解答や個人データは一切含めない
- データリポジトリと分けるのは、採点commitのたびにアプリが再ビルドされるのを避けるため

### 2. データリポジトリ(private)
```
CLAUDE.md                 # 採点ルール(採点者としての指示)
questions/
  2024-spring/q03.md      # 問題・設問・解答例・採点講評
answers/
  2024-spring/q03/
    20261018-2330.json    # 1回分の解答
results/
  2024-spring/q03/
    20261018-2330.json    # 採点結果(アプリ表示用)
    20261018-2330.md      # 添削コメント(人が読む用)
stats/summary.json        # 分野別集計(採点時に更新)
.github/workflows/grade.yml
```

## 試験形式
150分 / 問1(情報セキュリティ)必須 + 問2〜11から4問選択 / 合格基準60点

## 問題データ形式(questions/*.md)
```yaml
---
year: 2024
season: spring
number: 3
field: アルゴリズム
---
## 本文
(問題文。図表は画像 or Markdown表)

## 設問
- id: "1-a"
  text: "..."
  type: fill     # fill / short / numeric
  limit: 30      # 字数制限(記述のみ)
  points: 4      # 推定配点
  answer: "IPA解答例"
  alt_answers: ["別解"]
  notes: "採点講評の要点"
```
- IPA公開の問題・解答例を利用し、出典(年度・期・問番号)を画面に表示する

## 解答データ形式(answers/**/*.json)
```json
{
  "question": "2024-spring/q03",
  "answered_at": "2026-10-18T23:30:00+09:00",
  "elapsed_sec": 1650,
  "mode": "single",
  "answers": { "1-a": "...", "2": "..." }
}
```

## 採点結果形式(results/**/*.json)
```json
{
  "question": "2024-spring/q03",
  "answer_file": "answers/2024-spring/q03/20261018-2330.json",
  "total": 38, "max": 50,
  "items": [
    {
      "id": "2", "score": 2, "max": 4, "verdict": "partial",
      "matched_points": ["..."], "missing_points": ["..."],
      "feedback": "...", "improved_answer": "..."
    }
  ]
}
```

## CLAUDE.md(採点ルール)に書くこと
- 役割: 応用情報午後の採点者
- 対象: `answers/` にあって `results/` に対応ファイルがない解答をすべて採点する
- fill / numeric: 解答例と照合(全角半角・空白は正規化)
- short: 解答例のキーワード・論点が含まれているかで判定。表現の違いは許容、論点のズレ・字数超過は減点。0/部分点/満点 + 理由
- 出力: 上記JSON形式と添削mdを `results/` に作成し、`stats/summary.json` を更新
- 既存の results や answers は変更しない
- コミットメッセージ: `grade: 2024-spring/q03 (38/50)`

## 採点の起動(GitHub Actions)
- `answers/**` への push で起動
- `anthropics/claude-code-action` を使い、プロンプトは「CLAUDE.md の採点ルールに従って未採点の解答を採点し、結果をcommitしてpushして」
- 認証は Claude サブスクリプションのOAuthトークン(`claude setup-token` で発行し `CLAUDE_CODE_OAUTH_TOKEN` シークレットに登録)。API従量課金は使わない
- `concurrency` を設定して採点ジョブを直列化(連続push時のコンフリクト防止)
- 手動実行(`workflow_dispatch`)も可能にする
- 予備手段: Claude アプリ / Claude Code on the web からデータリポジトリを開いて「採点して」でも同じ結果になること

## アプリ(PWA)の機能
### MVP
1. ログイン: Cloudflare Access に任せる(アプリ側にログイン画面は作らない)
2. 問題一覧: `/api/questions` 経由で取得(年度/期/分野でフィルタ、採点済みマーク)
3. 解答画面
   - iPad横向きで問題文と解答欄を左右分割、縦向きはタブ切替
   - 字数カウンタ(制限超過で赤)、タイマー
   - Apple Pencil のスクリブル入力に対応
4. 提出: `POST /api/answers` → Functions が GitHub Contents API で `answers/` にcommit
5. 結果表示: `/api/results` をポーリング(提出後30秒間隔)し、届いたら設問ごとの得点・添削を表示

### API(Pages Functions)
| メソッド | パス | 内容 |
|---|---|---|
| GET | /api/questions | 問題一覧 |
| GET | /api/questions/:id | 問題本文 |
| POST | /api/answers | 解答をcommit(パスは `answers/` 配下に固定、他は書けない) |
| GET | /api/results?question= | 採点結果一覧 |
| GET | /api/stats | 分野別集計 |
- すべてのAPIで Access JWT を検証し、失敗時は401
- 書き込みは `answers/` 配下のみ許可(パストラバーサル防止)
6. 履歴一覧

### オフライン対応
- 問題データと書きかけの解答は IndexedDB に保持
- 通信できないときの提出は「送信待ち」キューに積み、オンライン復帰時に自動commit
- Accessセッション切れでAPIが401/ログインページへのリダイレクトを返したら、解答を消さずに「再ログインしてください」を表示し、ログイン後にキューを再送
- Service Worker は `/api/*` をキャッシュしない(認証が絡むため)

### v2
- 本番モード(150分・問1必須+4問選択の通し演習、60点判定)
- `stats/summary.json` から分野別正答率グラフ → 選択問題の戦略提案
- 間違えた設問の復習キュー
- 再採点リクエスト(異議コメント付きで `answers/` に再提出)

## 技術スタック(初期案)
- Vite + React + TypeScript、vite-plugin-pwa
- Cloudflare Pages + Pages Functions(TypeScript)
- GitHub API: Functions から fetch で直接呼ぶ(Octokit は不要なら入れない)
- JWT検証: jose
- 端末内保存: IndexedDB(idb)
- DBなし(データはすべてGitHub)

## セキュリティ
- GitHubトークンは Fine-grained PAT(データリポジトリ限定・Contents 読み書きのみ・有効期限付き)を Cloudflare の Secret に保存。将来は GitHub App に移行も検討
- iPad・アプリのコードにトークンを置かない
- データリポジトリは private
- Access(GitHubパスキー)+ Functions でのJWT検証の二重チェック
- 書き込みAPIは `answers/` 配下に限定

## 進め方
1. データリポジトリ作成: サンプル問題1問 + CLAUDE.md + grade.yml
2. 手で解答JSONをpushし、Actions で採点されることを確認
3. アプリ雛形(PWA + Pages Functions、ローカルは wrangler で動作確認)
4. Cloudflare Pages にデプロイし、Access(GitHubログイン)で保護 → iPadでログイン確認
5. Functions のJWT検証 + 問題一覧API
6. 解答画面 + 提出API
7. 結果表示(ポーリング)
8. オフラインキュー・セッション切れ対応
9. 履歴・分野別集計

## 手作業のセットアップ
- GitHub: アカウントにパスキーを登録し、データリポジトリ用 Fine-grained PAT を発行
- Cloudflare Zero Trust: チーム作成 → IdPにGitHubを追加 → Pages のドメインをセルフホストアプリとして登録 → 自分のメールのみ許可するポリシー
- Cloudflare Pages: PAT・Accessのチームドメイン・AUD を Secret/環境変数に登録
- データリポジトリ: `CLAUDE_CODE_OAUTH_TOKEN` を Actions シークレットに登録
