import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

/** 問題文の相対パス画像を /api/assets/ 経由に書き換える */
function rewriteImages(html: string, baseDir: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (/^(https?:|data:|\/)/i.test(src)) return;
    const path = new URL(src, `https://x/${baseDir}/`).pathname.replace(/^\//, "");
    img.setAttribute("src", `/api/assets/${path}`);
    img.setAttribute("loading", "lazy");
  });
  return tpl.innerHTML;
}

export function Markdown({ text, baseDir }: { text: string; baseDir?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false, gfm: true, breaks: true });
    const clean = DOMPurify.sanitize(raw);
    return baseDir ? rewriteImages(clean, baseDir) : clean;
  }, [text, baseDir]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
