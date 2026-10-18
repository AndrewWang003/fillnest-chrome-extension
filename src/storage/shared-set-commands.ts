import type { SiteIdentity } from "../domain/site";
import type { BindingRecord, FillNestState, TemplateRecord } from "./records";
import type * as Inputs from "./repository-inputs";
import {
  effectiveTemplateListForField,
  isFieldSharedElsewhere,
  nextSharedBindingOrder,
  validateSharedTemplateBinding,
  validateSharedTemplateFieldState,
  type SharedTemplateBindingRecord,
  type SharedTemplateFieldStateRecord,
  type SharedTemplateSetRecord,
} from "./shared-templates";
import {
  addSite,
  memberSiteIdsForSharedSet,
  resolveSiteMatchedField,
} from "./state-helpers";
import { StaleUndoError } from "./stale-errors";
import type { StateTransition, TransitionDeps } from "./template-commands";

/**
 * The Shared Template Set command family as pure state transitions.
 *
 * Task 032 Addendum A slice B3. Same contract as the Template and Binding
 * families: the Repository still owns reading, the mutation queue and
 * committing, and `next: null` means the command writes nothing.
 *
 * Seven of these commands call `commit` more than once in their original
 * bodies. Every one is a branch - each was immediately followed by a return -
 * so a call still performs exactly one durable write. The family locks in
 * `tests/unit/repository.test.ts` were written before this move to hold that.
 *
 * Commands that can also run inside `runAtomicComposite` are deliberately not
 * here: they read staged state rather than storage, and moving them needs a
 * different caller shape.
 */

export function saveTemplateCopyForSharedSetTransition(
  state: FillNestState,
  input: Inputs.SaveTemplateCopyForSharedSetInput,
  deps: TransitionDeps,
): StateTransition<Inputs.SaveTemplateCopyForSharedSetResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const existingSharedBinding = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.slotId && candidate.setId === set.id,
  );
  if (!existingSharedBinding) {
    throw new Error(`Shared Template Set slot not found: ${input.slotId}`);
  }
  const original = state.templates.find((candidate) => candidate.id === existingSharedBinding.templateId);
  if (!original) throw new Error(`Template not found: ${existingSharedBinding.templateId}`);

  const timestamp = deps.now();
  const memberSiteIds = existingSharedBinding.ownerFieldProfileId === undefined
    ? memberSiteIdsForSharedSet(state, set)
    : [resolveSiteMatchedField(state, existingSharedBinding.ownerFieldProfileId)?.page.siteId].filter(
        (siteId): siteId is SiteIdentity => siteId !== undefined,
      );
  const copyTemplate: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: memberSiteIds,
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  // Keeps the existing slot's own `id` (Task 026: "A Set-level copy changes
  // the base Template for its existing slot; it does not destroy that slot
  // identity") - every member Override/Exclusion keyed by this slot id
  // survives the swap untouched. Task 027 Addendum A (defect F): spreading
  // the existing record (rather than rebuilding it literal-by-literal)
  // preserves `ownerFieldProfileId` when this slot is a Field-only
  // relationship, so this same command stays safe to call against one.
  const copySharedBinding: SharedTemplateBindingRecord = {
    ...existingSharedBinding,
    templateId: copyTemplate.id,
    usageCount: 0,
    revision: 0,
  };

  return {
    next: {
    ...state,
    sites: memberSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
    templates: [...state.templates, copyTemplate],
    sharedTemplateBindings: state.sharedTemplateBindings.map((candidate) =>
      candidate.id === existingSharedBinding.id ? copySharedBinding : candidate,
    ),
  },
    result: { template: copyTemplate, sharedBinding: copySharedBinding },
  };
}

export function saveTemplateOverrideForFieldTransition(
  state: FillNestState,
  input: Inputs.SaveTemplateOverrideForFieldInput,
  deps: TransitionDeps,
): StateTransition<Inputs.SaveTemplateOverrideForFieldResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  if (!set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new Error(`Field Profile is not a member of this Shared Template Set: ${input.fieldProfileId}`);
  }
  const slot = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.slotId && candidate.setId === set.id,
  );
  if (!slot) throw new Error(`Shared Template Set slot not found: ${input.slotId}`);
  const fieldProfile = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
  if (!fieldProfile) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
  const page = state.pageProfiles.find((candidate) => candidate.id === fieldProfile.pageProfileId);
  if (!page) throw new Error(`Page Profile not found: ${fieldProfile.pageProfileId}`);

  const timestamp = deps.now();
  const overrideTemplate: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: [page.siteId],
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  const existingFieldState = state.sharedTemplateFieldStates.find(
    (candidate) =>
      candidate.setId === set.id && candidate.slotId === slot.id && candidate.fieldProfileId === input.fieldProfileId,
  );
  const fieldState: SharedTemplateFieldStateRecord = {
    id: existingFieldState?.id ?? deps.createId(),
    setId: set.id,
    slotId: slot.id,
    fieldProfileId: input.fieldProfileId,
    mode: "override",
    templateId: overrideTemplate.id,
    usageCount: 0,
    revision: 0,
  };

  return {
    next: {
    ...state,
    sites: addSite(state.sites, page.siteId),
    templates: [...state.templates, overrideTemplate],
    sharedTemplateFieldStates: existingFieldState
      ? state.sharedTemplateFieldStates.map((candidate) => (candidate.id === fieldState.id ? fieldState : candidate))
      : [...state.sharedTemplateFieldStates, fieldState],
  },
    result: { template: overrideTemplate, state: fieldState },
  };
}

export function undoSaveTemplateOverrideForFieldTransition(
  state: FillNestState,
  input: Inputs.UndoSaveTemplateOverrideForFieldInput,
): StateTransition<void> {
  const previousState = input.previousState ? validateSharedTemplateFieldState(input.previousState) : null;
  const copyTemplate = state.templates.find((candidate) => candidate.id === input.copyTemplateId);
  if (!copyTemplate) throw new StaleUndoError("The Override no longer exists.");
  const currentFieldState = state.sharedTemplateFieldStates.find(
    (candidate) => candidate.templateId === input.copyTemplateId && candidate.mode === "override",
  );
  if (!currentFieldState || copyTemplate.revision !== 0 || (currentFieldState.revision ?? 0) !== 0) {
    throw new StaleUndoError("This field's Override changed since it was created.");
  }
  return {
    next: {
    ...state,
    templates: state.templates.filter((candidate) => candidate.id !== input.copyTemplateId),
    sharedTemplateFieldStates: previousState
      ? state.sharedTemplateFieldStates.map((candidate) =>
          candidate.id === currentFieldState.id ? previousState : candidate,
        )
      : state.sharedTemplateFieldStates.filter((candidate) => candidate.id !== currentFieldState.id),
  },
    result: undefined,
  };
}

export function excludeSharedTemplateForFieldTransition(
  state: FillNestState,
  input: Inputs.ExcludeSharedTemplateForFieldInput,
  deps: TransitionDeps,
): StateTransition<Inputs.ExcludeSharedTemplateForFieldResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  if (!set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new Error(`Field Profile is not a member of this Shared Template Set: ${input.fieldProfileId}`);
  }
  const slot = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.slotId && candidate.setId === set.id,
  );
  if (!slot) throw new Error(`Shared Template Set slot not found: ${input.slotId}`);

  const existingFieldState = state.sharedTemplateFieldStates.find(
    (candidate) =>
      candidate.setId === set.id && candidate.slotId === slot.id && candidate.fieldProfileId === input.fieldProfileId,
  );
  const fieldState: SharedTemplateFieldStateRecord = {
    id: existingFieldState?.id ?? deps.createId(),
    setId: set.id,
    slotId: slot.id,
    fieldProfileId: input.fieldProfileId,
    mode: "exclude",
  };

  return {
    next: {
    ...state,
    sharedTemplateFieldStates: existingFieldState
      ? state.sharedTemplateFieldStates.map((candidate) => (candidate.id === fieldState.id ? fieldState : candidate))
      : [...state.sharedTemplateFieldStates, fieldState],
  },
    result: {
    state: fieldState,
    replacedOverrideTemplateId:
      existingFieldState?.mode === "override" ? existingFieldState.templateId ?? null : null,
  },
  };
}

export function undoExcludeSharedTemplateForFieldTransition(
  state: FillNestState,
  input: Inputs.UndoExcludeSharedTemplateForFieldInput,
): StateTransition<void> {
  const previousState = input.previousState ? validateSharedTemplateFieldState(input.previousState) : null;
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set || !set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new StaleUndoError("This Shared Template Set membership changed since the Exclusion was created.");
  }
  const currentFieldState = state.sharedTemplateFieldStates.find(
    (candidate) =>
      candidate.setId === input.setId &&
      candidate.slotId === input.slotId &&
      candidate.fieldProfileId === input.fieldProfileId,
  );
  if (!currentFieldState || currentFieldState.mode !== "exclude") {
    throw new StaleUndoError("This Exclusion no longer exists.");
  }
  if (previousState?.mode === "override" && !state.templates.some((t) => t.id === previousState.templateId)) {
    throw new StaleUndoError("The previous Override's Template no longer exists.");
  }
  return {
    next: {
    ...state,
    sharedTemplateFieldStates: previousState
      ? state.sharedTemplateFieldStates.map((candidate) =>
          candidate.id === currentFieldState.id ? previousState : candidate,
        )
      : state.sharedTemplateFieldStates.filter((candidate) => candidate.id !== currentFieldState.id),
  },
    result: undefined,
  };
}

export function undoSaveTemplateCopyForSharedSetTransition(
  state: FillNestState,
  input: Inputs.UndoSaveTemplateCopyForSharedSetInput,
): StateTransition<void> {
  const originalSharedBinding = validateSharedTemplateBinding(input.originalSharedBinding);
  const copyTemplate = state.templates.find((candidate) => candidate.id === input.copyTemplateId);
  if (!copyTemplate) {
    throw new StaleUndoError("The shared copy no longer exists.");
  }
  const copySharedBinding = state.sharedTemplateBindings.find(
    (candidate) =>
      candidate.templateId === input.copyTemplateId &&
      candidate.setId === originalSharedBinding.setId,
  );
  const conflict = state.sharedTemplateBindings.some(
    (candidate) =>
      candidate.setId === originalSharedBinding.setId &&
      candidate.templateId === originalSharedBinding.templateId,
  );
  const copyHasOtherRelationships =
    state.bindings.some((candidate) => candidate.templateId === input.copyTemplateId) ||
    state.sharedTemplateBindings.some(
      (candidate) =>
        candidate.templateId === input.copyTemplateId && candidate.id !== copySharedBinding?.id,
    );
  if (
    !copySharedBinding ||
    conflict ||
    copyTemplate.revision !== 0 ||
    copySharedBinding.revision !== 0 ||
    copyHasOtherRelationships
  ) {
    throw new StaleUndoError("This Shared Template Set changed since the copy was created.");
  }
  return {
    next: {
    ...state,
    templates: state.templates.filter((candidate) => candidate.id !== input.copyTemplateId),
    sharedTemplateBindings: [
      ...state.sharedTemplateBindings.filter((candidate) => candidate.id !== copySharedBinding.id),
      originalSharedBinding,
    ],
  },
    result: undefined,
  };
}

/**
 * What a Field keeps when it stops being a member of a Set: its own current
 * effective list, as direct Bindings. The Field's direct Bindings were dormant
 * while it belonged to the Set; callers replace that dormant list with this
 * one rather than merging the two.
 *
 * Task 026: effective, not the Set's raw slots, so its Overrides and
 * Exclusions carry forward. Leave sharing, End sharing (Task 021 Addendum B)
 * and Clear Site Data leaving one member (Task 026 Addendum A) all convert
 * through here, so they cannot drift apart again.
 */
export function effectiveListAsDirectBindings(
  state: FillNestState,
  fieldProfileId: string,
  deps: TransitionDeps,
): BindingRecord[] {
  const pageId = resolveSiteMatchedField(state, fieldProfileId)?.page.id ?? "";
  return effectiveTemplateListForField(state, fieldProfileId).entries.map((entry) => ({
    id: deps.createId(),
    templateId: entry.templateId,
    pageProfileId: pageId,
    fieldProfileId,
    createdAt: deps.now(),
    usageCount: entry.usageCount,
    revision: 0,
    // Task 027 Addendum C.2: carry the privacy across the conversion.
    // Without it this Binding is indistinguishable from any other, and the
    // next Set this Field joins would union the Template into the shared list
    // - handing a deliberately private Template to every member, which this
    // contract forbids.
    ...(entry.fieldOnlySlotId !== null ? { privateToField: true as const } : {}),
  }));
}

export function removeSharedTemplateSetMemberTransition(
  state: FillNestState,
  input: Inputs.RemoveSharedTemplateSetMemberInput,
  deps: TransitionDeps,
): StateTransition<Inputs.RemoveSharedTemplateSetMemberResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set || !set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new Error(`Field is not a member of this Shared Template Set: ${input.fieldProfileId}`);
  }

  const remainingMembers = set.memberFieldProfileIds.filter((id) => id !== input.fieldProfileId);
  // Task 026: convert a departing (or dissolving-survivor) Field's own
  // *effective* list - respecting its Overrides and Exclusions, not the
  // Set's raw base slots - into direct Bindings, so "Stop sharing" carries
  // that divergence forward intact.
  const snapshotBindingsFor = (fieldProfileId: string): BindingRecord[] =>
    effectiveListAsDirectBindings(state, fieldProfileId, deps);
  const dormantBindingsFor = (fieldProfileIds: readonly string[]): BindingRecord[] => {
    const fieldIds = new Set(fieldProfileIds);
    return state.bindings.filter((binding) => fieldIds.has(binding.fieldProfileId));
  };
  const replaceDormantBindings = (fieldProfileIds: readonly string[], snapshots: BindingRecord[]): BindingRecord[] => {
    const fieldIds = new Set(fieldProfileIds);
    return [...state.bindings.filter((binding) => !fieldIds.has(binding.fieldProfileId)), ...snapshots];
  };
  const fieldStatesForSet = state.sharedTemplateFieldStates.filter((entry) => entry.setId === set.id);
  const snapshotBindings = snapshotBindingsFor(input.fieldProfileId);
  const dormantBindings = dormantBindingsFor([input.fieldProfileId]);
  if (remainingMembers.length === 0) {
    // The last member leaving ends the set outright - a Shared Template Set
    // with zero members cannot be persisted (Task 015 Accepted Contract).
    // Ending sharing never changes a Template's Site Affinity (the same
    // rule an ordinary Unbind already follows), so no Template becomes
    // newly Global from this path alone.
    return {
      next: {
      ...state,
      sharedTemplateSets: state.sharedTemplateSets.filter((candidate) => candidate.id !== set.id),
      sharedTemplateBindings: state.sharedTemplateBindings.filter((binding) => binding.setId !== set.id),
      sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => entry.setId !== set.id),
      bindings: replaceDormantBindings([input.fieldProfileId], snapshotBindings),
    },
      result: { set: null, ended: true, newlyGlobalTemplates: [], snapshotBindings, dormantBindings, removedOwnedSlots: [], removedFieldStates: fieldStatesForSet },
    };
  }

  if (remainingMembers.length === 1) {
    const survivorId = remainingMembers[0]!;
    const survivorSnapshots = snapshotBindingsFor(survivorId);
    const allSnapshots = [...snapshotBindings, ...survivorSnapshots];
    const allDormantBindings = dormantBindingsFor([input.fieldProfileId, survivorId]);
    return {
      next: {
      ...state,
      sharedTemplateSets: state.sharedTemplateSets.filter((candidate) => candidate.id !== set.id),
      sharedTemplateBindings: state.sharedTemplateBindings.filter((binding) => binding.setId !== set.id),
      sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => entry.setId !== set.id),
      bindings: replaceDormantBindings([input.fieldProfileId, survivorId], allSnapshots),
    },
      result: {
      set: null,
      ended: true,
      newlyGlobalTemplates: [],
      snapshotBindings: allSnapshots,
      dormantBindings: allDormantBindings,
      removedOwnedSlots: [],
      removedFieldStates: fieldStatesForSet,
    },
    };
  }

  const departingFieldStates = fieldStatesForSet.filter((entry) => entry.fieldProfileId === input.fieldProfileId);
  // Task 027: the departing Field's own Field-only slot(s) must not linger
  // in the surviving Set - its `ownerFieldProfileId` would then point at a
  // Field no longer in `memberFieldProfileIds`, an invalid state. Its
  // content already carries forward via `snapshotBindings` above.
  const removedOwnedSlots = state.sharedTemplateBindings.filter(
    (binding) => binding.setId === set.id && binding.ownerFieldProfileId === input.fieldProfileId,
  );
  const removedOwnedSlotIds = new Set(removedOwnedSlots.map((slot) => slot.id));
  const updated: SharedTemplateSetRecord = { ...set, memberFieldProfileIds: remainingMembers };
  return {
    next: {
    ...state,
    sharedTemplateSets: state.sharedTemplateSets.map((candidate) =>
      candidate.id === set.id ? updated : candidate,
    ),
    sharedTemplateBindings: state.sharedTemplateBindings.filter(
      (binding) => !removedOwnedSlotIds.has(binding.id),
    ),
    sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter(
      (entry) => !(entry.setId === set.id && entry.fieldProfileId === input.fieldProfileId),
    ),
    bindings: replaceDormantBindings([input.fieldProfileId], snapshotBindings),
  },
    result: {
    set: updated,
    ended: false,
    newlyGlobalTemplates: [],
    snapshotBindings,
    dormantBindings,
    removedOwnedSlots,
    removedFieldStates: departingFieldStates,
  },
  };
}

export function undoRemoveSharedTemplateSetMemberTransition(
  state: FillNestState,
  input: Inputs.UndoRemoveSharedTemplateSetMemberInput,
): StateTransition<void> {
  const removedFieldStates = input.removedFieldStates.map(validateSharedTemplateFieldState);
  const snapshotIds = new Set(input.snapshotBindings.map((binding) => binding.id));
  if (!input.snapshotBindings.every((binding) => state.bindings.some((candidate) => candidate.id === binding.id))) {
    throw new StaleUndoError("This removal can no longer be undone.");
  }
  // Task 026: an Override's Template must still exist to restore that row.
  if (
    removedFieldStates.some(
      (entry) => entry.mode === "override" && !state.templates.some((t) => t.id === entry.templateId),
    )
  ) {
    throw new StaleUndoError("An Override Template no longer exists.");
  }
  const withoutSnapshot = state.bindings.filter((binding) => !snapshotIds.has(binding.id));
  const existingSet = state.sharedTemplateSets.find((candidate) => candidate.id === input.set.id);

  if (existingSet) {
    // The set survived the removal - simply restore the departed Field,
    // unless it has since joined a *different* set (checked across every
    // set, not just this one - re-adding it here would otherwise put one
    // Field in two Shared Template Sets at once).
    const rejoinedElsewhere = state.sharedTemplateSets.some((candidate) =>
      candidate.memberFieldProfileIds.includes(input.fieldProfileId),
    );
    if (rejoinedElsewhere) {
      throw new StaleUndoError("This removal can no longer be undone.");
    }
    // Task 027: the departing Field's own Field-only slot(s) must not
    // already be reoccupied by a newer slot with the same id - a later
    // mutation reusing this exact id is effectively impossible given the
    // id generator, but a stale Undo must never silently duplicate a slot.
    if (
      input.removedOwnedSlots.some((slot) =>
        state.sharedTemplateBindings.some((candidate) => candidate.id === slot.id),
      )
    ) {
      throw new StaleUndoError("This removal can no longer be undone.");
    }
    const updated: SharedTemplateSetRecord = {
      ...existingSet,
      memberFieldProfileIds: [...existingSet.memberFieldProfileIds, input.fieldProfileId],
    };
    return {
      next: {
      ...state, bindings: [...withoutSnapshot, ...input.dormantBindings],
      sharedTemplateSets: state.sharedTemplateSets.map((candidate) =>
        candidate.id === existingSet.id ? updated : candidate,
      ),
      sharedTemplateBindings: [...state.sharedTemplateBindings, ...input.removedOwnedSlots],
      sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...removedFieldStates],
    },
      result: undefined,
    };
  }

  // The removal ended the set outright - Undo must recreate the exact
  // pre-removal set and its shared Bindings together, or not at all.
  // Task 024 Addendum D: every former member must still exist and be free to
  // rejoin. Comparing the departing Field's Site with the Set's anchor Site
  // predates cross-Site Sets, and refused every Undo from a member on any
  // other Site; it also never checked the member that stayed behind.
  if (
    input.set.memberFieldProfileIds.some(
      (memberId) => !resolveSiteMatchedField(state, memberId) || isFieldSharedElsewhere(state, memberId),
    )
  ) {
    throw new StaleUndoError("This removal can no longer be undone.");
  }
  return {
    next: {
    ...state, bindings: [...withoutSnapshot, ...input.dormantBindings],
    sharedTemplateSets: [...state.sharedTemplateSets, input.set],
    sharedTemplateBindings: [...state.sharedTemplateBindings, ...input.endedSharedBindings],
    sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...removedFieldStates],
  },
    result: undefined,
  };
}

export function endSharedTemplateSetTransition(
  state: FillNestState,
  input: Inputs.EndSharedTemplateSetInput,
  deps: TransitionDeps,
): StateTransition<Inputs.EndSharedTemplateSetResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const endedFieldStates = state.sharedTemplateFieldStates.filter((entry) => entry.setId === set.id);

  // Task 021 Addendum B (owner decision, 2026-09-11): ending a Set leaves
  // every member with the Templates it was offered, exactly as leaving one
  // does - including Templates added while it was shared, and its own
  // Overrides, Exclusions and Field-only privacy (Task 026, Task 027
  // Addendum A defect E). Returning members to their dormant lists instead
  // made a Template added while shared vanish from every Field.
  const memberIds = new Set(set.memberFieldProfileIds);
  const convertedBindings = set.memberFieldProfileIds.flatMap((memberId) =>
    effectiveListAsDirectBindings(state, memberId, deps),
  );
  const dormantBindings = state.bindings.filter((binding) => memberIds.has(binding.fieldProfileId));

  return {
    next: {
    ...state,
    sharedTemplateSets: state.sharedTemplateSets.filter((candidate) => candidate.id !== set.id),
    sharedTemplateBindings: state.sharedTemplateBindings.filter((binding) => binding.setId !== set.id),
    sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => entry.setId !== set.id),
    bindings: [...state.bindings.filter((binding) => !memberIds.has(binding.fieldProfileId)), ...convertedBindings],
  },
    result: {
      memberFieldProfileIds: set.memberFieldProfileIds,
      newlyGlobalTemplates: [],
      endedFieldStates,
      convertedBindings,
      dormantBindings,
    },
  };
}

export function undoEndSharedTemplateSetTransition(
  state: FillNestState,
  input: Inputs.UndoEndSharedTemplateSetInput,
): StateTransition<void> {
  const endedFieldStates = input.endedFieldStates.map(validateSharedTemplateFieldState);
  if (state.sharedTemplateSets.some((candidate) => candidate.id === input.set.id)) {
    throw new StaleUndoError("This ending can no longer be undone.");
  }
  const stillUnshared = input.set.memberFieldProfileIds.every(
    (fieldId) =>
      !state.sharedTemplateSets.some((candidate) => candidate.memberFieldProfileIds.includes(fieldId)),
  );
  if (!stillUnshared) throw new StaleUndoError("This ending can no longer be undone.");
  if (
    endedFieldStates.some(
      (entry) => entry.mode === "override" && !state.templates.some((t) => t.id === entry.templateId),
    )
  ) {
    throw new StaleUndoError("An Override Template no longer exists.");
  }
  // Task 021 Addendum B: every member must still hold exactly the Bindings
  // this ending gave it. Anything since - a Template bound or unbound there -
  // would be silently discarded by putting the dormant list back.
  const convertedBindingIds = new Set(input.convertedBindings.map((binding) => binding.id));
  const unchanged = input.set.memberFieldProfileIds.every((memberId) => {
    const expected = input.convertedBindings.filter((binding) => binding.fieldProfileId === memberId);
    const current = state.bindings.filter((binding) => binding.fieldProfileId === memberId);
    return (
      current.length === expected.length &&
      expected.every((binding) =>
        current.some((candidate) => candidate.id === binding.id && candidate.templateId === binding.templateId),
      )
    );
  });
  if (!unchanged) throw new StaleUndoError("This ending can no longer be undone.");

  return {
    next: {
    ...state,
    sharedTemplateSets: [...state.sharedTemplateSets, input.set],
    sharedTemplateBindings: [...state.sharedTemplateBindings, ...input.sharedBindings],
    sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...endedFieldStates],
    bindings: [...state.bindings.filter((binding) => !convertedBindingIds.has(binding.id)), ...input.dormantBindings],
  },
    result: undefined,
  };
}

export function renameSharedTemplateSetTransition(
  state: FillNestState,
  input: Inputs.RenameSharedTemplateSetInput,
): StateTransition<SharedTemplateSetRecord> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const name = input.name.trim();
  if (name.length === 0) throw new Error("A Shared Template Set name cannot be empty.");

  const updated: SharedTemplateSetRecord = { ...set, name };
  return {
    next: {
    ...state,
    sharedTemplateSets: state.sharedTemplateSets.map((candidate) =>
      candidate.id === set.id ? updated : candidate,
    ),
  },
    result: updated,
  };
}

export function createTemplateAndBindSharedTransition(
  state: FillNestState,
  input: Inputs.CreateTemplateAndBindSharedInput,
  deps: TransitionDeps,
): StateTransition<Inputs.CreatedSharedTemplateBinding> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);

  const timestamp = deps.now();
  // Task 024: a cross-Site Set's members may span more than one Site - a
  // new Template created from any member Field is affiliated with every
  // Site the Set actually has a member on, not just the Set's own anchor
  // `siteId` (a pre-Task-024 Set always had exactly one Site here, so this
  // was previously equivalent to `[set.siteId]`).
  const memberSiteIds = memberSiteIdsForSharedSet(state, set);
  const template: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: memberSiteIds,
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  const sharedBinding: SharedTemplateBindingRecord = {
    id: deps.createId(),
    setId: set.id,
    templateId: template.id,
    usageCount: 0,
    revision: 0,
    order: nextSharedBindingOrder(state.sharedTemplateBindings, set.id),
  };

  return {
    next: {
    ...state,
    sites: memberSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
    templates: [...state.templates, template],
    sharedTemplateBindings: [...state.sharedTemplateBindings, sharedBinding],
  },
    result: { template, sharedBinding },
  };
}

export function undoCreateTemplateAndBindSharedTransition(
  state: FillNestState,
  input: Inputs.UndoCreateTemplateAndBindSharedInput,
): StateTransition<void> {
  const sharedBinding = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.sharedBindingId && candidate.setId === input.setId,
  );
  if (!sharedBinding) throw new StaleUndoError("This Template creation can no longer be undone.");

  return {
    next: {
    ...state,
    templates: state.templates.filter((template) => template.id !== input.templateId),
    sharedTemplateBindings: state.sharedTemplateBindings.filter(
      (candidate) => candidate.id !== sharedBinding.id,
    ),
  },
    result: undefined,
  };
}

export function createTemplateAndBindSharedFieldOnlyTransition(
  state: FillNestState,
  input: Inputs.CreateTemplateAndBindSharedFieldOnlyInput,
  deps: TransitionDeps,
): StateTransition<Inputs.CreateTemplateAndBindSharedFieldOnlyResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  if (!set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new Error(`Field Profile is not a member of this Shared Template Set: ${input.fieldProfileId}`);
  }
  const fieldProfile = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
  if (!fieldProfile) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
  const page = state.pageProfiles.find((candidate) => candidate.id === fieldProfile.pageProfileId);
  if (!page) throw new Error(`Page Profile not found: ${fieldProfile.pageProfileId}`);

  const timestamp = deps.now();
  const template: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: [page.siteId],
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  const sharedBinding: SharedTemplateBindingRecord = {
    id: deps.createId(),
    setId: set.id,
    templateId: template.id,
    usageCount: 0,
    revision: 0,
    order: nextSharedBindingOrder(state.sharedTemplateBindings, set.id),
    ownerFieldProfileId: input.fieldProfileId,
  };

  return {
    next: {
    ...state,
    sites: addSite(state.sites, page.siteId),
    templates: [...state.templates, template],
    sharedTemplateBindings: [...state.sharedTemplateBindings, sharedBinding],
  },
    result: { template, sharedBinding },
  };
}

export function undoCreateTemplateAndBindSharedFieldOnlyTransition(
  state: FillNestState,
  input: Inputs.UndoCreateTemplateAndBindSharedFieldOnlyInput,
): StateTransition<void> {
  const sharedBinding = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.sharedBindingId && candidate.setId === input.setId,
  );
  if (!sharedBinding) throw new StaleUndoError("This Template creation can no longer be undone.");

  return {
    next: {
    ...state,
    templates: state.templates.filter((template) => template.id !== input.templateId),
    sharedTemplateBindings: state.sharedTemplateBindings.filter((candidate) => candidate.id !== sharedBinding.id),
  },
    result: undefined,
  };
}

export function undoBindTemplateSharedTransition(
  state: FillNestState,
  input: Inputs.UndoBindTemplateSharedInput,
): StateTransition<void> {
  if (!state.sharedTemplateBindings.some((candidate) => candidate.id === input.sharedBindingId)) {
    throw new StaleUndoError("This Bind can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateBindings: state.sharedTemplateBindings.filter(
      (candidate) => candidate.id !== input.sharedBindingId,
    ),
  },
    result: undefined,
  };
}

export function bindTemplateToFieldOnlyTransition(
  state: FillNestState,
  input: Inputs.BindTemplateToFieldOnlyInput,
  deps: TransitionDeps,
): StateTransition<Inputs.BindTemplateToFieldOnlyResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  if (!set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new Error(`Field Profile is not a member of this Shared Template Set: ${input.fieldProfileId}`);
  }
  const template = state.templates.find((candidate) => candidate.id === input.templateId);
  if (!template) throw new Error(`Template not found: ${input.templateId}`);
  const fieldProfile = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
  if (!fieldProfile) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
  const page = state.pageProfiles.find((candidate) => candidate.id === fieldProfile.pageProfileId);
  if (!page) throw new Error(`Page Profile not found: ${fieldProfile.pageProfileId}`);

  // Idempotent for the same relationship, exactly as `bindTemplateShared`
  // already is for an ordinary slot: repeating this Bind (a double-click
  // before the Search row re-renders) must return the relationship that
  // already exists, not add a second one - a duplicate
  // `setId:templateId:owner` pair is rejected outright by the stored-data
  // invariant. Task 027 Addendum A.1 coexistence means the match keys on
  // the owner too: another member's own Field-only relationship to the
  // same Template is a different relationship, not a repeat of this one.
  const existing = state.sharedTemplateBindings.find(
    (candidate) =>
      candidate.setId === set.id &&
      candidate.templateId === input.templateId &&
      candidate.ownerFieldProfileId === input.fieldProfileId,
  );
  // Idempotent: this exact relationship already exists, so nothing is written.
  if (existing) return { next: null, result: { sharedBinding: existing } };

  const sharedBinding: SharedTemplateBindingRecord = {
    id: deps.createId(),
    setId: set.id,
    templateId: template.id,
    usageCount: 0,
    revision: 0,
    order: nextSharedBindingOrder(state.sharedTemplateBindings, set.id),
    ownerFieldProfileId: input.fieldProfileId,
  };
  const updatedTemplate: TemplateRecord = template.siteAffinities.includes(page.siteId)
    ? template
    : {
        ...template,
        siteAffinities: [...template.siteAffinities, page.siteId],
        updatedAt: deps.now(),
        revision: template.revision + 1,
      };

  return {
    next: {
    ...state,
    sites: addSite(state.sites, page.siteId),
    templates: state.templates.map((candidate) => (candidate.id === template.id ? updatedTemplate : candidate)),
    sharedTemplateBindings: [...state.sharedTemplateBindings, sharedBinding],
  },
    result: { sharedBinding },
  };
}

export function undoBindTemplateToFieldOnlyTransition(
  state: FillNestState,
  input: Inputs.UndoBindTemplateToFieldOnlyInput,
): StateTransition<void> {
  if (
    !state.sharedTemplateBindings.some(
      (candidate) => candidate.id === input.sharedBinding.id && candidate.setId === input.setId &&
        JSON.stringify(candidate) === JSON.stringify(input.sharedBinding),
    )
  ) {
    throw new StaleUndoError("This Bind can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateBindings: state.sharedTemplateBindings.filter(
      (candidate) => candidate.id !== input.sharedBinding.id,
    ),
  },
    result: undefined,
  };
}

export function unbindTemplateSharedTransition(
  state: FillNestState,
  input: Inputs.UnbindTemplateSharedInput,
): StateTransition<Inputs.UndoUnbindTemplateSharedInput | false> {
  const target = state.sharedTemplateBindings.find(
    (candidate) => candidate.setId === input.setId && candidate.id === input.slotId,
  );
  // No such slot in this Set: a no-op that must not write.
  if (!target) return { next: null, result: false };
  const remaining = state.sharedTemplateBindings.filter((candidate) => candidate.id !== target.id);
  const fieldStates = state.sharedTemplateFieldStates.filter((entry) => entry.slotId === target.id);
  const fieldStateIds = new Set(fieldStates.map((entry) => entry.id));

  return {
    next: {
    ...state,
    sharedTemplateBindings: remaining,
    sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => !fieldStateIds.has(entry.id)),
  },
    result: { sharedBinding: target, fieldStates },
  };
}

export function undoUnbindTemplateSharedTransition(
  state: FillNestState,
  input: Inputs.UndoUnbindTemplateSharedInput,
): StateTransition<void> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.sharedBinding.setId);
  const template = state.templates.find((candidate) => candidate.id === input.sharedBinding.templateId);
  // Task 027 Addendum A.1 coexistence: match the same relation identity
  // (Template plus owner) the removed slot had, not `templateId` alone - a
  // peer's coexisting slot for the same Template (ordinary vs. owner-only)
  // is a different relationship and must never block this Undo.
  const conflict = state.sharedTemplateBindings.some(
    (candidate) =>
      candidate.setId === input.sharedBinding.setId &&
      candidate.templateId === input.sharedBinding.templateId &&
      candidate.ownerFieldProfileId === input.sharedBinding.ownerFieldProfileId,
  );
  const fieldStateConflict = input.fieldStates.some((entry) =>
    state.sharedTemplateFieldStates.some((candidate) => candidate.id === entry.id),
  );
  if (!set || !template || conflict || fieldStateConflict) {
    throw new StaleUndoError("This Unbind can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateBindings: [...state.sharedTemplateBindings, input.sharedBinding],
    sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...input.fieldStates],
  },
    result: undefined,
  };
}

export function bindTemplateSharedTransition(
  state: FillNestState,
  input: Inputs.BindTemplateSharedInput,
  deps: TransitionDeps,
): StateTransition<SharedTemplateBindingRecord> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const template = state.templates.find((candidate) => candidate.id === input.templateId);
  if (!template) throw new Error(`Template not found: ${input.templateId}`);

  // Task 027 Addendum A (defect B): must match an *ordinary* slot only - a
  // peer's owner-only slot for the same Template is a different
  // relationship (A.1 coexistence) and must never silently satisfy
  // `Bind to Shared Set`, which would otherwise leave the Template
  // invisible to everyone else in the Set.
  const existing = state.sharedTemplateBindings.find(
    (candidate) =>
      candidate.setId === set.id &&
      candidate.templateId === input.templateId &&
      candidate.ownerFieldProfileId === undefined,
  );
  if (existing) {
    const currentFieldState = input.fieldProfileId
      ? state.sharedTemplateFieldStates.find(
          (entry) => entry.setId === set.id && entry.slotId === existing.id && entry.fieldProfileId === input.fieldProfileId,
        )
      : undefined;
    if (currentFieldState) {
      return {
        next: {
        ...state,
        sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => entry.id !== currentFieldState.id),
      },
        result: existing,
      };
    }
    // The slot already exists and this Field has no Exclusion on it: nothing
    // to write.
    return { next: null, result: existing };
  }

  const sharedBinding: SharedTemplateBindingRecord = {
    id: deps.createId(),
    setId: set.id,
    templateId: template.id,
    usageCount: 0,
    revision: 0,
    order: nextSharedBindingOrder(state.sharedTemplateBindings, set.id),
  };
  // Task 024: affiliate the Template with every Site the Set actually has
  // a member on, not just the Set's own anchor `siteId` (see
  // memberSiteIdsForSharedSet).
  const memberSiteIds = memberSiteIdsForSharedSet(state, set);
  const missingSiteIds = memberSiteIds.filter((siteId) => !template.siteAffinities.includes(siteId));
  const updatedTemplate: TemplateRecord =
    missingSiteIds.length === 0
      ? template
      : {
          ...template,
          siteAffinities: [...template.siteAffinities, ...missingSiteIds],
          updatedAt: deps.now(),
          revision: template.revision + 1,
        };

  return {
    next: {
    ...state,
    sites: memberSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
    templates: state.templates.map((candidate) =>
      candidate.id === template.id ? updatedTemplate : candidate,
    ),
    sharedTemplateBindings: [...state.sharedTemplateBindings, sharedBinding],
  },
    result: sharedBinding,
  };
}
