import type { SiteIdentity } from "../domain/site";

export function countTemplatesForSite(
  templates: readonly { siteAffinities: readonly SiteIdentity[] }[],
  siteId: SiteIdentity,
): number {
  return templates.filter((template) => template.siteAffinities.includes(siteId)).length;
}
