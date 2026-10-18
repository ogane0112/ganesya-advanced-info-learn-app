# 問題ファイルの書き方

データリポジトリの `questions/<年度>-<spring|autumn>/q<2桁の問番号>.md` に置く。
例: `questions/2024-spring/q03.md`(ファイル名がそのまま問題 ID `2024-spring/q03` になる)

```markdown
---
year: 2024
season: spring        # spring / autumn
number: 3
field: アルゴリズム     # 分野別集計に使う
title: "任意。一覧に表示するタイトル"
---
## 本文

問題文 (Markdown)。表は Markdown 表で、図は画像で書く。
![図1](img/q03-fig1.png)     ← questions/2024-spring/img/q03-fig1.png を参照

## 設問
```yaml
- id: "1-a"
  text: "設問文 (Markdown 可)"
  type: fill        # fill(穴埋め) / short(記述) / numeric(数値)
  limit: 30         # 字数制限 (記述のみ)
  points: 4         # 推定配点
  answer: "IPA 解答例"
  alt_answers: ["別解"]
  notes: "採点講評の要点"
```
```

- `## 設問` の YAML はコードフェンス (```yaml) で囲んでも囲まなくてもよい
- `id` は解答・採点結果のキーになる。`"1-ア"` のような日本語も可(32文字以内)
- `answer` / `alt_answers` / `notes` は解答画面には送られず、採点結果画面でだけ表示される
- 出典(年度・期・問番号)は画面に自動表示される。IPA 以外の問題では frontmatter に `source: "出典表記"` を書くと上書きできる
- 対応画像形式: png / jpg / gif / webp / svg
