import { describe, expect, it } from "vitest";

import { storeDescriptionProblems } from "../../scripts/lib/store-description.mjs";

// Codex review, 2026-09-12: the store check measured the manifest's
// `__MSG_extensionDescription__` placeholder - 28 characters, always short
// enough - instead of the description each language actually shows.

const catalogue = (message: string) => ({ extensionDescription: { message } });

describe("storeDescriptionProblems", () => {
  it("measures each language's description, not the placeholder", () => {
    expect(
      storeDescriptionProblems("__MSG_extensionDescription__", {
        en: catalogue("Field-aware plain-text templates with explicit user control."),
        zh_CN: catalogue("为每个输入框准备好的纯文本模版。"),
      }),
    ).toEqual([]);

    expect(
      storeDescriptionProblems("__MSG_extensionDescription__", {
        en: catalogue("x".repeat(133)),
        zh_CN: catalogue("短"),
      }),
    ).toEqual(["the en description is 133 characters; the store allows 132"]);
  });

  it("names a language whose catalogue lacks the message", () => {
    expect(storeDescriptionProblems("__MSG_extensionDescription__", { en: {} })).toEqual([
      "the en catalogue has no extensionDescription message",
    ]);
  });

  it("measures a literal description as it is", () => {
    expect(storeDescriptionProblems("Plain", {})).toEqual([]);
    expect(storeDescriptionProblems("y".repeat(140), {})).toEqual([
      "the description is 140 characters; the store allows 132",
    ]);
    expect(storeDescriptionProblems("", {})).toEqual(["the manifest has no description"]);
  });

  it("counts characters, not UTF-16 units", () => {
    expect(storeDescriptionProblems("__MSG_d__", { en: { d: { message: "😀".repeat(132) } } })).toEqual([]);
  });
});
