# 応用情報 午後 採点データ

アプリ (ganesya-advanced-info-learn-app) が解答を `answers/` に commit すると、
GitHub Actions 上の Claude が `CLAUDE.md` のルールで採点し `results/` に commit します。

- `questions/<年度>-<spring|autumn>/q<2桁>.md` … 問題 (形式はアプリ側 docs/QUESTION_FORMAT.md)
- `answers/` … 解答 (アプリが書く)
- `results/` … 採点結果 (Claude が書く)
- `stats/summary.json` … 分野別集計 (`node scripts/update-stats.mjs` で再生成)

## 過去問の取り込み

Actions の「import」を Run workflow(年度・期・問・取り込み元を指定)すると、
過去問道場(既定)から午後問題のページを保存し(`scripts/fetch-apsiken.mjs`)、解答例は IPA 公式 PDF から取得して
(`scripts/fetch-ipa.mjs --kinds ans,cmnt`)、Claude が `IMPORT.md` のルールで問題文・設問だけを `questions/` に変換して commit します(解説は取り込みません)。
取り込み元に `ipa` を選ぶと IPA 公式 PDF の問題冊子から変換します。

ローカルで取得だけしたい場合: `npm ci && node scripts/fetch-apsiken.mjs --year 2024 --season spring`(`apsiken-raw/` に保存)
形式チェック: `node scripts/check-questions.mjs`

## 採点

手動で採点したいときは Actions の「grade」を Run workflow するか、
Claude Code / Claude アプリでこのリポジトリを開いて「採点して」と頼んでください。
