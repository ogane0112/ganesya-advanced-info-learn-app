// UI ギャラリー用の固定データ
import sampleMd from "../../data-repo-template/questions/2024-spring/q03.md?raw";
import { parseQuestion } from "../../shared/question";
import type {
  AnswerPayload,
  HistoryEntry,
  Question,
  QuestionListItem,
  ResultEntry,
  StatsSummary,
} from "../../shared/types";

export const QID = "2024-spring/q03";
export const question: Question = parseQuestion(QID, sampleMd);

const FIELDS = [
  "情報セキュリティ",
  "経営戦略",
  "プログラミング",
  "システムアーキテクチャ",
  "ネットワーク",
  "データベース",
  "組込みシステム開発",
  "情報システム開発",
  "プロジェクトマネジメント",
  "サービスマネジメント",
  "システム監査",
];
const TITLES = [
  "Web アプリケーションの脆弱性対策",
  "新規事業の収益性分析",
  "二分探索",
  "クラウドへのシステム移行",
  "社内ネットワークの冗長化",
  "在庫管理システムのデータベース設計",
  "スマート家電の制御",
  "アジャイル開発の導入",
  "システム更改プロジェクトのリスク管理",
  "サービスデスクの改善",
  "販売管理システムの監査",
];

export const questionList: QuestionListItem[] = [2024, 2023].flatMap((year) =>
  (["autumn", "spring"] as const).flatMap((season) =>
    FIELDS.map((field, i) => {
      const number = i + 1;
      const id = `${year}-${season}/q${String(number).padStart(2, "0")}`;
      const graded = (year + number + (season === "spring" ? 1 : 0)) % 3 === 0;
      return {
        id,
        year,
        season,
        number,
        field,
        title: TITLES[i],
        graded: id === QID || graded,
        attempts: id === QID ? 2 : graded ? 1 : 0,
        best: id === QID ? { total: 14, max: 20 } : graded ? { total: 8 + (number % 10), max: 20 } : undefined,
      };
    }),
  ),
);

export const draftAnswers: Record<string, string> = {
  "1-ア": "mid + 1",
  "1-イ": "mid - 1",
  "2": "7",
  "3": "配列が昇順に整列済みであることが必要",
  "4": "要素を追加するたびに整列状態を保つ必要がある",
};

export const ANSWER_FILE = `answers/${QID}/20261018-2330.json`;
const OLD_ANSWER_FILE = `answers/${QID}/20261012-2105.json`;

export const submittedPayload: AnswerPayload = {
  question: QID,
  answered_at: "2026-10-18T23:30:00+09:00",
  elapsed_sec: 1650,
  mode: "single",
  answers: draftAnswers,
  client_id: "gallery-client-0001",
};

export const results: ResultEntry[] = [
  {
    path: `results/${QID}/20261018-2330.json`,
    result: {
      question: QID,
      answer_file: ANSWER_FILE,
      total: 14,
      max: 20,
      items: [
        { id: "1-ア", score: 3, max: 3, verdict: "correct", feedback: "正解。" },
        { id: "1-イ", score: 3, max: 3, verdict: "correct", feedback: "正解。" },
        { id: "2", score: 4, max: 4, verdict: "correct", feedback: "正解。探索範囲が 100→50→25→12→6→3→1 と絞られる点を押さえています。" },
        {
          id: "3",
          score: 2,
          max: 4,
          verdict: "partial",
          matched_points: ["整列済みであること"],
          missing_points: [],
          feedback: "論点は正しいが 18 字で字数制限 (15 字) を超えているため減点。「〜が必要」は不要です。",
          improved_answer: "昇順に整列されていること",
        },
        {
          id: "4",
          score: 2,
          max: 6,
          verdict: "partial",
          matched_points: ["整列状態の維持が必要"],
          missing_points: ["挿入位置以降の要素の移動・再整列のコスト"],
          feedback: "整列を保つ必要がある点は書けていますが、なぜそれが不利なのか (移動や並べ替えのコスト) に触れていません。",
          improved_answer: "追加のたびに整列状態を保つための並べ替えや要素の移動が必要になるから",
        },
      ],
    },
    comment_md:
      "# 2024-spring/q03 採点結果 14/20\n\n- 解答日時: 2026-10-18 23:30 / 所要時間: 27分30秒\n- 分野: プログラミング\n\n## 総評\n穴埋めと計算は完璧です。記述は**字数制限**と**理由の掘り下げ**を意識しましょう。",
  },
  {
    path: `results/${QID}/20261012-2105.json`,
    result: {
      question: QID,
      answer_file: OLD_ANSWER_FILE,
      total: 9,
      max: 20,
      items: [
        { id: "1-ア", score: 3, max: 3, verdict: "correct" },
        { id: "1-イ", score: 0, max: 3, verdict: "wrong", feedback: "mid は比較済みなので範囲から除外します。", improved_answer: "mid - 1" },
        { id: "2", score: 0, max: 4, verdict: "wrong", feedback: "最悪ケースの回数を数え直しましょう。", improved_answer: "7" },
        { id: "3", score: 4, max: 4, verdict: "correct" },
        { id: "4", score: 2, max: 6, verdict: "partial", missing_points: ["要素移動のコスト"] },
      ],
    },
  },
];

export const history: HistoryEntry[] = [
  { question: QID, answer_file: ANSWER_FILE, answered_at: "2026-10-18T23:30:00+09:00", result_file: results[0].path, total: 14, max: 20 },
  { question: "2024-autumn/q01", answer_file: "answers/2024-autumn/q01/20261016-0730.json", answered_at: "2026-10-16T07:30:00+09:00" },
  { question: "2023-spring/q06", answer_file: "answers/2023-spring/q06/20261014-2200.json", answered_at: "2026-10-14T22:00:00+09:00", result_file: "x", total: 13, max: 20 },
  { question: QID, answer_file: OLD_ANSWER_FILE, answered_at: "2026-10-12T21:05:00+09:00", result_file: results[1].path, total: 9, max: 20 },
  { question: "2023-autumn/q05", answer_file: "answers/2023-autumn/q05/20261010-1930.json", answered_at: "2026-10-10T19:30:00+09:00", result_file: "y", total: 16, max: 20 },
];

export const stats: StatsSummary = {
  updated_at: "2026-10-18T23:45:00+09:00",
  fields: {
    情報セキュリティ: { attempts: 4, score: 58, max: 80, rate: 0.725 },
    プログラミング: { attempts: 2, score: 23, max: 40, rate: 0.575 },
    データベース: { attempts: 3, score: 41, max: 60, rate: 0.683 },
    ネットワーク: { attempts: 2, score: 21, max: 40, rate: 0.525 },
    システム監査: { attempts: 1, score: 16, max: 20, rate: 0.8 },
    プロジェクトマネジメント: { attempts: 1, score: 9, max: 20, rate: 0.45 },
  },
  questions: {
    [QID]: { field: "プログラミング", attempts: 2, best: 14, latest: 14, max: 20 },
    "2023-spring/q06": { field: "データベース", attempts: 1, best: 13, latest: 13, max: 20 },
    "2023-autumn/q05": { field: "ネットワーク", attempts: 1, best: 16, latest: 16, max: 20 },
  },
};
