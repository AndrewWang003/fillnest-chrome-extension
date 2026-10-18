import type { ActivationManagementSnapshot } from "../activation/activation-authority";
import type { ActivationMode } from "../activation/activation-repository";
import { siteIdentityFromUrl, type SiteIdentity } from "../domain/site";
import { countTemplatesForSite } from "../templates/site-affinity";
import {
  deriveResetSiteMappingsImpact,
  type FillNestState,
} from "../storage/fillnest-repository";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: false });

export interface SiteOriginProjection {
  origin: string;
  pattern: string;
  originActivation: ActivationMode;
}

export interface SiteProjection {
  siteId: SiteIdentity;
  origins: SiteOriginProjection[];
  authorized: boolean;
}

export function buildSiteProjections(
  state: FillNestState,
  activation: ActivationManagementSnapshot,
): SiteProjection[] {
  const originsBySite = new Map<SiteIdentity, SiteOriginProjection[]>();
  for (const record of activation.origins) {
    const siteId = siteIdFromOrigin(record.origin);
    if (siteId === null) continue;
    const list = originsBySite.get(siteId) ?? [];
    list.push({
      origin: record.origin,
      pattern: `${record.origin}/*`,
      originActivation: record.originActivation,
    });
    originsBySite.set(siteId, list);
  }

  const projections: SiteProjection[] = [];
  // Sites is an access-management surface. Historical Site Affinity and
  // profile records remain discoverable in Templates, never as a misleading
  // `No Access` entry here.
  for (const siteId of originsBySite.keys()) {
    const origins = (originsBySite.get(siteId) ?? []).sort((a, b) => collator.compare(a.origin, b.origin));
    projections.push({
      siteId,
      origins,
      authorized: true,
    });
  }

  return projections.sort((a, b) => collator.compare(a.siteId, b.siteId));
}

function siteIdFromOrigin(origin: string): SiteIdentity | null {
  try {
    return siteIdentityFromUrl(origin);
  } catch {
    return null;
  }
}

export { countTemplatesForSite };

export interface ResetSiteMappingsImpact {
  siteId: SiteIdentity;
  pageProfileCount: number;
  fieldProfileCount: number;
  bindingCount: number;
  pageAliasCount: number;
  fieldAliasCount: number;
  templateAffinityCount: number;
  logicalPageRuleCount: number;
  sharedTemplateSetCount: number;
}

export function computeResetSiteMappingsImpact(
  state: FillNestState,
  siteId: SiteIdentity,
): ResetSiteMappingsImpact {
  const impact = deriveResetSiteMappingsImpact(state, siteId);
  return {
    siteId,
    ...impact,
  };
}
