import type { SiteIdentity } from "../domain/site";
import type { FieldProfileRecord, FillNestState } from "./records";
import type * as Inputs from "./repository-inputs";
import {
  defaultSharedTemplateSetName,
  isFieldSharedElsewhere,
  sameSharedBindings,
  type SharedTemplateBindingRecord,
  type SharedTemplateFieldStateRecord,
  type SharedTemplateSetRecord,
} from "./shared-templates";
import {
  addSite,
  memberSiteIdsForSharedSet,
  prepareBindingProfiles,
  resolveSiteMatchedField,
} from "./state-helpers";
import { StaleUndoError } from "./stale-errors";
import type { StateTransition, TransitionDeps } from "./template-commands";

/**
 * Shared Template Set commands that also run inside `runAtomicComposite`.
 *
 * Task 032 Addendum A slice B4, kept apart from slice B3 because their callers
 * differ, not their logic. Each of these is invoked both as its own command and
 * as one step of a composite (`joinSetAndShare`, `mergeSetsAndShare`), so the
 * Repository runs them through `runStagedTransition`, which reads staged state
 * when a composite is in flight. A composite step calls the transition directly
 * and commits the result, which stages rather than writes - exactly what the
 * inline bodies did.
 */

export function undoCreateSharedTemplateSetTransition(
  state: FillNestState,
  input: Inputs.UndoCreateSharedTemplateSetInput,
): StateTransition<void> {
  if (!state.sharedTemplateSets.some((set) => set.id === input.setId)) {
    throw new StaleUndoError("This Shared Template Set can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateSets: state.sharedTemplateSets.filter((set) => set.id !== input.setId),
    sharedTemplateBindings: state.sharedTemplateBindings.filter(
      (binding) => binding.setId !== input.setId,
    ),
  },
    result: undefined,
  };
}

export function undoAddSharedTemplateSetMemberTransition(
  state: FillNestState,
  input: Inputs.UndoAddSharedTemplateSetMemberInput,
): StateTransition<void> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set || !set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    throw new StaleUndoError("This add can no longer be undone.");
  }
  const currentBindings = state.sharedTemplateBindings.filter((binding) => binding.setId === set.id);
  // Task 027 Addendum A (defect L): the slot comparison is order-
  // insensitive. `undoJoinSetAndShare` reverses its promotion half first,
  // and an A.3 mode 2 promotion Undo reinstates the consumed owner-only
  // slot by appending it - byte-identical records in a different array
  // order. A `JSON.stringify` comparison rejected that as stale, so the
  // composite Undo could never complete (acceptance 4). `sameSharedBindings`
  // still rejects any genuine change, including a bare promotion.
  if (input.previousSet.id !== set.id || input.previousSet.memberFieldProfileIds.includes(input.fieldProfileId) ||
      JSON.stringify(set) !== JSON.stringify(input.expectedSet) ||
      !sameSharedBindings(currentBindings, input.expectedSharedBindings)) {
    throw new StaleUndoError("This add can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateSets: state.sharedTemplateSets.map((candidate) => candidate.id === set.id ? input.previousSet : candidate),
    sharedTemplateBindings: [
      ...state.sharedTemplateBindings.filter((binding) => binding.setId !== set.id),
      ...input.previousSharedBindings,
    ],
  },
    result: undefined,
  };
}

export function mergeSharedTemplateSetsTransition(
  state: FillNestState,
  input: Inputs.MergeSharedTemplateSetsInput,
  deps: TransitionDeps,
): StateTransition<Inputs.MergeSharedTemplateSetsResult> {
  if (input.keepSetId === input.removeSetId) {
    throw new Error("A Shared Template Set cannot be merged with itself.");
  }
  const keepSet = state.sharedTemplateSets.find((set) => set.id === input.keepSetId);
  const removeSet = state.sharedTemplateSets.find((set) => set.id === input.removeSetId);
  if (!keepSet) throw new Error(`Shared Template Set not found: ${input.keepSetId}`);
  if (!removeSet) throw new Error(`Shared Template Set not found: ${input.removeSetId}`);

  const previousKeepSet = keepSet;
  const previousKeepSetBindings = state.sharedTemplateBindings.filter(
    (binding) => binding.setId === keepSet.id,
  );
  const removedSetBindings = state.sharedTemplateBindings.filter(
    (binding) => binding.setId === removeSet.id,
  );

  // The operation is never partial: every member of both Sets ends up in
  // one four-(or more-)member Set, deduplicated and keep-Set-first ordered.
  const mergedMemberIds = [
    ...keepSet.memberFieldProfileIds,
    ...removeSet.memberFieldProfileIds.filter((id) => !keepSet.memberFieldProfileIds.includes(id)),
  ];

  // Effective lists merge the same way createSharedTemplateSet unions
  // direct Bindings: deduplicated by Template ID, usage counts summed. A
  // Template shared by both Sets keeps the keep-Set's own Binding
  // identity/revision; one exclusive to the removed Set gets a fresh
  // Binding record now owned by the surviving Set.
  // Task 027: a Field-only slot's relationship, not its Template id, is
  // its identity - it must never dedupe or pool usage with an ordinary
  // slot (or another owner's Field-only slot) for the same Template, or a
  // merge would either silently expose it to every member or silently
  // drop an ordinary member's existing access.
  const usageByTemplateId = new Map<string, number>();
  for (const binding of [...previousKeepSetBindings, ...removedSetBindings]) {
    if (binding.ownerFieldProfileId !== undefined) continue;
    usageByTemplateId.set(binding.templateId, (usageByTemplateId.get(binding.templateId) ?? 0) + binding.usageCount);
  }
  const mergedBindings: SharedTemplateBindingRecord[] = [];
  let order = 0;
  for (const binding of previousKeepSetBindings) {
    mergedBindings.push({
      ...binding,
      usageCount:
        binding.ownerFieldProfileId !== undefined
          ? binding.usageCount
          : usageByTemplateId.get(binding.templateId) ?? binding.usageCount,
      order: order++,
    });
  }
  for (const binding of removedSetBindings) {
    const dedupes =
      binding.ownerFieldProfileId === undefined &&
      previousKeepSetBindings.some(
        (existing) => existing.ownerFieldProfileId === undefined && existing.templateId === binding.templateId,
      );
    if (dedupes) continue;
    mergedBindings.push({
      id: deps.createId(),
      setId: keepSet.id,
      templateId: binding.templateId,
      usageCount:
        binding.ownerFieldProfileId !== undefined
          ? binding.usageCount
          : usageByTemplateId.get(binding.templateId) ?? binding.usageCount,
      revision: 0,
      order: order++,
      // Task 027: a Field-only relationship must survive a merge exactly
      // as owner-only - dropping this here would silently expose it to
      // every member of the newly combined Set.
      ...(binding.ownerFieldProfileId !== undefined ? { ownerFieldProfileId: binding.ownerFieldProfileId } : {}),
    });
  }

  // Task 026 acceptance 6: remap every Override/Exclusion the removed
  // Set's members held against their own (now-gone) slot onto the
  // canonical surviving slot for the same base Template - the kept Set's
  // existing slot when both Sets already inherited it (dedup), or the
  // fresh slot created above when it was exclusive to the removed Set.
  // `mergedBindings` always has exactly one entry per surviving Template
  // id, so this lookup finds the right canonical slot in either case.
  const previousRemovedSetFieldStates = state.sharedTemplateFieldStates.filter(
    (entry) => entry.setId === removeSet.id,
  );
  const canonicalSlotIdByRemovedSlotId = new Map<string, string>();
  for (const removedBinding of removedSetBindings) {
    // Task 027: an owner-only slot never dedupes, so its canonical match
    // must agree on ownership too - matching by Template id alone could
    // otherwise remap its Override/Exclusion onto an unrelated ordinary
    // (or a different owner's) slot for the same Template.
    const canonical = mergedBindings.find(
      (binding) =>
        binding.templateId === removedBinding.templateId &&
        binding.ownerFieldProfileId === removedBinding.ownerFieldProfileId,
    );
    if (canonical) canonicalSlotIdByRemovedSlotId.set(removedBinding.id, canonical.id);
  }
  const remappedFieldStates: SharedTemplateFieldStateRecord[] = previousRemovedSetFieldStates.flatMap((entry) => {
    const canonicalSlotId = canonicalSlotIdByRemovedSlotId.get(entry.slotId);
    return canonicalSlotId ? [{ ...entry, setId: keepSet.id, slotId: canonicalSlotId }] : [];
  });

  const mergedSet: SharedTemplateSetRecord = { ...keepSet, memberFieldProfileIds: mergedMemberIds };

  // Every Template in the merged effective list is affiliated with every
  // Site the merged Set now has a member on - a Template already shared
  // by only one side (e.g. the removed Set's own exclusive Templates)
  // otherwise keeps just its pre-merge Site(s).
  const mergedSiteIds = memberSiteIdsForSharedSet(state, mergedSet);
  // Task 027 Addendum A (Slice 3): only a Template reachable through an
  // ordinary slot gains Site Affinity for every merged Site - an
  // owner-only slot's Template stays visible to just its own owner, so
  // affiliating it with every merged Site would surface a private
  // Template in an unrelated Site's library merely for organizational
  // purposes.
  const mergedTemplateIds = new Set(
    mergedBindings
      .filter((binding) => binding.ownerFieldProfileId === undefined)
      .map((binding) => binding.templateId),
  );
  const templates = state.templates.map((template) => {
    if (!mergedTemplateIds.has(template.id)) return template;
    const missingSiteIds = mergedSiteIds.filter((siteId) => !template.siteAffinities.includes(siteId));
    if (missingSiteIds.length === 0) return template;
    return {
      ...template,
      siteAffinities: [...template.siteAffinities, ...missingSiteIds],
      updatedAt: deps.now(),
      revision: template.revision + 1,
    };
  });

  return {
    next: {
    ...state,
    sites: mergedSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
    templates,
    sharedTemplateSets: state.sharedTemplateSets
      .filter((set) => set.id !== removeSet.id)
      .map((set) => (set.id === keepSet.id ? mergedSet : set)),
    sharedTemplateBindings: [
      ...state.sharedTemplateBindings.filter(
        (binding) => binding.setId !== keepSet.id && binding.setId !== removeSet.id,
      ),
      ...mergedBindings,
    ],
    sharedTemplateFieldStates: [
      ...state.sharedTemplateFieldStates.filter((entry) => entry.setId !== removeSet.id),
      ...remappedFieldStates,
    ],
  },
    result: {
    set: mergedSet,
    bindings: mergedBindings,
    removedSet: removeSet,
    removedSetBindings,
    previousKeepSet,
    previousKeepSetBindings,
    remappedFieldStates,
    previousRemovedSetFieldStates,
  },
  };
}

export function undoMergeSharedTemplateSetsTransition(
  state: FillNestState,
  input: Inputs.UndoMergeSharedTemplateSetsInput,
): StateTransition<void> {
  const mergedSet = state.sharedTemplateSets.find((set) => set.id === input.mergedSet.id);
  // Task 010's global rule: any later successful mutation invalidates a
  // pending Undo. The merged Set must still exactly match what the merge
  // itself produced - not just still exist - or a name change, a further
  // membership change, or a new/removed Template binding made after the
  // merge (through Site management or an ordinary shared-scope mutation)
  // would otherwise be silently discarded and replaced by the stale
  // pre-merge snapshot.
  const currentMergedBindings = state.sharedTemplateBindings.filter((binding) => binding.setId === input.mergedSet.id);
  const sameMemberSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);
  const currentRemappedFieldStates = state.sharedTemplateFieldStates.filter((entry) =>
    input.remappedFieldStates.some((expected) => expected.id === entry.id),
  );
  const sameFieldStates = (
    a: readonly SharedTemplateFieldStateRecord[],
    b: readonly SharedTemplateFieldStateRecord[],
  ) =>
    a.length === b.length &&
    [...a].sort((left, right) => left.id.localeCompare(right.id)).every((entry, index) => {
      const other = [...b].sort((left, right) => left.id.localeCompare(right.id))[index];
      return (
        other !== undefined &&
        entry.id === other.id &&
        entry.setId === other.setId &&
        entry.slotId === other.slotId &&
        entry.fieldProfileId === other.fieldProfileId &&
        entry.mode === other.mode &&
        entry.templateId === other.templateId &&
        entry.usageCount === other.usageCount &&
        entry.revision === other.revision
      );
    });
  if (
    !mergedSet ||
    mergedSet.name !== input.mergedSet.name ||
    !sameMemberSet(mergedSet.memberFieldProfileIds, input.mergedSet.memberFieldProfileIds) ||
    !sameSharedBindings(currentMergedBindings, input.mergedSetBindings) ||
    !sameFieldStates(currentRemappedFieldStates, input.remappedFieldStates) ||
    state.sharedTemplateSets.some((set) => set.id === input.removedSet.id)
  ) {
    throw new StaleUndoError("This merge can no longer be undone.");
  }
  return {
    next: {
    ...state,
    sharedTemplateSets: [
      ...state.sharedTemplateSets.filter((set) => set.id !== mergedSet.id),
      input.previousKeepSet,
      input.removedSet,
    ],
    sharedTemplateBindings: [
      ...state.sharedTemplateBindings.filter((binding) => binding.setId !== mergedSet.id),
      ...input.previousKeepSetBindings,
      ...input.removedSetBindings,
    ],
    sharedTemplateFieldStates: [
      ...state.sharedTemplateFieldStates.filter(
        (entry) => !input.remappedFieldStates.some((remapped) => remapped.id === entry.id),
      ),
      ...input.previousRemovedSetFieldStates,
    ],
  },
    result: undefined,
  };
}

export function promoteFieldOnlySlotTransition(
  state: FillNestState,
  input: Inputs.PromoteFieldOnlySlotInput,
  deps: TransitionDeps,
): StateTransition<Inputs.PromoteFieldOnlySlotResult> {
  const slot = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.slotId && candidate.setId === input.setId,
  );
  if (!slot) throw new Error(`Shared Template Slot not found: ${input.slotId}`);
  if (slot.ownerFieldProfileId === undefined) {
    throw new Error("This slot is already shared with every member of the Set.");
  }
  // Task 027 Confirmed Contract: only the owner may broaden its own
  // Field-only relationship. Enforced here rather than left to the calling
  // surface, so no UI path (or future caller) can widen a peer's private
  // relationship on its behalf.
  if (slot.ownerFieldProfileId !== input.fieldProfileId) {
    throw new Error("A Field-only Template can be shared only by its owner.");
  }
  const previousOwnerFieldProfileId = slot.ownerFieldProfileId;
  const ownerId = previousOwnerFieldProfileId;
  const ownerOverride = state.sharedTemplateFieldStates.find(
    (entry) => entry.setId === input.setId && entry.slotId === slot.id &&
      entry.fieldProfileId === ownerId && entry.mode === "override",
  );
  const promotedTemplateId = ownerOverride?.templateId ?? slot.templateId;
  const promotedUsageCount = ownerOverride?.usageCount ?? slot.usageCount;
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const promotedTemplate = state.templates.find((candidate) => candidate.id === promotedTemplateId);
  if (!promotedTemplate) throw new Error(`Template not found: ${promotedTemplateId}`);
  const memberSiteIds = memberSiteIdsForSharedSet(state, set);
  const missingSiteIds = memberSiteIds.filter((siteId) => !promotedTemplate.siteAffinities.includes(siteId));
  const sharedTemplate = missingSiteIds.length === 0
    ? promotedTemplate
    : {
        ...promotedTemplate,
        siteAffinities: [...promotedTemplate.siteAffinities, ...missingSiteIds],
        updatedAt: deps.now(),
        revision: promotedTemplate.revision + 1,
      };

  // Task 027 Addendum A.3: mode 2 - an ordinary slot for the same
  // Template already exists in this Set (defects C/G). Clearing this
  // slot's own owner in place would otherwise create a duplicate pair of
  // slots for the same Template; instead the owner-only slot is consumed
  // into the existing ordinary slot.
  const ordinarySlot = state.sharedTemplateBindings.find(
    (candidate) =>
      candidate.setId === input.setId &&
      candidate.templateId === promotedTemplateId &&
      candidate.ownerFieldProfileId === undefined,
  );

  if (!ordinarySlot) {
    const promoted: SharedTemplateBindingRecord = {
      ...slot,
      templateId: promotedTemplateId,
      usageCount: promotedUsageCount,
      revision: slot.revision + 1,
      ownerFieldProfileId: undefined,
    };
    return {
      next: {
      ...state,
      sites: memberSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
      templates: state.templates.map((candidate) => candidate.id === sharedTemplate.id ? sharedTemplate : candidate),
      sharedTemplateBindings: state.sharedTemplateBindings.map((candidate) =>
        candidate.id === slot.id ? promoted : candidate,
      ),
      sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter((entry) => entry.id !== ownerOverride?.id),
    },
      result: {
      sharedBinding: promoted,
      previousOwnerFieldProfileId,
      previousSlot: slot,
      ...(ownerOverride ? { removedFieldStates: [ownerOverride] } : {}),
    },
    };
  }

  const consumedSlot = slot;
  const previousOrdinarySlot = ordinarySlot;
  // The owner's own field-state rows keyed to either slot are removed: an
  // Override/Exclusion on the deleted owner-only slot has no slot left to
  // attach to, and any Exclusion the owner held on the surviving ordinary
  // slot is removed too - the owner just asked for this Template to be
  // shared, so it must become visible to the owner as well.
  const removedFieldStates = state.sharedTemplateFieldStates.filter(
    (entry) =>
      entry.setId === input.setId &&
      entry.fieldProfileId === ownerId &&
      (entry.slotId === consumedSlot.id || (entry.slotId === ordinarySlot.id && entry.mode === "exclude")),
  );
  const removedFieldStateIds = new Set(removedFieldStates.map((entry) => entry.id));
  const mergedOrdinarySlot: SharedTemplateBindingRecord = {
    ...ordinarySlot,
    usageCount: ordinarySlot.usageCount + consumedSlot.usageCount,
    revision: ordinarySlot.revision + 1,
  };

  return {
    next: {
    ...state,
    sites: memberSiteIds.reduce((sites, siteId) => addSite(sites, siteId), state.sites),
    templates: state.templates.map((candidate) => candidate.id === sharedTemplate.id ? sharedTemplate : candidate),
    sharedTemplateBindings: state.sharedTemplateBindings
      .filter((candidate) => candidate.id !== consumedSlot.id)
      .map((candidate) => (candidate.id === ordinarySlot.id ? mergedOrdinarySlot : candidate)),
    sharedTemplateFieldStates: state.sharedTemplateFieldStates.filter(
      (entry) => !removedFieldStateIds.has(entry.id),
    ),
  },
    result: {
    sharedBinding: mergedOrdinarySlot,
    previousOwnerFieldProfileId,
    consumedSlot,
    previousOrdinarySlot,
    removedFieldStates,
  },
  };
}

export function undoPromoteFieldOnlySlotTransition(
  state: FillNestState,
  input: Inputs.UndoPromoteFieldOnlySlotInput,
): StateTransition<void> {
  const slot = state.sharedTemplateBindings.find(
    (candidate) => candidate.id === input.slotId && candidate.setId === input.setId,
  );
  // Task 010's global rule: this Undo is only valid while the slot is
  // still exactly as the promotion left it - currently shared, no owner.
  if (!slot || slot.ownerFieldProfileId !== undefined) {
    throw new StaleUndoError("This promotion can no longer be undone.");
  }

  if (!input.consumedSlot || !input.previousOrdinarySlot) {
    const expected = input.previousSlot;
    const removedOverride = input.removedFieldStates?.find((entry) => entry.mode === "override");
    const expectedTemplateId = removedOverride?.templateId ?? expected?.templateId;
    const expectedUsageCount = removedOverride?.usageCount ?? expected?.usageCount;
    const fieldStateReused = (input.removedFieldStates ?? []).some((entry) =>
      state.sharedTemplateFieldStates.some((candidate) => candidate.id === entry.id),
    );
    if (!expected || slot.templateId !== expectedTemplateId || slot.usageCount !== expectedUsageCount ||
        slot.revision !== expected.revision + 1 || slot.order !== expected.order) {
      throw new StaleUndoError("This promotion can no longer be undone.");
    }
    if (fieldStateReused) throw new StaleUndoError("This promotion can no longer be undone.");
    // Mode 1: unchanged - the promoted slot itself just needs its owner
    // restored.
    return {
      next: {
      ...state,
      sharedTemplateBindings: state.sharedTemplateBindings.map((candidate) =>
        candidate.id === slot.id ? expected : candidate,
      ),
      sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...(input.removedFieldStates ?? [])],
    },
      result: undefined,
    };
  }

  // Mode 2 (Addendum A.3): reject if the surviving ordinary slot no longer
  // matches exactly what the promotion produced - reconstructed from the
  // slot's own pre-promotion state plus the consumed slot's usage - or if
  // the consumed slot's id (or any removed field-state's id) has since
  // been reused. That reuse is effectively impossible given the id
  // generator, but this Undo must never silently duplicate a slot or a
  // field-state row.
  const expectedUsageCount = input.previousOrdinarySlot.usageCount + input.consumedSlot.usageCount;
  const expectedRevision = input.previousOrdinarySlot.revision + 1;
  const matchesExpected =
    slot.templateId === input.previousOrdinarySlot.templateId &&
    slot.order === input.previousOrdinarySlot.order &&
    slot.usageCount === expectedUsageCount &&
    slot.revision === expectedRevision;
  const consumedSlotReused = state.sharedTemplateBindings.some(
    (candidate) => candidate.id === input.consumedSlot!.id,
  );
  const fieldStateReused = (input.removedFieldStates ?? []).some((entry) =>
    state.sharedTemplateFieldStates.some((candidate) => candidate.id === entry.id),
  );
  if (!matchesExpected || consumedSlotReused || fieldStateReused) {
    throw new StaleUndoError("This promotion can no longer be undone.");
  }

  return {
    next: {
    ...state,
    sharedTemplateBindings: [
      ...state.sharedTemplateBindings.map((candidate) =>
        candidate.id === slot.id ? input.previousOrdinarySlot! : candidate,
      ),
      input.consumedSlot,
    ],
    sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...(input.removedFieldStates ?? [])],
  },
    result: undefined,
  };
}

export function createSharedTemplateSetTransition(
  state: FillNestState,
  input: Inputs.CreateSharedTemplateSetInput,
  deps: TransitionDeps,
): StateTransition<Inputs.CreateSharedTemplateSetResult> {
  // An empty Field (no direct Binding) has no durable Field Profile yet -
  // create each one that's missing here, in the same commit as the set
  // itself, rather than requiring a Bind first (which would contradict
  // "Two empty Fields may create a Shared Template Set").
  for (const newField of input.newFields ?? []) {
    if (state.fieldProfiles.some((candidate) => candidate.id === newField.fieldProfileId)) continue;
    const profiles = prepareBindingProfiles(state, newField);
    state = {
      ...state,
      sites: addSite(state.sites, profiles.siteId),
      pageProfiles: profiles.pageProfiles,
      fieldProfiles: profiles.fieldProfiles,
    };
  }
  const memberIds = [...new Set(input.fieldProfileIds)];
  if (memberIds.length < 2) {
    throw new Error("A Shared Template Set requires at least two Fields at creation.");
  }

  const alreadyShared = new Set(
    state.sharedTemplateSets.flatMap((set) => set.memberFieldProfileIds),
  );
  let siteId: SiteIdentity | null = null;
  const members: FieldProfileRecord[] = [];
  for (const fieldId of memberIds) {
    const resolved = resolveSiteMatchedField(state, fieldId);
    if (!resolved) throw new Error(`Field Profile not found: ${fieldId}`);
    if (alreadyShared.has(fieldId)) {
      throw new Error(`Field already belongs to a Shared Template Set: ${fieldId}`);
    }
    if (siteId === null) siteId = resolved.page.siteId;
    else if (siteId !== resolved.page.siteId && !input.allowCrossSite) {
      throw new Error("A Shared Template Set cannot contain Fields from different Sites.");
    }
    members.push(resolved.field);
  }
  if (siteId === null) throw new Error("A Shared Template Set requires at least two Fields at creation.");
  const resolvedSiteId: SiteIdentity = siteId;

  const existingNames = new Set(
    state.sharedTemplateSets.filter((set) => set.siteId === resolvedSiteId).map((set) => set.name),
  );
  const setId = deps.createId();
  const set: SharedTemplateSetRecord = {
    id: setId,
    siteId: resolvedSiteId,
    name: defaultSharedTemplateSetName(existingNames),
    memberFieldProfileIds: memberIds,
  };

  // Union the members' direct Template IDs, deduplicated by Template ID
  // only, usage counts summed - existing direct Bindings are left exactly
  // as they are and simply become dormant for as long as the Field is a
  // member (Task 015 Accepted Contract).
  // Task 027 Addendum C.2: a Binding carried over from a Field-only Slot is
  // excluded from the union and becomes its own Field's owner-only Slot
  // instead. Creating a Set is the user sharing a *Field*, not a decision
  // about each Template's audience, and only `Share this version` may widen
  // a private one.
  const byTemplateId = new Map<string, number>();
  /** @see BindingRecord.privateToField */
  const privateBindings: { fieldProfileId: string; templateId: string; usageCount: number }[] = [];
  for (const field of members) {
    for (const binding of state.bindings.filter((candidate) => candidate.fieldProfileId === field.id)) {
      if (binding.privateToField) {
        privateBindings.push({
          fieldProfileId: field.id,
          templateId: binding.templateId,
          usageCount: binding.usageCount,
        });
        continue;
      }
      byTemplateId.set(binding.templateId, (byTemplateId.get(binding.templateId) ?? 0) + binding.usageCount);
    }
  }
  let sharedOrder = 0;
  const sharedBindings: SharedTemplateBindingRecord[] = [
    ...[...byTemplateId.entries()].map(([templateId, usageCount]) => ({
      id: deps.createId(),
      setId,
      templateId,
      usageCount,
      revision: 0,
      order: sharedOrder++,
    })),
    ...privateBindings.map((entry) => ({
      id: deps.createId(),
      setId,
      templateId: entry.templateId,
      usageCount: entry.usageCount,
      revision: 0,
      order: sharedOrder++,
      ownerFieldProfileId: entry.fieldProfileId,
    })),
  ];

  // Task 024: a cross-Site create (allowCrossSite) may union direct
  // Bindings whose Templates were each only affiliated with their own
  // member's Site - affiliate every unioned Template with every member
  // Site now sharing it.
  const memberSiteIds = [
    ...new Set(
      members
        .map((field) => resolveSiteMatchedField(state, field.id)?.page.siteId)
        .filter((candidate): candidate is SiteIdentity => candidate !== undefined),
    ),
  ];
  const unionedTemplateIds = new Set(byTemplateId.keys());
  const templates = state.templates.map((template) => {
    if (!unionedTemplateIds.has(template.id)) return template;
    const missingSiteIds = memberSiteIds.filter((memberSiteId) => !template.siteAffinities.includes(memberSiteId));
    if (missingSiteIds.length === 0) return template;
    return {
      ...template,
      siteAffinities: [...template.siteAffinities, ...missingSiteIds],
      updatedAt: deps.now(),
      revision: template.revision + 1,
    };
  });

  return {
    next: {
    ...state,
    templates,
    sharedTemplateSets: [...state.sharedTemplateSets, set],
    sharedTemplateBindings: [...state.sharedTemplateBindings, ...sharedBindings],
  },
    result: { set, sharedBindings },
  };
}

export function addSharedTemplateSetMemberTransition(
  state: FillNestState,
  input: Inputs.AddSharedTemplateSetMemberInput,
  deps: TransitionDeps,
): StateTransition<Inputs.AddSharedTemplateSetMemberResult> {
  const set = state.sharedTemplateSets.find((candidate) => candidate.id === input.setId);
  if (!set) throw new Error(`Shared Template Set not found: ${input.setId}`);
  const previousSharedBindings = state.sharedTemplateBindings.filter((binding) => binding.setId === set.id);
  if (set.memberFieldProfileIds.includes(input.fieldProfileId)) {
    // Already a member: idempotent, and nothing is written.
    return {
      next: null,
      result: { ...set, undo: { previousSet: set, expectedSet: set, previousSharedBindings, expectedSharedBindings: previousSharedBindings } },
    };
  }

  if (input.newField && !state.fieldProfiles.some((candidate) => candidate.id === input.newField!.fieldProfileId)) {
    const profiles = prepareBindingProfiles(state, input.newField);
    state = {
      ...state,
      sites: addSite(state.sites, profiles.siteId),
      pageProfiles: profiles.pageProfiles,
      fieldProfiles: profiles.fieldProfiles,
    };
  }

  const resolved = resolveSiteMatchedField(state, input.fieldProfileId);
  if (!resolved) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
  // Task 027 Addendum C.1: `allowCrossSite` is an opt-in for *expanding* a
  // Set to a new Site. Joining a Site the Set already covers expands
  // nothing, so it needs no opt-in. Comparing against `set.siteId` - the
  // anchor, which never changes - made every same-Site candidate look
  // cross-Site once a Set spanned two Sites, and the Picker computes its
  // own `crossSite` against the *current* Field's Site, so nothing sent the
  // opt-in and the operation threw.
  if (!memberSiteIdsForSharedSet(state, set).includes(resolved.page.siteId) && !input.allowCrossSite) {
    throw new Error(`Field Profile not found in this Site: ${input.fieldProfileId}`);
  }
  if (isFieldSharedElsewhere(state, input.fieldProfileId)) {
    throw new Error(`Field already belongs to a Shared Template Set: ${input.fieldProfileId}`);
  }

  const updated: SharedTemplateSetRecord = {
    ...set,
    memberFieldProfileIds: [...set.memberFieldProfileIds, input.fieldProfileId],
  };
  // Snapshot the independent Field's effective list into the shared list.
  // Dormant direct Bindings remain untouched; deduplicate by Template ID.
  const sharedBindings = previousSharedBindings.map((binding) => ({ ...binding }));
  let nextOrder = sharedBindings.reduce((next, binding) => Math.max(next, binding.order + 1), 0);
  const directBindings = [...state.bindings]
    .filter((binding) => binding.fieldProfileId === input.fieldProfileId)
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  for (const binding of directBindings) {
    // Task 027 Addendum C.2: a Binding carried over from a Field-only Slot
    // stays private. It joins the Set as this Field's own owner-only Slot,
    // never as an ordinary one, and never merges into an existing shared
    // Slot - otherwise leaving a Set and later sharing again would hand a
    // deliberately private Template to every member.
    if (binding.privateToField) {
      sharedBindings.push({
        id: deps.createId(), setId: set.id, templateId: binding.templateId,
        usageCount: binding.usageCount, revision: 0, order: nextOrder++,
        ownerFieldProfileId: input.fieldProfileId,
      });
      continue;
    }
    // Task 027 Addendum A (defect J): dedupe against an *ordinary* slot
    // only - a coexisting owner-only slot for the same Template belongs to
    // a different Field (A.1 coexistence) and must never absorb the
    // joiner's own Template, or the joiner loses it outright.
    const existing = sharedBindings.find(
      (candidate) => candidate.templateId === binding.templateId && candidate.ownerFieldProfileId === undefined,
    );
    if (existing) {
      existing.usageCount += binding.usageCount;
      existing.revision += 1;
    } else {
      sharedBindings.push({
        id: deps.createId(), setId: set.id, templateId: binding.templateId,
        usageCount: binding.usageCount, revision: 0, order: nextOrder++,
      });
    }
  }
  const newSiteId = resolved.page.siteId;
  const memberSiteIds = memberSiteIdsForSharedSet(state, updated);
  const sharedTemplateIds = new Set(
    sharedBindings
      .filter((binding) => binding.ownerFieldProfileId === undefined)
      .map((binding) => binding.templateId),
  );
  const templates = state.templates.map((template) => {
    if (!sharedTemplateIds.has(template.id)) return template;
    const missingSiteIds = memberSiteIds.filter((siteId) => !template.siteAffinities.includes(siteId));
    if (missingSiteIds.length === 0) return template;
    return {
      ...template,
      siteAffinities: [...template.siteAffinities, ...missingSiteIds],
      updatedAt: deps.now(),
      revision: template.revision + 1,
    };
  });
  return {
    next: {
    ...state,
    sites: addSite(state.sites, newSiteId),
    templates,
    sharedTemplateBindings: [...state.sharedTemplateBindings.filter((binding) => binding.setId !== set.id), ...sharedBindings],
    sharedTemplateSets: state.sharedTemplateSets.map((candidate) =>
      candidate.id === set.id ? updated : candidate,
    ),
  },
    result: { ...updated, undo: { previousSet: set, expectedSet: updated, previousSharedBindings, expectedSharedBindings: sharedBindings } },
  };
}
