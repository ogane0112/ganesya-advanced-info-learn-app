# 応用情報 午後 採点データ

アプリ (ganesya-advanced-info-learn-app) が解答を `answers/` に commit すると、
GitHub Actions 上の Claude が `CLAUDE.md` のルールで採点し `results/` に commit します。

- `questions/<年度>-<spring|autumn>/q<2桁>.md` … 問題 (形式はアプリ側 docs/QUESTION_FORMAT.md)
- `answers/` … 解答 (アプリが書く)
- `results/` … 採点結果 (Claude が書く)
- `stats/summary.json` … 分野別集計 (`node scripts/update-stats.mjs` で再生成)

手動で採点したいときは Actions の「grade」を Run workflow するか、
Claude Code / Claude アプリでこのリポジトリを開いて「採点して」と頼んでください。
