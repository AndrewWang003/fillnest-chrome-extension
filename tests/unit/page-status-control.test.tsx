import { en } from "../../src/i18n/messages";
import { zhHans } from "../../src/i18n/messages.zh-Hans";
// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";

import { PageStatusControl, pageStatusStyles } from "../../src/ui/page-status/PageStatusControl";

describe("PageStatusControl", () => {
  it("exposes one explicit Active or Pause action without a menu", () => {
    const root = document.createElement("div");
    const onToggle = vi.fn();

    render(<PageStatusControl mode="active" messages={en} lang="en" onToggle={onToggle} />, root);
    expect(root.querySelectorAll("button")).toHaveLength(1);
    expect(root.querySelector("button")?.getAttribute("aria-label")).toBe("Pause on this site");
    expect(root.textContent).not.toContain("Menu");

    render(<PageStatusControl mode="paused" messages={en} lang="en" onToggle={onToggle} />, root);
    expect(root.querySelector("button")?.getAttribute("aria-label")).toBe("Active on this site");
  });

  // Codex review, 2026-09-13: it sits inside a page with a `lang` of its own.
  it("says which language its name is in", () => {
    const root = document.createElement("div");
    render(<PageStatusControl mode="active" messages={zhHans} lang="zh-Hans" onToggle={vi.fn()} />, root);
    expect(root.querySelector("button")?.getAttribute("lang")).toBe("zh-Hans");
  });

  it("keeps state color click-owned and uses a stationary hover affordance", () => {
    // The point of this assertion is that hover changes only the border and
    // the shadow - never the fill, which is what says whether FillNest is
    // active here. Task 034 moved the colours onto theme tokens; what hover
    // touches is unchanged.
    expect(pageStatusStyles).toContain(
      ".page-status:hover { border-color: var(--fn-accent-border); box-shadow: 0 10px 26px rgb(var(--fn-shadow) / 30%); }",
    );
    expect(pageStatusStyles).not.toContain(".page-status:hover { background:");
    expect(pageStatusStyles).not.toContain(".page-status.active:hover");
    expect(pageStatusStyles).not.toContain("transform:");
  });
});
