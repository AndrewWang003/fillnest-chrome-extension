import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageStatusStyles } from "../../src/ui/page-status/PageStatusControl";
import { pickerStyles } from "../../src/ui/picker/picker-styles";

// Task 045 (owner QA, 2026-09-15): a scrollbar that appears only once content
// overflows re-lays out everything beside it. Every rule that makes an element
// scroll must keep its scrollbar's room, and every stylesheet that has such a
// rule gets the shared 10px scrollbar that the right paddings assume. The
// headed spec (scrollbar-gutter.spec.ts) measures the result; this catches the
// next scroll container before anyone sees it jump.

const sheets: ReadonlyArray<readonly [string, string]> = [
  ["side-panel.css", readFileSync("src/ui/side-panel/side-panel.css", "utf8")],
  ["popup.css", readFileSync("src/ui/popup/popup.css", "utf8")],
  ["picker-styles.ts", pickerStyles],
  ["page-status styles", pageStatusStyles],
  ["toggle-switch.css", readFileSync("src/ui/shared/toggle-switch.css", "utf8")],
  ["current-website-access.css", readFileSync("src/ui/shared/current-website-access.css", "utf8")],
];

function rules(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((match) => ({
    selector: match[1]!.trim(),
    body: match[2]!,
  }));
}

describe("scroll containers keep their scrollbar's room", () => {
  it("every rule that scrolls also declares a stable gutter, or an always-present track", () => {
    const missing: string[] = [];
    for (const [name, css] of sheets) {
      for (const { selector, body } of rules(css)) {
        if (!/overflow(?:-y)?\s*:\s*auto/u.test(body)) continue;
        if (!/scrollbar-gutter\s*:\s*stable/u.test(body)) missing.push(`${name}: ${selector}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives the Popup and the Side Panel the shared scrollbar, and puts it in the Picker", () => {
    const shared = readFileSync("src/ui/shared/scrollbars.css", "utf8");
    expect(shared).toMatch(/::-webkit-scrollbar \{ width: 10px;/u);
    expect(pickerStyles).toContain(shared);
    for (const entry of ["src/ui/popup/main.tsx", "src/ui/side-panel/main.tsx"]) {
      expect(readFileSync(entry, "utf8")).toContain('import "../shared/scrollbars.css";');
    }
  });
});
