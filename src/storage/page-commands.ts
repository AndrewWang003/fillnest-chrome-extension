import { siteIdentityFromUrl, type SiteIdentity } from "../domain/site";
import {
  routeFamily,
  routePatternMatches,
  matchesBothSimilarityThresholds,
  type LogicalPageEvidence,
} from "../recognition/logical-page-matching";
import type {
  BindingRecord,
  CompatibilityPairDecisionRecord,
  FillNestState,
  FieldProfileRecord,
  LogicalPageFieldProvenanceRecord,
  LogicalPageObservationRecord,
  LogicalPageRuleRecord,
  PageProfileRecord,
} from "./records";
import type { FieldContextResolution } from "./repository-inputs";
import type * as Inputs from "./repository-inputs";
import {
  LogicalPageSeparationError,
  StaleImpactError,
  StaleLogicalPageCandidateError,
} from "./stale-errors";
import { effectiveListAsDirectBindings } from "./shared-set-commands";
import type { SharedTemplateSetRecord } from "./shared-templates";
import {
  addSite,
  deriveResetSiteMappingsImpact,
  deriveSiteMappingScope,
  sameResetSiteMappingsImpact,
  normalizeAlias,
  prepareBindingProfiles,
  retainBoundPageObservations,
} from "./state-helpers";
import { compactOptionalFields, unorderedPairKey } from "./state-validation";
import type { StateTransition, TransitionDeps } from "./template-commands";

/**
 * Page identity, alias and compatibility commands as pure state transitions.
 *
 * Task 032 Addendum A slice B5. These act on Page and Field Profiles and on
 * the Logical Page rules that key off them, rather than on Templates or on
 * Shared Template Sets, so they are their own family under rule 3.
 */

export function stopLogicalPageMatchingTransition(
  state: FillNestState,
  input: Inputs.StopLogicalPageMatchingInput,
  deps: TransitionDeps,
): StateTransition<Inputs.StopLogicalPageMatchingResult> {
  const rule = state.logicalPageRules.find((candidate) => candidate.id === input.ruleId);
  if (!rule) {
    throw new LogicalPageSeparationError(`Logical Page Matching rule not found: ${input.ruleId}`);
  }

  const provenanceEntries = state.logicalPageProvenance.filter((entry) => entry.ruleId === rule.id);
  const fieldsById = new Map(state.fieldProfiles.map((field) => [field.id, field] as const));
  const pagesById = new Map(state.pageProfiles.map((page) => [page.id, page] as const));

  const newBindings: BindingRecord[] = [];
  const separatedFieldProfileIds: string[] = [];

  for (const provenance of provenanceEntries) {
    if (!pagesById.has(provenance.sourcePageProfileId)) {
      throw new LogicalPageSeparationError("A separated Page no longer exists.");
    }
    for (const mapping of provenance.fieldMappings) {
      const sourceField = fieldsById.get(mapping.sourceFieldProfileId);
      if (!sourceField) throw new LogicalPageSeparationError("A separated Field no longer exists.");

      if (!fieldsById.has(mapping.canonicalFieldProfileId)) {
        throw new LogicalPageSeparationError("A merged Field no longer exists.");
      }
      // Task 020 Addendum A: the separated Field takes the merged Field's list
      // as it stands now. Separation "is not a destructive restoration of
      // historical lists" (Task 014), and the user may have bound, unbound or
      // deleted Templates on the merged Field since it was confirmed.
      const canonicalBindings = state.bindings.filter(
        (binding) => binding.fieldProfileId === mapping.canonicalFieldProfileId,
      );

      for (const canonicalBinding of canonicalBindings) {
        newBindings.push({
          id: deps.createId(),
          templateId: canonicalBinding.templateId,
          pageProfileId: sourceField.pageProfileId,
          fieldProfileId: sourceField.id,
          createdAt: deps.now(),
          usageCount: canonicalBinding.usageCount,
          revision: 0,
        });
      }
      separatedFieldProfileIds.push(sourceField.id);
    }
  }

  return {
    next: {
    ...state,
    bindings: [...state.bindings, ...newBindings],
    logicalPageRules: state.logicalPageRules.filter((candidate) => candidate.id !== rule.id),
    logicalPageProvenance: state.logicalPageProvenance.filter((entry) => entry.ruleId !== rule.id),
  },
    result: { separatedFieldProfileIds },
  };
}

export function setPageAliasTransition(
  state: FillNestState,
  input: Inputs.SetPageAliasInput,
): StateTransition<PageProfileRecord> {
  const profile = state.pageProfiles.find((candidate) => candidate.id === input.pageProfileId);
  if (!profile) throw new Error(`Page Profile not found: ${input.pageProfileId}`);

  const updated = compactOptionalFields({ ...profile, userAlias: normalizeAlias(input.alias) });
  return {
    next: {
    ...state,
    pageProfiles: state.pageProfiles.map((candidate) =>
      candidate.id === profile.id ? updated : candidate,
    ),
  },
    result: updated,
  };
}

export function recordCompatibilityPairNoTransition(
  state: FillNestState,
  input: Inputs.RecordCompatibilityPairNoInput,
  deps: TransitionDeps,
): StateTransition<CompatibilityPairDecisionRecord> {
  if (input.fieldProfileIdA === input.fieldProfileIdB) {
    throw new Error("A Field cannot be paired with itself.");
  }
  if (
    !state.fieldProfiles.some((candidate) => candidate.id === input.fieldProfileIdA) ||
    !state.fieldProfiles.some((candidate) => candidate.id === input.fieldProfileIdB)
  ) {
    throw new Error("Compatibility pair decision references an unknown Field.");
  }
  const key = unorderedPairKey(input.fieldProfileIdA, input.fieldProfileIdB);
  const existing = state.compatibilityPairDecisions.find(
    (decision) => unorderedPairKey(decision.fieldProfileIdA, decision.fieldProfileIdB) === key,
  );
  // This exact pair was already decided; recording it again writes nothing.
  if (existing) return { next: null, result: existing };

  const decision: CompatibilityPairDecisionRecord = {
    id: deps.createId(),
    fieldProfileIdA: input.fieldProfileIdA,
    fieldProfileIdB: input.fieldProfileIdB,
    createdAt: deps.now(),
  };
  return {
    next: {
    ...state,
    compatibilityPairDecisions: [...state.compatibilityPairDecisions, decision],
  },
    result: decision,
  };
}

export function setFieldAliasTransition(
  state: FillNestState,
  input: Inputs.SetFieldAliasInput,
): StateTransition<FieldProfileRecord> {
  let profile = state.fieldProfiles.find(
    (candidate) => candidate.id === input.fieldProfileId,
  );
  if (!profile && input.newField?.fieldProfileId === input.fieldProfileId) {
    const profiles = prepareBindingProfiles(state, input.newField);
    state = {
      ...state,
      sites: addSite(state.sites, profiles.siteId),
      pageProfiles: profiles.pageProfiles,
      fieldProfiles: profiles.fieldProfiles,
    };
    profile = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
  }
  if (!profile) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);

  const updated = compactOptionalFields({ ...profile, userAlias: normalizeAlias(input.alias) });
  return {
    next: {
    ...state,
    fieldProfiles: state.fieldProfiles.map((candidate) =>
      candidate.id === profile.id ? updated : candidate,
    ),
  },
    result: updated,
  };
}

/**
 * The single same-Origin, same-Route-Pattern retained Observation meeting
 * both accepted Jaccard thresholds, or null when there is none or the
 * match is ambiguous. Shared by resolution and confirmation so the two
 * can never disagree about what currently qualifies as a candidate.
 */
export function matchingLogicalPageObservation(
  state: FillNestState,
  siteId: SiteIdentity,
  evidence: LogicalPageEvidence,
): LogicalPageObservationRecord | null {
  if (evidence.routePattern === null) return null;
  const addressPattern = evidence.routePattern;
  const matches = state.logicalPageObservations.filter(
    (observation) =>
      observation.siteId === siteId &&
      observation.origin === evidence.origin &&
      // Task 014 Addendum C Slice 2: the same route *family*, not the identical
      // pattern. Exact equality could only ever compare two addresses the
      // pattern builder had already generalized for itself, so a site whose
      // records are slugs - or anything it could only hash - was never
      // comparable to itself.
      routeFamily(observation.routePattern, addressPattern) !== null &&
      matchesBothSimilarityThresholds(
        evidence,
        new Set(observation.fieldFeatureHashes),
        new Set(observation.groupedFieldFeatureHashes),
      ),
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function resetSiteMappingsBatchTransition(
  state: FillNestState,
  input: Inputs.ResetSiteMappingsBatchInput,
  deps: TransitionDeps,
): StateTransition<Inputs.ResetSiteMappingsResult> {
  const uniqueInputs = new Map<SiteIdentity, Inputs.ResetSiteMappingsInput>();
  for (const siteInput of input.sites) uniqueInputs.set(siteInput.siteId, siteInput);

  for (const siteInput of uniqueInputs.values()) {
    const actualImpact = deriveResetSiteMappingsImpact(state, siteInput.siteId);
    if (siteInput.expectedImpact && !sameResetSiteMappingsImpact(actualImpact, siteInput.expectedImpact)) {
      throw new StaleImpactError("Saved-field impact changed. Review the updated counts before clearing.");
    }
  }

  const pageIds = new Set<string>();
  const fieldIds = new Set<string>();
  const bindingIds = new Set<string>();
  for (const siteInput of uniqueInputs.values()) {
    const scope = deriveSiteMappingScope(state, siteInput.siteId);
    for (const id of scope.pageIds) pageIds.add(id);
    for (const id of scope.fieldIds) fieldIds.add(id);
    for (const id of scope.bindingIds) bindingIds.add(id);
  }

  const clearedSiteIds = new Set(uniqueInputs.keys());
  const updatedTemplates = state.templates.map((template) => {
    if (!template.siteAffinities.some((siteId) => clearedSiteIds.has(siteId))) return template;
    return {
      ...template,
      siteAffinities: template.siteAffinities.filter((siteId) => !clearedSiteIds.has(siteId)),
      revision: template.revision + 1,
    };
  });
  const newlyGlobalTemplates = updatedTemplates.filter(
    (template, index) =>
      state.templates[index] !== template && template.siteAffinities.length === 0,
  );

  // Site Data includes Logical Page Matching rules and their relationship
  // provenance and Site-specific keyed hashes, not only Page/Field/Binding
  // records - Clear Site Data and Remove Site must remove them together
  // (Task 014 Accepted Contract).
  const removedRuleIds = new Set(
    state.logicalPageRules.filter((rule) => clearedSiteIds.has(rule.siteId)).map((rule) => rule.id),
  );
  const logicalPageRules = state.logicalPageRules.filter((rule) => !clearedSiteIds.has(rule.siteId));
  const logicalPageProvenance = state.logicalPageProvenance.filter(
    (entry) => !removedRuleIds.has(entry.ruleId),
  );
  const logicalPageSiteKeys = state.logicalPageSiteKeys.filter((key) => !clearedSiteIds.has(key.siteId));

  // Site Data also includes Shared Template Sets and their shared Bindings
  // (Task 015 Accepted Contract): Clear Site Data and Remove Site must end
  // every Site-local set together with its other local data. Task 024: a
  // cross-Site Set only loses the members whose own Page is on a cleared
  // Site - a member on an untouched Site survives, using the exact same
  // automatic-dissolution semantics a manual single-member removal already
  // uses (removeSharedTemplateSetMemberUnlocked), not a blanket "end the
  // whole Set" keyed off the Set's own anchor `siteId` alone (which would
  // otherwise either silently end sharing for an unaffected Site's member,
  // or leave a cleared member's now-deleted Field Profile dangling in the
  // Set - a stored-data invariant violation).
  const removedSetIds = new Set<string>();
  // Task 027 Addendum A (defect I): a slot owned by a departing member
  // must never survive in a Set that itself survives with 2+ members - its
  // `ownerFieldProfileId` would otherwise point outside the Set's own
  // membership, an invalid stored-data state that would make the whole
  // operation throw. The departing owner's own Field/Page is being deleted
  // in this same operation, so unlike a manual single-member removal, this
  // slot's content needs no direct-Binding conversion for anyone.
  const removedOwnedSlotIds = new Set<string>();
  const survivorSnapshotBindings: BindingRecord[] = [];
  // Their dormant direct Bindings are replaced by the snapshot, not merged.
  const survivorIds = new Set<string>();
  const nextSharedTemplateSets: SharedTemplateSetRecord[] = [];
  for (const set of state.sharedTemplateSets) {
    const remainingMembers = set.memberFieldProfileIds.filter((memberId) => !fieldIds.has(memberId));
    if (remainingMembers.length === set.memberFieldProfileIds.length) {
      nextSharedTemplateSets.push(set);
      continue;
    }
    if (remainingMembers.length >= 2) {
      nextSharedTemplateSets.push({ ...set, memberFieldProfileIds: remainingMembers });
      for (const binding of state.sharedTemplateBindings) {
        if (
          binding.setId === set.id &&
          binding.ownerFieldProfileId !== undefined &&
          fieldIds.has(binding.ownerFieldProfileId)
        ) {
          removedOwnedSlotIds.add(binding.id);
        }
      }
      continue;
    }
    // 0 or 1 remaining members: the Set cannot survive (Task 015 Accepted
    // Contract forbids a Set with fewer than two members). A sole survivor
    // gets its shared Templates back as its own direct Bindings first.
    removedSetIds.add(set.id);
    const survivorId = remainingMembers[0];
    if (survivorId === undefined) continue;
    // Task 026 Addendum A: the survivor keeps its own *effective* list, the
    // same conversion `Stop sharing` performs (removeSharedTemplateSetMember).
    // Reading the Set's raw slots instead dropped its Overrides and
    // Exclusions, and lost the privacy of its own Field-only Templates. The
    // resolver never shows a departing owner's private slot to anyone else
    // (Task 027 Addendum A, defect H), so none reaches the survivor here.
    survivorIds.add(survivorId);
    survivorSnapshotBindings.push(...effectiveListAsDirectBindings(state, survivorId, deps));
  }
  const sharedTemplateSets = nextSharedTemplateSets;
  const sharedTemplateBindings = state.sharedTemplateBindings.filter(
    (binding) => !removedSetIds.has(binding.setId) && !removedOwnedSlotIds.has(binding.id),
  );
  // Task 027 / bounded Task 026 repair: prune every field-state row whose
  // Set was removed, whose own Field was cleared, or whose slot no longer
  // exists (a removed owner-only slot) - this was a pre-existing gap
  // (`sharedTemplateFieldStates` was never pruned by this operation at
  // all) surfaced while fixing defect I, not new Task 027 scope.
  const survivingSlotIds = new Set(sharedTemplateBindings.map((binding) => binding.id));
  const sharedTemplateFieldStates = state.sharedTemplateFieldStates.filter(
    (entry) =>
      !removedSetIds.has(entry.setId) && !fieldIds.has(entry.fieldProfileId) && survivingSlotIds.has(entry.slotId),
  );

  const didMutate =
    pageIds.size > 0 ||
    fieldIds.size > 0 ||
    bindingIds.size > 0 ||
    removedRuleIds.size > 0 ||
    removedSetIds.size > 0 ||
    removedOwnedSlotIds.size > 0 ||
    sharedTemplateFieldStates.length !== state.sharedTemplateFieldStates.length ||
    logicalPageSiteKeys.length !== state.logicalPageSiteKeys.length ||
    updatedTemplates.some((template, index) => template !== state.templates[index]);
  if (didMutate) {
    return {
      next: {
      ...state,
      templates: updatedTemplates,
      pageProfiles: state.pageProfiles.filter((page) => !pageIds.has(page.id)),
      fieldProfiles: state.fieldProfiles.filter((field) => !fieldIds.has(field.id)),
      bindings: [
        ...state.bindings.filter(
          (binding) => !pageIds.has(binding.pageProfileId) && !survivorIds.has(binding.fieldProfileId),
        ),
        ...survivorSnapshotBindings,
      ],
      logicalPageObservations: retainBoundPageObservations(
        state,
        state.bindings.filter((binding) => !pageIds.has(binding.pageProfileId)),
        state.pageProfiles.filter((page) => !pageIds.has(page.id)),
      ),
      logicalPageRules,
      logicalPageProvenance,
      logicalPageSiteKeys,
      sharedTemplateSets,
      sharedTemplateBindings,
      sharedTemplateFieldStates,
      // Task 024 Addendum D: a remembered "No" about a deleted Field has
      // nothing left to describe.
      compatibilityPairDecisions: state.compatibilityPairDecisions.filter(
        (decision) => !fieldIds.has(decision.fieldProfileIdA) && !fieldIds.has(decision.fieldProfileIdB),
      ),
    },
      result: {
      pageProfileIds: [...pageIds],
      fieldProfileIds: [...fieldIds],
      bindingIds: [...bindingIds],
      newlyGlobalTemplates,
      endedSharedTemplateSetCount: removedSetIds.size,
      didMutate,
    },
    };
  }

  // Nothing about this Site's mappings changed, so nothing is written.
  return {
    next: null,
    result: {
      pageProfileIds: [...pageIds],
      fieldProfileIds: [...fieldIds],
      bindingIds: [...bindingIds],
      newlyGlobalTemplates,
      endedSharedTemplateSetCount: removedSetIds.size,
      didMutate,
    },
  };
}

export function confirmLogicalPageCandidateTransition(
  state: FillNestState,
  input: Inputs.ConfirmLogicalPageCandidateInput,
  deps: TransitionDeps,
): StateTransition<FieldContextResolution> {
  const { evidence } = input;
  const siteId = siteIdentityFromUrl(evidence.origin);

  const canonicalPage = state.pageProfiles.find((page) => page.id === input.canonicalPageProfileId);
  if (!canonicalPage || canonicalPage.siteId !== siteId) {
    throw new StaleLogicalPageCandidateError("The candidate's canonical Page no longer exists.");
  }
  if (
    state.logicalPageRules.some(
      (rule) =>
        rule.siteId === siteId &&
        rule.origin === evidence.origin &&
        evidence.routePattern !== null &&
        routePatternMatches(rule.routePattern, evidence.routePattern),
    )
  ) {
    throw new StaleLogicalPageCandidateError(
      "A Logical Page Matching rule already covers this Route Pattern.",
    );
  }
  const observation = matchingLogicalPageObservation(state, siteId, evidence);
  if (!observation || observation.pageProfileId !== canonicalPage.id) {
    throw new StaleLogicalPageCandidateError(
      "The candidate Observation no longer meets both similarity thresholds.",
    );
  }
  // `evidence.routePattern` is non-null once a matching Observation was found:
  // `matchingLogicalPageObservation` returns null otherwise.
  //
  // Task 014 Addendum C Slice 2: the Rule stores the **family** the two
  // addresses share, not the one the user happened to be standing on. The two
  // differ in at most one position, and it is that position the Rule has to
  // generalize over - storing this address's own pattern would produce a Rule
  // that covers only the address that created it.
  const addressPattern = evidence.routePattern ?? observation.routePattern;
  const routePattern = routeFamily(observation.routePattern, addressPattern) ?? addressPattern;

  const sourcePage =
    input.pageIdentityKey !== null
      ? state.pageProfiles.find((page) => page.siteId === siteId && page.identityKey === input.pageIdentityKey)
      : undefined;

  let bindings = state.bindings;
  const fieldMappings: LogicalPageFieldProvenanceRecord[] = [];

  if (sourcePage && sourcePage.id !== canonicalPage.id) {
    const sharedFieldIds = new Set(
      state.sharedTemplateSets.flatMap((set) => set.memberFieldProfileIds),
    );
    const sourceFields = state.fieldProfiles.filter(
      (field) => field.pageProfileId === sourcePage.id && field.identityKey !== undefined,
    );
    for (const sourceField of sourceFields) {
      const canonicalField = state.fieldProfiles.find(
        (field) => field.pageProfileId === canonicalPage.id && field.identityKey === sourceField.identityKey,
      );
      // Only an exact FieldProfile identity match may merge or inherit a
      // Binding; every other Field on the reviewed Page remains independent.
      if (!canonicalField) continue;
      // A Shared Template Set member's direct Bindings must stay exactly
      // as they are while it is a member (Task 015 Accepted Contract) -
      // merging one into (or out of) a Shared Template Set member here
      // would silently move a Binding the member's own set membership
      // says nothing about, corrupting what "stop sharing" is supposed
      // to restore. Skip the merge for this Field pair entirely; the
      // Rule itself is still created, and every other Field on the
      // reviewed Page still merges normally.
      if (sharedFieldIds.has(sourceField.id) || sharedFieldIds.has(canonicalField.id)) continue;

      const sourceBindings = bindings.filter((binding) => binding.fieldProfileId === sourceField.id);
      if (sourceBindings.length === 0) continue;

      const canonicalBindings = bindings.filter((binding) => binding.fieldProfileId === canonicalField.id);
      const byTemplate = new Map<string, BindingRecord>(
        canonicalBindings.map((binding) => [binding.templateId, binding] as const),
      );
      for (const sourceBinding of sourceBindings) {
        const existing = byTemplate.get(sourceBinding.templateId);
        if (existing) {
          byTemplate.set(sourceBinding.templateId, {
            ...existing,
            usageCount: existing.usageCount + sourceBinding.usageCount,
          });
        } else {
          byTemplate.set(sourceBinding.templateId, {
            ...sourceBinding,
            fieldProfileId: canonicalField.id,
            pageProfileId: canonicalPage.id,
          });
        }
      }
      const mergedBindings = [...byTemplate.values()];
      const sourceBindingIds = new Set(sourceBindings.map((binding) => binding.id));
      bindings = [
        ...bindings.filter(
          (binding) => binding.fieldProfileId !== canonicalField.id && !sourceBindingIds.has(binding.id),
        ),
        ...mergedBindings,
      ];
      fieldMappings.push({
        sourceFieldProfileId: sourceField.id,
        canonicalFieldProfileId: canonicalField.id,
        bindingIds: mergedBindings.map((binding) => binding.id),
      });
    }
  }

  const rule: LogicalPageRuleRecord = {
    id: input.ruleId,
    siteId,
    siteKeyId: observation.siteKeyId,
    origin: evidence.origin,
    routePattern,
    fieldFeatureHashes: [...evidence.fieldFeatures],
    groupedFieldFeatureHashes: [...evidence.groupedFieldFeatures],
    pageProfileId: canonicalPage.id,
  };

  const logicalPageProvenance =
    fieldMappings.length > 0 && sourcePage
      ? [
          ...state.logicalPageProvenance,
          {
            id: deps.createId(),
            ruleId: rule.id,
            origin: evidence.origin,
            sourcePageProfileId: sourcePage.id,
            canonicalPageProfileId: canonicalPage.id,
            fieldMappings,
          },
        ]
      : state.logicalPageProvenance;

  // Resolved before the commit so the result and the state it describes are
  // computed from the same snapshot. `state.fieldProfiles` is unchanged by
  // the commit above, so this is the same Field either way.
  const targetField =
    evidence.fieldIdentityKey !== null
      ? state.fieldProfiles.find(
          (field) => field.pageProfileId === canonicalPage.id && field.identityKey === evidence.fieldIdentityKey,
        )
      : undefined;

  return {
    next: {
    ...state,
    bindings,
    logicalPageRules: [...state.logicalPageRules, rule],
    logicalPageProvenance,
  },
    result: {
    siteId,
    pageProfileId: canonicalPage.id,
    fieldProfileId: targetField?.id ?? deps.createId(),
    recognized: targetField !== undefined,
  },
  };
}
