import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerPath, isQuestionId, nowJstIso, resultPathFor, stampFromIso } from "../shared/ids";
import { parseQuestion, sourceLabel, stripAnswers } from "../shared/question";
import { countChars, normalizeAnswer } from "../shared/text";
import { validateAnswerPayload } from "../shared/validate";

const sample = readFileSync(new URL("../data-repo-template/questions/2024-spring/q03.md", import.meta.url), "utf8");

describe("ids", () => {
  it("validates question ids", () => {
    expect(isQuestionId("2024-spring/q03")).toBe(true);
    expect(isQuestionId("2024-autumn/q11")).toBe(true);
    for (const bad of ["2024-summer/q03", "../2024-spring/q03", "2024-spring/q3", "2024-spring/q03/../../x", "", 1]) {
      expect(isQuestionId(bad)).toBe(false);
    }
  });

  it("builds answer paths only under answers/", () => {
    expect(answerPath("2024-spring/q03", "20261018-2330")).toBe("answers/2024-spring/q03/20261018-2330.json");
    expect(() => answerPath("../x", "20261018-2330")).toThrow();
    expect(() => answerPath("2024-spring/q03", "../../x")).toThrow();
  });

  it("converts timestamps to JST stamps", () => {
    expect(stampFromIso("2026-10-18T23:30:00+09:00")).toBe("20261018-2330");
    expect(stampFromIso("2026-10-18T14:30:45Z")).toBe("20261018-2330");
    expect(stampFromIso("2026-10-18T14:30:45Z", true)).toBe("20261018-233045");
    expect(nowJstIso(new Date("2026-10-18T14:30:00Z"))).toBe("2026-10-18T23:30:00+09:00");
  });

  it("maps answer files to result files", () => {
    expect(resultPathFor("answers/2024-spring/q03/20261018-2330.json")).toBe("results/2024-spring/q03/20261018-2330.json");
    expect(resultPathFor("answers/x.json")).toBeNull();
  });
});

describe("question parsing", () => {
  it("parses the sample question", () => {
    const q = parseQuestion("2024-spring/q03", sample);
    expect(q.field).toBe("アルゴリズム");
    expect(q.year).toBe(2024);
    expect(q.body).toContain("binarySearch");
    expect(q.subquestions.map((s) => s.id)).toEqual(["1-ア", "1-イ", "2", "3", "4"]);
    expect(q.subquestions[3]).toMatchObject({ type: "short", limit: 15, points: 4 });
  });

  it("strips answers for the solving screen", () => {
    const q = stripAnswers(parseQuestion("2024-spring/q03", sample));
    for (const s of q.subquestions) {
      expect(s.answer).toBeUndefined();
      expect(s.notes).toBeUndefined();
      expect(s.alt_answers).toBeUndefined();
    }
  });

  it("accepts an unfenced YAML list", () => {
    const md = `---\nyear: 2023\nseason: autumn\nnumber: 2\nfield: 経営戦略\n---\n## 本文\nテキスト\n\n## 設問\n- id: "1"\n  text: "問"\n  type: short\n  limit: 30\n`;
    const q = parseQuestion("2023-autumn/q02", md);
    expect(q.subquestions).toHaveLength(1);
    expect(q.subquestions[0].limit).toBe(30);
  });

  it("labels the source in Japanese era", () => {
    expect(sourceLabel({ year: 2024, season: "spring", number: 3 })).toBe("令和6年度 春期 午後 問3");
    expect(sourceLabel({ year: 2019, season: "spring", number: 1 })).toBe("平成31年度 春期 午後 問1");
    expect(sourceLabel({ year: 2019, season: "autumn", number: 1 })).toBe("令和元年度 秋期 午後 問1");
  });
});

describe("text", () => {
  it("counts characters without newlines", () => {
    expect(countChars("あい\nう")).toBe(3);
    expect(countChars("𠮷野家")).toBe(3);
  });
  it("normalizes answers", () => {
    expect(normalizeAnswer(" ｍｉｄ　＋ １ ")).toBe("mid+1");
  });
});

describe("answer validation", () => {
  const base = {
    question: "2024-spring/q03",
    answered_at: "2026-10-18T23:30:00+09:00",
    elapsed_sec: 1650,
    mode: "single",
    answers: { "1-ア": "mid + 1", "2": "7" },
    client_id: "0d2c1a3e-1111-4c4c-9999-123456789abc",
  };

  it("accepts a valid payload", () => {
    expect(validateAnswerPayload(base, new Set(["1-ア", "2"]))).toMatchObject({ question: "2024-spring/q03" });
  });

  it.each([
    ["path traversal in question", { question: "../../etc/passwd" }],
    ["bad date", { answered_at: "yesterday" }],
    ["negative elapsed", { elapsed_sec: -1 }],
    ["bad mode", { mode: "x" }],
    ["non-string answer", { answers: { "2": 7 } }],
    ["too long answer", { answers: { "2": "a".repeat(2001) } }],
    ["bad client id", { client_id: "x" }],
  ])("rejects %s", (_name, patch) => {
    expect(() => validateAnswerPayload({ ...base, ...patch })).toThrow();
  });

  it("rejects unknown sub-question ids", () => {
    expect(() => validateAnswerPayload(base, new Set(["2"]))).toThrow(/unknown/);
  });
});
