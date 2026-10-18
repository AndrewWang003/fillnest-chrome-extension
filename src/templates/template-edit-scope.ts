import type { FillNestState, TemplateRecord } from "../storage/fillnest-repository";

export type TemplateEditScope =
  | "single"
  | "everywhere-only"
  | "field-copy"
  | "shared-inherited"
  // Task 027 Addendum A (defect F): the Current Field's only path to this
  // Template is an owner-only slot it owns, with no ordinary slot for the
  // same Template also contributing - editing it must never offer a
  // Set-wide save.
  | "shared-field-only";

/**
 * Describes the choices an Inline Picker may offer while editing a Template.
 * Direct Bindings owned by Shared Template Set members are dormant and do
 * not count as effective uses; each Shared Binding and each Override
 * (Task 026) is one effective scope of its own. This intentionally does not
 * import `effectiveTemplateListForField` as a value - the content-script
 * bundle (which imports this module through the Inline Picker) must not
 * gain a repository value import (Task 027 Addendum A.5), so the small
 * amount of owner-only-aware collapse logic it would need is inlined here.
 */
export function resolveTemplateEditScope(
  state: FillNestState,
  template: TemplateRecord,
  fieldProfileId: string,
): TemplateEditScope {
  const currentSet = state.sharedTemplateSets.find((set) =>
    set.memberFieldProfileIds.includes(fieldProfileId),
  );
  const sharedMemberIds = new Set(
    state.sharedTemplateSets.flatMap((set) => set.memberFieldProfileIds),
  );
  const activeDirectBindings = state.bindings.filter(
    (binding) =>
      binding.templateId === template.id && !sharedMemberIds.has(binding.fieldProfileId),
  );
  const sharedBindings = state.sharedTemplateBindings.filter(
    (binding) => binding.templateId === template.id,
  );
  // Task 027 Addendum A: an owner-only slot the current Field cannot even
  // see must not inflate `effectiveUseCount` into treating the Template as
  // multi-context for this Field - only a slot visible to the current Field
  // (an ordinary slot, or its own owner-only slot) counts.
  const visibleSharedBindings = sharedBindings.filter(
    (binding) => binding.ownerFieldProfileId === undefined || binding.ownerFieldProfileId === fieldProfileId,
  );
  // Task 026: an Override Template lives only in sharedTemplateFieldStates,
  // never in sharedTemplateBindings - each one is its own effective scope,
  // used only by the Field that owns it (unless explicitly Bound elsewhere
  // too, which this same count also picks up).
  const overrideStates = state.sharedTemplateFieldStates.filter(
    (entry) => entry.mode === "override" && entry.templateId === template.id,
  );
  const effectiveUseCount = activeDirectBindings.length + visibleSharedBindings.length + overrideStates.length;
  // Task 026 Confirmed Contract: "Scope choices are calculated from actual
  // effective consumers, never merely from the number of Site Affinities" -
  // a Template can accumulate Site Affinity history independent of how many
  // Fields currently, actually use it.
  const affectsMultipleContexts = effectiveUseCount > 1;

  if (currentSet) {
    // Is the Current Field's own relationship to this Template an Override?
    const ownsOverride = overrideStates.some(
      (entry) => entry.setId === currentSet.id && entry.fieldProfileId === fieldProfileId,
    );
    if (ownsOverride) return affectsMultipleContexts ? "everywhere-only" : "single";

    // Every one of the Set's own slots the Current Field actually resolves
    // to this Template through (after Task 027's owner-only policy and its
    // own Exclusion) - an Override was already handled above, so it is
    // excluded here.
    const contributingSlots = sharedBindings.filter((binding) => {
      if (binding.setId !== currentSet.id) return false;
      if (binding.ownerFieldProfileId !== undefined && binding.ownerFieldProfileId !== fieldProfileId) return false;
      const fieldState = state.sharedTemplateFieldStates.find(
        (entry) =>
          entry.setId === currentSet.id && entry.slotId === binding.id && entry.fieldProfileId === fieldProfileId,
      );
      if (fieldState !== undefined) return false; // "exclude" or "override" - neither is plain inheritance
      return true;
    });
    if (contributingSlots.length > 0) {
      // Task 027 Addendum A (defect F): visible only through owner-only
      // slot(s) this Field owns, with no ordinary slot also contributing -
      // a private relationship, never a Set-wide save target.
      const isFieldOnly = contributingSlots.every(
        (binding) => binding.ownerFieldProfileId === fieldProfileId,
      );
      if (isFieldOnly) return "shared-field-only";
      return "shared-inherited";
    }

    // Found only through Search, or excluded for this Field - no current
    // relationship for this Field to narrow the edit to.
    return "everywhere-only";
  }

  // A Search result that is not effective in the Target Field cannot make a
  // local copy: there is no current relationship to split. Its only valid
  // edit is the original Template itself, so name that scope explicitly.
  const currentUsesTemplate = activeDirectBindings.some(
    (binding) => binding.fieldProfileId === fieldProfileId,
  );
  if (!currentUsesTemplate) return "everywhere-only";

  if (!affectsMultipleContexts) return "single";
  return "field-copy";
}

/**
 * The Save-scope label for a context-free edit (Side Panel `All templates`,
 * `By location`, or Search) that has no concrete Field to narrow to. Task
 * 026 Confirmed Contract: such an edit "offers only `Save everywhere`" when
 * there is more than one actual effective use scope, and never offers a
 * narrower field-scoped choice it has no Field context to attach to.
 */
export function resolveGlobalTemplateEditScope(
  state: FillNestState,
  template: TemplateRecord,
): "single" | "everywhere-only" {
  const sharedMemberIds = new Set(
    state.sharedTemplateSets.flatMap((set) => set.memberFieldProfileIds),
  );
  const activeDirectBindings = state.bindings.filter(
    (binding) => binding.templateId === template.id && !sharedMemberIds.has(binding.fieldProfileId),
  );
  const sharedBindings = state.sharedTemplateBindings.filter(
    (binding) => binding.templateId === template.id,
  );
  const overrideStates = state.sharedTemplateFieldStates.filter(
    (entry) => entry.mode === "override" && entry.templateId === template.id,
  );
  const effectiveUseCount = activeDirectBindings.length + sharedBindings.length + overrideStates.length;
  return effectiveUseCount > 1 ? "everywhere-only" : "single";
}
