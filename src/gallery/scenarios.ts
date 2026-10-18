// UI ギャラリーの各シナリオ (画面 × 状態)
import { cache, drafts, enqueueSubmission, outbox } from "../lib/db";
import { stripAnswers } from "../../shared/question";
import type { QuestionListItem, ResultEntry, StatsSummary } from "../../shared/types";
import * as fx from "./fixtures";

export type ApiMode = "ok" | "offline" | "auth" | "loading";

export interface ApiData {
  questions: { items: QuestionListItem[]; errors: string[] };
  results: { items: ResultEntry[] };
  history: { items: typeof fx.history };
  stats: StatsSummary;
}

export interface Scenario {
  id: string;
  group: string;
  title: string;
  note?: string;
  path: string;
  api?: ApiMode;
  data?: Partial<ApiData>;
  /** 描画前に端末内データ (IndexedDB) を用意する */
  seed?: () => Promise<void>;
  /** 描画後の操作 (タブ切替など) */
  after?: (root: HTMLElement) => void;
}

const QHREF = `/q/${fx.QID}`;

const clickTab = (label: string) => (root: HTMLElement) => {
  const tab = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === label);
  tab?.click();
};

async function seedDraft() {
  await drafts.put({
    question: fx.QID,
    answers: fx.draftAnswers,
    elapsed_sec: 1650,
    client_id: "gallery-draft-0001",
    updated_at: Date.now(),
  });
}

async function seedSubmission(sent: boolean) {
  await cache.setQuestion(stripAnswers(fx.question));
  await enqueueSubmission(fx.submittedPayload);
  if (sent) await outbox.markSent(fx.submittedPayload.client_id, fx.ANSWER_FILE);
}

export const scenarios: Scenario[] = [
  { id: "list", group: "問題一覧", title: "通常", path: "/", note: "採点済み・解答回数・最高点・書きかけマーク", seed: seedDraft },
  { id: "list-loading", group: "問題一覧", title: "読み込み中", path: "/", api: "loading" },
  { id: "list-empty", group: "問題一覧", title: "問題なし", path: "/", data: { questions: { items: [], errors: [] } } },
  {
    id: "list-offline",
    group: "問題一覧",
    title: "オフライン(端末キャッシュ表示)",
    path: "/",
    api: "offline",
    seed: async () => {
      await cache.setList(fx.questionList.slice(0, 8));
      await seedDraft();
    },
  },
  {
    id: "list-errors",
    group: "問題一覧",
    title: "読み込めない問題ファイルあり",
    path: "/",
    data: {
      questions: {
        items: fx.questionList.slice(0, 6),
        errors: ["questions/2024-autumn/q07.md: 「## 設問」は YAML のリストで書いてください"],
      },
    },
  },
  {
    id: "list-pending",
    group: "問題一覧",
    title: "送信待ちあり",
    path: "/",
    seed: () => seedSubmission(false),
  },

  { id: "answer-new", group: "解答", title: "白紙", path: QHREF, note: "横向きは左右分割、縦向きはタブ" },
  { id: "answer-draft", group: "解答", title: "書きかけ・字数超過", path: QHREF, seed: seedDraft, note: "設問3 が 18/15 字で赤表示" },
  {
    id: "answer-tab",
    group: "解答",
    title: "縦向きで解答タブ",
    path: QHREF,
    seed: seedDraft,
    after: clickTab("解答"),
    note: "横向きでは変化なし",
  },

  {
    id: "results-graded",
    group: "採点結果",
    title: "採点済み",
    path: `${QHREF}/results?answer=${encodeURIComponent(fx.ANSWER_FILE)}`,
    seed: () => seedSubmission(true),
  },
  {
    id: "results-grading",
    group: "採点結果",
    title: "採点中(ポーリング)",
    path: `${QHREF}/results?client=${fx.submittedPayload.client_id}`,
    seed: () => seedSubmission(true),
    data: { results: { items: fx.results.slice(1) } },
  },
  {
    id: "results-queued",
    group: "採点結果",
    title: "送信待ち(オフライン)",
    path: `${QHREF}/results?client=${fx.submittedPayload.client_id}`,
    api: "offline",
    seed: () => seedSubmission(false),
  },
  {
    id: "results-auth",
    group: "採点結果",
    title: "ログイン切れ",
    path: `${QHREF}/results?client=${fx.submittedPayload.client_id}`,
    api: "auth",
    seed: () => seedSubmission(false),
  },
  { id: "results-none", group: "採点結果", title: "結果なし", path: `${QHREF}/results`, data: { results: { items: [] } } },

  {
    id: "history",
    group: "履歴",
    title: "通常(送信エラーあり)",
    path: "/history",
    seed: async () => {
      await seedSubmission(false);
      await outbox.markError(fx.submittedPayload.client_id, "unknown answer id: 9");
    },
  },
  { id: "history-empty", group: "履歴", title: "解答なし", path: "/history", data: { history: { items: [] } } },

  { id: "stats", group: "集計", title: "通常", path: "/stats" },
  { id: "stats-empty", group: "集計", title: "データなし", path: "/stats", data: { stats: {} } },
];

export const defaultData: ApiData = {
  questions: { items: fx.questionList, errors: [] },
  results: { items: fx.results },
  history: { items: fx.history },
  stats: fx.stats,
};
