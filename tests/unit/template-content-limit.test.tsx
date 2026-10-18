// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it } from "vitest";

import { FillNestRepository, type LocalStorageArea } from "../../src/storage/fillnest-repository";
import { TemplateLengthCounter } from "../../src/ui/shared/TemplateLengthCounter";
import {
  assertTemplateContentWithinLimit,
  isTemplateContentWithinLimit,
  MAX_TEMPLATE_CONTENT_BYTES,
  MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS,
  TEMPLATE_CONTENT_COUNT_VISIBLE_FROM,
  templateContentByteLength,
  TEMPLATE_TOO_LONG_MESSAGE,
} from "../../src/templates/template-content";

describe("Template content limit (Task 035, R8)", () => {
  it("measures UTF-8 bytes, so a writing system is not penalised for its encoding", () => {
    expect(templateContentByteLength("abc")).toBe(3);
    expect(templateContentByteLength("中文字")).toBe(9);
    // An emoji costs what it actually costs to store.
    expect(templateContentByteLength("🙂")).toBe(4);
  });

  it("holds the budget the owner set: 1,000 Chinese characters", () => {
    const chinese = "中".repeat(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS);
    expect(templateContentByteLength(chinese)).toBe(MAX_TEMPLATE_CONTENT_BYTES);
    expect(isTemplateContentWithinLimit(chinese)).toBe(true);
    expect(isTemplateContentWithinLimit(`${chinese}中`)).toBe(false);
  });

  it("buys about the same amount of writing in Latin script", () => {
    expect(isTemplateContentWithinLimit("a".repeat(MAX_TEMPLATE_CONTENT_BYTES))).toBe(true);
    expect(isTemplateContentWithinLimit("a".repeat(MAX_TEMPLATE_CONTENT_BYTES + 1))).toBe(false);
  });

  it("refuses with a sentence the user can act on, stating the budget both ways", () => {
    expect(() => assertTemplateContentWithinLimit("中".repeat(1001))).toThrow(TEMPLATE_TOO_LONG_MESSAGE);
    expect(TEMPLATE_TOO_LONG_MESSAGE).toContain("1,000 Chinese characters");
    expect(TEMPLATE_TOO_LONG_MESSAGE).toContain("3,000 letters");
    expect(() => assertTemplateContentWithinLimit("中".repeat(1000))).not.toThrow();
  });
});

class QuotaStorage implements LocalStorageArea {
  private readonly values: Record<string, unknown> = {};

  constructor(private readonly failWith: string | null) {}

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: this.values[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (this.failWith !== null) throw new Error(this.failWith);
    Object.assign(this.values, items);
  }

  async remove(): Promise<void> {
    // Not exercised here.
  }
}

describe("a full local store (Task 035, R8)", () => {
  it("says what is full and what to do about it, instead of passing on Chrome's wording", async () => {
    const repository = new FillNestRepository(
      new QuotaStorage("Resource::kQuotaBytes quota exceeded"),
    );

    await expect(
      repository.createTemplate({ content: "Anything", pageUrl: "https://example.test/form" }),
    ).rejects.toThrow(/FillNest has run out of local storage/u);
  });

  it("never relabels an unrelated storage failure as a full store", async () => {
    const repository = new FillNestRepository(new QuotaStorage("The extension context was invalidated"));

    await expect(
      repository.createTemplate({ content: "Anything", pageUrl: "https://example.test/form" }),
    ).rejects.toThrow("The extension context was invalidated");
  });
});

describe("the editor's length counter (Task 035, R8 follow-up)", () => {
  function draw(content: string): { root: HTMLElement; counter: Element | null } {
    const root = document.createElement("div");
    document.body.append(root);
    render(<TemplateLengthCounter content={content} />, root);
    return { root, counter: root.querySelector(".template-length-counter") };
  }

  function clear(root: HTMLElement): void {
    render(null, root);
    root.remove();
  }

  it("stays silent until the draft is near the limit", () => {
    // A running total here is noise on a Template plainly nowhere near it.
    const { root, counter } = draw("Short enough");
    expect(counter).toBeNull();
    clear(root);
  });

  it("counts what is left in the characters the writer is actually using", () => {
    // 2,600 letters is 2,600 bytes, so 400 letters remain.
    const latin = draw("a".repeat(2600));
    expect(latin.counter?.textContent).toBe("About 400 characters left");
    expect(latin.counter?.classList.contains("over")).toBe(false);
    clear(latin.root);

    // 900 Chinese characters is 2,700 bytes, so 100 characters remain - not
    // the 300 a byte count would imply, and not the "2,700 of 3,000" that
    // would tell someone who typed 900 characters that they typed 2,700.
    const chinese = draw("中".repeat(900));
    expect(chinese.counter?.textContent).toBe("About 100 characters left");
    clear(chinese.root);
  });

  it("keeps the exact budget available for anyone who wants it", () => {
    const { root, counter } = draw("中".repeat(900));
    expect(counter?.getAttribute("title")).toContain("2,700 of 3,000");
    expect(counter?.getAttribute("title")).toContain("A Chinese character counts as three");
    clear(root);
  });

  it("says how far over an over-long draft is, which is the state Save is disabled in", () => {
    const { root, counter } = draw("中".repeat(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS + 40));
    expect(counter?.classList.contains("over")).toBe(true);
    expect(counter?.textContent).toBe("About 40 characters too many");
    clear(root);
  });

  it("shows nothing for a draft just below the threshold and something just above it", () => {
    const below = draw("a".repeat(TEMPLATE_CONTENT_COUNT_VISIBLE_FROM - 1));
    expect(below.counter).toBeNull();
    clear(below.root);

    const at = draw("a".repeat(TEMPLATE_CONTENT_COUNT_VISIBLE_FROM));
    expect(at.counter).not.toBeNull();
    clear(at.root);
  });
});
