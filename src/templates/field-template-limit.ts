import { UserFacingError } from "../messages/user-error";
import { effectiveTemplateListForField } from "../storage/shared-templates";
import type { FillNestState } from "../storage/records";

/**
 * How many Templates one Field may offer.
 *
 * Set by the owner at **20 for V1**. The number is a usability limit, not a
 * storage one: the Picker's list is meant to be scanned, and a Field that
 * offers forty things has stopped being a shortcut. If it turns out to be too
 * few, raising it is a one-line change and breaks nothing - a stored Field that
 * is already over the limit keeps working, because the limit is checked when
 * something is *added*, never when state is read or validated.
 *
 * ## What it covers, and what it deliberately does not
 *
 * It covers the ordinary, repeatable "put this Template on this Field"
 * actions - the ones a user performs dozens of times, and the only ones that
 * can grow a list without bound.
 *
 * It does **not** cover the structural Shared Template Set operations: adding a
 * member, joining, merging two Sets, or promoting a Field-only slot. Those are
 * one-off actions the user has already confirmed, usually mid-flow, and
 * refusing one because the result would be twenty-one is a worse outcome than
 * a Field briefly offering twenty-one. A Field that arrives over the limit
 * that way still cannot grow further: every add path checks.
 *
 * That exemption used to be silent, which was its real problem - a Set merge
 * could take a Field from twenty to forty with the confirmation saying only
 * how many *fields* were affected. The Picker's merge and join confirmation
 * now states the resulting Template count and flags it when it goes over, so
 * the trade is the user's to make rather than something that happens to them.
 *
 * Restore and every Undo are exempt for the same reason the content-length
 * limit exempts them - they carry relationships FillNest already accepted, and
 * refusing to give a user their own data back is the worse failure.
 */
export const MAX_TEMPLATES_PER_FIELD = 20;

/**
 * When the Picker starts showing the count.
 *
 * Below this a running total is noise on a list the user can see the length of
 * at a glance; above it, the user is close enough to the limit that meeting it
 * for the first time as a refusal would be a surprise.
 */
export const FIELD_TEMPLATE_COUNT_VISIBLE_FROM = MAX_TEMPLATES_PER_FIELD - 5;

export const FIELD_TEMPLATE_LIMIT_MESSAGE =
  `This field already offers ${MAX_TEMPLATES_PER_FIELD} Templates, which is the most FillNest keeps on one field. Remove one from this field before adding another.`;

export function fieldTemplateCount(state: FillNestState, fieldProfileId: string): number {
  return effectiveTemplateListForField(state, fieldProfileId).templateIds.length;
}

export function fieldIsAtTemplateLimit(state: FillNestState, fieldProfileId: string): boolean {
  return fieldTemplateCount(state, fieldProfileId) >= MAX_TEMPLATES_PER_FIELD;
}

/** Throws the user-facing message when this Field cannot take another Template. */
export function assertFieldCanTakeAnotherTemplate(state: FillNestState, fieldProfileId: string): void {
  if (fieldIsAtTemplateLimit(state, fieldProfileId)) {
    throw new UserFacingError("field-template-limit", FIELD_TEMPLATE_LIMIT_MESSAGE);
  }
}

/**
 * A slot added to a Shared Template Set lands on every member at once, so the
 * question is whether **any** member is full - not whether the Set is.
 */
export function assertSharedSetCanTakeAnotherTemplate(state: FillNestState, setId: string): void {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === setId);
  if (!set) return;
  for (const fieldProfileId of set.memberFieldProfileIds) {
    if (fieldIsAtTemplateLimit(state, fieldProfileId)) {
      throw new UserFacingError(
        "set-template-limit",
        `One of the fields in this set already offers ${MAX_TEMPLATES_PER_FIELD} Templates, which is the most FillNest keeps on one field. Remove one from the set before adding another.`,
      );
    }
  }
}
