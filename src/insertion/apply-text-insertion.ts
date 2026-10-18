import { isNativeField, readFieldText, type SupportedField } from "../fields/dom-field";

/**
 * Where the insertion goes, captured while the Field still owns the selection.
 *
 * A native control can be described by two offsets and restored from them at
 * any time. An editing host cannot: its selection lives in the document, in
 * terms of nodes, so what gets captured is a live `Range` and what restores it
 * is the document's own Selection.
 */
export type FieldSelectionSnapshot =
  | { readonly kind: "text"; readonly start: number; readonly end: number }
  | { readonly kind: "rich"; readonly range: Range; readonly text: string };

export function captureFieldSelection(field: SupportedField): FieldSelectionSnapshot | null {
  if (isNativeField(field)) {
    const { selectionStart, selectionEnd } = field;
    if (selectionStart === null || selectionEnd === null) return null;
    return { kind: "text", start: selectionStart, end: selectionEnd };
  }

  const selection = field.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!field.contains(range.commonAncestorContainer)) return null;
  return { kind: "rich", range: range.cloneRange(), text: range.toString() };
}

/**
 * Task 036. Insert `content` at the Field's caret or over its selection.
 *
 * Never a whole-field replacement, never HTML, and - the part that matters on
 * a chat composer - **never a synthetic key event**. A multi-line Template
 * must not send a message the user did not send.
 */
export function applyTextInsertion(
  field: SupportedField,
  content: string,
  selection: FieldSelectionSnapshot | null,
): void {
  if (isNativeField(field)) {
    applyNativeInsertion(field, content, selection);
    return;
  }
  applyRichTextInsertion(field, content, selection);
}

function applyNativeInsertion(
  field: HTMLInputElement | HTMLTextAreaElement,
  content: string,
  selection: FieldSelectionSnapshot | null,
): void {
  field.focus();
  if (!selection || selection.kind !== "text") {
    if (!document.execCommand("insertText", false, content)) {
      throw new Error("The browser could not insert text at the Target Field cursor");
    }
  } else {
    const inputType = selection.start === selection.end ? "insertText" : "insertReplacementText";
    field.setRangeText(content, selection.start, selection.end, "end");
    field.dispatchEvent(
      new InputEvent("input", {
        inputType,
        data: content,
        bubbles: true,
        composed: true,
        cancelable: false,
      }),
    );
  }
  field.dispatchEvent(
    new Event("change", {
      bubbles: true,
      composed: false,
      cancelable: false,
    }),
  );
}

/**
 * Ask first, then insert.
 *
 * Measured in a real headed Chrome on 2026-09-09, because the obvious
 * implementation is wrong: **`execCommand("insertText")` called from a content
 * script fires `input` in the page's world but never `beforeinput`.** A
 * document-model editor - ProseMirror, Lexical, Quill - routes typing through
 * `beforeinput`, so relying on `execCommand` alone hands the editor a DOM
 * mutation it did not author and no event explaining it, which is precisely
 * the case where it reverts the text on its next render.
 *
 * So the editor is asked with an explicit `beforeinput` it can act on:
 *
 * - cancelled: the editor says it will handle this itself. Inserting anyway
 *   would insert twice.
 * - not cancelled: `execCommand` does the work, and the page still gets its
 *   `input` event.
 *
 * A hand-dispatched event is untrusted, and an editor is entitled to ignore
 * it. That is why nothing here is assumed - `insertionWasAccepted` checks a
 * frame later what actually survived.
 */
function applyRichTextInsertion(
  field: SupportedField,
  content: string,
  selection: FieldSelectionSnapshot | null,
): void {
  field.focus();
  restoreRichSelection(field, selection);

  const beforeInput = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: content,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  if (!field.dispatchEvent(beforeInput)) return;

  // `execCommand` is deprecated and may simply be absent, but where it exists
  // it is the insertion the browser itself performs - correct across wrapped
  // nodes, inline elements and an editor's own node structure in a way manual
  // Range surgery is not.
  if (typeof document.execCommand === "function" && document.execCommand("insertText", false, content)) {
    return;
  }

  const documentSelection = field.ownerDocument.getSelection();
  const range = documentSelection?.rangeCount ? documentSelection.getRangeAt(0) : null;
  if (!range || !field.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const inserted = field.ownerDocument.createTextNode(content);
  range.insertNode(inserted);
  range.setStartAfter(inserted);
  range.collapse(true);
  documentSelection?.removeAllRanges();
  documentSelection?.addRange(range);
  field.dispatchEvent(
    new InputEvent("input", {
      inputType: "insertText",
      data: content,
      bubbles: true,
      composed: true,
      cancelable: false,
    }),
  );
}

function restoreRichSelection(field: SupportedField, selection: FieldSelectionSnapshot | null): void {
  const documentSelection = field.ownerDocument.getSelection();
  if (!documentSelection) return;

  if (
    selection?.kind === "rich" &&
    selection.range.startContainer.isConnected &&
    selection.range.endContainer.isConnected &&
    field.contains(selection.range.commonAncestorContainer)
  ) {
    documentSelection.removeAllRanges();
    documentSelection.addRange(selection.range);
    return;
  }

  // The captured range is gone, or there never was one. Land at the end of the
  // Field rather than at its start, which is where a caret-less focus leaves
  // an empty document - appending to what the user has typed is the behaviour
  // they asked for.
  if (documentSelection.rangeCount > 0) {
    const current = documentSelection.getRangeAt(0);
    if (field.contains(current.commonAncestorContainer)) return;
  }
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  documentSelection.removeAllRanges();
  documentSelection.addRange(range);
}

/**
 * Task 036. Whether the editor kept what was inserted.
 *
 * Called a frame after the insertion, because the failure that matters is not
 * a refusal - it is an editor that accepts the DOM change and overwrites it on
 * its next render. Comparison is whitespace-normalized: an editor is free to
 * turn a newline into a paragraph boundary, and that is acceptance, not loss.
 */
export function insertionWasAccepted(field: SupportedField, content: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();
  const needle = normalize(content);
  if (needle.length === 0) return true;
  return normalize(readFieldText(field)).includes(needle);
}
