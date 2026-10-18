// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";

import type { RichTextField } from "../../src/fields/dom-field";
import {
  applyTextInsertion,
  captureFieldSelection,
  insertionWasAccepted,
} from "../../src/insertion/apply-text-insertion";

describe("applyTextInsertion", () => {
  afterEach(() => document.body.replaceChildren());

  it("inserts literal text at a captured cursor and emits the exact event oracle", () => {
    const field = inputWithValue("Hello world");
    const events = observeInsertionEvents(field);

    applyTextInsertion(field, "brave ", { kind: "text", start: 6, end: 6 });

    expect(field.value).toBe("Hello brave world");
    expect(events).toEqual([
      {
        type: "input",
        constructor: "InputEvent",
        inputType: "insertText",
        data: "brave ",
        bubbles: true,
        composed: true,
        cancelable: false,
      },
      {
        type: "change",
        constructor: "Event",
        inputType: null,
        data: null,
        bubbles: true,
        composed: false,
        cancelable: false,
      },
    ]);
  });

  it("replaces only the captured selection and emits replacement semantics", () => {
    const field = inputWithValue("before SELECT after");
    const events = observeInsertionEvents(field);

    applyTextInsertion(field, "replacement", { kind: "text", start: 7, end: 13 });

    expect(field.value).toBe("before replacement after");
    expect(events[0]).toEqual(
      expect.objectContaining({
        type: "input",
        inputType: "insertReplacementText",
        data: "replacement",
      }),
    );
    expect(events[1]).toEqual(expect.objectContaining({ type: "change" }));
  });

  it("inserts an HTML/script payload as literal text, never as parsed markup or executable code", () => {
    const field = inputWithValue("Hello world");
    const payload = '<img src=x onerror=alert(1)><script>window.__xss = true;</script>';

    applyTextInsertion(field, payload, { kind: "text", start: 6, end: 6 });

    // The payload lands byte-for-byte inside the field's plain text value.
    expect(field.value).toBe(`Hello ${payload}world`);
    // No element was parsed out of the inserted content anywhere in the
    // document, and no script executed as a side effect of insertion.
    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it("does not modify an untouched textarea sibling when inserting into the target field", () => {
    const field = inputWithValue("Hello world");
    const sibling = document.createElement("textarea");
    sibling.value = "sibling untouched value";
    document.body.append(sibling);
    const siblingEvents: string[] = [];
    sibling.addEventListener("input", () => siblingEvents.push("input"));
    sibling.addEventListener("change", () => siblingEvents.push("change"));

    applyTextInsertion(field, "brave ", { kind: "text", start: 6, end: 6 });

    expect(field.value).toBe("Hello brave world");
    expect(sibling.value).toBe("sibling untouched value");
    expect(siblingEvents).toEqual([]);
  });
});

function inputWithValue(initialValue: string): HTMLInputElement {
  const field = document.createElement("input");
  field.value = initialValue;
  document.body.append(field);
  return field;
}

function observeInsertionEvents(field: HTMLInputElement): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const name of ["input", "change"]) {
    field.addEventListener(name, (event) => {
      const inputEvent = event instanceof InputEvent ? event : null;
      events.push({
        type: event.type,
        constructor: event.constructor.name,
        inputType: inputEvent?.inputType ?? null,
        data: inputEvent?.data ?? null,
        bubbles: event.bubbles,
        composed: event.composed,
        cancelable: event.cancelable,
      });
    });
  }
  return events;
}

/**
 * Task 036. The rich-text half of the insertion path.
 *
 * happy-dom has no `execCommand`, which is exactly the branch worth exercising
 * here: it is the fallback a browser without it - or an editor that refuses -
 * would take, and it is where the "honour a cancelled `beforeinput`" rule
 * lives. The `execCommand` path itself is a real-browser behaviour and is
 * covered by the headed suite.
 */
describe("applyTextInsertion into a Rich Text Field", () => {
  afterEach(() => document.body.replaceChildren());

  it("inserts at the caret without dispatching any key event", () => {
    const host = editingHost("Hello world");
    const keyEvents: string[] = [];
    for (const type of ["keydown", "keypress", "keyup"]) {
      host.addEventListener(type, () => keyEvents.push(type));
    }
    selectWithin(host, 6, 6);

    applyTextInsertion(host, "brave ", captureFieldSelection(host));

    expect(host.textContent).toBe("Hello brave world");
    // The rule that keeps a multi-line Template from sending a chat message.
    expect(keyEvents).toEqual([]);
  });

  it("replaces only the captured selection", () => {
    const host = editingHost("before SELECT after");
    selectWithin(host, 7, 13);
    applyTextInsertion(host, "replacement", captureFieldSelection(host));
    expect(host.textContent).toBe("before replacement after");
  });

  it("inserts an HTML payload as literal text, never as parsed markup", () => {
    const host = editingHost("Hello ");
    selectWithin(host, 6, 6);
    applyTextInsertion(host, '<img src=x onerror=alert(1)>', captureFieldSelection(host));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("Hello <img src=x onerror=alert(1)>");
  });

  it("leaves the Field untouched when the editor cancels beforeinput", () => {
    const host = editingHost("untouched");
    host.addEventListener("beforeinput", (event) => event.preventDefault());
    selectWithin(host, 9, 9);

    applyTextInsertion(host, " and more", captureFieldSelection(host));

    // The editor said it would handle this itself. Writing anyway is how a
    // document-model editor ends up with a DOM it did not author.
    expect(host.textContent).toBe("untouched");
    expect(insertionWasAccepted(host, " and more")).toBe(false);
  });

  it("appends at the end when the captured selection is gone", () => {
    const host = editingHost("kept");
    const stale = captureFieldSelection(host);
    host.replaceChildren(document.createTextNode("kept"));
    applyTextInsertion(host, " more", stale);
    expect(host.textContent).toBe("kept more");
  });

  it("counts a whitespace-reshaped insertion as accepted", () => {
    const host = editingHost("");
    host.replaceChildren();
    host.append(paragraph("Line one"), paragraph("Line two"));
    // An editor is free to turn a newline into a paragraph boundary.
    expect(insertionWasAccepted(host, "Line one\nLine two")).toBe(true);
    expect(insertionWasAccepted(host, "Line three")).toBe(false);
  });
});

function editingHost(text: string): RichTextField {
  const host = document.createElement("div");
  host.setAttribute("contenteditable", "true");
  host.setAttribute("role", "textbox");
  host.setAttribute("aria-label", "Prompt");
  host.textContent = text;
  document.body.append(host);
  return host as RichTextField;
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.textContent = text;
  return element;
}

function selectWithin(host: HTMLElement, start: number, end: number): void {
  const textNode = host.firstChild;
  if (!textNode) throw new Error("The fixture host has no text to select within");
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
