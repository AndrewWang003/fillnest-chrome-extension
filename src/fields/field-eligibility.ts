export interface SafeFieldMetadata {
  tagName: string;
  effectiveType: string;
  disabled: boolean;
  readOnly: boolean;
  autocomplete: string;
  name: string;
  id: string;
  ariaLabel: string;
  label: string;
  role: string;
  ariaControls: string;
  dataProvide: string;
  placeholder: string;
  /**
   * Task 036. The element's accessible name, for a Rich Text Field only.
   * Empty for `<input>` and `<textarea>`, whose name evidence already arrives
   * through `ariaLabel`, `label`, `name` and `id` - reusing those slots for a
   * second source would change their existing identity keys.
   */
  accessibleName: string;
  /**
   * Task 036. The three natural-language affordances an editing host can
   * switch off: `spellcheck`, `autocorrect`, `autocapitalize`. A host that has
   * turned off all three is not editing prose - see `isCodeEditingHost`.
   */
  languageAffordances: {
    spellcheck: string;
    autocorrect: string;
    autocapitalize: string;
  };
  /**
   * Task 036. Lower-cased `role` values on the element's ancestors, nearest
   * first, for a Rich Text Field. A composer inside a grid or a listbox is a
   * cell editor, not a composer.
   */
  ancestorRoles: readonly string[];
}

/**
 * The `effectiveType` a Rich Text Field reports. It is a structural fact about
 * the element - the same family as `type="email"` on an `<input>` - and it is
 * what Task 024 Addendum B keys its compatibility token on.
 */
export const RICH_TEXT_EFFECTIVE_TYPE = "contenteditable";

/**
 * Roles that make an editing host something other than a composer. A cell, a
 * row, an option or a code editor is a control that happens to be editable.
 */
const RICH_TEXT_ROLE_VETOES: ReadonlySet<string> = new Set([
  "code",
  "grid",
  "gridcell",
  "row",
  "cell",
  "columnheader",
  "rowheader",
  "listitem",
  "option",
  "treeitem",
]);

/** Container roles whose descendants are cells or options, never composers. */
const RICH_TEXT_ANCESTOR_ROLE_VETOES: ReadonlySet<string> = new Set([
  "grid",
  "table",
  "treegrid",
  "listbox",
  "tree",
  "menu",
]);

export type FieldEligibility =
  | { supported: true; reason: "supported" }
  | {
      supported: false;
      reason: "state" | "element" | "type" | "sensitive" | "special-purpose";
    };

const SUPPORTED_INPUT_TYPES = new Set(["text", "search", "email", "tel", "url"]);

export function classifyField(metadata: SafeFieldMetadata): FieldEligibility {
  if (metadata.disabled || metadata.readOnly) {
    return { supported: false, reason: "state" };
  }

  if (metadata.effectiveType === RICH_TEXT_EFFECTIVE_TYPE) {
    return classifyRichTextField(metadata);
  }

  const tagName = metadata.tagName.toUpperCase();
  if (tagName !== "INPUT" && tagName !== "TEXTAREA") {
    return { supported: false, reason: "element" };
  }

  if (
    tagName === "INPUT" &&
    !SUPPORTED_INPUT_TYPES.has(metadata.effectiveType.toLowerCase())
  ) {
    return { supported: false, reason: "type" };
  }

  if (isSensitive(metadata)) {
    return { supported: false, reason: "sensitive" };
  }

  if (isSpecialPurpose(metadata)) {
    return { supported: false, reason: "special-purpose" };
  }

  return { supported: true, reason: "supported" };
}

/**
 * Task 036. A `contenteditable` editing host is a Field only when the page
 * says it is one.
 *
 * The declaration requirement - `role="textbox"`, an accessible name, or a
 * placeholder - is an `or` on purpose. Requiring more than one would have
 * staked the feature on an assumption about how particular editors mark up
 * their hosts, and a rule that ships too narrow can be widened later, while one
 * that ships too wide cannot be narrowed without destroying Bindings users
 * already made.
 *
 * Addendum D widened it once, for exactly that reason. A composer met in the
 * field declared no role and no accessible name and carried only
 * `data-placeholder`, and FillNest had already decided - Task 024 Addendum C.1 -
 * that a Rich Text Field's placeholder is the best name it has, ahead of its
 * accessible name. Reading a name for the label and then refusing to accept it
 * as a declaration was an inconsistency in this file, not a property of the
 * page.
 *
 * The structural vetoes come first because they are the false-positive class
 * that actually exists on the web: a spreadsheet cell, a kanban card title and
 * a code editor are all editing hosts, and none of them is a place to offer a
 * Template.
 */
function classifyRichTextField(metadata: SafeFieldMetadata): FieldEligibility {
  const role = metadata.role.trim().toLowerCase();
  if (RICH_TEXT_ROLE_VETOES.has(role)) {
    return { supported: false, reason: "special-purpose" };
  }
  if (metadata.ancestorRoles.some((ancestorRole) => RICH_TEXT_ANCESTOR_ROLE_VETOES.has(ancestorRole))) {
    return { supported: false, reason: "special-purpose" };
  }
  if (isCodeEditingHost(metadata)) {
    return { supported: false, reason: "special-purpose" };
  }

  const declared =
    role === "textbox" ||
    metadata.accessibleName.trim().length > 0 ||
    metadata.placeholder.trim().length > 0;
  if (!declared) return { supported: false, reason: "type" };

  // Every word-based exclusion FillNest already enforces has to keep applying,
  // and on a bare editing host the accessible name is the only word evidence
  // there is - `name`, `id` and `autocomplete` are usually absent entirely.
  const withName: SafeFieldMetadata = {
    ...metadata,
    ariaLabel: metadata.ariaLabel || richTextFieldName(metadata),
    label: metadata.label || richTextFieldName(metadata),
  };
  if (isSensitive(withName)) return { supported: false, reason: "sensitive" };
  if (isSpecialPurpose(withName)) return { supported: false, reason: "special-purpose" };

  return { supported: true, reason: "supported" };
}

/**
 * Whether this editing host is a code editor rather than a prose composer.
 *
 * `role="code"` catches the hosts that say so, and almost none do: CodeMirror
 * 6 - the `contenteditable` code editor most likely to be met in the wild -
 * declares `role="textbox"` with `aria-multiline="true"`, which is exactly
 * what a chat composer declares. Checked on the real markup, the honest
 * structural difference is that a code editor switches off **every** natural-
 * language affordance the platform offers, and a prose composer switches off
 * none of them: ChatGPT's carries `spellcheck="true" autocorrect="on"
 * autocapitalize="sentences"`, and Claude's and Gemini's set none of the three.
 *
 * All three are required, deliberately. A prose editor that merely turns off
 * spellcheck is still a prose editor; one that has also turned off
 * autocorrect and autocapitalize has told the platform it is not handling
 * natural language at all.
 */
function isCodeEditingHost(metadata: SafeFieldMetadata): boolean {
  const { spellcheck, autocorrect, autocapitalize } = metadata.languageAffordances;
  return (
    spellcheck.trim().toLowerCase() === "false" &&
    autocorrect.trim().toLowerCase() === "off" &&
    ["off", "none"].includes(autocapitalize.trim().toLowerCase())
  );
}

/**
 * Task 036. Whether this Field can carry a Binding.
 *
 * A Rich Text Field qualifying only through `role="textbox"` - with neither a
 * placeholder nor an accessible name - has no stable identity to key on:
 * `buildFieldIdentityKey` would fall back to the ancestor chain and an ordinal, and on the SPAs this feature exists for, expanding a
 * sidebar or switching conversations changes that chain. The resulting Binding
 * would disappear periodically, which costs more trust than the missing
 * feature does. Insertion still works; only remembering does not.
 */
export function isBindableField(metadata: SafeFieldMetadata): boolean {
  if (metadata.effectiveType !== RICH_TEXT_EFFECTIVE_TYPE) return true;
  return richTextFieldName(metadata).length > 0;
}

/**
 * The words a Rich Text Field offers about itself: its accessible name, and
 * failing that its placeholder.
 *
 * One function serves four callers on purpose - eligibility, the word-based
 * exclusions, bindability and `buildFieldIdentityKey` - because a name good
 * enough to admit a Field is a name good enough to key it on, and a name good
 * enough to key it on has to face the sensitive-word rules. Splitting them is
 * how a Field gets admitted under one name and remembered under another.
 *
 * The accessible name comes first, and this is the one place where it does.
 * Task 024 Addendum C.1 puts the placeholder ahead of it for the **display**
 * title, and says in as many words that identity is unaffected either way.
 * Here the order is not a preference at all: it is the guarantee that every
 * Binding made before Addendum D keeps the key it was made under. A composer
 * that has both is keyed exactly as it was; the placeholder only ever speaks
 * for a host that had nothing else to say.
 */
export function richTextFieldName(metadata: {
  effectiveType: string;
  accessibleName?: string;
  placeholder?: string;
}): string {
  if (metadata.effectiveType !== RICH_TEXT_EFFECTIVE_TYPE) return "";
  return (metadata.accessibleName ?? "").trim() || (metadata.placeholder ?? "").trim();
}

function isSpecialPurpose(metadata: SafeFieldMetadata): boolean {
  const semanticSources = new Set(
    [metadata.name, metadata.id, metadata.ariaLabel, metadata.label]
      .map(datePurposeKey)
      .filter((value): value is string => value !== null),
  ).size;
  // Addendum D. A `combobox` or `spinbutton` commits a **choice**, and what the
  // person typed may never be submitted at all - which is the whole reason this
  // veto exists. That argument is about single-value controls, and every
  // fixture protecting it is an `<input>`. A `<textarea>` or an editing host
  // cannot be committing one choice: multi-line and pick-exactly-one are
  // contradictory claims, and when a page makes both, the shape of the element
  // is the honest half. Met in the field as `<textarea role="combobox">` on a
  // chat composer, where the typed text is unambiguously the message.
  const singleValueControl = metadata.tagName.toUpperCase() === "INPUT";
  const controllerEvidence =
    singleValueControl && /^(?:combobox|spinbutton)$/u.test(metadata.role.toLowerCase());
  const calendarTarget = isDatePurposeText(metadata.ariaControls);
  const dateFormat = /(?:yyyy|yy|mm|dd).*(?:yyyy|yy|mm|dd)/iu.test(
    metadata.placeholder,
  );
  const declaredDateWidget = isDatePurposeText(metadata.dataProvide);
  const birthDate = [metadata.name, metadata.id, metadata.ariaLabel, metadata.label]
    .some((value) => isBirthDatePurpose(value));

  return (
    controllerEvidence ||
    semanticSources >= 2 ||
    (semanticSources >= 1 && (controllerEvidence || calendarTarget)) ||
    ((controllerEvidence || calendarTarget) && dateFormat) ||
    declaredDateWidget ||
    birthDate
  );
}

function datePurposeKey(value: string): string | null {
  if (!isDatePurposeText(value)) return null;
  return value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .join(" ");
}

function isDatePurposeText(value: string): boolean {
  const words = value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
  const hasDatePurpose = words.some(
    (word) => word === "date" || word === "calendar" || word === "datepicker",
  );
  const hasFreeTextPurpose = words.some((word) =>
    ["note", "notes", "comment", "comments", "description", "details", "message"].includes(
      word,
    ),
  );
  return hasDatePurpose && !hasFreeTextPurpose;
}

// A birth date is not an ambiguous free-text "start date" note: it is an
// intrinsically structured date even when a widget fails to expose ARIA
// calendar metadata or an associated native label.
function isBirthDatePurpose(value: string): boolean {
  const words = value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
  return words.includes("date") && (words.includes("birth") || words.includes("dob"));
}

// A national identity number is an intrinsically sensitive, structured value,
// and PROJECT.md's exclusion list ends with "and other sensitive or
// unsupported fields". Task 028 Slice 3 (audit finding S4).
//
// Evaluated per evidence source rather than over the joined description, for
// the same reason `isDatePurposeText` is: a free-text word in one attribute
// must not excuse an identity term in another. A field labelled "Social
// Security Number" that merely carries id="notes" is still an SSN field.
//
// Terms are generic and site-neutral, and matched word-bounded so "sincerity",
// "singer", "tinting", and "destination" are unaffected.
const NATIONAL_IDENTITY_PATTERN =
  /\b(?:ssn|sin|nino|tin|passport|social[ -]?security|social[ -]?insurance|national[ -]?insurance|national[ -]?id(?:entity)?|tax[ -]?id)\b/u;

function isNationalIdentityPurpose(value: string): boolean {
  const words = value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
  const hasFreeTextPurpose = words.some((word) =>
    ["note", "notes", "comment", "comments", "description", "describe", "details", "message"].includes(
      word,
    ),
  );
  if (hasFreeTextPurpose) return false;
  return NATIONAL_IDENTITY_PATTERN.test(words.join(" "));
}

function isSensitive(metadata: SafeFieldMetadata): boolean {
  const autocompleteTokens = metadata.autocomplete.toLowerCase().split(/\s+/u);
  if (
    autocompleteTokens.includes("one-time-code") ||
    autocompleteTokens.some(
      (token) =>
        token.includes("password") ||
        token.startsWith("cc-") ||
        token.startsWith("transaction-"),
    )
  ) {
    return true;
  }

  const description = [metadata.name, metadata.id, metadata.ariaLabel, metadata.label]
    .join(" ")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase();

  if (
    [metadata.name, metadata.id, metadata.ariaLabel, metadata.label].some(isNationalIdentityPurpose)
  ) {
    return true;
  }

  return /\b(?:password|passphrase|pin|otp|totp|cvv|cvc|passcode|(?:access|recovery|backup)[ -]?(?:code|pin|token)|api[ -]?(?:key|token)|(?:ssh[ -]?)?private[ -]?key|client[ -]?secret|secret[ -]?key|(?:auth|authorization|bearer)[ -]?token|(?:2fa|mfa)[ -]?(?:code|passcode|token)|sms[ -]?passcode|authenticat(?:ion|or)[ -]?(?:code|passcode|token)|one[ -]?time[ -]?(?:code|passcode|token)|verification[ -]?(?:code|passcode|token)|security[ -]?(?:code|passcode|token)|card[ -]?verification[ -]?value|card[ -]?holder(?:[ -]?name)?|name[ -]?on[ -]?card|(?:credit|debit|payment)[ -]?card|bank[ -]?account(?:[ -]?number)?|routing(?:[ -]?transit)?[ -]?number|iban|swift[ -]?code|bic|bsb|sort[ -]?code|(?:card[ -]?)?(?:expiration|expiry)(?:[ -]?(?:date|month|year))?|valid[ -]?thru|card[ -]?number)\b/u.test(
    description,
  );
}
