import type { SiteIdentity } from "../domain/site";
import type { Messages } from "../i18n/messages";
import { fieldDisplayName, pageDisplayName } from "../labels/display-label";
import {
  effectiveTemplateListForField,
  type BindingRecord,
  type FillNestState,
  type TemplateRecord,
} from "../storage/fillnest-repository";
import { compareTemplates } from "./library-views";
import { derivePreview } from "./template-preview";

export interface FieldFirstOption {
  template: TemplateRecord;
  // Present for a Field's own direct Binding; `null` when this entry is
  // resolved from a Shared Template Set slot instead (Task 026) - a Set
  // slot has no per-Field Binding record of its own to reorder or point at.
  binding: BindingRecord | null;
  // The owning Shared Template Set slot, present only when this entry came
  // from `effectiveTemplateListForField` - `null` for an ordinary direct
  // Binding entry.
  slotId: string | null;
  // Whether this entry is the Field's own Override of the slot's base
  // Template, as opposed to plain inheritance - always `false` for a
  // non-Set Field.
  isOverride: boolean;
  // Task 027: whether this entry is private to this Field - every relation
  // behind it is a Field-only slot this Field owns. Drives Save-scope
  // labelling.
  isFieldOnly: boolean;
  // The owner-only slot behind this entry, if any - `Share this version`
  // targets this slot and is offered for exactly these. See the
  // repository's `EffectiveTemplateListEntry.fieldOnlySlotId`.
  fieldOnlySlotId: string | null;
}

export interface FieldFirstFieldRow {
  fieldProfileId: string;
  fieldIdentityKey: string | null;
  pageProfileId: string;
  siteId: SiteIdentity;
  label: string;
  pageLabel: string;
  // The raw User Alias, if any - distinct from `label`/`pageLabel`, which
  // are already resolved to the alias-or-derived display string. Renaming
  // UI needs the raw value so an edit starts pre-filled with the current
  // alias instead of blank.
  fieldAlias: string | undefined;
  pageAlias: string | undefined;
  // The Shared Template Set this Field belongs to, if any (Task 026) - a
  // concrete Field context exposes the same valid Save-scope choices as
  // that Field's Picker only when this is set.
  sharedSetId: string | null;
  // The Field's effective Template list (Task 026): its own direct Bindings
  // ranked by persisted order, or - for exactly as long as it is a Shared
  // Template Set member - that Set's slots resolved against the Field's own
  // Overrides and Exclusions. Nothing pulled in from an unrelated Field.
  options: FieldFirstOption[];
}

export interface FieldFirstView {
  fields: FieldFirstFieldRow[];
  // Templates with zero live Bindings anywhere in the library.
  notOfferedAnywhere: TemplateRecord[];
}

import { orderFieldTemplateEntries } from "./field-template-order";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: false });

/** `messages` names the derived Page and Field labels in the reader's language (Task 040). */
export function buildFieldFirstView(
  state: FillNestState,
  pageProfileId: string | null,
  messages: Messages,
): FieldFirstView {
  const templatesById = new Map(state.templates.map((template) => [template.id, template] as const));
  const pagesById = new Map(state.pageProfiles.map((page) => [page.id, page] as const));
  const fieldsById = new Map(state.fieldProfiles.map((field) => [field.id, field] as const));

  const bindingsByField = new Map<string, BindingRecord[]>();
  for (const binding of state.bindings) {
    const list = bindingsByField.get(binding.fieldProfileId) ?? [];
    list.push(binding);
    bindingsByField.set(binding.fieldProfileId, list);
  }

  const sharedSetByFieldId = new Map<string, string>();
  for (const set of state.sharedTemplateSets) {
    for (const memberFieldProfileId of set.memberFieldProfileIds) {
      sharedSetByFieldId.set(memberFieldProfileId, set.id);
    }
  }

  // A Shared Template Set member's own direct Bindings are dormant (Task
  // 026): its effective list always comes from `effectiveTemplateListForField`
  // instead, so its candidate Field ids must be considered even when it has
  // no live direct Binding of its own.
  const candidateFieldIds = new Set<string>([...bindingsByField.keys(), ...sharedSetByFieldId.keys()]);

  const fields: FieldFirstFieldRow[] = [];
  if (pageProfileId !== null) {
    for (const fieldProfileId of candidateFieldIds) {
      const field = fieldsById.get(fieldProfileId);
      if (!field) continue;
      const page = pagesById.get(field.pageProfileId);
      if (!page || page.id !== pageProfileId) continue;

      const sharedSetId = sharedSetByFieldId.get(fieldProfileId) ?? null;
      const options: FieldFirstOption[] = sharedSetId
        ? effectiveTemplateListForField(state, fieldProfileId).entries.flatMap((entry) => {
            const template = templatesById.get(entry.templateId);
            return template
              ? [
                  {
                    template,
                    binding: null,
                    slotId: entry.slotId,
                    isOverride: entry.isOverride,
                    isFieldOnly: entry.isFieldOnly,
                    fieldOnlySlotId: entry.fieldOnlySlotId,
                  },
                ]
              : [];
          })
        : (bindingsByField.get(fieldProfileId) ?? [])
            .flatMap((binding) => {
              const template = templatesById.get(binding.templateId);
              return template
                ? [{ template, binding, slotId: null, isOverride: false, isFieldOnly: false, fieldOnlySlotId: null }]
                : [];
            })
            .sort((a, b) => (a.binding.id < b.binding.id ? -1 : a.binding.id > b.binding.id ? 1 : 0));

      // Task 003 field-local ordering: a Field the user has never reordered is
      // ranked automatically by its own Binding usage, not by the order things
      // happened to be bound in. The Picker applies the same rule through the
      // same function, so the two surfaces cannot drift apart again.
      const ordered = orderFieldTemplateEntries(
        options.map((option) => ({
          ...option,
          templateId: option.template.id,
          usageCount: option.binding?.usageCount ?? 0,
        })),
        (templateId) => templatesById.get(templateId)?.content,
      );
      options.length = 0;
      options.push(...ordered);

      if (options.length === 0) continue;

      fields.push({
        fieldProfileId,
        fieldIdentityKey: field.identityKey ?? null,
        pageProfileId: page.id,
        siteId: page.siteId,
        label: fieldDisplayName(field, messages),
        pageLabel: pageDisplayName(page, messages),
        fieldAlias: field.userAlias,
        pageAlias: page.userAlias,
        sharedSetId,
        options,
      });
    }
  }

  fields.sort((a, b) => {
    const left = fieldsById.get(a.fieldProfileId)?.documentOrder;
    const right = fieldsById.get(b.fieldProfileId)?.documentOrder;
    if (left !== undefined && right !== undefined) return left - right;
    if (left !== undefined) return -1;
    if (right !== undefined) return 1;
    return collator.compare(a.fieldProfileId, b.fieldProfileId);
  });

  // A Template is "offered" if any live relationship makes it reachable from
  // a Field: an ordinary direct Binding, a Shared Template Set slot's base
  // Template, or a Field's own Override (Task 026) - the latter two live
  // outside `state.bindings` entirely, so they must be counted explicitly or
  // this bucket would wrongly claim a visibly-shared Template as unused.
  const boundTemplateIds = new Set<string>([
    ...state.bindings.map((binding) => binding.templateId),
    ...state.sharedTemplateBindings.map((binding) => binding.templateId),
    ...state.sharedTemplateFieldStates
      .filter((entry) => entry.mode === "override" && entry.templateId)
      .map((entry) => entry.templateId as string),
  ]);
  const notOfferedAnywhere = state.templates
    .filter((template) => !boundTemplateIds.has(template.id))
    .sort(compareTemplates("alphabetical", "ascending"));

  return { fields, notOfferedAnywhere };
}

export function filterFieldFirstView(view: FieldFirstView, search: string): FieldFirstView {
  const normalized = search.trim().toLocaleLowerCase();
  if (normalized.length === 0) return view;

  const fields = view.fields
    .map((field): FieldFirstFieldRow | null => {
      const fieldMatches = field.label.toLocaleLowerCase().includes(normalized);
      const options = fieldMatches
        ? field.options
        : field.options.filter(
            (option) =>
              derivePreview(option.template.content).toLocaleLowerCase().includes(normalized) ||
              option.template.content.toLocaleLowerCase().includes(normalized),
          );
      if (options.length === 0) return null;
      return { ...field, options };
    })
    .filter((field): field is FieldFirstFieldRow => field !== null);

  const notOfferedAnywhere = view.notOfferedAnywhere.filter(
    (template) =>
      derivePreview(template.content).toLocaleLowerCase().includes(normalized) ||
      template.content.toLocaleLowerCase().includes(normalized),
  );

  return { fields, notOfferedAnywhere };
}
