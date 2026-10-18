import type {
  FieldProfileRecord,
  FillNestState,
  PageProfileRecord,
  TemplateRecord,
} from "../storage/fillnest-repository";
import type { SharedTemplateSetRecord } from "../storage/shared-templates";

/**
 * Task 040 (owner decision 1A). What the Templates page's Shared Sets tab
 * shows of one Set: its shared list once, then each member Field with only
 * what makes it different from that list.
 */
export interface SharedSetView {
  set: SharedTemplateSetRecord;
  /** The ordinary Slots' Templates, in Set order. Never a Field-only one. */
  sharedTemplates: TemplateRecord[];
  /** The distinct Sites the members are on - more than one for a cross-Site Set. */
  siteIds: string[];
  members: SharedSetMemberView[];
}

export interface SharedSetMemberView {
  fieldProfileId: string;
  field: FieldProfileRecord | undefined;
  page: PageProfileRecord | undefined;
  /** This Field's own version of a shared Template (an Override). */
  overrides: Array<{ base: TemplateRecord; own: TemplateRecord }>;
  /** Shared Templates this Field does not offer (Exclusions). */
  exclusions: TemplateRecord[];
  /** Templates only this Field offers (its Field-only relationships), as it offers them. */
  fieldOnly: TemplateRecord[];
}

export function buildSharedSetViews(state: FillNestState): SharedSetView[] {
  const templates = new Map(state.templates.map((template) => [template.id, template] as const));
  const fields = new Map(state.fieldProfiles.map((field) => [field.id, field] as const));
  const pages = new Map(state.pageProfiles.map((page) => [page.id, page] as const));
  const known = (template: TemplateRecord | undefined): template is TemplateRecord => template !== undefined;

  return [...state.sharedTemplateSets]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((set) => {
      const slots = state.sharedTemplateBindings
        .filter((slot) => slot.setId === set.id)
        .sort((left, right) => left.order - right.order);
      const states = state.sharedTemplateFieldStates.filter((entry) => entry.setId === set.id);
      const stateOf = (slotId: string, fieldProfileId: string) =>
        states.find((entry) => entry.slotId === slotId && entry.fieldProfileId === fieldProfileId);

      const members = set.memberFieldProfileIds.map((fieldProfileId): SharedSetMemberView => {
        const field = fields.get(fieldProfileId);
        const overrides: SharedSetMemberView["overrides"] = [];
        const exclusions: TemplateRecord[] = [];
        const fieldOnly: TemplateRecord[] = [];
        for (const slot of slots) {
          const entry = stateOf(slot.id, fieldProfileId);
          if (slot.ownerFieldProfileId !== undefined) {
            // A Field-only relationship belongs under its owner alone, showing
            // the version the owner actually offers.
            if (slot.ownerFieldProfileId !== fieldProfileId || entry?.mode === "exclude") continue;
            const offered = templates.get(entry?.mode === "override" ? entry.templateId! : slot.templateId);
            if (offered) fieldOnly.push(offered);
            continue;
          }
          const base = templates.get(slot.templateId);
          if (!base || !entry) continue;
          if (entry.mode === "exclude") {
            exclusions.push(base);
          } else {
            const own = templates.get(entry.templateId!);
            if (own) overrides.push({ base, own });
          }
        }
        return {
          fieldProfileId,
          field,
          page: field ? pages.get(field.pageProfileId) : undefined,
          overrides,
          exclusions,
          fieldOnly,
        };
      });

      const siteIds = [...new Set(members.map((member) => member.page?.siteId).filter((siteId) => siteId !== undefined))]
        .sort();
      return {
        set,
        sharedTemplates: slots
          .filter((slot) => slot.ownerFieldProfileId === undefined)
          .map((slot) => templates.get(slot.templateId))
          .filter(known),
        siteIds: siteIds.length > 0 ? siteIds : [set.siteId],
        members,
      };
    });
}
