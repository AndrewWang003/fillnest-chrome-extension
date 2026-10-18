import type { SiteIdentity } from "../domain/site";
import type { Messages } from "../i18n/messages";
import { fieldDisplayName, pageDisplayName } from "../labels/display-label";
import type {
  BindingRecord,
  FillNestState,
  TemplateRecord,
} from "../storage/fillnest-repository";
import { derivePreview } from "./template-preview";

export interface LocationTreeLeaf {
  template: TemplateRecord;
  binding: BindingRecord;
}

export interface LocationTreeFieldNode {
  fieldProfileId: string;
  label: string;
  templateCount: number;
  templates: LocationTreeLeaf[];
}

export interface LocationTreePageNode {
  pageProfileId: string;
  label: string;
  templateCount: number;
  fields: LocationTreeFieldNode[];
}

export interface LocationTreeSiteNode {
  siteId: SiteIdentity;
  label: string;
  templateCount: number;
  pages: LocationTreePageNode[];
}

export interface LocationTree {
  sites: LocationTreeSiteNode[];
}

/** `messages` names the derived Page and Field labels in the reader's language (Task 040). */
export function buildLocationTree(state: FillNestState, messages: Messages): LocationTree {
  const templatesById = new Map(state.templates.map((template) => [template.id, template] as const));

  const bindingsByField = groupBy(state.bindings, (binding) => binding.fieldProfileId);
  const fieldsByPage = groupBy(state.fieldProfiles, (field) => field.pageProfileId);
  const pagesBySite = groupBy(state.pageProfiles, (page) => page.siteId);

  const sites: LocationTreeSiteNode[] = [];
  for (const site of state.sites) {
    const siteTemplateIds = new Set<string>();
    const pages: LocationTreePageNode[] = [];

    for (const page of pagesBySite.get(site.id) ?? []) {
      const pageTemplateIds = new Set<string>();
      const fields: LocationTreeFieldNode[] = [];

      for (const field of fieldsByPage.get(page.id) ?? []) {
        const leaves = (bindingsByField.get(field.id) ?? [])
          .map((binding): LocationTreeLeaf | null => {
            const template = templatesById.get(binding.templateId);
            return template ? { template, binding } : null;
          })
          .filter((leaf): leaf is LocationTreeLeaf => leaf !== null)
          .sort((left, right) => compareLeavesByBindingUsage(left, right));

        if (leaves.length === 0) continue;
        for (const leaf of leaves) {
          pageTemplateIds.add(leaf.template.id);
          siteTemplateIds.add(leaf.template.id);
        }
        fields.push({
          fieldProfileId: field.id,
          label: fieldDisplayName(field, messages),
          templateCount: new Set(leaves.map((leaf) => leaf.template.id)).size,
          templates: leaves,
        });
      }

      if (fields.length === 0) continue;
      pages.push({
        pageProfileId: page.id,
        label: pageDisplayName(page, messages),
        templateCount: pageTemplateIds.size,
      // Document order is the user's spatial mental model. Older profiles
      // without it retain their stable persisted-array order rather than
      // being reordered whenever an alias changes.
      fields: [...fields].sort((left, right) => {
        const leftOrder = fieldsByPage.get(page.id)?.find((field) => field.id === left.fieldProfileId)?.documentOrder;
        const rightOrder = fieldsByPage.get(page.id)?.find((field) => field.id === right.fieldProfileId)?.documentOrder;
        if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
        if (leftOrder !== undefined) return -1;
        if (rightOrder !== undefined) return 1;
        return 0;
      }),
      });
    }

    if (pages.length === 0) continue;
    sites.push({
      siteId: site.id,
      label: site.id,
      templateCount: siteTemplateIds.size,
      pages: [...pages].sort((left, right) => collator.compare(left.label, right.label)),
    });
  }

  return {
    sites: [...sites].sort((left, right) => collator.compare(left.label, right.label)),
  };
}

export interface AllTemplatesFilters {
  search?: string;
  // Union semantics: a Template matches if it has affinity to *any* Site in
  // this set - not every selected Site, since a Template only ever carries
  // its own real Site Affinities, never a combined one.
  siteIds?: ReadonlySet<SiteIdentity> | null;
  globalOnly?: boolean;
  boundOnly?: boolean | null;
}

export function listAllTemplates(
  state: FillNestState,
  filters: AllTemplatesFilters,
  sort: SortKind = "default",
  direction?: SortDirection,
): TemplateRecord[] {
  const boundIds = new Set(state.bindings.map((binding) => binding.templateId));
  const normalizedSearch = (filters.search ?? "").trim().toLocaleLowerCase();

  const matches = state.templates.filter((template) => {
    // "Global only" surfaces Templates with no Site Affinity, but also any
    // Template that currently has none of its Bindings live: once nothing
    // is bound anywhere, a stale Site Affinity left over from before it was
    // unbound shouldn't keep it hidden from "available everywhere" filtering.
    if (filters.globalOnly && template.siteAffinities.length > 0 && boundIds.has(template.id)) return false;
    if (
      filters.siteIds &&
      filters.siteIds.size > 0 &&
      !template.siteAffinities.some((site) => filters.siteIds!.has(site))
    )
      return false;
    if (filters.boundOnly === true && !boundIds.has(template.id)) return false;
    if (filters.boundOnly === false && boundIds.has(template.id)) return false;
    if (normalizedSearch.length === 0) return true;
    return template.content.toLocaleLowerCase().includes(normalizedSearch);
  });

  const resolvedDirection = direction ?? defaultDirectionFor(sort);
  return [...matches].sort(compareTemplates(sort, resolvedDirection));
}

export type SortKind = "default" | "alphabetical" | "created" | "updated" | "usage";
export type SortDirection = "ascending" | "descending";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: false });

export function defaultDirectionFor(sort: SortKind): SortDirection {
  return sort === "alphabetical" ? "ascending" : "descending";
}

function comparePreview(a: TemplateRecord, b: TemplateRecord): number {
  return collator.compare(derivePreview(a.content), derivePreview(b.content));
}

function compareStableId(a: TemplateRecord, b: TemplateRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function primaryCompareAscending(sort: SortKind, a: TemplateRecord, b: TemplateRecord): number {
  switch (sort) {
    case "alphabetical":
      return comparePreview(a, b);
    case "created":
      return compareStrings(a.createdAt, b.createdAt);
    case "updated":
      return compareStrings(a.updatedAt, b.updatedAt);
    case "usage":
    case "default":
    default:
      return a.totalUsageCount - b.totalUsageCount;
  }
}

export function compareTemplates(
  sort: SortKind,
  direction: SortDirection,
): (a: TemplateRecord, b: TemplateRecord) => number {
  return (a, b) => {
    const ascending = primaryCompareAscending(sort, a, b);
    const oriented = direction === "ascending" ? ascending : -ascending;
    return oriented || comparePreview(a, b) || compareStableId(a, b);
  };
}

function compareLeavesByBindingUsage(left: LocationTreeLeaf, right: LocationTreeLeaf): number {
  const byUsage = right.binding.usageCount - left.binding.usageCount;
  if (byUsage !== 0) return byUsage;
  return compareTemplates("alphabetical", "ascending")(left.template, right.template);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const list = map.get(key(item)) ?? [];
    list.push(item);
    map.set(key(item), list);
  }
  return map;
}
