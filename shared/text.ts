/** 字数カウント: 改行は数えず、サロゲートペアは1文字として数える */
export function countChars(s: string): number {
  return [...s.replace(/\r?\n/g, "")].length;
}

/** 全角英数記号→半角、空白除去 (fill/numeric の照合用。採点は Claude が行うが表示の参考に使う) */
export function normalizeAnswer(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, "")
    .toLowerCase();
}
