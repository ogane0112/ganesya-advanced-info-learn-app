# 応用情報 午後 採点データ

アプリ (ganesya-advanced-info-learn-app) が解答を `answers/` に commit すると、
GitHub Actions 上の Claude が `CLAUDE.md` のルールで採点し `results/` に commit します。

- `questions/<年度>-<spring|autumn>/q<2桁>.md` … 問題 (形式はアプリ側 docs/QUESTION_FORMAT.md)
- `answers/` … 解答 (アプリが書く)
- `results/` … 採点結果 (Claude が書く)
- `stats/summary.json` … 分野別集計 (`node scripts/update-stats.mjs` で再生成)

## 過去問の取り込み

Actions の「import」を Run workflow(年度・期・問を指定)すると、
IPA 公式サイトから午後の問題冊子・解答例・採点講評の PDF を取得し(`scripts/fetch-ipa.mjs`)、
Claude が `IMPORT.md` のルールで `questions/` に変換して commit します。

ローカルで PDF だけ取りたい場合: `npm ci && node scripts/fetch-ipa.mjs --year 2024 --season spring`(`ipa-pdf/` に保存)
形式チェック: `node scripts/check-questions.mjs`

## 採点

手動で採点したいときは Actions の「grade」を Run workflow するか、
Claude Code / Claude アプリでこのリポジトリを開いて「採点して」と頼んでください。
