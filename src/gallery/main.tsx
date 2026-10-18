// UI ギャラリー (開発用): npm run gallery → http://localhost:5173/gallery.html
//   ?scenario=<id>&theme=light|dark  … 1 シナリオをモック API で描画 (iframe の中身)
//   パラメータなし                    … 全シナリオを端末サイズ別に並べる一覧
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./Shell";
import { defaultData, scenarios } from "./scenarios";

const params = new URLSearchParams(location.search);
const scenarioId = params.get("scenario");
const root = document.getElementById("root")!;

async function renderScenario(id: string) {
  // 端末内データはシナリオごとにメモリ上で独立させる (実ブラウザの IndexedDB を汚さない)
  await import("fake-indexeddb/auto");
  await import("../styles.css");
  const [{ MemoryRouter }, { App }, { installMockApi }, { refreshPending }] = await Promise.all([
    import("react-router-dom"),
    import("../App"),
    import("./mockApi"),
    import("../lib/outbox"),
  ]);
  const sc = scenarios.find((s) => s.id === id);
  if (!sc) {
    root.textContent = `unknown scenario: ${id}`;
    return;
  }
  document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
  installMockApi(sc.api ?? "ok", { ...defaultData, ...sc.data });
  await sc.seed?.();
  await refreshPending();
  createRoot(root).render(
    <StrictMode>
      <MemoryRouter initialEntries={[sc.path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  setTimeout(() => {
    sc.after?.(root);
    // スクリーンショット撮影用の描画完了フラグ
    setTimeout(() => (document.body.dataset.ready = "1"), 300);
  }, 700);
}

if (scenarioId) {
  void renderScenario(scenarioId);
} else {
  createRoot(root).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}
