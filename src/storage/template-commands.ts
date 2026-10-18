import { siteIdentityFromUrl } from "../domain/site";
import type { BindingRecord, FillNestState, TemplateRecord } from "./records";
import type * as Inputs from "./repository-inputs";
import type {
  CreateTemplateAndBindInput,
  CreateTemplateInput,
  CreatedTemplateBinding,
  DeleteTemplateInput,
  DeleteTemplatesInput,
  DeleteTemplatesResult,
  RestoreTemplateInput,
  RestoreTemplatesFailure,
  RestoreTemplatesInput,
  RestoreTemplatesResult,
  UpdateTemplateInput,
} from "./repository-inputs";
import {
  type SharedTemplateBindingRecord,
  type SharedTemplateFieldStateRecord,
  validateSharedTemplateBinding,
  validateSharedTemplateFieldState,
} from "./shared-templates";
import {
  addSite,
  prepareBindingProfiles,
  retainBoundPageObservations,
} from "./state-helpers";
import { validateBinding, validateTemplate } from "./state-validation";
import { StaleUndoError } from "./stale-errors";
import { isRecord } from "./value-guards";

/**
 * The Template command family as pure state transitions, and the shared shape
 * every extracted command family uses.
 *
 * Task 032 Addendum A slice B1. Each function takes the state it was given and
 * returns the state that should replace it, or `null` when the command is a
 * no-op that must not write. The Repository still owns reading, the mutation
 * queue, validation on commit, and how many durable writes happen - moving
 * that would change observable behaviour, which Addendum A rule 1 forbids.
 *
 * `next: null` is not the same as returning the unchanged state: the
 * behaviour locks in `tests/unit/repository.test.ts` assert that a no-op
 * delete performs zero writes, and committing an identical state would still
 * be a write.
 */
/** The non-deterministic inputs a transition is allowed to use. */
export interface TransitionDeps {
  createId(): string;
  now(): string;
}

export interface StateTransition<T> {
  /** The state to commit, or `null` to commit nothing. */
  next: FillNestState | null;
  result: T;
}

export function createTemplateTransition(
  state: FillNestState,
  input: CreateTemplateInput,
  deps: TransitionDeps,
): StateTransition<TemplateRecord> {
  const timestamp = deps.now();
  const template: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: [siteIdentityFromUrl(input.pageUrl)],
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };

  return {
    next: {
      ...state,
      sites: addSite(state.sites, template.siteAffinities[0] ?? ""),
      templates: [...state.templates, template],
    },
    result: template,
  };
}

export function createTemplateAndBindTransition(
  state: FillNestState,
  input: CreateTemplateAndBindInput,
  deps: TransitionDeps,
): StateTransition<CreatedTemplateBinding> {
  const timestamp = deps.now();
  const profiles = prepareBindingProfiles(state, input);

  const template: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: [profiles.siteId],
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  const binding: BindingRecord = {
    id: deps.createId(),
    templateId: template.id,
    pageProfileId: input.pageProfileId,
    fieldProfileId: input.fieldProfileId,
    createdAt: timestamp,
    usageCount: 0,
    revision: 0,
    ...(input.privateToField === true ? { privateToField: true as const } : {}),
  };

  return {
    next: {
      ...state,
      sites: addSite(state.sites, profiles.siteId),
      templates: [...state.templates, template],
      pageProfiles: profiles.pageProfiles,
      fieldProfiles: profiles.fieldProfiles,
      bindings: [...state.bindings, binding],
    },
    result: { template, binding },
  };
}

export function updateTemplateTransition(
  state: FillNestState,
  input: UpdateTemplateInput,
  deps: TransitionDeps,
): StateTransition<TemplateRecord> {
  const template = state.templates.find(
    (candidate) => candidate.id === input.templateId,
  );
  if (!template) throw new Error(`Template not found: ${input.templateId}`);

  const updated: TemplateRecord = {
    ...template,
    content: input.content,
    updatedAt: deps.now(),
    revision: template.revision + 1,
  };

  return {
    next: {
      ...state,
      templates: state.templates.map((candidate) =>
        candidate.id === template.id ? updated : candidate,
      ),
    },
    result: updated,
  };
}

export function deleteTemplateTransition(
  state: FillNestState,
  input: DeleteTemplateInput,
): StateTransition<boolean> {
  const template = state.templates.find(
    (candidate) => candidate.id === input.templateId,
  );
  if (!template) return { next: null, result: false };

  // Task 026: a deleted Template can be a Shared Template Set slot's own
  // base (removing the slot itself, and with it every dependent Override
  // and Exclusion) or the target of a Field's Override (removing just
  // that one relationship). Leaving either dangling would corrupt the
  // very next read - never a silent, unvalidated fallback to inheritance.
  const removedSlotIds = new Set(
    state.sharedTemplateBindings
      .filter((binding) => binding.templateId === input.templateId)
      .map((binding) => binding.id),
  );
  const sharedTemplateFieldStates = state.sharedTemplateFieldStates.filter(
    (entry) =>
      !removedSlotIds.has(entry.slotId) &&
      !(entry.mode === "override" && entry.templateId === input.templateId),
  );

  return {
    next: {
      ...state,
      templates: state.templates.filter(
        (candidate) => candidate.id !== input.templateId,
      ),
      bindings: state.bindings.filter(
        (binding) => binding.templateId !== input.templateId,
      ),
      sharedTemplateBindings: state.sharedTemplateBindings.filter(
        (binding) => binding.templateId !== input.templateId,
      ),
      sharedTemplateFieldStates,
      logicalPageObservations: retainBoundPageObservations(
        state,
        state.bindings.filter((binding) => binding.templateId !== input.templateId),
      ),
    },
    result: true,
  };
}

export function deleteTemplatesTransition(
  state: FillNestState,
  input: DeleteTemplatesInput,
): StateTransition<DeleteTemplatesResult> {
  const idsToDelete = new Set(
    input.templateIds.filter((id) => state.templates.some((template) => template.id === id)),
  );
  if (idsToDelete.size === 0) return { next: null, result: { deletedTemplateIds: [] } };

  // Task 026: see deleteTemplateTransition - the same dependent-slot and
  // dependent-Override cleanup applies to every Template in the batch.
  const removedSlotIds = new Set(
    state.sharedTemplateBindings
      .filter((binding) => idsToDelete.has(binding.templateId))
      .map((binding) => binding.id),
  );
  const sharedTemplateFieldStates = state.sharedTemplateFieldStates.filter(
    (entry) =>
      !removedSlotIds.has(entry.slotId) &&
      !(entry.mode === "override" && idsToDelete.has(entry.templateId!)),
  );

  return {
    next: {
      ...state,
      templates: state.templates.filter((template) => !idsToDelete.has(template.id)),
      bindings: state.bindings.filter((binding) => !idsToDelete.has(binding.templateId)),
      sharedTemplateBindings: state.sharedTemplateBindings.filter(
        (binding) => !idsToDelete.has(binding.templateId),
      ),
      sharedTemplateFieldStates,
      logicalPageObservations: retainBoundPageObservations(
        state,
        state.bindings.filter((binding) => !idsToDelete.has(binding.templateId)),
      ),
    },
    result: { deletedTemplateIds: [...idsToDelete] },
  };
}

/**
 * The Overrides and Exclusions an Undo of a Template deletion may put back.
 *
 * Task 026: a row whose slot this Undo restores comes back with it; a stale or
 * already-recreated slot never resurrects a dangling relationship. Task 026
 * Addendum A: deleting the Template an Override *points at* removes only that
 * Override - its slot stays in the Set - so the Override returns to that slot
 * while the slot, the Field's membership and the Field's freedom on that slot
 * all still hold.
 */
function restorableFieldStatesFor(
  state: FillNestState,
  templateId: string,
  fieldStates: SharedTemplateFieldStateRecord[],
  restoredSlots: SharedTemplateBindingRecord[],
): SharedTemplateFieldStateRecord[] {
  const restoredSlotIds = new Set(restoredSlots.map((slot) => slot.id));
  return fieldStates.filter((entry) => {
    if (restoredSlotIds.has(entry.slotId)) return true;
    if (entry.mode !== "override" || entry.templateId !== templateId) return false;
    const slot = state.sharedTemplateBindings.find(
      (candidate) => candidate.id === entry.slotId && candidate.setId === entry.setId,
    );
    const set = state.sharedTemplateSets.find((candidate) => candidate.id === entry.setId);
    return (
      slot !== undefined &&
      (slot.ownerFieldProfileId === undefined || slot.ownerFieldProfileId === entry.fieldProfileId) &&
      set?.memberFieldProfileIds.includes(entry.fieldProfileId) === true &&
      !state.sharedTemplateFieldStates.some(
        (candidate) => candidate.slotId === entry.slotId && candidate.fieldProfileId === entry.fieldProfileId,
      )
    );
  });
}

export function restoreTemplateTransition(
  state: FillNestState,
  input: RestoreTemplateInput,
): StateTransition<TemplateRecord> {
  const template = validateTemplate(input.template);
  const bindings = input.bindings.map(validateBinding);
  const sharedBindings = (input.sharedBindings ?? []).map(validateSharedTemplateBinding);
  const fieldStates = (input.fieldStates ?? []).map(validateSharedTemplateFieldState);
  if (state.templates.some((candidate) => candidate.id === template.id)) {
    throw new StaleUndoError(`A Template with this ID already exists: ${template.id}`);
  }

  const restorableBindings = bindings.filter(
    (binding) =>
      binding.templateId === template.id &&
      state.pageProfiles.some((page) => page.id === binding.pageProfileId) &&
      state.fieldProfiles.some((field) => field.id === binding.fieldProfileId),
  );
  const restorableSharedBindings = sharedBindings.filter(
    (binding) =>
      binding.templateId === template.id &&
      state.sharedTemplateSets.some((set) => set.id === binding.setId) &&
      !state.sharedTemplateBindings.some(
        (candidate) => candidate.setId === binding.setId && candidate.templateId === template.id,
      ),
  );
  const restorableFieldStates = restorableFieldStatesFor(state, template.id, fieldStates, restorableSharedBindings);

  let sites = state.sites;
  for (const siteId of template.siteAffinities) {
    sites = addSite(sites, siteId);
  }

  return {
    next: {
      ...state,
      sites,
      templates: [...state.templates, template],
      bindings: [...state.bindings, ...restorableBindings],
      sharedTemplateBindings: [...state.sharedTemplateBindings, ...restorableSharedBindings],
      sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...restorableFieldStates],
    },
    result: template,
  };
}

export function restoreTemplatesTransition(
  state: FillNestState,
  input: RestoreTemplatesInput,
): StateTransition<RestoreTemplatesResult> {
  const restored: TemplateRecord[] = [];
  const failed: RestoreTemplatesFailure[] = [];
  const seenIds = new Set(state.templates.map((template) => template.id));
  let sites = state.sites;
  const templatesToAdd: TemplateRecord[] = [];
  let bindingsToAdd: BindingRecord[] = [];
  let sharedBindingsToAdd: SharedTemplateBindingRecord[] = [];
  let fieldStatesToAdd: SharedTemplateFieldStateRecord[] = [];

  for (const entry of input.templates) {
    const rawId =
      isRecord(entry.template) && typeof entry.template.id === "string" ? entry.template.id : "unknown";
    let template: TemplateRecord;
    let bindings: BindingRecord[];
    let sharedBindings: SharedTemplateBindingRecord[];
    let fieldStates: SharedTemplateFieldStateRecord[];
    try {
      template = validateTemplate(entry.template);
      bindings = entry.bindings.map(validateBinding);
      sharedBindings = (entry.sharedBindings ?? []).map(validateSharedTemplateBinding);
      fieldStates = (entry.fieldStates ?? []).map(validateSharedTemplateFieldState);
    } catch {
      failed.push({ templateId: rawId, reason: "This Template's data is no longer valid." });
      continue;
    }
    if (seenIds.has(template.id)) {
      failed.push({ templateId: template.id, reason: `A Template with this ID already exists: ${template.id}` });
      continue;
    }
    seenIds.add(template.id);

    const restorableBindings = bindings.filter(
      (binding) =>
        binding.templateId === template.id &&
        state.pageProfiles.some((page) => page.id === binding.pageProfileId) &&
        state.fieldProfiles.some((field) => field.id === binding.fieldProfileId),
    );
    const restorableSharedBindings = sharedBindings.filter(
      (binding) =>
        binding.templateId === template.id &&
        state.sharedTemplateSets.some((set) => set.id === binding.setId) &&
        !state.sharedTemplateBindings.some(
          (candidate) => candidate.setId === binding.setId && candidate.templateId === template.id,
        ),
    );
    const restorableFieldStates = restorableFieldStatesFor(state, template.id, fieldStates, restorableSharedBindings);
    for (const siteId of template.siteAffinities) sites = addSite(sites, siteId);
    templatesToAdd.push(template);
    bindingsToAdd = [...bindingsToAdd, ...restorableBindings];
    sharedBindingsToAdd = [...sharedBindingsToAdd, ...restorableSharedBindings];
    fieldStatesToAdd = [...fieldStatesToAdd, ...restorableFieldStates];
    restored.push(template);
  }

  if (templatesToAdd.length === 0) return { next: null, result: { restored, failed } };

  return {
    next: {
      ...state,
      sites,
      templates: [...state.templates, ...templatesToAdd],
      bindings: [...state.bindings, ...bindingsToAdd],
      sharedTemplateBindings: [...state.sharedTemplateBindings, ...sharedBindingsToAdd],
      sharedTemplateFieldStates: [...state.sharedTemplateFieldStates, ...fieldStatesToAdd],
    },
    result: { restored, failed },
  };
}

export function saveTemplateCopyForFieldTransition(
  state: FillNestState,
  input: Inputs.SaveTemplateCopyForFieldInput,
  deps: TransitionDeps,
): StateTransition<Inputs.SaveTemplateCopyForFieldResult> {
  const original = state.templates.find((candidate) => candidate.id === input.templateId);
  if (!original) throw new Error(`Template not found: ${input.templateId}`);
  const existingBinding = state.bindings.find(
    (candidate) =>
      candidate.templateId === input.templateId && candidate.fieldProfileId === input.fieldProfileId,
  );
  if (!existingBinding) {
    throw new Error(`No Binding to move for Field Profile: ${input.fieldProfileId}`);
  }
  const fieldProfile = state.fieldProfiles.find((field) => field.id === input.fieldProfileId);
  if (!fieldProfile) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
  const pageProfile = state.pageProfiles.find((page) => page.id === fieldProfile.pageProfileId);
  if (!pageProfile) throw new Error(`Page Profile not found: ${fieldProfile.pageProfileId}`);

  const timestamp = deps.now();
  const copyTemplate: TemplateRecord = {
    id: deps.createId(),
    content: input.content,
    siteAffinities: [pageProfile.siteId],
    createdAt: timestamp,
    updatedAt: timestamp,
    totalUsageCount: 0,
    revision: 0,
  };
  const copyBinding: BindingRecord = {
    id: deps.createId(),
    templateId: copyTemplate.id,
    pageProfileId: existingBinding.pageProfileId,
    fieldProfileId: existingBinding.fieldProfileId,
    createdAt: timestamp,
    usageCount: 0,
    revision: 0,
    // Task 027 Addendum F: the copy replaces this Field's Binding, so it takes
    // over that Binding's audience. A private Template edited for its own
    // Field must not become shareable by being edited.
    ...(existingBinding.privateToField === true ? { privateToField: true as const } : {}),
  };

  return {
    next: {
    ...state,
    sites: addSite(state.sites, pageProfile.siteId),
    templates: [...state.templates, copyTemplate],
    bindings: [
      ...state.bindings.filter((candidate) => candidate.id !== existingBinding.id),
      copyBinding,
    ],
  },
    result: { template: copyTemplate, binding: copyBinding },
  };
}

export function undoSaveTransition(
  state: FillNestState,
  input: Inputs.UndoSaveInput,
): StateTransition<TemplateRecord> {
  const snapshot = validateTemplate(input.template);
  const current = state.templates.find((candidate) => candidate.id === snapshot.id);
  if (!current) throw new StaleUndoError("The Template no longer exists.");
  if (current.revision !== input.expectedRevision) {
    throw new StaleUndoError(
      "The Template changed since this edit; Undo was cancelled to avoid overwriting the newer version.",
    );
  }
  const restored: TemplateRecord = { ...snapshot, revision: current.revision + 1 };
  return {
    next: {
    ...state,
    templates: state.templates.map((candidate) => (candidate.id === restored.id ? restored : candidate)),
  },
    result: restored,
  };
}

export function undoSaveCopyForFieldTransition(
  state: FillNestState,
  input: Inputs.UndoSaveCopyForFieldInput,
): StateTransition<void> {
  const originalBinding = validateBinding(input.originalBinding);
  const copyTemplate = state.templates.find((candidate) => candidate.id === input.copyTemplateId);
  if (!copyTemplate) {
    throw new StaleUndoError("The copy no longer exists.");
  }
  const copyBinding = state.bindings.find(
    (candidate) =>
      candidate.templateId === input.copyTemplateId &&
      candidate.fieldProfileId === originalBinding.fieldProfileId,
  );
  const copyHasOtherRelationships =
    state.bindings.some(
      (candidate) => candidate.templateId === input.copyTemplateId && candidate.id !== copyBinding?.id,
    ) ||
    state.sharedTemplateBindings.some((candidate) => candidate.templateId === input.copyTemplateId);
  if (!copyBinding || copyTemplate.revision !== 0 || copyBinding.revision !== 0 || copyHasOtherRelationships) {
    throw new StaleUndoError("This field's Binding changed since the copy was created.");
  }
  return {
    next: {
    ...state,
    templates: state.templates.filter((candidate) => candidate.id !== input.copyTemplateId),
    bindings: [
      ...state.bindings.filter((candidate) => candidate.id !== copyBinding.id),
      originalBinding,
    ],
  },
    result: undefined,
  };
}

export function deleteNewlyGlobalTemplatesTransition(
  state: FillNestState,
  input: Inputs.DeleteNewlyGlobalTemplatesInput,
): StateTransition<Inputs.DeleteNewlyGlobalTemplatesResult> {
  const expected = new Map(input.templates.map((template) => [template.id, template.expectedRevision]));
  const targets = state.templates.filter((template) => expected.has(template.id));
  if (targets.length !== expected.size || targets.some((template) => template.siteAffinities.length !== 0 || template.revision !== expected.get(template.id))) {
    throw new StaleUndoError("Newly Global Templates changed. Review Global Templates before deleting.");
  }
  const idsToDelete = new Set(expected.keys());
  const deleted: Inputs.RestoreTemplateInput[] = targets.map((template) => ({
    template,
    bindings: state.bindings.filter((binding) => binding.templateId === template.id),
  }));
  return {
    next: {
    ...state,
    templates: state.templates.filter((template) => !idsToDelete.has(template.id)),
    bindings: state.bindings.filter((binding) => !idsToDelete.has(binding.templateId)),
    logicalPageObservations: retainBoundPageObservations(
      state,
      state.bindings.filter((binding) => !idsToDelete.has(binding.templateId)),
    ),
  },
    result: { deleted },
  };
}
