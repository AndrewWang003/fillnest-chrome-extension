import type { Messages } from "../i18n/messages";

const PLACEHOLDER = ":record";

/**
 * Task 037. A derived label is a name FillNest made up, so it is translated.
 * A name the **user** typed is theirs and is never touched - which is why
 * every caller resolves `userAlias ?? derive(...)`, and only the second half
 * comes through here.
 */
type SemanticKindLabelKey =
  | "labelEmail"
  | "labelPhone"
  | "labelWebsite"
  | "labelPostalCode"
  | "labelAddress"
  | "labelFirstName"
  | "labelLastName"
  | "labelName";

const SEMANTIC_KIND_LABELS: Record<string, SemanticKindLabelKey> = {
  email: "labelEmail",
  phone: "labelPhone",
  website: "labelWebsite",
  "postal-code": "labelPostalCode",
  address: "labelAddress",
  "first-name": "labelFirstName",
  "last-name": "labelLastName",
  name: "labelName",
};

/**
 * Task 040. The name a Page or Field is shown by: the user's own alias, or a
 * name derived in the reader's language. `messages` is required so a caller
 * cannot fall back to English without saying so.
 */
export function pageDisplayName(page: { userAlias?: string; identityKey?: string }, messages: Messages): string {
  return page.userAlias ?? derivePageDisplayLabel(page.identityKey, messages);
}

export function fieldDisplayName(
  field: { userAlias?: string; identityKey?: string; observedTitle?: string },
  messages: Messages,
): string {
  return field.userAlias ?? deriveFieldDisplayLabel(field.identityKey, field.observedTitle, messages);
}

export function derivePageDisplayLabel(
  identityKey: string | undefined,
  messages: Messages,
): string {
  if (identityKey === undefined) return messages.labelPage();
  const pathname = identityKey.split("?")[0] ?? "";
  if (pathname === "" || pathname === "/") return messages.labelHome();

  const segments = pathname
    .split("/")
    .map((segment) => cleanSegment(segment))
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return messages.labelPage();

  return segments.map(titleCaseSegment).join(" / ");
}

export function deriveFieldDisplayLabel(
  identityKey: string | undefined,
  observedTitle: string | undefined,
  messages: Messages,
): string {
  // The page's own words for this Field, read off its markup. Not ours to
  // translate.
  if (observedTitle && observedTitle.trim().length > 0) return observedTitle;
  if (!identityKey) return messages.labelTextField();
  const { semanticKind, ordinal } = readFieldIdentity(identityKey);
  const known = SEMANTIC_KIND_LABELS[semanticKind];
  if (known) return messages[known]();
  // Every unclassified Field on a Page falls back to this same generic
  // label; the Field's position among its indistinguishable siblings
  // (already captured, privacy-safe, structural evidence - not raw HTML
  // attributes) is the only thing left that can tell them apart. The first
  // of a group stays plain "Text field" so the common single-field case
  // reads cleanly; later ones are numbered from 2.
  return ordinal !== null && ordinal > 0
    ? messages.labelTextFieldNumbered(ordinal + 1)
    : messages.labelTextField();
}

function readFieldIdentity(identityKey: string): { semanticKind: string; ordinal: number | null } {
  try {
    const parsed: unknown = JSON.parse(identityKey);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const semanticKind = typeof record.semanticKind === "string" ? record.semanticKind : "";
      const ordinal =
        typeof record.ordinal === "number" && Number.isInteger(record.ordinal) && record.ordinal >= 0
          ? record.ordinal
          : null;
      return { semanticKind, ordinal };
    }
  } catch {
    // Malformed identityKey text falls through to the generic label.
  }
  return { semanticKind: "", ordinal: null };
}

function cleanSegment(rawSegment: string): string {
  if (rawSegment.length === 0) return "";
  const withoutPlaceholder = rawSegment.split(PLACEHOLDER).join("");
  if (/\d/u.test(withoutPlaceholder)) return "";
  return withoutPlaceholder.replace(/-{2,}/gu, "-").replace(/^-+|-+$/gu, "");
}

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[-_]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
