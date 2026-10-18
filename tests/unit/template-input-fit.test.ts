import { describe, expect, it } from "vitest";

import { fitTemplateInput, MAX_TEMPLATE_CONTENT_BYTES } from "../../src/templates/template-content";

// Task 035 Addendum A (owner decision, 2026-09-11): input stops at the limit.
// Only what was just typed or pasted is cut; text already there is never
// touched, and a character is never split.
describe("fitTemplateInput", () => {
  const full = "中".repeat(1000);

  it("leaves input within the limit exactly as typed", () => {
    expect(fitTemplateInput("ab", "abc", 3)).toEqual({ value: "abc", caret: 3, truncated: false });
  });

  it("refuses a character typed at the limit", () => {
    expect(fitTemplateInput(full, `${full}a`, 1001)).toEqual({ value: full, caret: 1000, truncated: true });
  });

  it("keeps the part of a paste that fits and drops the rest", () => {
    const before = "a".repeat(MAX_TEMPLATE_CONTENT_BYTES - 5);
    const result = fitTemplateInput(before, `${before}0123456789`, before.length + 10);
    expect(result).toEqual({ value: `${before}01234`, caret: before.length + 5, truncated: true });
  });

  it("cuts the pasted text in the middle, not the text after the caret", () => {
    const head = "a".repeat(1000);
    const tail = "b".repeat(1995);
    const next = `${head}XXXXXXXXXX${tail}`;
    const result = fitTemplateInput(head + tail, next, 1010);
    expect(result).toEqual({ value: `${head}XXXXX${tail}`, caret: 1005, truncated: true });
  });

  it("never splits a multi-byte character", () => {
    const before = "a".repeat(MAX_TEMPLATE_CONTENT_BYTES - 4);
    const result = fitTemplateInput(before, `${before}中中`, before.length + 2);
    expect(result).toEqual({ value: `${before}中`, caret: before.length + 1, truncated: true });
    expect(fitTemplateInput(before.slice(1), `${before.slice(1)}🙂🙂`, before.length + 3).value).toBe(`${before.slice(1)}🙂`);
  });

  it("lets a Template saved before the limit existed shrink, but not grow", () => {
    const legacy = "中".repeat(1100);
    expect(fitTemplateInput(legacy, legacy.slice(1), 0)).toEqual({ value: legacy.slice(1), caret: 0, truncated: false });
    expect(fitTemplateInput(legacy, `${legacy}a`, 1101)).toEqual({ value: legacy, caret: 1100, truncated: true });
  });
});
