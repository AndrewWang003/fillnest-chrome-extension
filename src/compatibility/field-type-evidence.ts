import type { GenericFieldTypeEvidence } from "./compatibility-kind";

/**
 * `FieldProfileRecord.identityKey` is a plain (unhashed) JSON blob produced
 * by `buildFieldIdentityKey` (src/recognition/recognition-evidence.ts) that
 * already embeds `type` and `autocomplete` - both generic, standards-defined
 * HTML vocabulary, never a webpage value. This lets the compatibility engine
 * classify a stored Field's kind from data already durably on disk, with no
 * new schema field, migration, or live-DOM re-read. Malformed or legacy
 * identityKey text (or a missing identityKey) falls through to empty
 * evidence, the same "malformed identityKey" tolerance already used by
 * `deriveFieldDisplayLabel` (src/labels/display-label.ts).
 */
export function parseGenericFieldTypeEvidence(identityKey: string | undefined): GenericFieldTypeEvidence {
  if (!identityKey) return { effectiveType: "", autocomplete: "" };
  try {
    const parsed: unknown = JSON.parse(identityKey);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return {
        effectiveType: typeof record.type === "string" ? record.type : "",
        autocomplete: typeof record.autocomplete === "string" ? record.autocomplete : "",
      };
    }
  } catch {
    // Malformed identityKey text yields empty (unclassified) evidence.
  }
  return { effectiveType: "", autocomplete: "" };
}
