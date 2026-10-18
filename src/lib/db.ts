import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AnswerPayload, Question, QuestionListItem, ResultEntry } from "../../shared/types";

export interface Draft {
  question: string;
  answers: Record<string, string>;
  elapsed_sec: number;
  client_id: string;
  updated_at: number;
}

export interface OutboxItem {
  client_id: string;
  payload: AnswerPayload;
  created_at: number;
  last_error?: string;
}

export interface Submission {
  client_id: string;
  question: string;
  /** 送信成功後に確定する answers/... のパス */
  path?: string;
  payload: AnswerPayload;
  submitted_at: number;
}

interface AppDB extends DBSchema {
  kv: { key: string; value: unknown };
  questions: { key: string; value: Question };
  drafts: { key: string; value: Draft };
  outbox: { key: string; value: OutboxItem };
  submissions: { key: string; value: Submission; indexes: { by_question: string } };
  results: { key: string; value: ResultEntry[] };
}

let dbp: Promise<IDBPDatabase<AppDB>> | null = null;

export function db() {
  dbp ??= openDB<AppDB>("ap-pm", 1, {
    upgrade(d) {
      d.createObjectStore("kv");
      d.createObjectStore("questions");
      d.createObjectStore("drafts");
      d.createObjectStore("outbox", { keyPath: "client_id" });
      d.createObjectStore("submissions", { keyPath: "client_id" }).createIndex("by_question", "question");
      d.createObjectStore("results");
    },
  });
  return dbp;
}

export const cache = {
  async getList() {
    return (await (await db()).get("kv", "questionList")) as QuestionListItem[] | undefined;
  },
  async setList(items: QuestionListItem[]) {
    await (await db()).put("kv", items, "questionList");
  },
  async getQuestion(id: string) {
    return (await db()).get("questions", id);
  },
  async setQuestion(q: Question) {
    await (await db()).put("questions", q, q.id);
  },
  async cachedQuestionIds() {
    return new Set(await (await db()).getAllKeys("questions"));
  },
  async getResults(id: string) {
    return (await db()).get("results", id);
  },
  async setResults(id: string, items: ResultEntry[]) {
    await (await db()).put("results", items, id);
  },
};

export const drafts = {
  async get(id: string) {
    return (await db()).get("drafts", id);
  },
  async put(d: Draft) {
    await (await db()).put("drafts", d, d.question);
  },
  async delete(id: string) {
    await (await db()).delete("drafts", id);
  },
  async ids() {
    return new Set(await (await db()).getAllKeys("drafts"));
  },
};

export const submissions = {
  async byQuestion(id: string) {
    return (await db()).getAllFromIndex("submissions", "by_question", id);
  },
  async all() {
    return (await db()).getAll("submissions");
  },
};

/** 提出: 送信待ちキューと提出記録を同時に書き、下書きを消す */
export async function enqueueSubmission(payload: AnswerPayload) {
  const d = await db();
  const tx = d.transaction(["outbox", "submissions", "drafts"], "readwrite");
  await Promise.all([
    tx.objectStore("outbox").put({ client_id: payload.client_id, payload, created_at: Date.now() }),
    tx.objectStore("submissions").put({
      client_id: payload.client_id,
      question: payload.question,
      payload,
      submitted_at: Date.now(),
    }),
    tx.objectStore("drafts").delete(payload.question),
    tx.done,
  ]);
}

export const outbox = {
  async all() {
    return (await db()).getAll("outbox");
  },
  async count() {
    return (await db()).count("outbox");
  },
  async markSent(clientId: string, path: string) {
    const d = await db();
    const tx = d.transaction(["outbox", "submissions"], "readwrite");
    const sub = await tx.objectStore("submissions").get(clientId);
    if (sub) await tx.objectStore("submissions").put({ ...sub, path });
    await tx.objectStore("outbox").delete(clientId);
    await tx.done;
  },
  async markError(clientId: string, message: string) {
    const d = await db();
    const item = await d.get("outbox", clientId);
    if (item) await d.put("outbox", { ...item, last_error: message });
  },
  async remove(clientId: string) {
    await (await db()).delete("outbox", clientId);
  },
};
