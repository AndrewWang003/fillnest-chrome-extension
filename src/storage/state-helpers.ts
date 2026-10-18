import { siteIdentityFromUrl } from "../domain/site";
import type {
  BindingRecord,
  FieldProfileRecord,
  FillNestState,
  LogicalPageObservationRecord,
  PageProfileRecord,
  SiteRecord,
} from "./records";
import type {
  BindingTargetInput,
  ResetSiteMappingsExpectedImpact,
  SiteMappingScope,
} from "./repository-inputs";
import { compactOptionalFields } from "./state-validation";
import type { SiteIdentity } from "../domain/site";
import type { SharedTemplateSetRecord } from "./shared-templates";

/**
 * State helpers shared by more than one command family.
 *
 * Task 032 Addendum A slice B0. These are pure functions over stored records,
 * and every command family that Phase B extracts needs some of them. Moving
 * them first is what lets a family move on its own afterwards: a command
 * module cannot import them from `fillnest-repository.ts` without the two
 * files importing each other.
 */

export function addSite(sites: SiteRecord[], siteId: SiteIdentity): SiteRecord[] {
  if (sites.some((site) => site.id === siteId)) return sites;
  return [...sites, { id: siteId }];
}

export function retainBoundPageObservations(
  state: FillNestState,
  bindings: readonly BindingRecord[],
  pageProfiles: readonly PageProfileRecord[] = state.pageProfiles,
): LogicalPageObservationRecord[] {
  const existingPageIds = new Set(pageProfiles.map((page) => page.id));
  const boundPageIds = new Set(bindings.map((binding) => binding.pageProfileId));
  return state.logicalPageObservations.filter(
    (observation) => existingPageIds.has(observation.pageProfileId) && boundPageIds.has(observation.pageProfileId),
  );
}

export function prepareBindingProfiles(
  state: FillNestState,
  input: BindingTargetInput,
): {
  siteId: SiteIdentity;
  pageProfiles: PageProfileRecord[];
  fieldProfiles: FieldProfileRecord[];
} {
  const siteId = siteIdentityFromUrl(input.pageUrl);
  const existingPage = state.pageProfiles.find(
    (profile) => profile.id === input.pageProfileId,
  );
  if (existingPage && existingPage.siteId !== siteId) {
    throw new Error(`Page Profile Site mismatch: ${input.pageProfileId}`);
  }
  const existingField = state.fieldProfiles.find(
    (profile) => profile.id === input.fieldProfileId,
  );
  if (existingField && existingField.pageProfileId !== input.pageProfileId) {
    throw new Error(`Field Profile Page mismatch: ${input.fieldProfileId}`);
  }

  return {
    siteId,
    pageProfiles: existingPage
      ? state.pageProfiles
      : [
          ...state.pageProfiles,
          compactOptionalFields({
            id: input.pageProfileId,
            siteId,
            identityKey: input.pageIdentityKey,
          }),
        ],
    fieldProfiles: existingField
      ? state.fieldProfiles.map((profile) =>
          profile.id === existingField.id &&
          (input.fieldDocumentOrder !== undefined || input.fieldObservedTitle !== undefined)
            ? {
                ...profile,
                ...(input.fieldDocumentOrder !== undefined ? { documentOrder: input.fieldDocumentOrder } : {}),
                ...(input.fieldObservedTitle !== undefined ? { observedTitle: input.fieldObservedTitle } : {}),
              }
            : profile,
        )
      : [
          ...state.fieldProfiles,
          compactOptionalFields({
            id: input.fieldProfileId,
            pageProfileId: input.pageProfileId,
            identityKey: input.fieldIdentityKey,
            documentOrder: input.fieldDocumentOrder,
            observedTitle: input.fieldObservedTitle,
          }),
        ],
  };
}

// Shared by every Shared Template Set command that needs to resolve one
// Field to its owning Page, since Site-local membership is always checked
// against the Page's Site, never the Field alone.
export function resolveSiteMatchedField(
  state: FillNestState,
  fieldProfileId: string,
): { field: FieldProfileRecord; page: PageProfileRecord } | undefined {
  const field = state.fieldProfiles.find((candidate) => candidate.id === fieldProfileId);
  const page = field ? state.pageProfiles.find((candidate) => candidate.id === field.pageProfileId) : undefined;
  return field && page ? { field, page } : undefined;
}

/** Every distinct Site among a Shared Template Set's current members (Task 024: may be more than one). */
export function memberSiteIdsForSharedSet(state: FillNestState, set: SharedTemplateSetRecord): SiteIdentity[] {
  const siteIds = new Set<SiteIdentity>();
  for (const memberId of set.memberFieldProfileIds) {
    const resolved = resolveSiteMatchedField(state, memberId);
    if (resolved) siteIds.add(resolved.page.siteId);
  }
  return siteIds.size > 0 ? [...siteIds] : [set.siteId];
}

export function normalizeAlias(alias: string): string | undefined {
  const trimmed = alias.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// The single source of truth for "which Page Profiles, Field Profiles, and
// Bindings belong to this Site" - both the Site-cleanup preview impact shown
// to the user and the actual mutation that deletes/reassigns them must derive
// this scope from here, so the displayed count can never drift from what the
// mutation actually does.
export function deriveSiteMappingScope(state: FillNestState, siteId: SiteIdentity): SiteMappingScope {
  const pageIds = new Set(
    state.pageProfiles.filter((page) => page.siteId === siteId).map((page) => page.id),
  );
  const fieldIds = new Set(
    state.fieldProfiles.filter((field) => pageIds.has(field.pageProfileId)).map((field) => field.id),
  );
  const bindingIds = new Set(
    state.bindings.filter((binding) => pageIds.has(binding.pageProfileId)).map((binding) => binding.id),
  );
  return { pageIds, fieldIds, bindingIds };
}

export function deriveResetSiteMappingsImpact(
  state: FillNestState,
  siteId: SiteIdentity,
): ResetSiteMappingsExpectedImpact {
  const { pageIds, fieldIds, bindingIds } = deriveSiteMappingScope(state, siteId);
  const pages = state.pageProfiles.filter((page) => pageIds.has(page.id));
  const fields = state.fieldProfiles.filter((field) => fieldIds.has(field.id));
  return {
    pageProfileCount: pageIds.size,
    fieldProfileCount: fieldIds.size,
    bindingCount: bindingIds.size,
    pageAliasCount: pages.filter((page) => page.userAlias !== undefined).length,
    fieldAliasCount: fields.filter((field) => field.userAlias !== undefined).length,
    templateAffinityCount: state.templates.filter((template) => template.siteAffinities.includes(siteId)).length,
    logicalPageRuleCount: state.logicalPageRules.filter((rule) => rule.siteId === siteId).length,
    // A Set is affected by clearing this Site whenever any of its members'
    // own Field is here (Task 024: a cross-Site Set's own anchor `siteId`
    // no longer implies every member is on that Site) - matching exactly
    // what resetSiteMappingsBatchUnlocked itself checks against `fieldIds`.
    sharedTemplateSetCount: state.sharedTemplateSets.filter((set) =>
      set.memberFieldProfileIds.some((memberId) => fieldIds.has(memberId)),
    ).length,
  };
}

export function sameResetSiteMappingsImpact(
  left: ResetSiteMappingsExpectedImpact,
  right: ResetSiteMappingsExpectedImpact,
): boolean {
  return (
    left.pageProfileCount === right.pageProfileCount &&
    left.fieldProfileCount === right.fieldProfileCount &&
    left.bindingCount === right.bindingCount &&
    left.pageAliasCount === right.pageAliasCount &&
    left.fieldAliasCount === right.fieldAliasCount
    && left.templateAffinityCount === right.templateAffinityCount
    && left.logicalPageRuleCount === right.logicalPageRuleCount
    && left.sharedTemplateSetCount === right.sharedTemplateSetCount
  );
}
