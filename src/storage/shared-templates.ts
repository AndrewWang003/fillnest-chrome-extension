import type { SiteIdentity } from "../domain/site";
import { InvalidStoredDataError } from "./invalid-stored-data-error";
import {
  isNonEmptyString,
  isNonEmptyStringArray,
  isNonNegativeInteger,
  isRecord,
} from "./value-guards";

/**
 * The Shared Template Set subsystem: its records, its invariant validators,
 * and the resolver every surface reads a Field's effective Template list
 * through.
 *
 * Task 031 extracted this from `fillnest-repository.ts`. Three consecutive
 * audits of Task 027 found 15 defects, and they were not distributed randomly:
 * every one sat at a seam inside that 6,000-line module where the membership
 * commands, this resolver, and the Undo staleness checks each had to agree
 * about a data shape that changed twice. Giving the shape, its invariants, and
 * its resolution one home is the first step in reducing that recurrence.
 *
 * This module deliberately imports nothing from `fillnest-repository.ts`. It
 * takes structural state slices instead of `FillNestState`, so the dependency
 * runs one way and cannot become a cycle. `FillNestState` satisfies those
 * slices structurally, so callers pass it unchanged.
 */

/** The minimum a direct Binding must expose for effective-list resolution. */
export interface ResolvableBinding {
  id: string;
  templateId: string;
  fieldProfileId: string;
  usageCount: number;
}

/** The slice of stored state a Field's effective Template list is resolved from. */
export interface SharedTemplateResolutionState {
  bindings: readonly ResolvableBinding[];
  sharedTemplateSets: readonly SharedTemplateSetRecord[];
  sharedTemplateBindings: readonly SharedTemplateBindingRecord[];
  sharedTemplateFieldStates: readonly SharedTemplateFieldStateRecord[];
}

export interface SharedTemplateSetRecord {
  id: string;
  siteId: SiteIdentity;
  name: string;
  // A Field's own direct Bindings stay in `bindings`, untouched but dormant,
  // for exactly as long as its id appears here - "dormant" is not a stored
  // flag, it is defined by set membership.
  memberFieldProfileIds: string[];
}

/**
 * One Template in a Shared Template Set's own ordered effective list. Its
 * own `id` is that entry's durable logical slot identity (Task 026 Confirmed
 * Contract: "separate from the Template record currently supplying its base
 * content") - a Set-level copy (`saveTemplateCopyForSharedSet`) replaces
 * `templateId` in place and keeps this same `id`, so a member's Override or
 * Exclusion (keyed by this `id` as `slotId`) survives that edit.
 */
export interface SharedTemplateBindingRecord {
  id: string;
  setId: string;
  templateId: string;
  usageCount: number;
  revision: number;
  // Rank among every other Binding in this same set, ascending, lower first -
  // the set-level equivalent of BindingRecord.order, since a shared list has
  // no single owning Field to key ordinary Binding.order off of.
  order: number;
  // Task 027 Confirmed Contract: when present, this slot is a Field-only
  // relationship - only this one Field Profile may ever resolve it, checked
  // before any Override/Exclusion (Task 026) logic. Absent means an ordinary
  // shared slot every member resolves normally. Environment or membership
  // changes (add/move/merge/cross-Site merge/split/restore/undo) must never
  // clear or reassign this value except through an explicit `Share this
  // version` promotion, which removes it entirely.
  ownerFieldProfileId?: string;
}

/**
 * One member Field's explicit divergence from a Shared Template Set slot's
 * base Template (Task 026 Confirmed Contract). No row for a (setId,
 * fieldProfileId, slotId) triple means "inherit" - the Field uses the slot's
 * own base Template. `templateId`/`usageCount`/`revision` are present only
 * for `mode: "override"`; an Exclusion carries no Template of its own.
 */
export interface SharedTemplateFieldStateRecord {
  id: string;
  setId: string;
  slotId: string;
  fieldProfileId: string;
  mode: "override" | "exclude";
  templateId?: string;
  usageCount?: number;
  revision?: number;
}

// Same max+1 reasoning as `nextBindingOrder`, applied to one Shared Template
// Set's own ordered list instead of one Field's own Bindings.
export function nextSharedBindingOrder(bindings: SharedTemplateBindingRecord[], setId: string): number {
  const existingOrders = bindings.filter((binding) => binding.setId === setId).map((binding) => binding.order);
  return existingOrders.length === 0 ? 0 : Math.max(...existingOrders) + 1;
}

/**
 * Whether two snapshots describe the same Shared Template Set slots.
 *
 * Task 010's Undo-staleness checks compare a Set's current slots against the
 * snapshot a mutation recorded. That comparison must be order-insensitive:
 * an Undo that legitimately restores a slot (Task 027 Addendum A.3 mode 2
 * reinstates a consumed owner-only slot by appending it) leaves the array in
 * a different order with byte-identical records, and a positional or
 * `JSON.stringify` comparison would then reject a perfectly valid composite
 * Undo. Identity is the id set plus each record's own fields - including
 * `ownerFieldProfileId`, so a promotion is never mistaken for no change.
 */
export function sameSharedBindings(
  a: readonly SharedTemplateBindingRecord[],
  b: readonly SharedTemplateBindingRecord[],
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((binding) => [binding.id, binding] as const));
  return a.every((binding) => {
    const other = byId.get(binding.id);
    return (
      other !== undefined &&
      binding.setId === other.setId &&
      binding.templateId === other.templateId &&
      binding.usageCount === other.usageCount &&
      binding.revision === other.revision &&
      binding.order === other.order &&
      binding.ownerFieldProfileId === other.ownerFieldProfileId
    );
  });
}

export function defaultSharedTemplateSetName(existingNames: ReadonlySet<string>): string {
  let candidate = 1;
  while (existingNames.has(`Shared Template Set ${candidate}`)) candidate += 1;
  return `Shared Template Set ${candidate}`;
}


export function isFieldSharedElsewhere(
  state: Pick<SharedTemplateResolutionState, "sharedTemplateSets">,
  fieldProfileId: string,
): boolean {
  return state.sharedTemplateSets.some((candidate) => candidate.memberFieldProfileIds.includes(fieldProfileId));
}

/**
 * Task 027 Addendum A (A.2): an explicit reference to one Template
 * relationship. Every command that reads, edits, removes, or re-scopes one
 * relationship should prefer this over a bare `templateId`, which cannot
 * distinguish an ordinary slot from a coexisting owner-only slot for the
 * same Template (the direct cause of Addendum A findings A, B, F, and J).
 */
export type TemplateRelationRef =
  | { kind: "binding"; bindingId: string }
  | { kind: "slot"; setId: string; slotId: string }
  | { kind: "override"; setId: string; slotId: string; fieldProfileId: string };

/** One resolved entry in a Field's effective Template list (Task 026). */
export interface EffectiveTemplateListEntry {
  templateId: string;
  // Task 027 Addendum A (A.2): sum of usageCount across every contributing
  // relation collapsed into this entry. Usage recording still increments
  // only the primary relation, so a collapse never double-counts.
  usageCount: number;
  // Every relation the Field may resolve for this Template, ordered lowest
  // slot `order` first. A Field never sees the same Template twice: when
  // more than one relation resolves to the same Template (Task 027 Addendum
  // A.1 coexistence), they are collapsed into this one entry.
  relations: TemplateRelationRef[];
  // The owning Shared Template Set slot for the *primary* relation (lowest
  // `order`), present only for a Shared Set member - `null` for a Field's
  // own ordinary direct Binding. Save-scope UI uses this to target the right
  // slot for `saveTemplateCopyForSharedSet`, `saveTemplateOverrideForField`,
  // and `excludeSharedTemplateForField`.
  slotId: string | null;
  // Whether the primary relation is the Field's own Override of the slot's
  // base Template (as opposed to plain inheritance) - `false` for a non-Set
  // Field.
  isOverride: boolean;
  // Task 027: `true` only when EVERY contributing relation is an owner-only
  // slot this Field owns, with no Override - `false` for an ordinary shared
  // slot, an Override/Exclusion of one, a non-Set Field's direct Binding, or
  // a collapsed entry where an ordinary slot also contributes (the Template
  // is then already visible to peers). It answers "is this item private?",
  // which drives Save-scope labelling.
  isFieldOnly: boolean;
  // The owner-only slot contributing to this entry, if any - `null`
  // otherwise. Distinct from `isFieldOnly`: a collapsed entry where an
  // ordinary slot also contributes is not private, but the Field still holds
  // a private relation underneath it. `Share this version` targets THIS
  // slot, never the primary relation, and is offered whenever it is
  // non-null: in the mixed case the promotion is a pure cleanup collapse
  // (Addendum A.3 mode 2), the only action allowed to remove that otherwise
  // unreachable relation.
  fieldOnlySlotId: string | null;
}

export interface EffectiveTemplateList {
  templateIds: string[];
  usageCount: number;
  entries: EffectiveTemplateListEntry[];
}

/**
 * A Field's effective Template list is either its own direct Bindings, or -
 * for exactly as long as it is a Shared Template Set member - that set's
 * shared list resolved slot by slot against the Field's own Overrides and
 * Exclusions (Task 015 Accepted Contract, relaxed only as Task 026
 * authorizes: "A field's effective Template list resolves slots in their
 * shared order, selecting the base, Override, or no entry for each slot").
 * Task 024 reuses this same resolution to decide whether a Field is a
 * discoverable Compatibility Candidate source. Task 027 Addendum A (A.2):
 * the result carries at most one entry per distinct visible Template,
 * collapsing coexisting relations for the same Template while preserving
 * their provenance in `relations`.
 */
export function effectiveTemplateListForField(
  state: SharedTemplateResolutionState,
  fieldProfileId: string,
): EffectiveTemplateList {
  const set = state.sharedTemplateSets.find((candidate) => candidate.memberFieldProfileIds.includes(fieldProfileId));
  if (set) {
    const sharedBindings = state.sharedTemplateBindings
      .filter((binding) => binding.setId === set.id)
      .sort((a, b) => a.order - b.order);
    interface Contribution {
      templateId: string;
      usageCount: number;
      order: number;
      relation: TemplateRelationRef;
      isOverride: boolean;
      // Whether this single relation, on its own, is owner-only - an
      // Override contribution is never counted as field-only (A.2).
      isFieldOnly: boolean;
      fieldOnlySlotId: string | null;
    }
    const contributions: Contribution[] = [];
    for (const slot of sharedBindings) {
      // Task 027 Confirmed Contract: a Field-only slot's owner-only policy
      // applies before any Override/Exclusion resolution - a non-owner never
      // sees it, full stop, regardless of any field-state that might exist.
      if (slot.ownerFieldProfileId !== undefined && slot.ownerFieldProfileId !== fieldProfileId) continue;
      const fieldState = state.sharedTemplateFieldStates.find(
        (candidate) =>
          candidate.setId === set.id && candidate.slotId === slot.id && candidate.fieldProfileId === fieldProfileId,
      );
      if (fieldState?.mode === "exclude") continue;
      if (fieldState?.mode === "override") {
        contributions.push({
          templateId: fieldState.templateId!,
          usageCount: fieldState.usageCount ?? 0,
          order: slot.order,
          relation: { kind: "override", setId: set.id, slotId: slot.id, fieldProfileId },
          isOverride: true,
          isFieldOnly: false,
          fieldOnlySlotId: slot.ownerFieldProfileId === fieldProfileId ? slot.id : null,
        });
        continue;
      }
      contributions.push({
        templateId: slot.templateId,
        usageCount: slot.usageCount,
        order: slot.order,
        relation: { kind: "slot", setId: set.id, slotId: slot.id },
        isOverride: false,
        isFieldOnly: slot.ownerFieldProfileId === fieldProfileId,
        fieldOnlySlotId: slot.ownerFieldProfileId === fieldProfileId ? slot.id : null,
      });
    }
    // Group by resulting templateId - deterministic and order-independent,
    // per Addendum A.2's collapse rule.
    const grouped = new Map<string, Contribution[]>();
    for (const contribution of contributions) {
      const group = grouped.get(contribution.templateId);
      if (group) group.push(contribution);
      else grouped.set(contribution.templateId, [contribution]);
    }
    const entries: EffectiveTemplateListEntry[] = [];
    for (const [templateId, group] of grouped) {
      const sorted = [...group].sort((a, b) => a.order - b.order);
      const primary = sorted[0]!;
      const ownSlotId = sorted.find((contribution) => contribution.fieldOnlySlotId !== null)?.fieldOnlySlotId ?? null;
      entries.push({
        templateId,
        usageCount: sorted.reduce((total, contribution) => total + contribution.usageCount, 0),
        relations: sorted.map((contribution) => contribution.relation),
        slotId: primary.relation.kind === "binding" ? null : primary.relation.slotId,
        isOverride: primary.isOverride,
        isFieldOnly: sorted.every((contribution) => contribution.isFieldOnly),
        fieldOnlySlotId: ownSlotId,
      });
    }
    return {
      templateIds: entries.map((entry) => entry.templateId),
      usageCount: entries.reduce((total, entry) => total + entry.usageCount, 0),
      entries,
    };
  }
  // Deterministic, like the Shared Template Set branch above. `state.bindings`
  // is in storage-array order, so ranking by id gives every caller the same
  // sequence regardless of how the array happens to be laid out. The displayed
  // order is then chosen by `orderFieldTemplateEntries`.
  const directBindings = [...state.bindings]
    .filter((binding) => binding.fieldProfileId === fieldProfileId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const entries: EffectiveTemplateListEntry[] = directBindings.map((binding) => ({
    templateId: binding.templateId,
    usageCount: binding.usageCount,
    relations: [{ kind: "binding", bindingId: binding.id }],
    slotId: null,
    isOverride: false,
    isFieldOnly: false,
    fieldOnlySlotId: null,
  }));
  return {
    templateIds: entries.map((entry) => entry.templateId),
    usageCount: entries.reduce((total, entry) => total + entry.usageCount, 0),
    entries,
  };
}

export function validateSharedTemplateSet(value: unknown): SharedTemplateSetRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.siteId) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyStringArray(value.memberFieldProfileIds) ||
    new Set(value.memberFieldProfileIds).size !== value.memberFieldProfileIds.length
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    siteId: value.siteId,
    name: value.name,
    memberFieldProfileIds: [...value.memberFieldProfileIds],
  };
}

export function validateSharedTemplateBinding(value: unknown): SharedTemplateBindingRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.setId) ||
    !isNonEmptyString(value.templateId) ||
    !isNonNegativeInteger(value.usageCount) ||
    !isNonNegativeInteger(value.revision) ||
    !isNonNegativeInteger(value.order) ||
    (value.ownerFieldProfileId !== undefined && !isNonEmptyString(value.ownerFieldProfileId))
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    setId: value.setId,
    templateId: value.templateId,
    usageCount: value.usageCount,
    revision: value.revision,
    order: value.order,
    ...(value.ownerFieldProfileId !== undefined ? { ownerFieldProfileId: value.ownerFieldProfileId } : {}),
  };
}

export function validateSharedTemplateFieldState(value: unknown): SharedTemplateFieldStateRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.setId) ||
    !isNonEmptyString(value.slotId) ||
    !isNonEmptyString(value.fieldProfileId) ||
    (value.mode !== "override" && value.mode !== "exclude")
  ) {
    throw new InvalidStoredDataError();
  }
  if (value.mode === "override") {
    if (
      !isNonEmptyString(value.templateId) ||
      !isNonNegativeInteger(value.usageCount) ||
      !isNonNegativeInteger(value.revision)
    ) {
      throw new InvalidStoredDataError();
    }
    return {
      id: value.id,
      setId: value.setId,
      slotId: value.slotId,
      fieldProfileId: value.fieldProfileId,
      mode: "override",
      templateId: value.templateId,
      usageCount: value.usageCount,
      revision: value.revision,
    };
  }
  // An Exclusion carries no Template of its own.
  if (value.templateId !== undefined || value.usageCount !== undefined || value.revision !== undefined) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    setId: value.setId,
    slotId: value.slotId,
    fieldProfileId: value.fieldProfileId,
    mode: "exclude",
  };
}

/**
 * Every stored-data invariant the Shared Template Set subsystem owns.
 *
 * Task 031 moved these next to the records they constrain. They are the safety
 * net that turned three audits' worth of defects into rejected operations
 * rather than corrupted stores - the owner-membership rule and the
 * `setId:templateId:owner` uniqueness key in particular - so they belong with
 * the shape they defend, not 700 lines away from it.
 *
 * Takes the surrounding facts it needs as plain sets and maps rather than the
 * whole state, so it stays independent of the repository module.
 */
export function assertSharedTemplateInvariants(input: {
  sharedTemplateSets: readonly SharedTemplateSetRecord[];
  sharedTemplateBindings: readonly SharedTemplateBindingRecord[];
  sharedTemplateFieldStates: readonly SharedTemplateFieldStateRecord[];
  /** Every Site id the state knows about. */
  siteIds: ReadonlySet<string>;
  /** Every Template id the state knows about. */
  templateIds: ReadonlySet<string>;
  /** Field Profile id to its Page Profile id. */
  fieldPageIds: ReadonlyMap<string, string>;
  /** Every Page Profile id the state knows about. */
  pageIds: ReadonlySet<string>;
}): void {
  // Shared Template Set membership (Task 015 Accepted Contract): Site-local,
  // at least one member, and a Field belongs to at most one set - checked
  // across every set at once, not just within each set individually.
  // `set.siteId` is the Set's anchor Site (where it was created or the
  // surviving Set of a merge) for Site-management display only - Task 024
  // is the sole authorized extension letting a member's own Page be on a
  // different Site, through explicit Link confirmation only (never inferred).
  const sharedFieldMemberships = new Set<string>();
  for (const set of input.sharedTemplateSets) {
    if (!input.siteIds.has(set.siteId) || set.memberFieldProfileIds.length === 0) {
      throw new InvalidStoredDataError();
    }
    for (const memberId of set.memberFieldProfileIds) {
      const memberPageId = input.fieldPageIds.get(memberId);
      const memberPageExists = memberPageId !== undefined && input.pageIds.has(memberPageId);
      if (!memberPageExists || sharedFieldMemberships.has(memberId)) {
        throw new InvalidStoredDataError();
      }
      sharedFieldMemberships.add(memberId);
    }
  }

  const sharedSets = new Map(input.sharedTemplateSets.map((set) => [set.id, set] as const));
  const sharedTemplatePairs = new Set<string>();
  const sharedOrderBySet = new Map<string, Set<number>>();
  for (const sharedBinding of input.sharedTemplateBindings) {
    if (!sharedSets.has(sharedBinding.setId) || !input.templateIds.has(sharedBinding.templateId)) {
      throw new InvalidStoredDataError();
    }
    // Task 027: a Field-only slot's owner must be an actual member of the
    // slot's own Set - it can never point outside the Set it lives in.
    if (
      sharedBinding.ownerFieldProfileId !== undefined &&
      !sharedSets.get(sharedBinding.setId)!.memberFieldProfileIds.includes(sharedBinding.ownerFieldProfileId)
    ) {
      throw new InvalidStoredDataError();
    }

    // Task 027: an owner-only slot is a distinct relationship from the
    // ordinary (ownerless) slot for the same Template, and from another
    // owner's own owner-only slot for it - a merge may legitimately produce
    // several such slots in one Set. Uniqueness is therefore keyed per
    // owner (or the lack of one), not by Template id alone.
    const pair = `${sharedBinding.setId}:${sharedBinding.templateId}:${sharedBinding.ownerFieldProfileId ?? ""}`;
    if (sharedTemplatePairs.has(pair)) throw new InvalidStoredDataError();
    sharedTemplatePairs.add(pair);

    const seenOrders = sharedOrderBySet.get(sharedBinding.setId) ?? new Set<number>();
    if (seenOrders.has(sharedBinding.order)) throw new InvalidStoredDataError();
    seenOrders.add(sharedBinding.order);
    sharedOrderBySet.set(sharedBinding.setId, seenOrders);
  }

  // Task 026: a per-field Override/Exclusion is keyed by (Set, member Field,
  // logical slot) and must reference all three genuinely - a slot is the
  // owning Shared Template Binding's own `id`, so it implicitly pins the Set
  // too (checked explicitly below anyway, defense in depth).
  const sharedSlotsBySet = new Map<string, Set<string>>();
  for (const sharedBinding of input.sharedTemplateBindings) {
    const slots = sharedSlotsBySet.get(sharedBinding.setId) ?? new Set<string>();
    slots.add(sharedBinding.id);
    sharedSlotsBySet.set(sharedBinding.setId, slots);
  }
  const fieldStateIds = new Set(input.sharedTemplateFieldStates.map((entry) => entry.id));
  if (fieldStateIds.size !== input.sharedTemplateFieldStates.length) throw new InvalidStoredDataError();
  const seenFieldStateSlots = new Set<string>();
  for (const entry of input.sharedTemplateFieldStates) {
    const set = sharedSets.get(entry.setId);
    if (!set || !set.memberFieldProfileIds.includes(entry.fieldProfileId)) {
      throw new InvalidStoredDataError();
    }
    if (!sharedSlotsBySet.get(entry.setId)?.has(entry.slotId)) throw new InvalidStoredDataError();
    if (entry.mode === "override" && !input.templateIds.has(entry.templateId!)) {
      throw new InvalidStoredDataError();
    }
    const tuple = `${entry.setId}:${entry.fieldProfileId}:${entry.slotId}`;
    if (seenFieldStateSlots.has(tuple)) throw new InvalidStoredDataError();
    seenFieldStateSlots.add(tuple);
  }
}
