import { describe, expect, it } from "vitest";

import { pickerStyles } from "../../src/ui/picker/picker-styles";

describe("Picker editable Field label styling", () => {
  it("gives the clickable Field name visible hover, focus, and pressed depth cues", () => {
    expect(pickerStyles).toContain(".picker-field-alias-trigger:hover");
    expect(pickerStyles).toContain(".picker-field-alias-trigger:focus-visible");
    expect(pickerStyles).toContain(".picker-field-alias-trigger:active");
    expect(pickerStyles).toMatch(/picker-field-alias-trigger:hover[^}]*box-shadow:\s*inset/u);
  });

  it("keeps inline rename actions to the right of the Field name input", () => {
    expect(pickerStyles).toMatch(
      /picker-field-alias-editor\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/u,
    );
  });
});

describe("Picker viewport fit (Task 023 Addendum B5, finding 15)", () => {
  it("never asks for more width than the viewport has, so browser zoom cannot push its right-hand side out of reach", () => {
    expect(pickerStyles).toMatch(/\.picker\s*\{[^}]*width:\s*min\(348px,\s*calc\(100vw - 16px\)\)/u);
  });

  it("bounds its height to the viewport in both anchored and pinned modes", () => {
    expect(pickerStyles).toMatch(/\.picker\s*\{[^}]*max-height:\s*min\(440px,\s*calc\(100vh - 16px\)\)/u);
    expect(pickerStyles).toMatch(/\.picker\.pinned\s*\{[^}]*max-height:\s*min\(560px,\s*calc\(100vh - 16px\)\)/u);
  });
});
