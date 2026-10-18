import { useEffect, useState } from "react";
import type { Question } from "../../shared/types";
import { api } from "./api";
import { cache } from "./db";

/** 端末キャッシュを先に表示し、取れればネットワークの最新で置き換える */
export function useQuestion(id: string, reveal = false) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setQuestion(null);
    setError(null);
    (async () => {
      // reveal 時も通信できなければ端末キャッシュ (解答例なし) で表示だけはする
      const cached = await cache.getQuestion(id);
      if (cached && alive) setQuestion(cached);
      try {
        const q = await api.question(id, reveal);
        if (!alive) return;
        setQuestion(q);
        if (!reveal) await cache.setQuestion(q);
      } catch (e) {
        if (alive && !cached) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, reveal]);

  return { question, error };
}
