import { describe, expect, it } from "vitest";

import { deriveOutcomePreview, derivePreview } from "../../src/templates/template-preview";

describe("derivePreview", () => {
  it("uses the first non-empty line", () => {
    expect(derivePreview("Hello world\nSecond line")).toBe("Hello world");
  });

  it("skips leading blank lines", () => {
    expect(derivePreview("\n\n  \nHello world\nSecond line")).toBe("Hello world");
  });

  it("trims leading and trailing whitespace on the chosen line", () => {
    expect(derivePreview("   Hello world   \nSecond line")).toBe("Hello world");
  });

  it("handles Windows-style line endings", () => {
    expect(derivePreview("\r\nHello world\r\nSecond line")).toBe("Hello world");
  });

  it("falls back to the trimmed whole content when every line is blank", () => {
    expect(derivePreview("   \n   \n   ")).toBe("");
  });

  it("returns single-line content trimmed", () => {
    expect(derivePreview("  Only line  ")).toBe("Only line");
  });

  it("limits outcome previews to 50 characters without splitting Unicode characters", () => {
    const content = `${"A".repeat(49)}😀tail`;
    expect(deriveOutcomePreview(content)).toBe(`${"A".repeat(49)}…`);
    expect(Array.from(deriveOutcomePreview(content))).toHaveLength(50);
  });
});
