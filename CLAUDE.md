# 開発メモ (アプリリポジトリ)

- 要件: docs/REQUIREMENTS.md。採点ロジックはアプリに持たない(データリポジトリの CLAUDE.md が担当)
- `shared/` はアプリと Functions の両方から import される。DOM / Workers 固有 API を使わない
- GitHub への書き込みパスは必ず `shared/ids.ts` の関数で組み立てる(`answers/` 配下限定)
- Service Worker は `/api/*` を扱わない(vite.config.ts の navigateFallbackDenylist)
- 変更後は `npm run typecheck && npm test && npm run build`
- E2E 確認: `node scripts/mock-github.mjs <データdir>` + `wrangler pages dev dist --binding GITHUB_API_URL=http://localhost:9999 DEV_BYPASS_AUTH=true ...`
- UI 確認: `npm run gallery` (src/gallery/scenarios.ts に画面×状態を定義)。画面や状態を増やしたらシナリオも追加し、`npm run gallery:shots` で iPad 横/縦・iPhone × ライト/ダークを撮って崩れを確認
