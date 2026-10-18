import { describe, expect, it } from "vitest";

import { findInlineUserFacingStrings } from "../../scripts/lib/i18n-conformance.mjs";

/**
 * Task 037, slice 5. The gate's own fixture: it has to fail on the thing it
 * exists to catch, and stay quiet about everything else - a check that cries
 * wolf gets silenced, and then guards nothing.
 */
describe("findInlineUserFacingStrings", () => {
  it("catches prose written between JSX tags", () => {
    const findings = findInlineUserFacingStrings(`
      export function Thing() {
        return <p>Save a local copy of your Templates.</p>;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.text).toBe("Save a local copy of your Templates.");
  });

  it("catches prose in the attributes a reader actually hears or sees", () => {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      const findings = findInlineUserFacingStrings(`<input ${attribute}="Search your templates" />`);
      expect(findings.map((finding) => finding.kind), attribute).toEqual([attribute]);
    }
  });

  // 2026-09-11 audit: the Picker rendered two English sentences imported from
  // the core as constants, and the gate - which reads literals - never saw them.
  it("catches an imported message constant rendered in JSX", () => {
    const findings = findInlineUserFacingStrings(`
      <p class="picker-length-error" role="alert">{TEMPLATE_TOO_LONG_MESSAGE}</p>
    `);
    expect(findings).toEqual([{ line: 2, kind: "constant", text: "TEMPLATE_TOO_LONG_MESSAGE" }]);
  });

  // Task 040: the Picker's instant tooltips are read off `data-tooltip`, and
  // three of them were English literals in a Chinese Picker.
  it("catches prose in a tooltip attribute", () => {
    expect(findInlineUserFacingStrings(`<button data-tooltip="Remove from this field" />`)).toEqual([
      { line: 1, kind: "data-tooltip", text: "Remove from this field" },
    ]);
  });

  it("says nothing about a message constant that is not rendered", () => {
    expect(findInlineUserFacingStrings(`throw new Error(TEMPLATE_TOO_LONG_MESSAGE);`)).toEqual([]);
  });

  it("says nothing about a string that comes from the catalogue", () => {
    expect(
      findInlineUserFacingStrings(`
        <p aria-label={t.searchTemplates()}>{t.backupDescription()}</p>
      `),
    ).toEqual([]);
  });

  it("says nothing about comments, which nobody renders", () => {
    expect(
      findInlineUserFacingStrings(`
        // This explains why the code does what it does.
        /* And so does this one, at length, in prose. */
        <p>{t.thing()}</p>
      `),
    ).toEqual([]);
  });

  it("says nothing about TypeScript generics, which look exactly like JSX", () => {
    // The trap that made the first version of this check unusable:
    // \`useState<Foo>(null)\` puts code between a ">" and a "<".
    expect(
      findInlineUserFacingStrings(`
        const [state, setState] = useState<FillNestState | null>(null);
        const map = new Map<string, ReadonlyArray<string>>();
      `),
    ).toEqual([]);
  });

  it("catches a single capitalised word, because that is usually a button", () => {
    // The first version required two words, and the owner found Move, Insert,
    // Restore and every theme name still in English.
    expect(findInlineUserFacingStrings("<button>Save</button>").map((f) => f.text)).toEqual(["Save"]);
  });

  it("says nothing about the shapes an identifier takes", () => {
    // A lowercase single word is an internal token: the icon components pass
    // `label="edit"` to build a marker nobody reads. SCREAMING_CASE is never
    // prose either.
    expect(findInlineUserFacingStrings('<Icon label="edit" />')).toEqual([]);
    expect(findInlineUserFacingStrings("<span>ACTIVATION_STATE_CHANGED</span>")).toEqual([]);
    expect(findInlineUserFacingStrings("const p: Promise<void> = run();")).toEqual([]);
  });

  it("catches a lowercase word between tags that trails off or ends a sentence", () => {
    // Task 037 Addendum F: the share Finder's "more…" toggle reached a Chinese
    // reader in English. A lowercase single word was taken for a token, but
    // one that carries an ellipsis or a full stop between tags is read.
    expect(findInlineUserFacingStrings("<button>\n  more…\n</button>").map((f) => f.text)).toEqual(["more…"]);
    expect(findInlineUserFacingStrings("<span>done.</span>").map((f) => f.text)).toEqual(["done."]);
    expect(findInlineUserFacingStrings("<span>enabled</span>")).toEqual([]);
  });

  it("catches prose built at runtime, which is where the outcome messages live", () => {
    const findings = findInlineUserFacingStrings(
      "setOutcome({ message: `Deleted ${count} Templates from your library.` });",
    );
    expect(findings.map((finding) => finding.kind)).toEqual(["interpolated text"]);
  });

  it("says nothing about a class list, a selector or a CSS value", () => {
    expect(findInlineUserFacingStrings("<div class={`page-status ${mode}`} />")).toEqual([]);
    expect(findInlineUserFacingStrings("el.style.top = `${top}px`;")).toEqual([]);
  });

  it("honours an explicit exemption with a stated reason", () => {
    // The one honest reason: a word the user must type cannot be translated,
    // because translating it would make the instruction wrong.
    expect(
      findInlineUserFacingStrings(
        ["// i18n-exempt: the word the user must type.", '<input placeholder="Type delete" />'].join("\n"),
      ),
    ).toEqual([]);
  });

  it("reports the line the string is actually on", () => {
    const findings = findInlineUserFacingStrings(
      ["<div>", "  {/* a comment */}", "  <p>Two words here</p>", "</div>"].join("\n"),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(3);
  });

  // Task 037 Addendum B. Three shapes the owner found still English on screen.
  it("catches a quoted string in a ternary, a tuple or an assignment", () => {
    const texts = (source: string) => findInlineUserFacingStrings(source).map((finding) => finding.text);
    expect(texts('<input placeholder={filtered ? "Search Template bodies" : "Search…"} />')).toEqual([
      "Search Template bodies",
      "Search…",
    ]);
    expect(texts('const STATUS = [["", "All"], ["active", "Active"]];')).toEqual(["All", "Active"]);
    expect(texts('const label = selected > 0 ? `${selected} chosen` : "Select all filtered addresses";')).toEqual([
      "Select all filtered addresses",
    ]);
    expect(texts('<button>{direction === "ascending" ? "↑ Ascending" : "↓ Descending"}</button>')).toEqual([
      "↑ Ascending",
      "↓ Descending",
    ]);
  });

  it("catches JSX text written next to an expression", () => {
    expect(
      findInlineUserFacingStrings("<p>Share <strong>{name}</strong> to Shared Template Set{\" \"}</p>").map(
        (finding) => finding.text,
      ),
    ).toContain("to Shared Template Set");
    expect(
      findInlineUserFacingStrings("<p>\n  Delete {count} Templates?\n  <span>Sites: {list}</span>\n</p>").map(
        (finding) => finding.text,
      ),
    ).toEqual(expect.arrayContaining(["Delete", "Sites:"]));
  });

  // Codex review, 2026-09-13: each of these reached a Chinese reader while
  // this gate passed.
  it("catches a lowercase word beside an expression - a unit, a count's noun", () => {
    const texts = (source: string) => findInlineUserFacingStrings(source).map((finding) => finding.text);
    expect(texts('<span>\n  {count} option{count === 1 ? "" : "s"}\n</span>')).toContain("option");
    expect(texts("<span>{selected.size} selected</span>")).toContain("selected");
    expect(texts('<span>\n  {first}–{last} of{" "}\n  {total}\n</span>')).toContain("of");
    expect(texts("<li>\n  {count} field{count === 1 ? \"\" : \"s\"} before\n</li>")).toEqual(
      expect.arrayContaining(["field", "before"]),
    );
  });

  it("says nothing about the keywords that sit between braces in code", () => {
    expect(findInlineUserFacingStrings("<Row key={id} template={template} selectable {...rest} />")).toEqual([]);
    expect(findInlineUserFacingStrings("function watch(onChange: (dark: boolean) => void {")).toEqual([]);
    expect(
      findInlineUserFacingStrings(`
        try {
          run();
        } catch {
          recover();
        } finally {
          done();
        }
        if (a) {
          b();
        } else {
          c();
        }
      `),
    ).toEqual([]);
  });

  it("catches prose in any prop named for a message, a label or a text", () => {
    expect(
      findInlineUserFacingStrings('<List items={items} emptyMessage="No Templates match this Search." />').map((finding) => finding.text),
    ).toEqual(["No Templates match this Search."]);
  });

  it("catches a short runtime phrase once it has sentence punctuation", () => {
    const texts = (source: string) => findInlineUserFacingStrings(source).map((finding) => finding.text);
    expect(texts("const tail = ` (+${hidden} more)`;")).toHaveLength(1);
    expect(texts("const said = `${action.label} is available.`;")).toHaveLength(1);
    expect(texts("<p title={`${used} of ${max}. ${detail}`} />")).toHaveLength(1);
    // A path, a dotted key and a calc() are not.
    expect(texts("const path = `${base}/${name}.json`;")).toEqual([]);
    expect(texts("const key = `${prefix}.${name}`;")).toEqual([]);
    expect(texts("const width = `calc(${a} + ${b})`;")).toEqual([]);
  });

  it("catches a sentence handed to a state setter, but not an identifier", () => {
    expect(
      findInlineUserFacingStrings(['setError("FillNest returned invalid data.");', 'setDestination("Templates");'].join("\n")).map(
        (finding) => finding.text,
      ),
    ).toEqual(["FillNest returned invalid data."]);
  });

  it("catches a fallback after ||, which is not a type union", () => {
    expect(findInlineUserFacingStrings('return derivePreview(content) || "Empty Template";').map((f) => f.text)).toEqual([
      "Empty Template",
    ]);
  });

  it("says nothing about quoted strings that are code", () => {
    expect(
      findInlineUserFacingStrings(
        [
          'if (event.key === "Escape") close();',
          'switch (mode) { case "Overview": break; }',
          'throw new Error(response.ok ? "Invalid state response" : response.error);',
          'export type Destination = "Overview" | "Templates";',
          'setDestination("Templates");',
          '{(["Overview", "Templates"] as const).map((item) => item)}',
          '<div class={pinned ? "picker pinned" : "picker"} />',
          'document.querySelectorAll("input[form], textarea[form]");',
          "const theme = { light: { a: 1 }, dark: { a: 2 } };",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
