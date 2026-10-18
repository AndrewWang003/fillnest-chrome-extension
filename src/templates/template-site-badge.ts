import type { SiteIdentity } from "../domain/site";
import type { BindingRecord, PageProfileRecord, TemplateRecord } from "../storage/fillnest-repository";

export interface SiteAffinityBadge {
  primarySite: SiteIdentity;
  // Count of the Template's *other* Site Affinities, beyond the primary one
  // shown - e.g. `otherCount: 2` renders as "indeed.com +2".
  otherCount: number;
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * For a Template with Site Affinity, picks the visible Search-row label.
 * A one-Site Template shows that Site directly. A multi-Site Template shows
 * whichever affiliated Site has the highest aggregate usage (summed
 * live-Binding `usageCount` on that Site), ties broken alphabetically.
 * Returns null for a Template with zero Site Affinity, since Global Templates
 * already have no Site label to show.
 */
export function computeSiteAffinityBadge(
  template: Pick<TemplateRecord, "id" | "siteAffinities">,
  bindings: readonly BindingRecord[],
  pageProfiles: readonly PageProfileRecord[],
): SiteAffinityBadge | null {
  if (template.siteAffinities.length === 0) return null;
  if (template.siteAffinities.length === 1) {
    const [primarySite] = template.siteAffinities;
    return primarySite ? { primarySite, otherCount: 0 } : null;
  }

  const siteByPageProfileId = new Map(pageProfiles.map((page) => [page.id, page.siteId] as const));
  const usageBySite = new Map<SiteIdentity, number>(template.siteAffinities.map((site) => [site, 0]));
  for (const binding of bindings) {
    if (binding.templateId !== template.id) continue;
    const siteId = siteByPageProfileId.get(binding.pageProfileId);
    if (siteId === undefined || !usageBySite.has(siteId)) continue;
    usageBySite.set(siteId, (usageBySite.get(siteId) ?? 0) + binding.usageCount);
  }

  const ranked = [...usageBySite.entries()].sort(
    (a, b) => b[1] - a[1] || collator.compare(a[0], b[0]),
  );
  const primary = ranked[0];
  if (!primary) return null;
  return { primarySite: primary[0], otherCount: template.siteAffinities.length - 1 };
}
