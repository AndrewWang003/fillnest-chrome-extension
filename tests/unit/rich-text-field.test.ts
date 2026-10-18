// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";

import {
  asSupportedField,
  fieldObservedTitle,
  isFieldBindable,
  readAccessibleName,
  readFieldText,
  readSafeMetadata,
  type RichTextField,
} from "../../src/fields/dom-field";
import { RICH_TEXT_EFFECTIVE_TYPE } from "../../src/fields/field-eligibility";
import { classifyCompatibilityKind } from "../../src/compatibility/compatibility-kind";
import { buildFieldIdentityKey } from "../../src/recognition/recognition-evidence";
import { recordInsertionRejectionTransition } from "../../src/storage/binding-commands";
import type { FillNestState } from "../../src/storage/records";

/**
 * Task 036. The eligibility rules, the identity they produce, and the two
 * addenda that hang off them.
 *
 * The three named acceptance targets are represented here by their real
 * markup, taken from the owner's own console capture on 2026-09-09 - the
 * attributes only, never a site name, a class name or a selector. What is
 * asserted is that the *generic* rule admits that shape, not that we recognize
 * those sites.
 */
describe("Rich Text Field eligibility", () => {
  afterEach(() => document.body.replaceChildren());

  it("admits an editing host that declares itself with a role and a name", () => {
    const host = mount(`<div contenteditable="true" role="textbox" aria-multiline="true"
      aria-label="Write your prompt"></div>`);
    const field = asSupportedField(host);
    expect(field).toBe(host);
    expect(readSafeMetadata(field as never).effectiveType).toBe(RICH_TEXT_EFFECTIVE_TYPE);
  });

  it("admits a host declared by an accessible name alone, and one declared by role alone", () => {
    const named = mount(`<div contenteditable="true" aria-label="Message"></div>`);
    const roleOnly = mount(`<div contenteditable="true" role="textbox"></div>`);
    expect(asSupportedField(named)).toBe(named);
    expect(asSupportedField(roleOnly)).toBe(roleOnly);
  });

  it("refuses a host that declares nothing", () => {
    const host = mount(`<div contenteditable="true">Editable content</div>`);
    expect(asSupportedField(host)).toBeNull();
  });

  it("refuses a cell, a code editor, and anything inside a grid or listbox", () => {
    for (const markup of [
      `<div contenteditable="true" role="gridcell" aria-label="Amount"></div>`,
      `<div contenteditable="true" role="code" aria-label="Source"></div>`,
      `<div contenteditable="true" role="listitem" aria-label="Card title"></div>`,
    ]) {
      expect(asSupportedField(mount(markup))).toBeNull();
    }

    const grid = mount(`<div role="grid"><div role="row">
      <div contenteditable="true" role="textbox" aria-label="Notes"></div></div></div>`);
    const inGrid = grid.querySelector<HTMLElement>("[contenteditable]");
    expect(inGrid).not.toBeNull();
    expect(asSupportedField(inGrid as Element)).toBeNull();
  });

  // Task 036 Addendum D. The veto on `aria-multiline="false"` is gone. It was
  // written against an imagined single-line rich editor and never refused one;
  // what it did refuse, met in the field, was a 734x60 chat composer that
  // declares `role="textbox" aria-multiline="false"` and holds block-level
  // paragraphs. A page that contradicts itself is not evidence, and the cost of
  // being wrong the other way is offering a Template in a one-line title box -
  // still a box the person is typing prose into.
  it("accepts a composer that calls itself single-line while behaving otherwise", () => {
    const host = mount(
      `<div contenteditable="true" role="textbox" aria-multiline="false" aria-label="Ask anything"><p></p></div>`,
    );
    expect(asSupportedField(host)).not.toBeNull();
  });

  // Task 036 Addendum D. Task 024 Addendum C.1 already read `data-placeholder`
  // as this Field's display title; refusing to accept the same string as a
  // declaration was an inconsistency in FillNest, not a property of the page.
  it("accepts a host named only by its placeholder, and lets it carry a Binding", () => {
    const host = mount(
      `<div contenteditable="true" data-placeholder="Type / for quick access"></div>`,
    );
    const field = asSupportedField(host);
    expect(field).not.toBeNull();
    expect(isFieldBindable(field as never)).toBe(true);
  });

  it("keeps refusing a placeholder that names a sensitive value", () => {
    const host = mount(`<div contenteditable="true" data-placeholder="One-time code"></div>`);
    expect(asSupportedField(host)).toBeNull();
  });

  it("refuses a code editor that declares itself only as a multi-line text box", () => {
    // CodeMirror 6's own markup. It declares `role="textbox"` and
    // `aria-multiline="true"` exactly as a chat composer does; what separates
    // them is that it has switched off every natural-language affordance.
    const codeMirror = mount(`<div contenteditable="true" role="textbox" aria-multiline="true"
      spellcheck="false" autocorrect="off" autocapitalize="off" aria-label="Editor content"></div>`);
    expect(asSupportedField(codeMirror)).toBeNull();

    // Turning off spellcheck alone is not enough to disqualify prose.
    const proseWithoutSpellcheck = mount(`<div contenteditable="true" role="textbox"
      spellcheck="false" aria-label="Write your prompt"></div>`);
    expect(asSupportedField(proseWithoutSpellcheck)).not.toBeNull();

    // And a composer that leaves them on, or sets them for prose, is admitted -
    // this is ChatGPT's own combination.
    const composer = mount(`<div contenteditable="true" role="textbox" aria-multiline="true"
      spellcheck="true" autocorrect="on" autocapitalize="sentences" aria-label="Ask a question"></div>`);
    expect(asSupportedField(composer)).not.toBeNull();
  });

  it("refuses a sensitive or date-purpose editing host on its accessible name alone", () => {
    // A bare editing host has no `name`, `id` or `autocomplete`, so the
    // accessible name is the only word evidence the existing vetoes can use.
    for (const name of ["Card number", "One-time code", "Recovery code", "Date of birth"]) {
      const host = mount(`<div contenteditable="true" role="textbox" aria-label="${name}"></div>`);
      expect(asSupportedField(host)).toBeNull();
    }
  });

  it("treats only the outermost editing host as the Field", () => {
    const outer = mount(`<div contenteditable="true" role="textbox" aria-label="Prompt">
      <p contenteditable="true">a paragraph the editor owns</p></div>`);
    const inner = outer.querySelector<HTMLElement>("p");
    expect(asSupportedField(outer)).toBe(outer);
    expect(asSupportedField(inner as Element)).toBeNull();
  });

  it("refuses a host the page has marked aria-disabled", () => {
    const host = mount(`<div contenteditable="true" role="textbox" aria-label="Prompt" aria-disabled="true"></div>`);
    expect(asSupportedField(host)).toBeNull();
  });

  it("reads an accessible name from aria-label, aria-labelledby, and a wrapping label", () => {
    const labelled = mount(`<div><span id="composer-label">Ask a question</span>
      <div contenteditable="true" role="textbox" aria-labelledby="composer-label"></div></div>`);
    const host = labelled.querySelector<HTMLElement>("[contenteditable]") as RichTextField;
    expect(readAccessibleName(host)).toBe("Ask a question");

    const wrapped = mount(`<label>Notes<div contenteditable="true" role="textbox"></div></label>`);
    const inLabel = wrapped.querySelector<HTMLElement>("[contenteditable]") as RichTextField;
    expect(readAccessibleName(inLabel)).toBe("Notes");
  });

  it("excludes a wrapping Rich Text Field's draft from label metadata (Task 039 C1)", () => {
    const wrapped = mount(
      `<label>Message<div contenteditable="true" role="textbox">CONFIDENTIAL EXISTING DRAFT</div></label>`,
    );
    const field = wrapped.querySelector<HTMLElement>("[contenteditable]") as RichTextField;

    expect(readAccessibleName(field)).toBe("Message");
    expect(readSafeMetadata(field).accessibleName).toBe("Message");
    expect(fieldObservedTitle(field)).toBe("Message");
  });

  it("excludes editable descendants from referenced label metadata (Task 039 C1)", () => {
    const labelled = mount(`<div><span id="composer-label">Reply
      <span contenteditable="true">PRIVATE LABEL DRAFT</span></span>
      <div contenteditable="true" role="textbox" aria-labelledby="composer-label"></div></div>`);
    const field = labelled.querySelectorAll<HTMLElement>("[contenteditable]")[1] as RichTextField;

    expect(readAccessibleName(field)).toBe("Reply");
    expect(readSafeMetadata(field).accessibleName).toBe("Reply");
    expect(fieldObservedTitle(field)).toBe("Reply");
  });

  it("excludes a textarea's content from a Rich Text Field's label (Task 039 Addendum A)", () => {
    const wrapped = mount(`<label>Message <textarea>PRIVATE TEXTAREA CONTENT</textarea>
      <div contenteditable="true" role="textbox"></div></label>`);
    const field = wrapped.querySelector<HTMLElement>("[contenteditable]") as RichTextField;

    expect(readAccessibleName(field)).toBe("Message");
    expect(fieldObservedTitle(field)).toBe("Message");
  });

  it("preserves existing internal label whitespace when no editable text contributes (Task 039 C1)", () => {
    const label = document.createElement("label");
    label.append(document.createTextNode("Message   details\n here"));
    const field = document.createElement("div") as RichTextField;
    field.setAttribute("contenteditable", "true");
    field.setAttribute("role", "textbox");
    label.append(field);
    document.body.append(label);

    expect(readAccessibleName(field)).toBe("Message   details\n here");
  });

  it("preserves whitespace where multiple aria-labelledby sources meet (Task 039 C1)", () => {
    const container = document.createElement("div");
    const first = document.createElement("span");
    first.id = "first-label";
    first.textContent = "  First  ";
    const second = document.createElement("span");
    second.id = "second-label";
    second.textContent = "  Second  ";
    const field = document.createElement("div") as RichTextField;
    field.setAttribute("contenteditable", "true");
    field.setAttribute("role", "textbox");
    field.setAttribute("aria-labelledby", "first-label second-label");
    container.append(first, second, field);
    document.body.append(container);

    expect(readAccessibleName(field)).toBe("First     Second");
  });

  it("reads the Field's text as plain text, with formatting dropped", () => {
    const host = mount(`<div contenteditable="true" role="textbox" aria-label="Prompt">
      <p><strong>Bold</strong> and <em>italic</em></p></div>`) as RichTextField;
    expect(readFieldText(host)).toContain("Bold and italic");
    expect(readFieldText(host)).not.toContain("<strong>");
  });
});

describe("Rich Text Field identity and Binding", () => {
  afterEach(() => document.body.replaceChildren());

  it("keys a named host on its accessible name, and an unnamed one on how many hosts the page has", () => {
    const withName = identityKey({ accessibleName: "Write your prompt" });
    const otherName = identityKey({ accessibleName: "Search" });
    expect(withName).not.toBeNull();
    expect(withName).not.toBe(otherName);
    // A hash: no readable page text reaches the key.
    expect(withName).not.toContain("Write your prompt");

    // This is what tiered Binding is about. A named host's key does not move
    // when the page gains or loses another editor; an unnamed one's does,
    // because with nothing else to key on it falls back to counting.
    expect(identityKey({ accessibleName: "Write your prompt", supportedFieldCount: 4 })).toBe(withName);
    const unnamed = identityKey({ accessibleName: "" });
    expect(identityKey({ accessibleName: "", supportedFieldCount: 4 })).not.toBe(unnamed);

    // Addendum A, from the owner's QA: an SPA re-parents its composer as the
    // view rebuilds around it, and keeps editors mounted that are not on
    // screen. A named host must survive both; neither the ancestor chain nor
    // the ordinal is part of its key.
    expect(
      identityKey({ accessibleName: "Write your prompt", ancestorTags: ["main", "section", "div"] }),
    ).toBe(withName);
    expect(identityKey({ accessibleName: "Write your prompt", equivalentFieldIndex: 2 })).toBe(withName);
    expect(withName).not.toContain("ancestors");
    expect(withName).not.toContain("ordinal");
    // An unnamed host still carries the chain - it has nothing better.
    expect(identityKey({ accessibleName: "", ancestorTags: ["main", "section"] })).not.toBe(unnamed);
  });

  it("leaves a native control's identity key byte-identical", () => {
    // The migration constraint. A stored Page Profile is found by exact key
    // match, so a new key property must never appear on a key that already
    // existed.
    expect(
      buildFieldIdentityKey({
        tagName: "INPUT",
        effectiveType: "text",
        name: "email",
        id: "email",
        autocomplete: "email",
        ariaLabel: "",
        label: "Email",
        formName: "signup",
        ancestorTags: ["form", "div"],
        supportedFieldCount: 3,
        equivalentFieldCount: 1,
        equivalentFieldIndex: 0,
      }),
    ).toBe(
      '{"tag":"input","type":"text","name":"email","id":"email","autocomplete":"email","semanticKind":"email","form":"signup","ancestors":["form","div"],"ordinal":0}',
    );
  });

  it("prefers a stable attribute over the label, which these applications change", () => {
    // Addendum A.3, from the owner's third QA pass: one composer resolved to
    // two alternating Field Profiles, each with its own name and Templates.
    // A composer carrying an id is keyed on the id, and a label that changes
    // with the interface's state cannot move it.
    const withId = (accessibleName: string) =>
      buildFieldIdentityKey({
        tagName: "DIV",
        effectiveType: RICH_TEXT_EFFECTIVE_TYPE,
        name: "",
        id: "prompt-textarea",
        autocomplete: "off",
        ariaLabel: accessibleName,
        label: "",
        accessibleName,
        formName: "",
        ancestorTags: ["div", "form"],
        supportedFieldCount: 1,
        equivalentFieldCount: 1,
        equivalentFieldIndex: 0,
      });
    expect(withId("Ask anything")).toBe(withId("问问 ChatGPT"));
    expect(withId("Ask anything")).not.toContain("accessibleName");

    // With no attribute to key on, the name is still the identity - it is the
    // only thing there is, and it is what tiered Binding is granted on.
    expect(identityKey({ accessibleName: "Write your prompt" })).not.toBe(
      identityKey({ accessibleName: "Search" }),
    );
  });

  it("allows Binding only where an accessible name gives a stable key", () => {
    const named = mount(`<div contenteditable="true" role="textbox" aria-label="Prompt"></div>`);
    const roleOnly = mount(`<div contenteditable="true" role="textbox"></div>`);
    const native = mount(`<input type="text" name="notes">`);
    expect(isFieldBindable(named as never)).toBe(true);
    expect(isFieldBindable(roleOnly as never)).toBe(false);
    expect(isFieldBindable(native as never)).toBe(true);
  });
});

describe("Task 024 Addendum B: the compatibility kind of a rich-text host", () => {
  it("is the structural rich-text token, never the host's autofill hint", () => {
    // ChatGPT's composer carries `autocomplete="off"`. Without this rule it
    // would match every unrelated control on the site that also opts out.
    expect(classifyCompatibilityKind({ effectiveType: RICH_TEXT_EFFECTIVE_TYPE, autocomplete: "off" })).toEqual({
      kind: "other",
      token: "rich-text",
    });
    expect(classifyCompatibilityKind({ effectiveType: RICH_TEXT_EFFECTIVE_TYPE, autocomplete: "" })).toEqual({
      kind: "other",
      token: "rich-text",
    });
    // `other` is same-Site only under the existing rules, so no rich-text host
    // can ever produce a cross-Site automatic suggestion.
    expect(classifyCompatibilityKind({ effectiveType: "text", autocomplete: "off" })).toEqual({
      kind: "other",
      token: "off",
    });
  });
});

describe("Task 036: the Insertion Rejection fact", () => {
  it("records a rejection, clears it on the next success, and writes nothing when unchanged", () => {
    const state = stateWithField();
    const rejected = recordInsertionRejectionTransition(state, {
      fieldProfileId: "field-1",
      rejected: true,
    });
    expect(rejected.next?.fieldProfiles[0]?.insertionRejected).toBe(true);

    const unchanged = recordInsertionRejectionTransition(rejected.next as FillNestState, {
      fieldProfileId: "field-1",
      rejected: true,
    });
    expect(unchanged.next).toBeNull();

    const cleared = recordInsertionRejectionTransition(rejected.next as FillNestState, {
      fieldProfileId: "field-1",
      rejected: false,
    });
    // Removed rather than written as `false`: the absence is the default.
    expect(cleared.next?.fieldProfiles[0]).not.toHaveProperty("insertionRejected");
  });

  it("does nothing for a Field that has no stored profile", () => {
    const transition = recordInsertionRejectionTransition(stateWithField(), {
      fieldProfileId: "missing",
      rejected: true,
    });
    expect(transition.next).toBeNull();
    expect(transition.result).toBe(false);
  });
});

function mount(markup: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = markup.trim();
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
}

function identityKey(overrides: {
  accessibleName: string;
  ancestorTags?: string[];
  supportedFieldCount?: number;
  equivalentFieldIndex?: number;
}): string | null {
  return buildFieldIdentityKey({
    tagName: "DIV",
    effectiveType: RICH_TEXT_EFFECTIVE_TYPE,
    name: "",
    id: "",
    autocomplete: "",
    ariaLabel: overrides.accessibleName,
    label: "",
    accessibleName: overrides.accessibleName,
    formName: "",
    ancestorTags: overrides.ancestorTags ?? ["div", "form"],
    supportedFieldCount: overrides.supportedFieldCount ?? 1,
    equivalentFieldCount: 1,
    equivalentFieldIndex: overrides.equivalentFieldIndex ?? 0,
  });
}

function stateWithField(): FillNestState {
  return {
    version: 1,
    templates: [],
    sites: [],
    pageProfiles: [],
    fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
    bindings: [],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
  } as unknown as FillNestState;
}
