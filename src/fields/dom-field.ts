import {
  classifyField,
  isBindableField,
  RICH_TEXT_EFFECTIVE_TYPE,
  type SafeFieldMetadata,
} from "./field-eligibility";

/**
 * Task 036. An eligible `contenteditable` editing host.
 *
 * Narrowing `isContentEditable` to `true` is what keeps this a distinct member
 * of `SupportedField` rather than collapsing into `HTMLElement`: the compiler
 * then refuses `field.value`, `field.labels` and `field.form` on the union, so
 * every place that assumed a native control has to go through an accessor in
 * this module instead of silently reading `undefined` at runtime.
 */
export type RichTextField = HTMLElement & { readonly isContentEditable: true };

export type NativeField = HTMLInputElement | HTMLTextAreaElement;
export type SupportedField = NativeField | RichTextField;

/** Everything that could be a Field, before eligibility is judged. */
export const FIELD_CANDIDATE_SELECTOR = "input, textarea, [contenteditable]";

export function isNativeField(element: unknown): element is NativeField {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

/**
 * Whether this element is the editing host itself, rather than a node inside
 * one. The outermost host is the Field: a `contenteditable` paragraph inside a
 * `contenteditable` composer is part of that composer, not a second Field.
 */
export function isEditingHost(element: unknown): element is RichTextField {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.isContentEditable) return false;
  return element.parentElement?.isContentEditable !== true;
}

export function asSupportedField(element: Element): SupportedField | null {
  if (isNativeField(element)) {
    return classifyField(readSafeMetadata(element)).supported ? element : null;
  }
  if (!isEditingHost(element)) return null;
  return classifyField(readSafeMetadata(element)).supported ? element : null;
}

/** Task 036. Whether this Field can carry a Binding - see `isBindableField`. */
export function isFieldBindable(field: SupportedField): boolean {
  return isBindableField(readSafeMetadata(field));
}

/**
 * Whether the only thing standing between this element and support is its
 * `readOnly` flag.
 *
 * Task 016 Addendum D. A focus-driven component - Element UI's `el-select`,
 * and every typeahead built the same way - marks its own input `readonly`
 * whenever it does not have focus, and clears it again on focus. That is a
 * statement about focus, not about the field being read-only, and it is
 * indistinguishable from a genuine one **except** by what caused the focus to
 * move. Only the caller knows that; this answers the narrow question of
 * whether `readOnly` is the sole obstacle.
 *
 * Everything else still disqualifies: a disabled field, an unsupported type, a
 * sensitive field. A field that is read-only *and* a password field is still
 * simply out of scope. A Rich Text Field has no `readOnly` flag, so the
 * question does not arise for one.
 */
export function isSupportedExceptReadOnly(element: Element): element is NativeField {
  if (!isNativeField(element)) return false;
  if (!element.readOnly || element.disabled) return false;
  return classifyField({ ...readSafeMetadata(element), readOnly: false }).supported;
}

export function readSafeMetadata(field: SupportedField): SafeFieldMetadata {
  if (!isNativeField(field)) return readRichTextMetadata(field);
  return {
    tagName: field.tagName,
    effectiveType: field instanceof HTMLTextAreaElement ? "textarea" : field.type,
    disabled: field.disabled,
    readOnly: field.readOnly,
    autocomplete: field.autocomplete,
    name: field.name,
    id: field.id,
    ariaLabel: field.getAttribute("aria-label") ?? "",
    label: nativeLabelText(field),
    role: field.getAttribute("role") ?? "",
    ariaControls: field.getAttribute("aria-controls") ?? "",
    dataProvide: field.getAttribute("data-provide") ?? "",
    placeholder: field.placeholder,
    accessibleName: "",
    languageAffordances: { spellcheck: "", autocorrect: "", autocapitalize: "" },
    ancestorRoles: [],
  };
}

function readRichTextMetadata(field: RichTextField): SafeFieldMetadata {
  return {
    tagName: field.tagName,
    effectiveType: RICH_TEXT_EFFECTIVE_TYPE,
    // An editing host has no `disabled` property; `aria-disabled` is the only
    // way a page can say the same thing about one.
    disabled: field.getAttribute("aria-disabled") === "true",
    readOnly: false,
    autocomplete: field.getAttribute("autocomplete") ?? "",
    name: field.getAttribute("name") ?? "",
    id: field.id,
    ariaLabel: field.getAttribute("aria-label") ?? "",
    label: "",
    role: field.getAttribute("role") ?? "",
    ariaControls: field.getAttribute("aria-controls") ?? "",
    dataProvide: field.getAttribute("data-provide") ?? "",
    // Task 036 Addendum D. `data-placeholder` first, because that is where a
    // `contenteditable` composer keeps the words it prints in the empty box -
    // the attribute is meaningless on a non-input element, so editors invent
    // their own. `fieldObservedTitle` has read it since Task 024 Addendum C.1;
    // this is the same string reaching eligibility and identity.
    placeholder:
      field.getAttribute("data-placeholder") ?? field.getAttribute("placeholder") ?? "",
    accessibleName: readAccessibleName(field),
    languageAffordances: {
      spellcheck: field.getAttribute("spellcheck") ?? "",
      autocorrect: field.getAttribute("autocorrect") ?? "",
      autocapitalize: field.getAttribute("autocapitalize") ?? "",
    },
    ancestorRoles: readAncestorRoles(field),
  };
}

/**
 * The element's accessible name, from the three sources a page can actually
 * use on an editing host. `aria-describedby` is deliberately not one of them:
 * it is a description, not a name, and it changes as a page shows and hides
 * hints.
 */
export function readAccessibleName(field: RichTextField): string {
  const ariaLabel = field.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/u)
      .map((id) => readLabelMetadataText(field.ownerDocument.getElementById(id), field))
      .join(" ")
      .trim();
    if (text) return text;
  }

  const label = field.closest("label");
  const labelText = readLabelMetadataText(label, field).trim();
  if (labelText) return labelText;

  return "";
}

/**
 * Read only the non-editable text a label contributes as metadata.
 *
 * Task 039 C1. A wrapping label's `textContent` includes the Rich Text
 * Field's current draft. Walking the source tree lets us reject an editable
 * subtree before reading any of its text nodes, including editable content in
 * an `aria-labelledby` source.
 *
 * Task 039 Addendum A. The same holds for a `<textarea>`: its text is its
 * content - filled in by the server, or the typed value itself where a
 * framework mirrors the value into `defaultValue` - so a label wrapping one
 * would otherwise read it as the label's words. A label without such a
 * control reads exactly as its `textContent` did.
 */
export function readLabelMetadataText(source: Element | null, field: SupportedField): string {
  if (!source) return "";

  const visit = (node: Node): string => {
    if (node === field) return "";
    if (node instanceof HTMLTextAreaElement) return "";
    if (node instanceof HTMLElement && node.isContentEditable) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
    return [...node.childNodes].map(visit).join("");
  };

  return visit(source);
}

function nativeLabelText(field: NativeField): string {
  return [...(field.labels ?? [])].map((label) => readLabelMetadataText(label, field)).join(" ");
}

function readAncestorRoles(field: RichTextField): string[] {
  const roles: string[] = [];
  let ancestor = field.parentElement;
  while (ancestor && ancestor !== field.ownerDocument.body && roles.length < 12) {
    const role = ancestor.getAttribute("role")?.trim().toLowerCase();
    if (role) roles.push(role);
    ancestor = ancestor.parentElement;
  }
  return roles;
}

/* -------------------------------------------------------------------------
 * Accessors. A Rich Text Field is an ordinary element, so everything the rest
 * of the extension used to read straight off an `<input>` goes through here.
 * ---------------------------------------------------------------------- */

/** The Field's plain text. Rich content is flattened; formatting is dropped. */
export function readFieldText(field: SupportedField): string {
  return isNativeField(field) ? field.value : field.innerText;
}

export function fieldLabelText(field: SupportedField): string {
  return isNativeField(field) ? nativeLabelText(field) : readAccessibleName(field);
}

export function fieldFormElement(field: SupportedField): HTMLFormElement | null {
  return isNativeField(field) ? field.form : field.closest("form");
}

export function fieldName(field: SupportedField): string {
  return isNativeField(field) ? field.name : field.getAttribute("name") ?? "";
}

/**
 * A user-visible title for this Field, for management surfaces. The same
 * classes of readable metadata the product already shows for a native Field.
 */
export function fieldObservedTitle(field: SupportedField): string | null {
  const candidates = isNativeField(field)
    ? [
        fieldLabelText(field),
        field.getAttribute("aria-label") ?? "",
        field.getAttribute("placeholder") ?? "",
        field.getAttribute("name") ?? "",
        field.id,
      ]
    : // Task 024 Addendum C.1. The placeholder comes first for a Rich Text
      // Field, because it is the one name the user has actually *read*: it is
      // printed in the empty box. An accessible name is written for assistive
      // technology and often says something else entirely - Gemini's box shows
      // "Ask Gemini" and tells a screen reader "Enter a prompt for Gemini" -
      // and a name nobody has seen is no use in a list of Fields to choose
      // between. It stays the fallback, and identity is unaffected either way:
      // this is the display title, never the key.
      [
        field.getAttribute("data-placeholder") ?? "",
        field.getAttribute("placeholder") ?? "",
        readAccessibleName(field),
        field.id,
      ];
  const title = candidates.find((candidate) => candidate.trim().length > 0)?.trim() ?? "";
  return title.length > 0 ? title.slice(0, 1_000) : null;
}
