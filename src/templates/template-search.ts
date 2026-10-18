import type { TemplateRecord } from "../storage/fillnest-repository";

export function searchTemplates(
  templates: TemplateRecord[],
  query: string,
  boundTemplateIds: string[],
): TemplateRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return [];

  const bound = new Set(boundTemplateIds);
  return templates.filter(
    (template) =>
      !bound.has(template.id) &&
      template.content.toLocaleLowerCase().includes(normalizedQuery),
  );
}
