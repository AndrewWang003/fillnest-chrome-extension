import type { Messages } from "../../i18n/catalogue";
import { RichText } from "../shared/RichText";
import { useMessages } from "../../i18n/useMessages";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { type RuntimeResponse } from "../../messages/runtime-messages";
import type { SiteIdentity } from "../../domain/site";
import {
  effectiveTemplateListForField,
  type BindingRecord,
  type FieldProfileRecord,
  type FillNestState,
  type PageProfileRecord,
  type PromoteFieldOnlySlotResult,
  type RestoreTemplateInput,
  type SaveTemplateCopyForFieldResult,
  type SaveTemplateCopyForSharedSetResult,
  type SaveTemplateOverrideForFieldResult,
  type SharedTemplateBindingRecord,
  type SharedTemplateFieldStateRecord,
  type TemplateRecord,
} from "../../storage/fillnest-repository";
import {
  buildFieldFirstView,
  filterFieldFirstView,
  type FieldFirstFieldRow,
  type FieldFirstOption,
} from "../../templates/field-first-view";
import {
  buildLocationTree,
  defaultDirectionFor,
  listAllTemplates,
  type LocationTree,
  type LocationTreeFieldNode,
  type LocationTreePageNode,
  type SortDirection,
  type SortKind,
} from "../../templates/library-views";
import { countTemplatesForSite } from "../../templates/site-affinity";
import {
  resolveGlobalTemplateEditScope,
  resolveTemplateEditScope,
  type TemplateEditScope,
} from "../../templates/template-edit-scope";
import {
  isTemplateContentWithinLimit,
  MAX_TEMPLATE_CONTENT_BYTES,
  MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS,
} from "../../templates/template-content";
import { deriveOutcomePreview, derivePreview } from "../../templates/template-preview";
import { DeleteIcon, EditIcon, ShareIcon, UnbindIcon } from "../icons/FillNestIcons";
import { TemplateLengthCounter } from "../shared/TemplateLengthCounter";
import { useTemplateContentInput } from "../shared/useTemplateContentInput";
import { SharedSetsView } from "./SharedSetsView";
import {
  type DeleteFlow,
  DeletionImpactPanel,
  isDeleteTemplatesResultShape,
  isEditContentSavable,
  isRestoreTemplatesResultShape,
  isTemplateRecordShape,
  highlightFieldInCurrentTab,
  ModalDialog,
  preview,
  rememberFocusedElement,
  restoreFocus,
  sendRequest,
  type SidePanelNotification,
  useCurrentTabContext,
} from "./SidePanelShared";
import { PageNote, useFirstUseTips } from "../shared/FirstUseTips";
import type { TipId } from "../../guidance/tips";

export type LibraryView = "tab" | "location" | "all" | "sets";

const VIEW_TIPS: Record<LibraryView, { tip: TipId; text(messages: Messages): string }> = {
  tab: { tip: "this-tab", text: (messages) => messages.noteThisTab() },
  all: { tip: "all-templates", text: (messages) => messages.noteAllTemplates() },
  location: { tip: "by-location", text: (messages) => messages.noteByLocation() },
  sets: { tip: "shared-sets", text: (messages) => messages.noteSharedSets() },
};

export type SidePanelLastAction =
  // `template` is the version that existed BEFORE the save, because Undo has
  // to restore it. Task 023 Addendum B5 (10): the result line must not be
  // built from it - renaming "Hobart" to "Hobart Street" then announced
  // "Saved \"Hobart\" everywhere it is used", naming the text the user had
  // just replaced. `savedContent` is what was actually saved.
  | { type: "save"; template: TemplateRecord; savedContent: string; expectedRevision: number }
  | { type: "unbind"; template: TemplateRecord; binding: BindingRecord; remainingBindingCount: number }
  | {
      type: "delete";
      template: TemplateRecord;
      bindings: BindingRecord[];
      sharedBindings: SharedTemplateBindingRecord[];
      fieldStates: SharedTemplateFieldStateRecord[];
      affectedFieldCount: number;
    }
  | { type: "batch-delete"; templates: RestoreTemplateInput[]; affectedFieldCount: number }
  | {
      type: "save-copy";
      copyTemplate: TemplateRecord;
      copyTemplateId: string;
      originalBinding: BindingRecord;
    }
  | {
      type: "save-copy-shared";
      copyTemplate: TemplateRecord;
      copyTemplateId: string;
      originalSharedBinding: SharedTemplateBindingRecord;
    }
  | {
      type: "save-override-for-field";
      copyTemplateId: string;
      previousState: SharedTemplateFieldStateRecord | null;
    }
  | {
      type: "exclude-shared-for-field";
      setId: string;
      slotId: string;
      fieldProfileId: string;
      template: TemplateRecord;
      previousState: SharedTemplateFieldStateRecord | null;
    }
  | {
      type: "share-this-version";
      setId: string;
      slotId: string;
      template: TemplateRecord;
      previousOwnerFieldProfileId: string;
      consumedSlot?: SharedTemplateBindingRecord;
      previousOrdinarySlot?: SharedTemplateBindingRecord;
      removedFieldStates?: SharedTemplateFieldStateRecord[];
    };

export function sidePanelUndoLabel(action: SidePanelLastAction, t: Messages): string {
  switch (action.type) {
    case "batch-delete": {
      const count = action.templates.length;
      const fields = action.affectedFieldCount;
      return t.deletedCountFromLibraryAndFields(count, fields);
    }
    case "save":
      return t.savedEverywhereShort(deriveOutcomePreview(action.savedContent));
    case "unbind": {
      const name = deriveOutcomePreview(action.template.content);
      return action.remainingBindingCount > 0
        ? t.removedFromFieldRemainsElsewhere(name, action.remainingBindingCount)
        : t.removedFromFieldNowGlobal(name);
    }
    case "delete":
      return t.deletedFromLibraryAndFields(deriveOutcomePreview(action.template.content), action.affectedFieldCount);
    case "save-copy":
      return t.savedCopyForThisFieldShort(deriveOutcomePreview(action.copyTemplate.content));
    case "save-copy-shared":
      return t.savedCopyForSharedShort(deriveOutcomePreview(action.copyTemplate.content));
    case "save-override-for-field":
      return t.savedForThisFieldOnlyShort();
    case "exclude-shared-for-field":
      return t.removedFromThisFieldShort(deriveOutcomePreview(action.template.content));
    case "share-this-version":
      return t.sharedWithWholeSetShort(deriveOutcomePreview(action.template.content));
    default:
      return assertNeverSidePanelAction(action);
  }
}

// Executes the Undo operation for a SidePanelLastAction.
// Returns the outcome string to display in the global result region, or null if
// the operation failed (in which case it has called onError already).
// Extracted to SidePanel can call it directly after lifting Undo state (Task 011).
export async function performUndo(
  action: SidePanelLastAction,
  onRefresh: () => Promise<void>,
  onError: (message: string) => void,
  t: Messages,
): Promise<string | null> {
  let response: RuntimeResponse;
  switch (action.type) {
    case "save":
      response = await sendRequest({
        type: "UNDO_SAVE",
        template: action.template,
        expectedRevision: action.expectedRevision,
      });
      break;
    case "unbind":
      response = await sendRequest({ type: "UNDO_UNBIND", binding: action.binding });
      break;
    case "batch-delete":
      response = await sendRequest({ type: "RESTORE_TEMPLATES", templates: action.templates });
      break;
    case "save-copy":
      response = await sendRequest({
        type: "UNDO_SAVE_COPY_FOR_FIELD",
        copyTemplateId: action.copyTemplateId,
        originalBinding: action.originalBinding,
      });
      break;
    case "save-copy-shared":
      response = await sendRequest({
        type: "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
        copyTemplateId: action.copyTemplateId,
        originalSharedBinding: action.originalSharedBinding,
      });
      break;
    case "save-override-for-field":
      response = await sendRequest({
        type: "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
        copyTemplateId: action.copyTemplateId,
        previousState: action.previousState,
      });
      break;
    case "exclude-shared-for-field":
      response = await sendRequest({
        type: "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
        setId: action.setId,
        slotId: action.slotId,
        fieldProfileId: action.fieldProfileId,
        previousState: action.previousState,
      });
      break;
    case "delete":
      response = await sendRequest({
        type: "RESTORE_TEMPLATE",
        template: action.template,
        bindings: action.bindings,
        sharedBindings: action.sharedBindings,
        fieldStates: action.fieldStates,
      });
      break;
    case "share-this-version":
      response = await sendRequest({
        type: "UNDO_PROMOTE_FIELD_ONLY_SLOT",
        setId: action.setId,
        slotId: action.slotId,
        ownerFieldProfileId: action.previousOwnerFieldProfileId,
        consumedSlot: action.consumedSlot,
        previousOrdinarySlot: action.previousOrdinarySlot,
        removedFieldStates: action.removedFieldStates,
      });
      break;
    default:
      return assertNeverSidePanelAction(action);
  }
  if (!response.ok) {
    onError(response.error);
    return null;
  }
  await onRefresh();
  if (action.type === "batch-delete" && isRestoreTemplatesResultShape(response.value) && response.value.failed.length > 0) {
    const result = response.value;
    onError(
      t.templatesCouldNotBeRestored(
        result.failed.length,
        action.templates.length,
        result.failed.map((failure: { reason: string }) => failure.reason).join("; "),
      ),
    );
    return null;
  }
  return sidePanelUndoOutcome(action, t);
}

function sidePanelUndoOutcome(action: SidePanelLastAction, t: Messages): string {
  switch (action.type) {
    case "batch-delete":
      return t.restoredTemplates(action.templates.length);
    case "save":
      return t.restoredPreviousVersion(deriveOutcomePreview(action.template.content));
    case "unbind":
      return t.restoredToThisField(deriveOutcomePreview(action.template.content));
    case "delete":
      return t.restoredToLibrary(deriveOutcomePreview(action.template.content));
    case "save-copy":
      return t.removedCopyForThisField(deriveOutcomePreview(action.copyTemplate.content));
    case "save-copy-shared":
      return t.removedCopyForShared(deriveOutcomePreview(action.copyTemplate.content));
    case "save-override-for-field":
      return t.removedOverrideForThisField();
    case "exclude-shared-for-field":
      return t.restoredToThisField(deriveOutcomePreview(action.template.content));
    case "share-this-version":
      return t.madeOwnVersionAgain(deriveOutcomePreview(action.template.content));
    default:
      return assertNeverSidePanelAction(action);
  }
}

function assertNeverSidePanelAction(_value: never): never {
  throw new Error("Unhandled SidePanelLastAction");
}

function isSaveTemplateCopyForFieldResultShape(value: unknown): value is SaveTemplateCopyForFieldResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecordShape((value).template) &&
    "binding" in value
  );
}

function isSaveTemplateCopyForSharedSetResultShape(value: unknown): value is SaveTemplateCopyForSharedSetResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecordShape((value).template) &&
    "sharedBinding" in value
  );
}

function isSaveTemplateOverrideResultShape(value: unknown): value is SaveTemplateOverrideForFieldResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecordShape((value).template)
  );
}

function isPromoteFieldOnlySlotResultShape(value: unknown): value is PromoteFieldOnlySlotResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "sharedBinding" in value &&
    "previousOwnerFieldProfileId" in value &&
    typeof (value as { previousOwnerFieldProfileId: unknown }).previousOwnerFieldProfileId === "string"
  );
}

function countAffectedTemplateFields(
  state: FillNestState,
  templates: RestoreTemplateInput[],
): number {
  const fieldIds = new Set<string>();
  for (const entry of templates) {
    for (const binding of entry.bindings) fieldIds.add(binding.fieldProfileId);
    for (const sharedBinding of entry.sharedBindings ?? []) {
      const set = state.sharedTemplateSets.find((candidate) => candidate.id === sharedBinding.setId);
      for (const fieldProfileId of set?.memberFieldProfileIds ?? []) fieldIds.add(fieldProfileId);
    }
  }
  return fieldIds.size;
}

/**
 * Escape inside an inline editor cancels the edit and stops there.
 *
 * Task 025 Addendum A. The modal dialogs already do this. The inline editors
 * did not, so Escape reached Chrome, which closes the side panel - the user
 * pressed it to abandon an edit and lost the whole panel, with focus landing
 * back in the page. Escape elsewhere in the panel is still Chrome's to handle;
 * this only consumes it when there is genuinely something to cancel.
 */
function handleEditorEscape(event: KeyboardEvent, cancel: () => void): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  cancel();
}

export function TemplatesPage({
  business,
  onRefresh,
  onError,
  onLastAction,
  onNotify,
  pendingSiteFilter,
  onPendingSiteFilterApplied,
}: {
  business: FillNestState;
  onRefresh(): Promise<void>;
  onError(message: string): void;
  onLastAction?(action: SidePanelLastAction | null): void;
  onNotify(message: string, detail?: string, action?: SidePanelNotification["action"]): void;
  pendingSiteFilter?: SiteIdentity | null;
  onPendingSiteFilterApplied?(): void;
}) {
  const t = useMessages();
  const [view, setView] = useState<LibraryView>("tab");
  const tips = useFirstUseTips();
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null);
  // The Field an edit was started from, when started from a concrete Field
  // context (a "This tab" Field-card row) - `null` for a context-free edit
  // (All templates / By location), which offers only "Save everywhere" (Task
  // 026 Confirmed Contract, acceptance 5).
  const [editingFieldContext, setEditingFieldContext] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [deleteFlow, setDeleteFlow] = useState<DeleteFlow | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [impactExpanded, setImpactExpanded] = useState(false);
  const deletionTriggerRef = useRef<HTMLElement | null>(null);
  // Task 027 Explicit Scope UI: "Scope-changing actions state the affected
  // Field or Set and member count before mutation." `Share this version`
  // broadens an audience, so it states its scope and waits.
  const shareTriggerRef = useRef<HTMLElement | null>(null);
  const [pendingShare, setPendingShare] = useState<{
    option: FieldFirstOption;
    fieldProfileId: string;
    setId: string;
    setName: string;
    memberCount: number;
    slotId: string;
    // Whether the promotion will run as Addendum A.3 mode 2, merging this
    // Field's separate private version into the Set's existing shared entry.
    willMerge: boolean;
  } | null>(null);

  const [fieldSearch, setFieldSearch] = useState("");
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [notOfferedExpanded, setNotOfferedExpanded] = useState(false);
  const highlightedFieldIdentityKey = useRef<string | null>(null);

  const [locationSearch, setLocationSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const expansionInitialized = useRef(false);

  const [allSearch, setAllSearch] = useState("");
  const [allSiteFilters, setAllSiteFilters] = useState<Set<SiteIdentity>>(new Set());
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [allGlobalOnly, setAllGlobalOnly] = useState(false);
  const [allBoundFilter, setAllBoundFilter] = useState<"" | "bound" | "unbound">("");
  const [allSort, setAllSort] = useState<SortKind>("default");
  const [allDirection, setAllDirection] = useState<SortDirection | undefined>(undefined);
  const allSearchRef = useRef<HTMLInputElement | null>(null);
  const siteMenuRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    if (!siteMenuOpen) return;
    function handlePointerDown(event: PointerEvent): void {
      if (siteMenuRef.current?.contains(event.target as Node)) return;
      setSiteMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [siteMenuOpen]);

  // Arriving from the Sites page's remove-access sheet: land on the full
  // library already filtered to that Site, so the user sees the actual
  // Templates rather than a count. A null Site means "just open Templates".
  // Arriving from the Sites page's remove-access sheet: land on the full
  // library already filtered to that Site, so the user sees the actual
  // Templates rather than a count. Only a real Site id acts - a null/absent
  // value means "just open Templates", which the destination switch already
  // did, and must not clobber whatever filter the user has set here.
  // Applies once per pending value, so the callback must not be a dependency -
  // re-running on a new callback identity would re-apply the filter and clobber
  // whatever the user has since set. The ref keeps it current without that.
  const latestPendingSiteFilterApplied = useRef(onPendingSiteFilterApplied);
  latestPendingSiteFilterApplied.current = onPendingSiteFilterApplied;
  useEffect(() => {
    if (!pendingSiteFilter) return;
    setView("all");
    setAllSiteFilters(new Set([pendingSiteFilter]));
    latestPendingSiteFilterApplied.current?.();
  }, [pendingSiteFilter]);

  function toggleSiteFilter(siteId: SiteIdentity): void {
    setAllSiteFilters((current) => {
      const next = new Set(current);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  const currentTabContext = useCurrentTabContext();

  function setPageFieldHighlight(fieldIdentityKey: string | null): void {
    if (highlightedFieldIdentityKey.current === fieldIdentityKey) return;
    highlightedFieldIdentityKey.current = fieldIdentityKey;
    void highlightFieldInCurrentTab(fieldIdentityKey);
  }

  useEffect(() => () => setPageFieldHighlight(null), []);

  const pageProfilesById = useMemo(
    () => new Map(business.pageProfiles.map((profile) => [profile.id, profile] as const)),
    [business.pageProfiles],
  );
  const fieldProfilesById = useMemo(
    () => new Map(business.fieldProfiles.map((profile) => [profile.id, profile] as const)),
    [business.fieldProfiles],
  );

  const currentTabPageProfileId = useMemo(
    () =>
      currentTabContext
        ? business.pageProfiles.find(
            (page) =>
              page.siteId === currentTabContext.siteId && page.identityKey === currentTabContext.pageIdentityKey,
          )?.id ?? null
        : null,
    [currentTabContext, business.pageProfiles],
  );

  const fieldFirstView = useMemo(
    () => filterFieldFirstView(buildFieldFirstView(business, currentTabPageProfileId, t), fieldSearch),
    [business, currentTabPageProfileId, fieldSearch, t],
  );

  const tree = useMemo(() => buildLocationTree(business, t), [business, t]);
  const filteredTree = useMemo(() => filterLocationTree(tree, locationSearch), [tree, locationSearch]);

  useEffect(() => {
    if (expansionInitialized.current) return;
    if (tree.sites.length === 0) return;
    if (currentTabContext === undefined) return; // still resolving which tab is active
    expansionInitialized.current = true;
    const currentPage = currentTabContext
      ? { siteId: currentTabContext.siteId, pageProfileId: currentTabPageProfileId }
      : null;
    setExpandedNodes(defaultExpandedNodesForCurrentSite(tree, currentPage));
  }, [tree, currentTabContext, currentTabPageProfileId]);

  function toggleNode(key: string): void {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    setSelectedForDeletion(new Set());
    setDeleteFlow(null);
    setTypedConfirmation("");
  }, [view]);

  const allTemplates = useMemo(
    () =>
      listAllTemplates(
        business,
        {
          search: allSearch,
          siteIds: allSiteFilters,
          globalOnly: allGlobalOnly,
          boundOnly: allBoundFilter === "" ? null : allBoundFilter === "bound",
        },
        allSort,
        allDirection,
      ),
    [business, allSearch, allSiteFilters, allGlobalOnly, allBoundFilter, allSort, allDirection],
  );

  function toggleFieldExpanded(fieldProfileId: string): void {
    setExpandedFields((current) => {
      const next = new Set(current);
      if (next.has(fieldProfileId)) next.delete(fieldProfileId);
      else next.add(fieldProfileId);
      return next;
    });
  }

  // Context-free edit (All templates / By location): no Field to narrow the
  // save to, so the only choice is the global "Save"/"Save everywhere".
  function startEdit(template: TemplateRecord): void {
    setEditingAliasId(null);
    setEditingTemplate(template);
    setEditDraft(template.content);
    setEditingFieldContext(null);
  }

  // A "This tab" Field-card edit has a concrete Field context and offers the
  // same valid Save-scope choices as that Field's Picker (Task 026
  // Confirmed Contract, acceptance 5).
  function startEditForField(template: TemplateRecord, fieldProfileId: string): void {
    setEditingAliasId(null);
    setEditingTemplate(template);
    setEditDraft(template.content);
    setEditingFieldContext(fieldProfileId);
  }

  function cancelEdit(): void {
    setEditingTemplate(null);
    setEditDraft("");
    setEditingFieldContext(null);
  }

  function setActiveAliasEditor(aliasId: string | null): void {
    if (aliasId) {
      setEditingTemplate(null);
      setEditDraft("");
      setEditingFieldContext(null);
    }
    setEditingAliasId(aliasId);
  }

  const editScope: TemplateEditScope = editingTemplate
    ? editingFieldContext
      ? resolveTemplateEditScope(business, editingTemplate, editingFieldContext)
      : resolveGlobalTemplateEditScope(business, editingTemplate)
    : "single";

  async function saveEdit(): Promise<void> {
    if (!editingTemplate || !isEditContentSavable(editingTemplate, editDraft)) return;
    const previousTemplate = editingTemplate;
    const response = await sendRequest({
      type: "UPDATE_TEMPLATE",
      templateId: editingTemplate.id,
      content: editDraft,
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    cancelEdit();
    if (isTemplateRecordShape(response.value)) {
      onLastAction?.({
        type: "save",
        template: previousTemplate,
        savedContent: response.value.content,
        expectedRevision: response.value.revision,
      });
    }
  }

  /**
   * "Save a copy here" (direct Field) or "Save for shared fields" (a Shared
   * Template Set slot) - creates a replacement Template scoped to the
   * editing Field's own relationship, leaving every other consumer of the
   * original Template untouched (Task 003 / Task 026).
   */
  async function saveCopyForField(): Promise<void> {
    if (!editingTemplate || !editingFieldContext || !isEditContentSavable(editingTemplate, editDraft)) return;
    const fieldProfileId = editingFieldContext;
    const set = business.sharedTemplateSets.find((candidate) =>
      candidate.memberFieldProfileIds.includes(fieldProfileId),
    );
    if (set) {
      // Task 027 Addendum A (defect F): target the exact slot this Field's
      // collapsed effective entry resolves to - never a `templateId`-keyed
      // lookup, which cannot tell an ordinary slot apart from a coexisting
      // owner-only slot for the same Template (A.1).
      const entry = effectiveTemplateListForField(business, fieldProfileId).entries.find(
        (candidate) => candidate.templateId === editingTemplate.id,
      );
      const originalSharedBinding = entry?.slotId
        ? business.sharedTemplateBindings.find(
            (candidate) => candidate.id === entry.slotId && candidate.setId === set.id,
          )
        : undefined;
      if (!originalSharedBinding) {
        onError(t.templateNoLongerSharedWithThisField());
        return;
      }
      const response = await sendRequest({
        type: "SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
        setId: set.id,
        slotId: originalSharedBinding.id,
        content: editDraft,
      });
      if (!response.ok) {
        onError(response.error);
        return;
      }
      await onRefresh();
      cancelEdit();
      if (isSaveTemplateCopyForSharedSetResultShape(response.value)) {
        onLastAction?.({
          type: "save-copy-shared",
          copyTemplate: response.value.template,
          copyTemplateId: response.value.template.id,
          originalSharedBinding,
        });
      }
      return;
    }
    const originalBinding = business.bindings.find(
      (candidate) => candidate.templateId === editingTemplate.id && candidate.fieldProfileId === fieldProfileId,
    );
    if (!originalBinding) return;
    const response = await sendRequest({
      type: "SAVE_TEMPLATE_COPY_FOR_FIELD",
      templateId: editingTemplate.id,
      fieldProfileId,
      content: editDraft,
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    cancelEdit();
    if (isSaveTemplateCopyForFieldResultShape(response.value)) {
      onLastAction?.({
        type: "save-copy",
        copyTemplate: response.value.template,
        copyTemplateId: response.value.template.id,
        originalBinding,
      });
    }
  }

  /** "Save for this field" (Task 026 Confirmed Contract): creates an Override for the Current Field only. */
  async function saveOverrideForField(): Promise<void> {
    if (!editingTemplate || !editingFieldContext || !isEditContentSavable(editingTemplate, editDraft)) return;
    const fieldProfileId = editingFieldContext;
    const set = business.sharedTemplateSets.find((candidate) =>
      candidate.memberFieldProfileIds.includes(fieldProfileId),
    );
    if (!set) return;
    const resolvedEntry = effectiveTemplateListForField(business, fieldProfileId).entries.find(
      (entry) => entry.templateId === editingTemplate.id,
    );
    const slot = resolvedEntry?.slotId
      ? business.sharedTemplateBindings.find(
          (candidate) => candidate.id === resolvedEntry.slotId && candidate.setId === set.id,
        )
      : undefined;
    if (!slot) {
      onError(t.templateNoLongerSharedWithThisField());
      return;
    }
    const previousState =
      business.sharedTemplateFieldStates.find(
        (candidate) =>
          candidate.setId === set.id && candidate.slotId === slot.id && candidate.fieldProfileId === fieldProfileId,
      ) ?? null;
    const response = await sendRequest({
      type: "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
      setId: set.id,
      slotId: slot.id,
      fieldProfileId,
      content: editDraft,
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    cancelEdit();
    if (isSaveTemplateOverrideResultShape(response.value)) {
      onLastAction?.({
        type: "save-override-for-field",
        copyTemplateId: response.value.template.id,
        previousState,
      });
    }
  }

  /**
   * "Remove from this field" for a Shared Template Set slot: records an
   * Exclusion for the Current Field only, leaving every other member's list
   * unaffected and the Set itself intact (Task 026 acceptance 3). Undoable.
   */
  async function excludeSharedForField(template: TemplateRecord, slotId: string, fieldProfileId: string): Promise<void> {
    const set = business.sharedTemplateSets.find((candidate) => candidate.memberFieldProfileIds.includes(fieldProfileId));
    if (!set) return;
    const previousState =
      business.sharedTemplateFieldStates.find(
        (candidate) => candidate.setId === set.id && candidate.slotId === slotId && candidate.fieldProfileId === fieldProfileId,
      ) ?? null;
    const response = await sendRequest({
      type: "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
      setId: set.id,
      slotId,
      fieldProfileId,
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onLastAction?.({
      type: "exclude-shared-for-field",
      setId: set.id,
      slotId,
      fieldProfileId,
      template,
      previousState,
    });
  }

  /**
   * "Share this version" (Task 027 Confirmed Contract): promotes a
   * Field-only relationship to a normal Shared Template Slot within the
   * owner's own current Set - every current member then resolves it
   * normally. It never affects an unrelated Set.
   */
  function requestShareThisVersionForField(option: FieldFirstOption, fieldProfileId: string): void {
    const set = business.sharedTemplateSets.find((candidate) => candidate.memberFieldProfileIds.includes(fieldProfileId));
    // Always the owner-only relation's own slot, never the collapsed
    // entry's primary relation - in the mixed case the primary is the
    // ordinary slot, and promoting that is both meaningless and wrong.
    if (!set || !option.fieldOnlySlotId) return;
    shareTriggerRef.current = rememberFocusedElement();
    // Mode 2 (Addendum A.3) when the Set already shares this exact Template
    // through an ordinary slot - the same condition the repository itself
    // uses to decide, so the disclosure matches what will happen.
    const willMerge = business.sharedTemplateBindings.some(
      (candidate) =>
        candidate.setId === set.id &&
        candidate.templateId === option.template.id &&
        candidate.ownerFieldProfileId === undefined,
    );
    setPendingShare({
      option,
      fieldProfileId,
      setId: set.id,
      setName: set.name,
      memberCount: set.memberFieldProfileIds.length,
      slotId: option.fieldOnlySlotId,
      willMerge,
    });
  }

  function cancelShareThisVersion(): void {
    setPendingShare(null);
    restoreFocus(shareTriggerRef.current);
    shareTriggerRef.current = null;
  }

  async function shareThisVersionForField(pending: NonNullable<typeof pendingShare>): Promise<void> {
    const { option, fieldProfileId, setId: setIdentifier, slotId } = pending;
    const set = business.sharedTemplateSets.find((candidate) => candidate.id === setIdentifier);
    if (!set) return;
    setPendingShare(null);
    restoreFocus(shareTriggerRef.current);
    shareTriggerRef.current = null;
    const response = await sendRequest({
      type: "PROMOTE_FIELD_ONLY_SLOT",
      setId: set.id,
      slotId,
      fieldProfileId,
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    if (isPromoteFieldOnlySlotResultShape(response.value)) {
      onLastAction?.({
        type: "share-this-version",
        setId: set.id,
        // Task 027 Addendum A.3: the slot the promotion actually left
        // behind - the surviving ordinary slot's id in mode 2, the same
        // slot otherwise - so Undo targets the right record.
        slotId: response.value.sharedBinding.id,
        template: option.template,
        previousOwnerFieldProfileId: response.value.previousOwnerFieldProfileId,
        consumedSlot: response.value.consumedSlot,
        previousOrdinarySlot: response.value.previousOrdinarySlot,
        removedFieldStates: response.value.removedFieldStates,
      });
    }
  }

  async function deleteSingle(template: TemplateRecord): Promise<void> {
    const bindings = business.bindings.filter((binding) => binding.templateId === template.id);
    const sharedBindings = business.sharedTemplateBindings.filter(
      (binding) => binding.templateId === template.id,
    );
    const removedSlotIds = new Set(sharedBindings.map((binding) => binding.id));
    const fieldStates = business.sharedTemplateFieldStates.filter(
      (entry) => removedSlotIds.has(entry.slotId) || (entry.mode === "override" && entry.templateId === template.id),
    );
    const response = await sendRequest({ type: "DELETE_TEMPLATE", templateId: template.id });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onLastAction?.({
      type: "delete",
      template,
      bindings,
      sharedBindings,
      fieldStates,
      affectedFieldCount: countAffectedTemplateFields(business, [{ template, bindings, sharedBindings }]),
    });
  }

  function toggleSelectForDeletion(templateId: string): void {
    setSelectedForDeletion((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  function toggleSelectAllVisible(templates: TemplateRecord[]): void {
    setSelectedForDeletion((current) => {
      const allSelected = templates.length > 0 && templates.every((template) => current.has(template.id));
      if (allSelected) {
        const next = new Set(current);
        for (const template of templates) next.delete(template.id);
        return next;
      }
      return new Set([...current, ...templates.map((template) => template.id)]);
    });
  }

  function startBatchDelete(templateIds: string[], source: DeleteFlow["source"]): void {
    if (templateIds.length === 0) return;
    deletionTriggerRef.current = rememberFocusedElement();
    // Task 028 Addendum B: typed `delete` guards a BULK operation that empties
    // the Library. Selecting a single Template is a targeted deletion and never
    // asks for a typed word, matching the row-level and Inline Picker Delete
    // actions - which never did.
    const wholeLibrary = templateIds.length > 1 && templateIds.length === business.templates.length;
    setDeleteFlow({ templateIds, wholeLibrary, source });
    setTypedConfirmation("");
    setImpactExpanded(false);
  }

  function cancelBatchDelete(): void {
    setDeleteFlow(null);
    setTypedConfirmation("");
  }

  async function confirmBatchDelete(): Promise<void> {
    if (!deleteFlow) return;
    if (deleteFlow.wholeLibrary && typedConfirmation !== "delete") return;

    const snapshot: RestoreTemplateInput[] = deleteFlow.templateIds.flatMap((id) => {
      const template = business.templates.find((candidate) => candidate.id === id);
      if (!template) return [];
      const sharedBindings = business.sharedTemplateBindings.filter((binding) => binding.templateId === id);
      const removedSlotIds = new Set(sharedBindings.map((binding) => binding.id));
      return [{
        template,
        bindings: business.bindings.filter((binding) => binding.templateId === id),
        sharedBindings,
        fieldStates: business.sharedTemplateFieldStates.filter(
          (entry) => removedSlotIds.has(entry.slotId) || (entry.mode === "override" && entry.templateId === id),
        ),
      }];
    });

    setDeleting(true);
    try {
      const response = await sendRequest({
        type: "DELETE_TEMPLATES",
        templateIds: deleteFlow.templateIds,
        // Task 028 (audit finding C2): the service worker re-derives whether
        // this empties the Library from its own state and enforces the typed
        // gate there, so this is a declaration of what the user typed, not the
        // gate itself.
        ...(deleteFlow.wholeLibrary ? { typedConfirmation: "delete" as const } : {}),
      });
      if (!response.ok) {
        onError(response.error);
        return;
      }
      await onRefresh();
      setSelectedForDeletion(new Set());
      setDeleteFlow(null);
      setTypedConfirmation("");
      restoreFocus(deletionTriggerRef.current);
      deletionTriggerRef.current = null;
      if (isDeleteTemplatesResultShape(response.value)) {
        const deletedIds = new Set(response.value.deletedTemplateIds);
        const deletedSnapshot = snapshot.filter((entry) => deletedIds.has(entry.template.id));
        if (deletedSnapshot.length > 0) {
          onLastAction?.({
            type: "batch-delete",
            templates: deletedSnapshot,
            affectedFieldCount: countAffectedTemplateFields(business, deletedSnapshot),
          });
        }
      }
    } finally {
      setDeleting(false);
    }
  }

  async function unbind(templateId: string, fieldProfileId: string): Promise<void> {
    const template = business.templates.find((candidate) => candidate.id === templateId);
    const binding = business.bindings.find(
      (candidate) => candidate.templateId === templateId && candidate.fieldProfileId === fieldProfileId,
    );
    if (!template || !binding) return;
    const remainingBindingCount = business.bindings.filter((candidate) => candidate.templateId === templateId).length - 1;
    const response = await sendRequest({ type: "UNBIND_TEMPLATE", templateId, fieldProfileId });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onLastAction?.({ type: "unbind", template, binding, remainingBindingCount });
  }


  async function renamePage(pageProfileId: string, alias: string): Promise<void> {
    const response = await sendRequest({ type: "SET_PAGE_ALIAS", pageProfileId, alias });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
  }

  async function renameField(fieldProfileId: string, alias: string): Promise<void> {
    const response = await sendRequest({ type: "SET_FIELD_ALIAS", fieldProfileId, alias });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
  }

  const rowActions: TemplateRowActions = {
    editingTemplate,
    editDraft,
    setEditDraft,
    editScope,
    onStartEdit: startEdit,
    onSaveEdit: () => void saveEdit(),
    onCancelEdit: cancelEdit,
    onDelete: (template) => void deleteSingle(template),
    selectedForDeletion,
    onToggleSelect: toggleSelectForDeletion,
  };

  const availableSites = useMemo(() => business.sites.map((site) => site.id).sort(), [business.sites]);
  const siteFilterCounts = useMemo(
    () =>
      new Map(
        availableSites.map(
          (site) => [site, countTemplatesForSite(business.templates, site)] as const,
        ),
      ),
    [availableSites, business.templates],
  );
  const visibleTemplates = allTemplates;
  const siteFilterButtonLabel =
    allSiteFilters.size === 0
      ? t.anySite()
      : allSiteFilters.size === 1
        ? [...allSiteFilters][0]!
        : t.siteFilterCount(allSiteFilters.size);

  return (
    <>
      <div class="field-first-header">
        <h1>{t.templatesLabel()}</h1>
        <span class="field-first-count">{business.templates.length}</span>
      </div>
      <div class="library-tabs" aria-label={t.templateLibraryViews()}>
        {(
          [
            ["tab", t.viewThisTab()],
            ["all", t.viewAllTemplates()],
            ["location", t.viewByLocation()],
            ["sets", t.viewSharedSets()],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            aria-current={view === key ? "true" : undefined}
            class={view === key ? "selected" : ""}
            onClick={() => {
              setPageFieldHighlight(null);
              setView(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task 042: one line on each view's first visit. */}
      {tips.shows(VIEW_TIPS[view].tip) && (
        <PageNote text={VIEW_TIPS[view].text(t)} onDismiss={() => tips.dismiss(VIEW_TIPS[view].tip)} />
      )}

      {view === "tab" && (
        <>
          <label class="search">
            <span>{t.search()}</span>
            <input
              aria-label={t.searchFieldsAndTemplates()}
              type="search"
              placeholder={t.searchFieldsAndTemplates()}
              value={fieldSearch}
              onInput={(event) => setFieldSearch(event.currentTarget.value)}
            />
          </label>

          {fieldFirstView.fields.map((field) => (
            <FieldCard
              key={field.fieldProfileId}
              field={field}
              expanded={expandedFields.has(field.fieldProfileId)}
              onToggleExpanded={() => toggleFieldExpanded(field.fieldProfileId)}
              onHighlight={(active) => setPageFieldHighlight(active ? field.fieldIdentityKey : null)}
              onRenameField={(alias) => void renameField(field.fieldProfileId, alias)}
              aliasEditorId={`field:${field.fieldProfileId}`}
              activeAliasEditorId={editingAliasId}
              onActiveAliasEditorChange={setActiveAliasEditor}
              editingTemplate={editingTemplate}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              editScope={editScope}
              onStartEdit={(template) => startEditForField(template, field.fieldProfileId)}
              onSaveEdit={() => void saveEdit()}
              onSaveCopyForField={() => void saveCopyForField()}
              onSaveForThisField={() => void saveOverrideForField()}
              onCancelEdit={cancelEdit}
              onRemove={(option) =>
                option.slotId
                  ? void excludeSharedForField(option.template, option.slotId, field.fieldProfileId)
                  : void unbind(option.template.id, field.fieldProfileId)
              }
              onShareThisVersion={(option) => requestShareThisVersionForField(option, field.fieldProfileId)}
            />
          ))}
          {fieldFirstView.fields.length === 0 && <p>{t.noFieldsWithTemplatesHere()}</p>}

          {pendingShare && (
            <ModalDialog
              label={t.shareThisVersion()}
              busy={false}
              onCancel={cancelShareThisVersion}
              restoreFocusTo={shareTriggerRef.current}
            >
              <p>
                <RichText
                  parts={t.shareVersionWithSetQuestion(
                    preview(pendingShare.option.template.content, t),
                    pendingShare.memberCount,
                    pendingShare.setName,
                  )}
                />
                {pendingShare.willMerge ? ` ${t.privateVersionMergesIntoShared()}` : ""}
              </p>
              <div class="confirm-actions">
                <button type="button" class="primary" onClick={() => void shareThisVersionForField(pendingShare)}>{t.shareWithTheSet()}</button>
                <button type="button" class="secondary" data-dialog-cancel onClick={cancelShareThisVersion}>{t.cancel()}</button>
              </div>
            </ModalDialog>
          )}

          <NotOfferedAnywhereBucket
            templates={fieldFirstView.notOfferedAnywhere}
            expanded={notOfferedExpanded}
            onToggleExpanded={() => setNotOfferedExpanded((current) => !current)}
            rowActions={rowActions}
          />

          <p class="field-first-footnote">
            {t.templatesPageHint()}
          </p>
        </>
      )}

      {view === "location" && (
        <>
          <label class="search">
            <span>{t.search()}</span>
            <input
              aria-label={t.searchLocationTree()}
              type="search"
              value={locationSearch}
              onInput={(event) => setLocationSearch(event.currentTarget.value)}
            />
          </label>
          <LocationTreeView
            tree={filteredTree}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            pageProfilesById={pageProfilesById}
            fieldProfilesById={fieldProfilesById}
            onRenamePage={(pageProfileId, alias) => void renamePage(pageProfileId, alias)}
            onRenameField={(fieldProfileId, alias) => void renameField(fieldProfileId, alias)}
            onUnbind={(templateId, fieldProfileId) => void unbind(templateId, fieldProfileId)}
            rowActions={rowActions}
            activeAliasEditorId={editingAliasId}
            onActiveAliasEditorChange={setActiveAliasEditor}
          />
        </>
      )}

      {view === "sets" && (
        <SharedSetsView business={business} onRefresh={onRefresh} onError={onError} onNotify={onNotify} />
      )}

      {view === "all" && (
        <>
          <label class="search">
            <span>{t.search()}</span>
            <div class="search-input-wrapper">
              {[...allSiteFilters].map((siteId) => (
                <span class="search-chip" key={siteId}>
                  <span class="search-chip-label">{siteId}</span>
                  <button
                    type="button"
                    aria-label={t.removeSiteFilter(siteId)}
                    title={t.removeSiteFilter(siteId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSiteFilter(siteId);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                ref={allSearchRef}
                aria-label={t.searchTemplateBodies()}
                type="search"
                placeholder={allSiteFilters.size > 0 ? t.searchTemplateBodies() : t.searchTemplateBodiesEllipsis()}
                value={allSearch}
                onInput={(event) => setAllSearch(event.currentTarget.value)}
                onKeyDown={(event) => {
                  const keyboardEvent = event as unknown as KeyboardEvent;
                  if (keyboardEvent.key === "Backspace" && allSearch === "" && allSiteFilters.size > 0) {
                    event.preventDefault();
                    setAllSiteFilters((current) => {
                      const next = new Set(current);
                      const last = [...next].pop();
                      if (last !== undefined) next.delete(last);
                      return next;
                    });
                  }
                }}
              />
            </div>
            {allSiteFilters.size > 1 && (
              <span class="search-union-hint">
                {t.siteUnionHint(allSiteFilters.size, allTemplates.length)}
              </span>
            )}
          </label>
          <div class="library-filters">
            <label class="site-filter" ref={siteMenuRef}>
              <span>{t.siteLabel()}</span>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={siteMenuOpen && !allGlobalOnly}
                aria-label={t.filterBySiteCurrent(siteFilterButtonLabel)}
                disabled={allGlobalOnly}
                onClick={() => setSiteMenuOpen((current) => !current)}
              >
                <span class="site-filter-label">{siteFilterButtonLabel}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {siteMenuOpen && !allGlobalOnly && (
                // Task 023 Addendum B5 (5): this was role="listbox", but its
                // children are checkboxes inside labels, not role="option".
                // A listbox prunes non-option children from the accessibility
                // tree, so VoiceOver could not reach a single Site with
                // Ctrl+Alt+Arrow even though Tab still moved DOM focus there.
                // It is a disclosure holding a group of checkboxes, so it says
                // that instead.
                <div class="site-filter-menu" role="group" aria-label={t.filterBySite()}>
                  <div class="site-filter-menu-header">
                    <span>{t.filterSite()}</span>
                    <button type="button" onClick={() => setAllSiteFilters(new Set())}>{t.anySite()}</button>
                  </div>
                  {availableSites.map((site) => (
                    <label class="site-filter-option" key={site}>
                      <input
                        type="checkbox"
                        checked={allSiteFilters.has(site)}
                        onChange={() => toggleSiteFilter(site)}
                      />
                      <span class="site-filter-option-id">{site}</span>
                      <span class="site-filter-option-count">{siteFilterCounts.get(site) ?? 0}</span>
                    </label>
                  ))}
                </div>
              )}
            </label>
            <button
              type="button"
              class={allGlobalOnly ? "filter-toggle selected" : "filter-toggle"}
              aria-pressed={allGlobalOnly ? "true" : "false"}
              onClick={() => {
                setAllGlobalOnly((current) => !current);
                setSiteMenuOpen(false);
              }}
            >{t.globalOnly()}</button>
            <label>
              <span>{t.bound()}</span>
              <select
                aria-label={t.filterByBound()}
                value={allBoundFilter}
                onChange={(event) => setAllBoundFilter(event.currentTarget.value as "" | "bound" | "unbound")}
              >
                <option value="">{t.any()}</option>
                <option value="bound">{t.bound()}</option>
                <option value="unbound">{t.unbound()}</option>
              </select>
            </label>
            <label>
              <span>{t.sortLabel()}</span>
              <select
                aria-label={t.sortTemplates()}
                value={allSort}
                onChange={(event) => {
                  const nextSort = event.currentTarget.value as SortKind;
                  setAllSort(nextSort);
                  setAllDirection(undefined);
                }}
              >
                <option value="default">{t.sortDefault()}</option>
                <option value="alphabetical">{t.sortAlphabetical()}</option>
                <option value="created">{t.sortCreated()}</option>
                <option value="updated">{t.sortUpdated()}</option>
                <option value="usage">{t.sortUsage()}</option>
              </select>
            </label>
            <button
              type="button"
              class="secondary"
              aria-label={t.reverseSortDirection()}
              onClick={() => setAllDirection((current) => (current ?? defaultDirectionFor(allSort)) === "ascending" ? "descending" : "ascending")}
            >
              {(allDirection ?? defaultDirectionFor(allSort)) === "ascending" ? t.sortAscending() : t.sortDescending()}
            </button>
          </div>

          <div class="selection-toolbar">
            {deleteFlow?.source === "selected" ? (
              <DeletionImpactPanel
                business={business}
                deleteFlow={deleteFlow}
                typedConfirmation={typedConfirmation}
                onTypedConfirmationChange={setTypedConfirmation}
                impactExpanded={impactExpanded}
                onToggleImpactExpanded={() => setImpactExpanded((current) => !current)}
                onConfirm={() => void confirmBatchDelete()}
                onCancel={cancelBatchDelete}
                busy={deleting}
                restoreFocusTo={deletionTriggerRef.current}
              />
            ) : (
              <>
                <label class="checkbox-field">
                  <input
                    type="checkbox"
                    aria-label={t.selectAllVisibleTemplates()}
                    checked={visibleTemplates.length > 0 && visibleTemplates.every((template) => selectedForDeletion.has(template.id))}
                    onChange={() => toggleSelectAllVisible(visibleTemplates)}
                  />
                  <span>{t.selectAll()}</span>
                </label>
                {selectedForDeletion.size > 0 && (
                  <>
                    <span>{t.selectedCount(selectedForDeletion.size)}</span>
                    <button
                      type="button"
                      class="danger"
                      onClick={() => startBatchDelete([...selectedForDeletion], "selected")}
                    >{t.deleteSelected()}</button>
                    <button type="button" class="secondary" onClick={() => setSelectedForDeletion(new Set())}>{t.clearSelection()}</button>
                  </>
                )}
              </>
            )}
          </div>

          <FlatTemplateList templates={allTemplates} rowActions={rowActions} emptyMessage={t.noTemplatesMatchSearch()} />
        </>
      )}
    </>
  );
}

export interface TemplateRowActions {
  editingTemplate: TemplateRecord | null;
  editDraft: string;
  setEditDraft(value: string): void;
  // Context-free rows (All templates / By location) only ever see "single"
  // or "everywhere-only" here - there is no Field to narrow a save to.
  editScope: TemplateEditScope;
  onStartEdit(template: TemplateRecord): void;
  onSaveEdit(): void;
  onCancelEdit(): void;
  onDelete(template: TemplateRecord): void;
  selectedForDeletion: Set<string>;
  onToggleSelect(templateId: string): void;
}

export function AliasLabel({
  displayLabel,
  currentAlias,
  onSave,
  editorId,
  activeEditorId,
  onActiveEditorChange,
  triggerLabel,
}: {
  displayLabel: string;
  currentAlias: string | undefined;
  onSave(alias: string): void;
  editorId?: string;
  activeEditorId?: string | null;
  onActiveEditorChange?(editorId: string | null): void;
  /** The rename control's accessible name, when "Rename <name>" is not enough. */
  triggerLabel?: string;
}) {
  const t = useMessages();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLSpanElement | null>(null);

  // Task 023 Addendum B5 (3): renaming is editing an existing name, not
  // inventing one from nothing, so the editor opens on the name the row is
  // showing right now. Before this it opened on `currentAlias`, which is
  // undefined for every row that has never been renamed - the common case -
  // and the user was handed an empty box under a row that plainly had a name.
  const seededName = currentAlias ?? displayLabel;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editing && editorId && activeEditorId !== editorId) setEditing(false);
  }, [activeEditorId, editing, editorId]);

  function startEditing(): void {
    setDraft(seededName);
    setEditing(true);
    if (editorId) onActiveEditorChange?.(editorId);
  }

  function commit(): void {
    const value = inputRef.current?.value ?? draft;
    // Seeding the box with the derived label means "leave it alone and press
    // Save" now arrives here as that label. Saving it would store a user alias
    // that merely restates the derived one, so an unchanged value is a cancel.
    if (value.trim() !== seededName.trim()) onSave(value);
    setEditing(false);
    if (editorId) onActiveEditorChange?.(null);
  }

  function cancel(): void {
    setEditing(false);
    if (editorId) onActiveEditorChange?.(null);
  }
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // Owner QA 2026-09-11, the rule Task 036 Addendum A.3 set for the Picker:
  // doing anything else without saving discards the rename. A press anywhere
  // outside the editor does; so does focus moving to another control. Focus
  // leaving the window does not - switching away to copy a name is not
  // abandoning it.
  useEffect(() => {
    if (!editing) return;
    const editor = editorRef.current;
    const document = editor?.ownerDocument;
    if (!editor || !document) return;
    function onPointerDown(event: PointerEvent): void {
      if (editor && !event.composedPath().includes(editor)) cancelRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editing]);

  if (editing) {
    return (
      <span
        class="alias-editor"
        ref={editorRef}
        onFocusOut={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && !event.currentTarget.contains(next)) cancel();
        }}
      >
        <input
          ref={inputRef}
          aria-label={t.nameForField(displayLabel)}
          value={draft}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            const native = event as unknown as KeyboardEvent;
            if (native.key === "Enter") commit();
            else if (native.key === "Escape") handleEditorEscape(native, cancel);
          }}
        />
        <button type="button" class="primary" onClick={commit}>{t.save()}</button>
        <button type="button" onClick={cancel}>{t.cancel()}</button>
      </span>
    );
  }

  // Task 023 Addendum B5 (2): this used to be the label plus a separate
  // pencil button. That button had lost its glyph (its CSS still sized an
  // `img`/`svg` child, which the Task 023 B4 icon change replaced with a
  // masked span), so a sighted user saw a blank circle and a screen reader
  // heard a bare "Rename, button" with no idea what it renamed. The Picker
  // already solves this by making the name itself the control, which both
  // names the action in context and shows on hover that it is interactive -
  // so the Side Panel now uses the same affordance.
  return (
    <span class="node-label-group">
      <button
        type="button"
        class="node-label-trigger"
        aria-label={triggerLabel ?? t.renameNamed(displayLabel)}
        title={t.rename()}
        onClick={startEditing}
        onKeyDown={(event) => {
          if ((event as unknown as KeyboardEvent).key === "F2") {
            event.preventDefault();
            startEditing();
          }
        }}
      >
        <span class="node-label">{displayLabel}</span>
      </button>
    </span>
  );
}

export function FlatTemplateList({
  templates,
  rowActions,
  emptyMessage,
}: {
  templates: TemplateRecord[];
  rowActions: TemplateRowActions;
  emptyMessage: string;
}) {
  return (
    <>
      <div class="template-list">
        {templates.map((template) => (
          <TemplateRow key={template.id} template={template} selectable {...rowActions} />
        ))}
      </div>
      {templates.length === 0 && <p>{emptyMessage}</p>}
    </>
  );
}

export function TemplateRow({
  template,
  editingTemplate,
  editDraft,
  setEditDraft,
  editScope,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  selectedForDeletion,
  onToggleSelect,
  onUnbind,
  selectable,
}: TemplateRowActions & { template: TemplateRecord; onUnbind?(): void; selectable?: boolean }) {
  const t = useMessages();
  const editInput = useTemplateContentInput(editDraft, setEditDraft);
  const isEditing = editingTemplate?.id === template.id;
  const isSelected = selectedForDeletion.has(template.id);
  const [textExpanded, setTextExpanded] = useState(false);
  return (
    <div class="template-item">
      {isEditing ? (
        <div class="editor-inline">
          <textarea
            aria-label={t.editTemplateContent()}
            value={editDraft}
            onInput={editInput.onInput}
            ref={editInput.ref}
            onKeyDown={(event) => handleEditorEscape(event, onCancelEdit)}
          />
          <TemplateLengthCounter content={editDraft} />
          {/* Task 035 (R8). Save is disabled past the limit; this says why. */}
          {(editInput.truncated || !isTemplateContentWithinLimit(editDraft)) && (
            <p class="panel-error" role="alert">{t.templateTooLong(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS, MAX_TEMPLATE_CONTENT_BYTES)}</p>
          )}
          <div class="editor-actions">
            <button
              type="button"
              class="primary"
              disabled={!isEditContentSavable(template, editDraft)}
              onClick={onSaveEdit}
            >
              {editScope === "everywhere-only" ? t.saveEverywhere() : t.save()}
            </button>
            <button type="button" onClick={onCancelEdit}>{t.cancel()}</button>
          </div>
        </div>
      ) : (
        <>
          <div class="template-row">
            {selectable && (
              <input
                type="checkbox"
                aria-label={t.selectForDeletion(preview(template.content, t))}
                checked={isSelected}
                onChange={() => onToggleSelect(template.id)}
              />
            )}
            {/* Task 023 Addendum B5 (8): the Template text is the button's
                accessible name, so a screen reader announced "<text>,
                collapsed, button" and nothing said what pressing it does.
                `title` becomes the accessible description here (the name
                already comes from the content), so the purpose is announced
                without displacing the text itself. */}
            <button
              type="button"
              class={textExpanded ? "template-row-text expanded" : "template-row-text"}
              aria-expanded={textExpanded ? "true" : "false"}
              title={textExpanded ? t.hideFullTemplateText() : t.showFullTemplateText()}
              onClick={() => setTextExpanded((current) => !current)}
            >
              {textExpanded ? template.content : preview(template.content, t)}
            </button>
          </div>
          <span class="template-row-actions">
            <button type="button" class="action" aria-label={t.edit()} title={t.edit()} onClick={() => onStartEdit(template)}>
              <EditIcon />
            </button>
            {onUnbind && (
              <button type="button" class="action" aria-label={t.unbind()} title={t.unbind()} onClick={onUnbind}>
                <UnbindIcon />
              </button>
            )}
            <button
              type="button"
              class="action danger"
              aria-label={t.deleteAction()}
              title={t.deleteAction()}
              onClick={() => onDelete(template)}
            >
              <DeleteIcon />
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function LocationTreeView({
  tree,
  expandedNodes,
  onToggle,
  pageProfilesById,
  fieldProfilesById,
  onRenamePage,
  onRenameField,
  onUnbind,
  rowActions,
  activeAliasEditorId,
  onActiveAliasEditorChange,
}: {
  tree: LocationTree;
  expandedNodes: Set<string>;
  onToggle(key: string): void;
  pageProfilesById: Map<string, PageProfileRecord>;
  fieldProfilesById: Map<string, FieldProfileRecord>;
  onRenamePage(pageProfileId: string, alias: string): void;
  onRenameField(fieldProfileId: string, alias: string): void;
  onUnbind(templateId: string, fieldProfileId: string): void;
  rowActions: TemplateRowActions;
  activeAliasEditorId: string | null;
  onActiveAliasEditorChange(editorId: string | null): void;
}) {
  const t = useMessages();
  return (
    <ul class="location-tree" aria-label={t.templatesByLocation()}>
      {tree.sites.map((site) => {
        const siteKey = `site:${site.siteId}`;
        const siteExpanded = expandedNodes.has(siteKey);
        return (
          <li key={site.siteId}>
            <TreeNodeRow depth={0} expanded={siteExpanded} onToggle={() => onToggle(siteKey)} count={site.templateCount}>
              <span class="node-label">{site.label}</span>
            </TreeNodeRow>
            {siteExpanded && (
              <ul>
                {site.pages.map((page) => (
                  <PageNode
                    key={page.pageProfileId}
                    page={page}
                    expandedNodes={expandedNodes}
                    onToggle={onToggle}
                    pageProfile={pageProfilesById.get(page.pageProfileId)}
                    fieldProfilesById={fieldProfilesById}
                    onRenamePage={onRenamePage}
                    onRenameField={onRenameField}
                    onUnbind={onUnbind}
                    rowActions={rowActions}
                    activeAliasEditorId={activeAliasEditorId}
                    onActiveAliasEditorChange={onActiveAliasEditorChange}
                  />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PageNode({
  page,
  expandedNodes,
  onToggle,
  pageProfile,
  fieldProfilesById,
  onRenamePage,
  onRenameField,
  onUnbind,
  rowActions,
  activeAliasEditorId,
  onActiveAliasEditorChange,
}: {
  page: LocationTreePageNode;
  expandedNodes: Set<string>;
  onToggle(key: string): void;
  pageProfile: PageProfileRecord | undefined;
  fieldProfilesById: Map<string, FieldProfileRecord>;
  onRenamePage(pageProfileId: string, alias: string): void;
  onRenameField(fieldProfileId: string, alias: string): void;
  onUnbind(templateId: string, fieldProfileId: string): void;
  rowActions: TemplateRowActions;
  activeAliasEditorId: string | null;
  onActiveAliasEditorChange(editorId: string | null): void;
}) {
  const key = `page:${page.pageProfileId}`;
  const expanded = expandedNodes.has(key);
  return (
    <li>
      <TreeNodeRow depth={1} expanded={expanded} onToggle={() => onToggle(key)} count={page.templateCount}>
        <AliasLabel
          displayLabel={page.label}
          currentAlias={pageProfile?.userAlias}
          onSave={(alias) => onRenamePage(page.pageProfileId, alias)}
          editorId={`page:${page.pageProfileId}`}
          activeEditorId={activeAliasEditorId}
          onActiveEditorChange={onActiveAliasEditorChange}
        />
      </TreeNodeRow>
      {expanded && (
        <ul>
          {page.fields.map((field) => (
            <FieldNode
              key={field.fieldProfileId}
              field={field}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              fieldProfile={fieldProfilesById.get(field.fieldProfileId)}
              onRenameField={onRenameField}
              onUnbind={onUnbind}
              rowActions={rowActions}
              activeAliasEditorId={activeAliasEditorId}
              onActiveAliasEditorChange={onActiveAliasEditorChange}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FieldNode({
  field,
  expandedNodes,
  onToggle,
  fieldProfile,
  onRenameField,
  onUnbind,
  rowActions,
  activeAliasEditorId,
  onActiveAliasEditorChange,
}: {
  field: LocationTreeFieldNode;
  expandedNodes: Set<string>;
  onToggle(key: string): void;
  fieldProfile: FieldProfileRecord | undefined;
  onRenameField(fieldProfileId: string, alias: string): void;
  onUnbind(templateId: string, fieldProfileId: string): void;
  rowActions: TemplateRowActions;
  activeAliasEditorId: string | null;
  onActiveAliasEditorChange(editorId: string | null): void;
}) {
  const key = `field:${field.fieldProfileId}`;
  const expanded = expandedNodes.has(key);
  return (
    <li>
      <TreeNodeRow depth={2} expanded={expanded} onToggle={() => onToggle(key)} count={field.templateCount}>
        <AliasLabel
          displayLabel={field.label}
          currentAlias={fieldProfile?.userAlias}
          onSave={(alias) => onRenameField(field.fieldProfileId, alias)}
          editorId={`field:${field.fieldProfileId}`}
          activeEditorId={activeAliasEditorId}
          onActiveEditorChange={onActiveAliasEditorChange}
        />
      </TreeNodeRow>
      {expanded && (
        <ul class="template-list tree-templates">
          {field.templates.map((leaf) => (
            <TemplateRow
              key={leaf.template.id}
              template={leaf.template}
              onUnbind={() => onUnbind(leaf.template.id, field.fieldProfileId)}
              {...rowActions}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreeNodeRow({
  depth,
  expanded,
  onToggle,
  count,
  chevronLabel,
  children,
}: {
  depth: number;
  expanded: boolean;
  onToggle(): void;
  count: number;
  // Optional: the Site-group and Logical Page rule rows this component
  // already served identify themselves structurally (next to the label a
  // sighted user reads), matching this codebase's existing convention. A
  // new caller may instead pass an explicit label where that's not enough.
  chevronLabel?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="tree-node" style={{ paddingLeft: `${depth * 14}px` }}>
      <button
        type="button"
        class="tree-chevron"
        aria-expanded={expanded}
        aria-label={chevronLabel}
        onClick={onToggle}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>
      {children}
      <span class="tree-node-count">{count}</span>
    </div>
  );
}

export interface FieldFirstEditActions {
  editingTemplate: TemplateRecord | null;
  editDraft: string;
  setEditDraft(value: string): void;
  // The valid Save-scope choices for a "This tab" Field-card edit mirror
  // that Field's Picker exactly (Task 026 Confirmed Contract, acceptance 5).
  editScope: TemplateEditScope;
  onStartEdit(template: TemplateRecord): void;
  onSaveEdit(): void;
  onSaveCopyForField(): void;
  onSaveForThisField(): void;
  onCancelEdit(): void;
}

export function FieldCard({
  field,
  expanded,
  onToggleExpanded,
  onRenameField,
  onRemove,
  onShareThisVersion,
  aliasEditorId,
  activeAliasEditorId,
  onActiveAliasEditorChange,
  onHighlight,
  ...editActions
}: FieldFirstEditActions & {
  field: FieldFirstFieldRow;
  expanded: boolean;
  onToggleExpanded(): void;
  onRenameField(alias: string): void;
  onRemove(option: FieldFirstOption): void;
  // Task 027: promotes a Field-only relationship to a normal Shared
  // Template Slot within its owner's current Set. Only ever called for an
  // `option.isFieldOnly` row.
  onShareThisVersion(option: FieldFirstOption): void;
  aliasEditorId: string;
  activeAliasEditorId: string | null;
  onActiveAliasEditorChange(editorId: string | null): void;
  onHighlight(active: boolean): void;
}) {
  const t = useMessages();
  const count = field.options.length;
  return (
    <section
      class="field-card"
      onMouseEnter={() => onHighlight(true)}
      onMouseLeave={() => onHighlight(false)}
      onFocus={() => onHighlight(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight(false);
      }}
    >
      <div class="tree-node field-card-header">
        <button
          type="button"
          class="tree-chevron"
          aria-expanded={expanded}
          aria-label={t.expandOrCollapseNamed(expanded, field.label)}
          onClick={onToggleExpanded}
        >
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        </button>
        <span class="field-card-labels">
          <AliasLabel
            displayLabel={field.label}
            currentAlias={field.fieldAlias}
            onSave={onRenameField}
            editorId={aliasEditorId}
            activeEditorId={activeAliasEditorId}
            onActiveEditorChange={onActiveAliasEditorChange}
          />
        </span>
        <span class="field-card-count">
          {t.fieldOptionCount(count)}
        </span>
      </div>
      {expanded && (
        <FieldFirstOptionList
          options={field.options}
          onRemove={onRemove}
          onShareThisVersion={onShareThisVersion}
          {...editActions}
        />
      )}
    </section>
  );
}

function fieldFirstOptionKey(option: FieldFirstOption): string {
  return option.binding?.id ?? option.slotId ?? option.template.id;
}

export function FieldFirstOptionList({
  options,
  onRemove,
  onShareThisVersion,
  editingTemplate,
  editDraft,
  setEditDraft,
  editScope,
  onStartEdit,
  onSaveEdit,
  onSaveCopyForField,
  onSaveForThisField,
  onCancelEdit,
}: FieldFirstEditActions & {
  options: FieldFirstOption[];
  onRemove(option: FieldFirstOption): void;
  onShareThisVersion(option: FieldFirstOption): void;
}) {
  const t = useMessages();
  const editInput = useTemplateContentInput(editDraft, setEditDraft);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const optionsByKey = useMemo(
    () => new Map(options.map((option) => [fieldFirstOptionKey(option), option] as const)),
    [options],
  );
  // Task 003 addendum (2026-09-07): a Field's list is ranked automatically and
  // is not user-arrangeable, so this is simply the order it arrives in.
  const displayKeys = options.map(fieldFirstOptionKey);

  return (
    <ul class="field-first-options">
      {displayKeys.map((rowKey, index) => {
        const option = optionsByKey.get(rowKey);
        if (!option) return null;
        const isEditing = editingTemplate?.id === option.template.id;
        return (
          <li
            key={rowKey}
            ref={(el) => {
              if (el) rowRefs.current.set(rowKey, el);
              else rowRefs.current.delete(rowKey);
            }}
            class="field-first-option"
          >
            {isEditing ? (
              <div class="editor-inline">
                <textarea
                  aria-label={t.editTemplateContent()}
                  value={editDraft}
                  onInput={editInput.onInput}
                  ref={editInput.ref}
                  onKeyDown={(event) => handleEditorEscape(event, onCancelEdit)}
                />
                <TemplateLengthCounter content={editDraft} />
                {(editInput.truncated || !isTemplateContentWithinLimit(editDraft)) && (
                  <p class="panel-error" role="alert">{t.templateTooLong(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS, MAX_TEMPLATE_CONTENT_BYTES)}</p>
                )}
                <div class="editor-actions">
                  {editScope === "field-copy" ? (
                    <>
                      <button
                        type="button"
                        disabled={!isEditContentSavable(option.template, editDraft)}
                        onClick={onSaveEdit}
                      >{t.saveEverywhere()}</button>
                      <button
                        type="button"
                        disabled={!isEditContentSavable(option.template, editDraft)}
                        onClick={onSaveCopyForField}
                      >{t.saveACopyHere()}</button>
                    </>
                  ) : editScope === "shared-inherited" ? (
                    <>
                      <button
                        type="button"
                        disabled={!isEditContentSavable(option.template, editDraft)}
                        onClick={onSaveCopyForField}
                      >{t.saveForSharedFields()}</button>
                      <button
                        type="button"
                        disabled={!isEditContentSavable(option.template, editDraft)}
                        onClick={onSaveForThisField}
                      >{t.saveForThisField()}</button>
                    </>
                  ) : editScope === "shared-field-only" ? (
                    // Task 027 Addendum A (defect F): a private relationship
                    // offers a single, never Set-wide, save choice - wired to
                    // the same Set-level copy command, which stays private
                    // because it targets this Field's own owner-only slot.
                    <button
                      type="button"
                      class="primary"
                      disabled={!isEditContentSavable(option.template, editDraft)}
                      onClick={onSaveCopyForField}
                    >{t.saveForThisField()}</button>
                  ) : (
                    <button
                      type="button"
                      class="primary"
                      disabled={!isEditContentSavable(option.template, editDraft)}
                      onClick={onSaveEdit}
                    >
                      {editScope === "everywhere-only" ? t.saveEverywhere() : t.save()}
                    </button>
                  )}
                  <button type="button" onClick={onCancelEdit}>{t.cancel()}</button>
                </div>
              </div>
            ) : (
              <>
                <span class="field-first-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <span class="field-first-option-content">{preview(option.template.content, t)}</span>
                <button
                  type="button"
                  class="action"
                  aria-label={t.edit()}
                  title={t.edit()}
                  onClick={() => onStartEdit(option.template)}
                >
                  <EditIcon />
                </button>
                {option.fieldOnlySlotId !== null && (
                  <button
                    type="button"
                    class="action"
                    aria-label={t.shareThisVersion()}
                    title={t.shareThisVersion()}
                    onClick={() => onShareThisVersion(option)}
                  >
                    <ShareIcon />
                  </button>
                )}
                <button
                  type="button"
                  class="action"
                  aria-label={option.slotId ? t.removeFromThisField() : t.unbind()}
                  title={option.slotId ? t.removeFromThisField() : t.unbind()}
                  onClick={() => onRemove(option)}
                >
                  <UnbindIcon />
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function NotOfferedAnywhereBucket({
  templates,
  expanded,
  onToggleExpanded,
  rowActions,
}: {
  templates: TemplateRecord[];
  expanded: boolean;
  onToggleExpanded(): void;
  rowActions: TemplateRowActions;
}) {
  const t = useMessages();
  if (templates.length === 0) return null;
  return (
    <div class="not-offered-anywhere">
      <button type="button" class="not-offered-anywhere-toggle" aria-expanded={expanded} onClick={onToggleExpanded}>
        <span class="not-offered-anywhere-title">{t.notOfferedAnywhere()}</span>
        <span class="not-offered-anywhere-count">
          {t.templatesWaitingForField(templates.length)}
        </span>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && <FlatTemplateList templates={templates} rowActions={rowActions} emptyMessage="" />}
    </div>
  );
}

export function defaultExpandedNodesForCurrentSite(
  tree: LocationTree,
  currentPage: { siteId: SiteIdentity; pageProfileId: string | null } | null,
): Set<string> {
  const keys = new Set<string>();
  if (!currentPage) return keys;
  const site = tree.sites.find((candidate) => candidate.siteId === currentPage.siteId);
  if (!site) return keys;
  keys.add(`site:${site.siteId}`);
  if (!currentPage.pageProfileId) return keys;
  const page = site.pages.find((candidate) => candidate.pageProfileId === currentPage.pageProfileId);
  if (!page) return keys;
  keys.add(`page:${page.pageProfileId}`);
  for (const field of page.fields) {
    keys.add(`field:${field.fieldProfileId}`);
  }
  return keys;
}

export function filterLocationTree(tree: LocationTree, query: string): LocationTree {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length === 0) return tree;

  const sites = tree.sites
    .map((site) => {
      const siteLabelMatches = site.label.toLocaleLowerCase().includes(normalized);
      const pages = site.pages
        .map((page) => {
          const pageLabelMatches = siteLabelMatches || page.label.toLocaleLowerCase().includes(normalized);
          const fields = page.fields
            .map((field) => {
              const fieldLabelMatches = pageLabelMatches || field.label.toLocaleLowerCase().includes(normalized);
              const templates = fieldLabelMatches
                ? field.templates
                : field.templates.filter(
                    (leaf) =>
                      derivePreview(leaf.template.content).toLocaleLowerCase().includes(normalized) ||
                      leaf.template.content.toLocaleLowerCase().includes(normalized),
                  );
              if (templates.length === 0) return null;
              return { ...field, templates, templateCount: new Set(templates.map((leaf) => leaf.template.id)).size };
            })
            .filter((field): field is LocationTreeFieldNode => field !== null);
          if (fields.length === 0) return null;
          const templateCount = new Set(fields.flatMap((field) => field.templates.map((leaf) => leaf.template.id))).size;
          return { ...page, fields, templateCount };
        })
        .filter((page): page is LocationTreePageNode => page !== null);
      if (pages.length === 0) return null;
      const templateCount = new Set(pages.flatMap((page) => page.fields.flatMap((field) => field.templates.map((leaf) => leaf.template.id)))).size;
      return { ...site, pages, templateCount };
    })
    .filter((site): site is LocationTree["sites"][number] => site !== null);

  return { sites };
}
