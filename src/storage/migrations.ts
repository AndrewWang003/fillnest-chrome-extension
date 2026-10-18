import { isPickerPosition } from "./picker-position";
import { InvalidStoredDataError } from "./invalid-stored-data-error";
import { isRecord } from "./value-guards";

/**
 * The stored-schema migration chain, v1 through v11.
 *
 * Task 032 moved this out of `fillnest-repository.ts`. Migrations are
 * append-only and are touched by a different kind of change than anything else
 * in that file: a new one is written once, at a schema bump, and then never
 * read again unless something breaks. Keeping them together makes the chain
 * legible as a sequence, and keeps 65 lines of history out of the module that
 * holds live behaviour.
 *
 * Each step takes the previous version's shape and returns the next. The
 * repository still owns the decision to run them and the rule that a migrated
 * state is validated before it is ever persisted.
 */

/**
 * The one migration that needs storage: v1 kept the Picker position under its
 * own top-level key, so v2 folds it into the state record. The legacy read is
 * injected rather than reaching for a repository instance, which is what keeps
 * the whole chain in one module.
 */
export async function migrateV1ToV2(
  value: Record<string, unknown>,
  readLegacyPickerPosition: () => Promise<unknown>,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(value.templates)) throw new InvalidStoredDataError();
  const templates: unknown[] = value.templates.map((template: unknown) =>
    isRecord(template) ? { ...template, totalUsageCount: 0 } : template,
  );
  const bindings = Array.isArray(value.bindings)
    ? (value.bindings as unknown[]).map((binding: unknown) =>
        isRecord(binding) ? { ...binding, usageCount: 0 } : binding,
      )
    : [];

  const legacyValue = await readLegacyPickerPosition();

  return {
    ...value,
    schemaVersion: 2,
    templates,
    bindings,
    pickerPosition: isPickerPosition(legacyValue) ? legacyValue : null,
  };
}

export function migrateV2ToV3(value: Record<string, unknown>): Record<string, unknown> {
  const templates: unknown = Array.isArray(value.templates)
    ? (value.templates as unknown[]).map((template: unknown) =>
        isRecord(template) ? { ...template, revision: 0 } : template,
      )
    : value.templates;
  const bindings: unknown = Array.isArray(value.bindings)
    ? (value.bindings as unknown[]).map((binding: unknown) =>
        isRecord(binding) ? { ...binding, revision: 0 } : binding,
      )
    : value.bindings;
  // Stamped as the literal target version for this one step, not
  // CURRENT_SCHEMA_VERSION - read() chains this into migrateV3ToV4
  // immediately after, and that chain depends on seeing an intermediate
  // schemaVersion 3 here rather than jumping straight to whatever the
  // latest version happens to be.
  return { ...value, schemaVersion: 3, templates, bindings };
}

export function migrateV3ToV4(value: Record<string, unknown>): Record<string, unknown> {
  const bindings: unknown[] = Array.isArray(value.bindings) ? (value.bindings as unknown[]) : [];
  const nextOrderByField = new Map<string, number>();
  const withOrder: unknown[] = bindings.map((binding: unknown) => {
    if (!isRecord(binding) || typeof binding.fieldProfileId !== "string") return binding;
    const order = nextOrderByField.get(binding.fieldProfileId) ?? 0;
    nextOrderByField.set(binding.fieldProfileId, order + 1);
    return { ...binding, order };
  });
  return { ...value, schemaVersion: 4, bindings: withOrder };
}

export function migrateV4ToV5(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    schemaVersion: 5,
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
  };
}

export function migrateV5ToV6(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 6, logicalPageObservations: [] };
}

export function migrateV6ToV7(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 7, sharedTemplateSets: [], sharedTemplateBindings: [] };
}

export function migrateV7ToV8(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 8, compatibilityPairDecisions: [] };
}

export function migrateV8ToV9(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 9, sharedTemplateFieldStates: [] };
}

// Task 027: purely additive - every existing sharedTemplateBindings entry is
// already valid with `ownerFieldProfileId` simply absent (an ordinary shared
// slot), so no per-record migration is needed beyond the version bump.
export function migrateV9ToV10(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 10 };
}

// Task 027 Addendum C.2 adds an optional `privateToField` marker to
// BindingRecord. Purely additive: an existing Binding simply has no marker and
// behaves exactly as it did before, so nothing is inferred retroactively about
// which Bindings were once private.
export function migrateV10ToV11(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 11 };
}

// v11 -> v12. This version was briefly defined as adding a `manuallyOrdered`
// marker to Field Profiles, for the field-local manual ordering Task 003
// described. The owner removed that feature the same day, before any release,
// so v12 carries no new field. The bump is kept rather than reverted because a
// store may already have been written at v12 by a build from that window, and
// such a store must stay readable. Any `manuallyOrdered` it holds is dropped on
// read: `validateFieldProfile` only copies fields it knows about.
export function migrateV11ToV12(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 12 };
}

// v12 -> v13 (field-local manual ordering removed, 2026-09-08). Drops
// `BindingRecord.order`. Nothing reads it any more: a Field's list is ranked by
// that Field's own Binding usage, and where a deterministic sequence is still
// needed the Binding id supplies it. `validateBinding` copies only fields it
// knows, so the value is dropped on the first read either way; this migration
// exists so the version number states that the shape changed.
export function migrateV12ToV13(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 13 };
}
