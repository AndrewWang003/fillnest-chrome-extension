import { derivePreview } from "./template-preview";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: false });

/**
 * The order a Field's own Template list is shown in, on every surface.
 *
 * A Field's Templates are ranked by **that Field's own Binding usage count**
 * descending, then Template Preview alphabetically, then stable Template ID.
 * Never by the Template's total usage across every Field - two Fields that
 * share a Template can legitimately rank it very differently.
 *
 * Task 003 originally also allowed a Field to become user-arranged after an
 * explicit drag. The owner removed that on 2026-09-07 rather than keep two
 * ordering modes: the Picker had never implemented either half of the rule, so
 * a drag in the Side Panel had no effect there, and automatic ranking alone was
 * judged enough. One implementation, one mode, both surfaces.
 */
export interface OrderableFieldEntry {
  templateId: string;
  /** This Field's own usage of the Template, not the Template's total. */
  usageCount: number;
}

export function orderFieldTemplateEntries<T extends OrderableFieldEntry>(
  entries: readonly T[],
  contentOf: (templateId: string) => string | undefined,
): T[] {
  return [...entries].sort((left, right) => {
    const byUsage = right.usageCount - left.usageCount;
    if (byUsage !== 0) return byUsage;
    const byPreview = collator.compare(
      derivePreview(contentOf(left.templateId) ?? ""),
      derivePreview(contentOf(right.templateId) ?? ""),
    );
    if (byPreview !== 0) return byPreview;
    return left.templateId < right.templateId ? -1 : left.templateId > right.templateId ? 1 : 0;
  });
}
