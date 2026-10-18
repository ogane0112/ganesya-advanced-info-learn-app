import { useSyncExternalStore } from "react";

// アプリ全体の状態 (オンライン/再ログイン要否/送信待ち件数)
export interface AppStatus {
  online: boolean;
  authRequired: boolean;
  pending: number;
  syncing: boolean;
}

let state: AppStatus = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  authRequired: false,
  pending: 0,
  syncing: false,
};
const listeners = new Set<() => void>();

export function setStatus(patch: Partial<AppStatus>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getStatus() {
  return state;
}

export function useStatus(): AppStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
