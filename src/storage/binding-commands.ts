import type { BindingRecord, FillNestState, TemplateRecord } from "./records";
import type {
  BindTemplateInput,
  RecordInsertionInput,
  UnbindTemplateInput,
  UndoBindInput,
  UndoUnbindInput,
} from "./repository-inputs";
import { effectiveTemplateListForField } from "./shared-templates";
import {
  addSite,
  prepareBindingProfiles,
  retainBoundPageObservations,
} from "./state-helpers";
import { validateBinding } from "./state-validation";
import { StaleUndoError } from "./stale-errors";
import type { StateTransition, TransitionDeps } from "./template-commands";

/**
 * The Binding command family as pure state transitions.
 *
 * Task 032 Addendum A slice B2. Same contract as the Template family: the
 * Repository still owns reading, the mutation queue and committing, and
 * `next: null` means this command writes nothing at all.
 */

/**
 * Task 036. Remember - or forget - that this Field's editor refused an
 * insertion. Writes nothing when the fact is already what it should be, so a
 * repeated success does not churn storage on every insertion.
 */
export function recordInsertionRejectionTransition(
  state: FillNestState,
  input: { fieldProfileId: string; rejected: boolean },
): StateTransition<boolean> {
  const field = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
  if (!field) return { next: null, result: false };
  if ((field.insertionRejected ?? false) === input.rejected) return { next: null, result: true };

  return {
    next: {
      ...state,
      fieldProfiles: state.fieldProfiles.map((candidate) =>
        candidate.id === field.id
          ? input.rejected
            ? { ...candidate, insertionRejected: true }
            : stripInsertionRejected(candidate)
          : candidate,
      ),
    },
    result: true,
  };
}

function stripInsertionRejected(field: FillNestState["fieldProfiles"][number]) {
  const { insertionRejected: _removed, ...rest } = field;
  return rest;
}

export function recordInsertionTransition(
  state: FillNestState,
  input: RecordInsertionInput,
): StateTransition<boolean> {
  const template = state.templates.find((candidate) => candidate.id === input.templateId);
  if (!template) return { next: null, result: false };

  const updatedTemplate: TemplateRecord = {
    ...template,
    totalUsageCount: template.totalUsageCount + 1,
    revision: template.revision + 1,
  };
  const entry = effectiveTemplateListForField(state, input.fieldProfileId).entries.find(
    (candidate) => candidate.templateId === input.templateId,
  );
  const primaryRelation = entry?.relations[0];
  const binding = primaryRelation?.kind === "binding"
    ? state.bindings.find((candidate) => candidate.id === primaryRelation.bindingId)
    : undefined;
  const sharedBinding = primaryRelation?.kind === "slot"
    ? state.sharedTemplateBindings.find((candidate) => candidate.id === primaryRelation.slotId)
    : undefined;
  const fieldState = primaryRelation?.kind === "override"
    ? state.sharedTemplateFieldStates.find(
        (candidate) => candidate.setId === primaryRelation.setId && candidate.slotId === primaryRelation.slotId &&
          candidate.fieldProfileId === primaryRelation.fieldProfileId && candidate.mode === "override",
      )
    : undefined;

  return {
    next: {
      ...state,
      templates: state.templates.map((candidate) =>
        candidate.id === template.id ? updatedTemplate : candidate,
      ),
      bindings: binding
        ? state.bindings.map((candidate) =>
            candidate === binding
              ? { ...candidate, usageCount: candidate.usageCount + 1, revision: candidate.revision + 1 }
              : candidate,
          )
        : state.bindings,
      sharedTemplateBindings: sharedBinding
        ? state.sharedTemplateBindings.map((candidate) =>
            candidate === sharedBinding
              ? { ...candidate, usageCount: candidate.usageCount + 1, revision: candidate.revision + 1 }
              : candidate,
          )
        : state.sharedTemplateBindings,
      sharedTemplateFieldStates: fieldState
        ? state.sharedTemplateFieldStates.map((candidate) =>
            candidate === fieldState
              ? { ...candidate, usageCount: (candidate.usageCount ?? 0) + 1, revision: (candidate.revision ?? 0) + 1 }
              : candidate,
          )
        : state.sharedTemplateFieldStates,
    },
    result: true,
  };
}

export function bindTemplateTransition(
  state: FillNestState,
  input: BindTemplateInput,
  deps: TransitionDeps,
): StateTransition<BindingRecord> {
  const template = state.templates.find(
    (candidate) => candidate.id === input.templateId,
  );
  if (!template) throw new Error(`Template not found: ${input.templateId}`);

  const existingBinding = state.bindings.find(
    (binding) =>
      binding.templateId === input.templateId &&
      binding.fieldProfileId === input.fieldProfileId,
  );
  // Binding again is idempotent, and must stay a no-op rather than a rewrite
  // of an identical state - see the family's durable-write locks.
  if (existingBinding) return { next: null, result: existingBinding };

  const profiles = prepareBindingProfiles(state, input);

  const timestamp = deps.now();
  const binding: BindingRecord = {
    id: deps.createId(),
    templateId: input.templateId,
    pageProfileId: input.pageProfileId,
    fieldProfileId: input.fieldProfileId,
    createdAt: timestamp,
    usageCount: 0,
    revision: 0,
  };
  const updatedTemplate: TemplateRecord = template.siteAffinities.includes(profiles.siteId)
    ? template
    : {
        ...template,
        siteAffinities: [...template.siteAffinities, profiles.siteId],
        updatedAt: timestamp,
        revision: template.revision + 1,
      };

  return {
    next: {
      ...state,
      sites: addSite(state.sites, profiles.siteId),
      templates: state.templates.map((candidate) =>
        candidate.id === template.id ? updatedTemplate : candidate,
      ),
      pageProfiles: profiles.pageProfiles,
      fieldProfiles: profiles.fieldProfiles,
      bindings: [...state.bindings, binding],
    },
    result: binding,
  };
}

export function unbindTemplateTransition(
  state: FillNestState,
  input: UnbindTemplateInput,
): StateTransition<boolean> {
  const remainingBindings = state.bindings.filter(
    (binding) =>
      !(
        binding.templateId === input.templateId &&
        binding.fieldProfileId === input.fieldProfileId
      ),
  );
  if (remainingBindings.length === state.bindings.length) return { next: null, result: false };

  return {
    next: {
      ...state,
      bindings: remainingBindings,
      logicalPageObservations: retainBoundPageObservations(state, remainingBindings),
    },
    result: true,
  };
}

export function undoBindTransition(
  state: FillNestState,
  input: UndoBindInput,
): StateTransition<void> {
  if (!state.bindings.some((candidate) => candidate.id === input.bindingId)) {
    throw new StaleUndoError("This Bind can no longer be undone.");
  }
  const remaining = state.bindings.filter((candidate) => candidate.id !== input.bindingId);
  return {
    next: {
      ...state,
      bindings: remaining,
      logicalPageObservations: retainBoundPageObservations(state, remaining),
    },
    result: undefined,
  };
}

export function undoUnbindTransition(
  state: FillNestState,
  input: UndoUnbindInput,
): StateTransition<void> {
  const binding = validateBinding(input.binding);
  if (!state.templates.some((candidate) => candidate.id === binding.templateId)) {
    throw new StaleUndoError("The Template no longer exists.");
  }
  if (
    !state.pageProfiles.some((page) => page.id === binding.pageProfileId) ||
    !state.fieldProfiles.some((field) => field.id === binding.fieldProfileId)
  ) {
    throw new StaleUndoError("The Field no longer exists.");
  }
  const conflict = state.bindings.some(
    (candidate) =>
      candidate.templateId === binding.templateId && candidate.fieldProfileId === binding.fieldProfileId,
  );
  if (conflict) {
    throw new StaleUndoError("This field was bound again since; Undo would create a duplicate.");
  }

  return {
    next: { ...state, bindings: [...state.bindings, binding] },
    result: undefined,
  };
}
