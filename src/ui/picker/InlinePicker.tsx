import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

import { fieldName, readFieldText, type SupportedField } from "../../fields/dom-field";
import { RichText } from "../shared/RichText";
import type { Messages } from "../../i18n/catalogue";
import { useLanguage, useMessages } from "../../i18n/useMessages";
import {
  isStateChangeNotification,
  isAddSharedTemplateSetMemberResult,
  type BindingTargetPayload,
  type OpaqueLogicalPageCandidateEvidencePayload,
  type RuntimeResponse,
} from "../../messages/runtime-messages";
import { CURRENT_SCHEMA_VERSION } from "../../storage/schema-version";
import type {
  BindingRecord,
  BindTemplateToFieldOnlyResult,
  CompatibilityCandidateView,
  CreatedSharedTemplateBinding,
  CreateSharedTemplateSetResult,
  FieldContextResolution,
  FillNestState,
  FindSimilarFieldCandidatesResult,
  JoinSetAndShareResult,
  LogicalPageReviewCandidate,
  MergeSetsAndShareResult,
  MergeSharedTemplateSetsResult,
  PickerPosition,
  PromoteFieldOnlySlotResult,
  RemoveSharedTemplateSetMemberResult,
  SaveTemplateCopyForFieldResult,
  SaveTemplateCopyForSharedSetResult,
  SaveTemplateOverrideForFieldResult,
  CreateTemplateAndBindSharedFieldOnlyResult,
  SharedMemberAddUndo,
  SharedTemplateBindingRecord,
  SharedTemplateFieldStateRecord,
  SharedTemplateSetRecord,
  TemplateRecord,
} from "../../storage/fillnest-repository";
import {
  deriveFieldDisplayLabel,
  derivePageDisplayLabel,
  fieldDisplayName,
  pageDisplayName,
} from "../../labels/display-label";
import { orderFieldTemplateEntries } from "../../templates/field-template-order";
import { compareTemplates, defaultDirectionFor } from "../../templates/library-views";
import { searchTemplates } from "../../templates/template-search";
import {
  FIELD_TEMPLATE_COUNT_VISIBLE_FROM,
  MAX_TEMPLATES_PER_FIELD,
} from "../../templates/field-template-limit";
import {
  isTemplateContentWithinLimit,
  MAX_TEMPLATE_CONTENT_BYTES,
  MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS,
} from "../../templates/template-content";
import { deriveOutcomePreview, derivePreview } from "../../templates/template-preview";
import { computeSiteAffinityBadge, type SiteAffinityBadge } from "../../templates/template-site-badge";
import { resolveTemplateEditScope, type TemplateEditScope } from "../../templates/template-edit-scope";
import {
  BindIcon,
  BindSharedSetIcon,
  LeaveSharingIcon,
  ShareWithIcon,
  CopyIcon,
  DeleteIcon,
  BackIcon,
  BrandIcon,
  EditIcon,
  MapPinIcon,
  PinIcon,
  RemoveFromFieldIcon,
  ShareIcon,
} from "../icons/FillNestIcons";
import { clampPickerPosition } from "./field-control-geometry";
import { TemplateLengthCounter } from "../shared/TemplateLengthCounter";
import { useTemplateContentInput } from "../shared/useTemplateContentInput";
import { FieldAliasEditor } from "./FieldAliasEditor";
import { PageNote, StartCard, useFirstUseTips } from "../shared/FirstUseTips";
import { sendRequest } from "../shared/runtime-request";

export type LastAction =
  | {
      type: "delete";
      template: TemplateRecord;
      bindings: BindingRecord[];
      sharedBindings: SharedTemplateBindingRecord[];
      fieldStates: SharedTemplateFieldStateRecord[];
    }
  | { type: "bind"; template: TemplateRecord; bindingId: string }
  | { type: "unbind"; template: TemplateRecord; binding: BindingRecord }
  // `template` is the pre-save version, kept for Undo. Task 023 Addendum B5
  // (10): result wording uses `savedContent`, the version actually saved.
  | { type: "save"; template: TemplateRecord; savedContent: string; expectedRevision: number }
  | {
      type: "save-copy";
      template: TemplateRecord;
      copyTemplate: TemplateRecord;
      copyTemplateId: string;
      originalBinding: BindingRecord;
    }
  | {
      type: "save-copy-shared";
      template: TemplateRecord;
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
  | { type: "create-bind-shared"; setId: string; template: TemplateRecord; sharedBindingId: string }
  | {
      type: "create-bind-shared-field-only";
      setId: string;
      template: TemplateRecord;
      sharedBindingId: string;
    }
  | {
      type: "bind-shared";
      setId: string;
      template: TemplateRecord;
      sharedBindingId: string;
      previousState?: SharedTemplateFieldStateRecord;
      created: boolean;
    }
  | {
      type: "unbind-shared";
      setId: string;
      template: TemplateRecord;
      sharedBinding: SharedTemplateBindingRecord;
      fieldStates: SharedTemplateFieldStateRecord[];
    }
  | {
      type: "bind-to-field-only";
      setId: string;
      template: TemplateRecord;
      sharedBinding: SharedTemplateBindingRecord;
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
      previousSlot?: SharedTemplateBindingRecord;
    }
  | { type: "create-shared-set"; setId: string }
  | { type: "add-shared-member"; setId: string; fieldProfileId: string; undo: SharedMemberAddUndo }
  | {
      // Task 027 Addendum B: the composite "Join Set & Share" - adds a
      // previously-unshared target Field to the owner's own current Set and
      // promotes the named Field-only slot in the same atomic operation.
      type: "join-set-and-share";
      template: TemplateRecord;
      setId: string;
      targetFieldProfileId: string;
      addUndo: SharedMemberAddUndo;
      slotId: string;
      previousOwnerFieldProfileId: string;
      consumedSlot?: SharedTemplateBindingRecord;
      previousOrdinarySlot?: SharedTemplateBindingRecord;
      removedFieldStates?: SharedTemplateFieldStateRecord[];
      previousSlot?: SharedTemplateBindingRecord;
    }
  | {
      // Task 027 Addendum B: the composite "Merge Sets & Share" - merges the
      // target's own existing Set into the owner's current Set and promotes
      // the named Field-only slot in the same atomic operation.
      type: "merge-sets-and-share";
      template: TemplateRecord;
      mergedSet: SharedTemplateSetRecord;
      mergedSetBindings: SharedTemplateBindingRecord[];
      previousKeepSet: SharedTemplateSetRecord;
      previousKeepSetBindings: SharedTemplateBindingRecord[];
      removedSet: SharedTemplateSetRecord;
      removedSetBindings: SharedTemplateBindingRecord[];
      remappedFieldStates: SharedTemplateFieldStateRecord[];
      previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
      slotId: string;
      previousOwnerFieldProfileId: string;
      consumedSlot?: SharedTemplateBindingRecord;
      previousOrdinarySlot?: SharedTemplateBindingRecord;
      removedFieldStates?: SharedTemplateFieldStateRecord[];
      previousSlot?: SharedTemplateBindingRecord;
    }
  | {
      type: "stop-sharing";
      fieldProfileId: string;
      set: SharedTemplateSetRecord;
      endedSharedBindings: SharedTemplateBindingRecord[];
      snapshotBindings: BindingRecord[];
      dormantBindings: BindingRecord[];
      removedOwnedSlots: SharedTemplateBindingRecord[];
      removedFieldStates: SharedTemplateFieldStateRecord[];
    }
  | {
      type: "merge-shared-sets";
      mergedSet: SharedTemplateSetRecord;
      mergedSetBindings: SharedTemplateBindingRecord[];
      previousKeepSet: SharedTemplateSetRecord;
      previousKeepSetBindings: SharedTemplateBindingRecord[];
      removedSet: SharedTemplateSetRecord;
      removedSetBindings: SharedTemplateBindingRecord[];
      remappedFieldStates: SharedTemplateFieldStateRecord[];
      previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
    };

interface InlinePickerProps {
  targetField: SupportedField;
  // Server-resolved even for a Field that has never been bound to anything
  // (RESOLVE_FIELD_CONTEXT always computes one) - the one reliable source
  // for "which Site is this," since a never-bound Field's own Page/Field
  // Profile may not exist in storage yet to look a Site up from.
  siteId?: string;
  pageProfileId: string;
  fieldProfileId: string;
  fieldRecognized?: boolean;
  pageIdentityKey: string | null;
  fieldIdentityKey: string | null;
  fieldDocumentOrder?: number | null;
  fieldObservedTitle?: string | null;
  // Other reliably identified Fields on the current page that have never
  // been bound to anything - such a Field has no durable Field Profile yet
  // (only a Bind persists one), so it cannot appear in `addFieldCandidates`
  // from stored state alone. The content script already scans the live DOM
  // for lifecycle tracking; this reuses that scan so "Add Fields" can offer
  // a page's brand-new Fields too, not only ones already bound elsewhere.
  pageFieldCandidates?: Array<{
    fieldIdentityKey: string;
    documentOrder: number | null;
    observedTitle: string | null;
  }>;
  onSharedFieldCandidateHighlight?(fieldIdentityKey: string | null): void;
  onSharedFieldCandidateLocate?(fieldIdentityKey: string): void;
  onInsert(template: TemplateRecord): void;
  onClose(): void;
  pinned: boolean;
  onPinnedChange(pinned: boolean): void;
  pickerPosition: PickerPosition | null;
  onPickerPositionChange(position: PickerPosition, persist: boolean): void;
  lastAction: LastAction | null;
  onLastActionChange(action: LastAction | null): void;
  targetFieldActionable: boolean;
  /**
   * Task 036. This Field's editor has refused an insertion - remembered from a
   * previous visit, or established a moment ago. It puts a `Copy` action on
   * every Template row so the user has a way through without first spending a
   * click on an insertion that will not land.
   */
  insertionRejected: boolean;
  /**
   * The content of an insertion this Field's editor has just refused. Present
   * only for the live failure; the notice it drives names what happened and
   * offers the copy explicitly.
   */
  insertionRejectionNotice: string | null;
  /** Writes the clipboard. Called only from the user's own click. */
  onCopyToClipboard(content: string): Promise<boolean>;
  /**
   * Task 036. Whether this Field can carry a Binding at all. False only for a
   * Rich Text Field that qualifies through `role="textbox"` alone: it has no
   * stable identity to key on, so a Binding made here would disappear the next
   * time the page rebuilt its editor. Insertion still works.
   */
  bindingSupported: boolean;
  logicalPageCandidate?: LogicalPageReviewCandidate | null;
  logicalPageCandidateEvidence?: OpaqueLogicalPageCandidateEvidencePayload | null;
  onLogicalPageCandidateConfirmed?(resolution: FieldContextResolution): void;
  onLogicalPageCandidateDismissed?(): void;
}

type Mode = "list" | "compose" | "review-candidate" | "find-similar-field";

// One selectable row in the "Add Fields" candidate list. A durable
// candidate already has a Field Profile in storage (from some prior Bind,
// possibly on a different page); a non-durable one was found live on the
// current page by the content script and has never been bound to anything,
// so it has no Field Profile yet at all. Either way it is always an "Add"
// here - a Field already in a *different* Shared Template Set is excluded
// from this list entirely. Moving a Field between Sets no longer exists
// (Task 040); it leaves one Set and then joins the other.
type SharedFieldCandidate = (
  | {
      durable: true;
      fieldProfileId: string;
      siteId: string;
      pageProfileId: string;
      existingSetId: string | null;
      existingSetMemberCount: number;
    }
  | { durable: false; fieldIdentityKey: string; observedTitle: string | null }
) & {
  key: string;
  label: string;
  pageLabel: string;
  // Ordering evidence only, and deliberately structural: the Field's own
  // page and its position on it. Nothing here compares Field names or
  // meanings - "Automatic semantic field matching" is an explicit Task 015
  // Non-Goal, and ranking by compatibility belongs to Task 024.
  onCurrentPage: boolean;
  documentOrder: number | null;
  fieldIdentityKey?: string;
};

// The Fields most likely to be wanted are the ones the user can see right
// now, so the list opens at the current page's own Fields and keeps the
// rest one click away rather than burying them.
const VISIBLE_SHARED_FIELD_CANDIDATES = 5;

type PickerOutcome =
  | { tone: "info" | "success" | "warning" | "danger"; message: string; template?: TemplateRecord; showDelete?: boolean }
  | null;

const FLYOUT_WIDTH = 200;
const FLYOUT_MAX_HEIGHT = 300;
const FLYOUT_GAP = 10;
const VIEWPORT_MARGIN = 8;
// How long the full-text flyout waits for the pointer to cross from the list
// to it (owner QA, 2026-09-11).
const FLYOUT_LINGER_MS = 400;

interface FieldAliasEdit {
  key: string;
  fieldProfileId: string;
  displayLabel: string;
  currentAlias?: string;
  newField?: BindingTargetPayload;
}

/**
 * Both are per-render allocations that were defeating downstream `useMemo`s.
 *
 * Task 023 Addendum B follow-up. `compareTemplates`'s arguments here are
 * literal constants, so the comparator never needs rebuilding. The empty
 * candidate list has to be one shared reference: `?? []` produced a new array
 * on every render, so every memo keyed on it recomputed every time.
 */
const DEFAULT_TEMPLATE_ORDER = compareTemplates("default", defaultDirectionFor("default"));
const NO_FIND_SIMILAR_CANDIDATES: FindSimilarFieldCandidatesResult["candidates"] = [];

export function InlinePicker({
  targetField,
  siteId: contextSiteId = "",
  pageProfileId,
  fieldProfileId,
  fieldRecognized = true,
  pageIdentityKey,
  fieldIdentityKey,
  fieldDocumentOrder,
  fieldObservedTitle,
  onInsert,
  onClose,
  pinned,
  onPinnedChange,
  pickerPosition,
  onPickerPositionChange,
  lastAction,
  onLastActionChange,
  targetFieldActionable,
  insertionRejected,
  insertionRejectionNotice,
  onCopyToClipboard,
  bindingSupported,
  logicalPageCandidate = null,
  logicalPageCandidateEvidence = null,
  onLogicalPageCandidateConfirmed = () => {},
  onLogicalPageCandidateDismissed = () => {},
  pageFieldCandidates = [],
  onSharedFieldCandidateHighlight,
  onSharedFieldCandidateLocate,
}: InlinePickerProps) {
  const t = useMessages();
  // Codex review, 2026-09-13: the Picker lives inside a page, and without its
  // own `lang` a screen reader read its Chinese with the page's language.
  const language = useLanguage();
  const tips = useFirstUseTips();
  const [mode, setMode] = useState<Mode>("list");
  const [state, setState] = useState<FillNestState | null>(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<PickerOutcome>(null);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TemplateRecord | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Task 035 Addendum A: the compose editor stops input at the content limit.
  const composeInput = useTemplateContentInput(draft, setDraft);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Owner QA, 2026-09-11: the full-text flyout sits beside the Picker, so the
  // pointer leaves the list - and the highlight - on its way there. The
  // flyout keeps the Template it was showing for a moment, and for as long as
  // the pointer is over it.
  const [flyoutHoldId, setFlyoutHoldId] = useState<string | null>(null);
  const flyoutLingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<
    { top: number; left: number; maxHeight: number; coversPicker: boolean } | null
  >(
    null,
  );
  const [insertCounts, setInsertCounts] = useState<Map<string, number>>(new Map());
  const [repeatInsertNotice, setRepeatInsertNotice] = useState<{ name: string; count: number } | null>(
    null,
  );
  const [sharedActionBusy, setSharedActionBusy] = useState(false);
  const [showAllSharedCandidates, setShowAllSharedCandidates] = useState(false);
  // Owner QA 2026-09-15: the Fields before this one open on their own, without
  // listing every other Field.
  const [showFieldsBefore, setShowFieldsBefore] = useState(false);
  const [findSimilarResult, setFindSimilarResult] = useState<FindSimilarFieldCandidatesResult | null>(null);
  // Task 024 Addendum C. The automatic offer, which the Confirmed Contract has
  // always specified and no surface has ever shown - `suggestedFieldProfileId`
  // was computed by the repository and dropped. It is fetched once per Field
  // while the Picker is open, and never previews a Template: this offer names
  // Fields, because recommending Templates before a deliberate Search is the
  // one thing the product does not do.
  const [linkOffer, setLinkOffer] = useState<FindSimilarFieldCandidatesResult | null>(null);
  const [linkOfferDismissed, setLinkOfferDismissed] = useState(false);
  const [findSimilarLoading, setFindSimilarLoading] = useState(false);
  const [findSimilarQuery, setFindSimilarQuery] = useState("");
  // A long Field label is clamped to 2 lines by default; a row the user
  // explicitly expands (by its Field Profile ID) stays fully visible.
  const [findSimilarExpandedLabels, setFindSimilarExpandedLabels] = useState<Set<string>>(new Set());
  const [expandedOnPageCandidateTemplates, setExpandedOnPageCandidateTemplates] = useState<Set<string>>(new Set());
  const [fieldAliasEdit, setFieldAliasEdit] = useState<FieldAliasEdit | null>(null);
  const [fieldAliasDraft, setFieldAliasDraft] = useState("");
  const [fieldAliasBusy, setFieldAliasBusy] = useState(false);
  const [pendingLink, setPendingLink] = useState<{
    candidate: CompatibilityCandidateView;
    fieldCount: number;
    siteCount: number;
  } | null>(null);
  // Task 027 Explicit Scope UI: "Scope-changing actions state the affected
  // Field or Set and member count before mutation." `Share this version`
  // broadens an audience, so it states its scope and waits, exactly as the
  // composite Join/Merge & Share actions already do.
  const [pendingShare, setPendingShare] = useState<{
    template: TemplateRecord;
    slotId: string;
    // Whether the promotion will run as Addendum A.3 mode 2, merging this
    // Field's separate private version into the Set's existing shared entry.
    willMerge: boolean;
  } | null>(null);
  const [pendingSharedBind, setPendingSharedBind] = useState<TemplateRecord | null>(null);
  // Task 027 Addendum B: set while the "find-similar-field" Finder is open
  // for the purpose of choosing a `Join Set & Share` / `Merge Sets & Share`
  // target for a specific Field-only Template - as opposed to its ordinary
  // "Link Templates with a similar Field" purpose (`pendingLink`). Reuses
  // the same Finder candidate search rather than a separate candidate
  // source: it is already scoped to plausible compatible Fields, already
  // excludes the current Field and any already-linked one, and already
  // carries the `existingSetId`/`crossSite` data the case matrix needs.
  const [shareTargetContext, setShareTargetContext] = useState<{ template: TemplateRecord; slotId: string } | null>(
    null,
  );
  const [pendingShareTarget, setPendingShareTarget] = useState<{
    candidate: CompatibilityCandidateView;
    mode: "join" | "merge";
    fieldCount: number;
    siteCount: number;
    // How many Templates every affected Field will offer afterwards. A join
    // and a merge both take the union of the two sides, so this is the one
    // number the old confirmation never said and the one that can put a Field
    // over the limit.
    resultingTemplateCount: number;
  } | null>(null);
  const findSimilarSearchRef = useRef<HTMLInputElement | null>(null);
  const carriedOutcome = useRef<{ fieldProfileId: string; outcome: PickerOutcome } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originTop: number;
    originLeft: number;
  } | null>(null);

  // The broadcast listener below is registered once for the Picker's lifetime,
  // but its callers are recreated on every render by the content script. Adding
  // them to the dependency array would tear the listener down and re-register
  // it on each render; holding them in a ref keeps one registration while
  // always calling the current function rather than the one from first render.
  const latestHandlers = useRef({ onLastActionChange, showError });
  latestHandlers.current = { onLastActionChange, showError };

  useEffect(() => {
    void readState().then(setState).catch((reason) => latestHandlers.current.showError(reason));
    // Mutations made elsewhere (the Side Panel, or another open Picker) must
    // reach an already-open Picker too - this mirrors the same broadcast the
    // Side Panel already listens for, closing the other direction of sync.
    const handleChange = (message: unknown) => {
      if (isStateChangeNotification(message)) {
        // A broadcast arrives before the mutating request resolves, so this
        // clears an older action but never races the action the Picker is
        // about to create for that same request.
        latestHandlers.current.onLastActionChange(null);
        setOutcome(null);
        void readState().then(setState).catch((reason) => latestHandlers.current.showError(reason));
      }
    };
    chrome.runtime.onMessage.addListener(handleChange);
    return () => chrome.runtime.onMessage.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (mode === "list") searchInputRef.current?.focus();
  }, [mode]);

  const isFirstFieldRender = useRef(true);
  useEffect(() => {
    if (isFirstFieldRender.current) {
      isFirstFieldRender.current = false;
      return;
    }
    setMode("list");
    setDraft("");
    setQuery("");
    setEditing(null);
    setEditDraft("");
    setHighlightedId(null);
    setShowAllSharedCandidates(false);
    setShowFieldsBefore(false);
    setFindSimilarResult(null);
    setFindSimilarQuery("");
    setPendingLink(null);
    // Task 027 Addendum F: a confirmation is worded for, and acts on, the
    // Field it was opened from. Left open, it followed a pinned Picker to the
    // next Field and ran there under the first Field's wording.
    setPendingShare(null);
    setPendingSharedBind(null);
    setShareTargetContext(null);
    setPendingShareTarget(null);
    setLinkOffer(null);
    setLinkOfferDismissed(false);
    // Task 036 Addendum A.3: an unsaved rename does not follow the user to
    // another Field. It was never saved, so there is nothing to carry.
    setFieldAliasEdit(null);
    setFieldAliasDraft("");
    // An error belongs to the Field whose action failed, not to the next one.
    setError("");
    // Confirming a Logical Page candidate re-identifies the *same* focused
    // Field as the canonical one, so this effect fires even though the user
    // never moved fields. Its result message has to survive that, or the one
    // confirmation the user explicitly asked for reports nothing. The carried
    // outcome is keyed to the Field it was produced for so a genuine later
    // Field change still clears it.
    const carried = carriedOutcome.current;
    carriedOutcome.current = null;
    setOutcome(carried?.fieldProfileId === fieldProfileId ? carried.outcome : null);
    setInsertCounts(new Map());
    setRepeatInsertNotice(null);
    setFieldAliasEdit(null);
    setFieldAliasDraft("");
  }, [fieldProfileId]);

  // A Field is either independent or shared for effective Template-list
  // purposes (Task 015 Accepted Contract) - at most one Shared Template Set
  // can list this Field, and while it does, its own dormant direct Bindings
  // must never appear in the Picker alongside the set's ordered list.
  const mySharedSet = useMemo(
    () => state?.sharedTemplateSets.find((set) => set.memberFieldProfileIds.includes(fieldProfileId)) ?? null,
    [state, fieldProfileId],
  );
  const currentSiteId =
    state?.pageProfiles.find((page) => page.id === pageProfileId)?.siteId ??
    contextSiteId ??
    mySharedSet?.siteId;
  // Task 024 Slice 3: every distinct Site among one Shared Template Set's
  // current members, used only to preview a Link's scope confirmation - the
  // Set's own `siteId` is just its anchor/display Site (see the repository's
  // own comment), not the full membership.
  function siteIdsForSharedSet(setId: string): Set<string> {
    const set = state?.sharedTemplateSets.find((candidate) => candidate.id === setId);
    const sites = new Set<string>();
    for (const memberId of set?.memberFieldProfileIds ?? []) {
      const field = state?.fieldProfiles.find((candidate) => candidate.id === memberId);
      const page = field ? state?.pageProfiles.find((candidate) => candidate.id === field.pageProfileId) : undefined;
      if (page) sites.add(page.siteId);
    }
    return sites;
  }
  // Task 026: the effective list resolves each Shared Template Set slot
  // against this Field's own Overrides/Exclusions - it is the single source
  // of truth for what this Field actually sees, never the Set's raw base
  // slots directly (which would ignore an Override entirely and still show
  // an excluded entry). Computed locally (mirroring the repository's own
  // `effectiveTemplateListForField`) rather than importing that module as a
  // value here, which would pull its entire dependency graph into the
  // content-script bundle for a handful of lines of pure logic.
  // Task 027 Addendum A (A.2, defect D): collapsed into at most one entry
  // per distinct visible Template - a Set may coexist an ordinary slot and
  // an owner-only slot for the same Template (A.1), and the old per-slot
  // list let the Field resolve the same Template twice, with
  // `slotIdForTemplateId` picking whichever slot happened to be last in
  // iteration order. The primary relation (lowest slot `order`) drives every
  // row action; `isFieldOnly` is `true` only when every contributing
  // relation is an owner-only slot this Field owns.
  const effectiveEntries = useMemo(() => {
    if (!state) return [];
    if (mySharedSet) {
      const slots = state.sharedTemplateBindings
        .filter((binding) => binding.setId === mySharedSet.id)
        .sort((a, b) => a.order - b.order);
      interface Contribution {
        templateId: string;
        order: number;
        slotId: string;
        isOverride: boolean;
        isFieldOnly: boolean;
        fieldOnlySlotId: string | null;
      }
      const contributions: Contribution[] = [];
      for (const slot of slots) {
        // Task 027 Confirmed Contract: a Field-only slot's owner-only policy
        // applies before any Override/Exclusion resolution - a non-owner
        // never sees it, full stop.
        if (slot.ownerFieldProfileId !== undefined && slot.ownerFieldProfileId !== fieldProfileId) continue;
        const isFieldOnlySlot = slot.ownerFieldProfileId === fieldProfileId;
        const fieldState = state.sharedTemplateFieldStates.find(
          (candidate) =>
            candidate.setId === mySharedSet.id && candidate.slotId === slot.id && candidate.fieldProfileId === fieldProfileId,
        );
        if (fieldState?.mode === "exclude") continue;
        if (fieldState?.mode === "override") {
          contributions.push({
            templateId: fieldState.templateId!,
            order: slot.order,
            slotId: slot.id,
            isOverride: true,
            isFieldOnly: false,
            fieldOnlySlotId: isFieldOnlySlot ? slot.id : null,
          });
          continue;
        }
        contributions.push({
          templateId: slot.templateId,
          order: slot.order,
          slotId: slot.id,
          isOverride: false,
          isFieldOnly: isFieldOnlySlot,
          fieldOnlySlotId: isFieldOnlySlot ? slot.id : null,
        });
      }
      const grouped = new Map<string, Contribution[]>();
      for (const contribution of contributions) {
        const group = grouped.get(contribution.templateId);
        if (group) group.push(contribution);
        else grouped.set(contribution.templateId, [contribution]);
      }
      return [...grouped.entries()].map(([templateId, group]) => {
        const sorted = [...group].sort((a, b) => a.order - b.order);
        const primary = sorted[0]!;
        return {
          templateId,
          slotId: primary.slotId,
          isOverride: primary.isOverride,
          isFieldOnly: sorted.every((contribution) => contribution.isFieldOnly),
          // The owner-only relation underneath this entry, if any - the only
          // valid target for `Share this version`. See the repository's own
          // `EffectiveTemplateListEntry.fieldOnlySlotId`.
          fieldOnlySlotId: sorted.find((contribution) => contribution.fieldOnlySlotId !== null)?.fieldOnlySlotId ?? null,
        };
      });
    }
    return state.bindings
      .filter((binding) => binding.fieldProfileId === fieldProfileId)
      .map((binding) => ({
        templateId: binding.templateId,
        slotId: null as string | null,
        isOverride: false,
        isFieldOnly: false,
        fieldOnlySlotId: null as string | null,
      }));
  }, [state, fieldProfileId, mySharedSet]);
  const boundTemplateIds = useMemo(() => effectiveEntries.map((entry) => entry.templateId), [effectiveEntries]);
  // Every row action reads its own collapsed entry - never a separately
  // computed Template-keyed map that could disagree with it about which
  // slot is primary (Task 027 Addendum A, defect D).
  const entryByTemplateId = useMemo(
    () => new Map(effectiveEntries.map((entry) => [entry.templateId, entry])),
    [effectiveEntries],
  );
  // Which of the current Field's own effective Templates have an owner-only
  // relation underneath them - the row offers `Share this version` for
  // exactly these. Not the same as `isFieldOnly`: a collapsed entry where an
  // ordinary slot also contributes still has a private relation the owner
  // must be able to reach, and the promotion is then the pure cleanup
  // collapse of Addendum A.3 mode 2.
  const fieldOnlyTemplateIds = useMemo(
    () =>
      new Set(
        effectiveEntries.filter((entry) => entry.fieldOnlySlotId !== null).map((entry) => entry.templateId),
      ),
    [effectiveEntries],
  );
  const currentFieldProfile = state?.fieldProfiles.find((field) => field.id === fieldProfileId);
  const fieldLabel =
    currentFieldProfile?.userAlias ||
    fieldObservedTitle ||
    targetField.getAttribute("aria-label") ||
    fieldName(targetField) ||
    targetField.getAttribute("placeholder") ||
    t.unnamedFieldLabel();
  const currentFieldTokens = new Set(normalizeFieldNameTokens(fieldLabel));
  // Live (this Picker just saw a refusal) or remembered (a previous visit did).
  const clipboardFallbackOffered = insertionRejected || (currentFieldProfile?.insertionRejected ?? false);
  // Every other reliably identified Field in this Site that is not already
  // in the Current Field's own Shared Template Set. A member of a different
  // Set remains selectable because the Task 024 Link flow can merge the Sets.
  // Merges two
  // sources: Fields with a durable Field Profile (from stored state), and
  // Fields the content script found live on this page that have never been
  // bound to anything and so have no durable Profile yet at all.
  const addFieldCandidates = useMemo(() => {
    if (!state) return [];
    const currentPage = state.pageProfiles.find((page) => page.id === pageProfileId);
    // The current Field's own Page may not be durable yet either (it may
    // never have been bound to anything) - contextSiteId is always
    // available regardless, since RESOLVE_FIELD_CONTEXT resolves one even
    // for a Field it has never seen before.
    // A cross-Site Set's `siteId` is only its anchor. Candidate locality must
    // follow the focused Field's actual Page, or a member on another Site
    // would incorrectly see the anchor Site's Fields instead of this page.
    const siteId = currentPage?.siteId ?? contextSiteId ?? mySharedSet?.siteId;
    if (!siteId) return [];
    const alreadyLinked = new Set(mySharedSet?.memberFieldProfileIds ?? []);
    // Every identityKey on the current page already represented by stored
    // state - whether as an independent candidate or a mergeable member of
    // another Set - so the live DOM scan below never re-offers
    // it as a bogus, seemingly-unbound duplicate.
    const representedIdentityKeysOnCurrentPage = new Set<string>();
    const durable: SharedFieldCandidate[] = [];
    for (const field of state.fieldProfiles) {
      const page = state.pageProfiles.find((candidate) => candidate.id === field.pageProfileId);
      if (page?.id === pageProfileId && field.identityKey !== undefined) {
        representedIdentityKeysOnCurrentPage.add(field.identityKey);
      }
      if (field.id === fieldProfileId || alreadyLinked.has(field.id)) continue;
      if (!page || page.siteId !== siteId) continue;
      const existingSet = state.sharedTemplateSets.find((set) =>
        set.memberFieldProfileIds.includes(field.id),
      );
      durable.push({
        key: field.id,
        durable: true,
        fieldProfileId: field.id,
        siteId: page.siteId,
        pageProfileId: page.id,
        existingSetId: existingSet?.id ?? null,
        existingSetMemberCount: existingSet?.memberFieldProfileIds.length ?? 0,
        label: field.userAlias ?? deriveFieldDisplayLabel(field.identityKey, field.observedTitle, t),
        pageLabel: page.userAlias ?? derivePageDisplayLabel(page.identityKey, t),
        onCurrentPage: page.id === pageProfileId,
        documentOrder: field.documentOrder ?? null,
        fieldIdentityKey: page.id === pageProfileId ? field.identityKey : undefined,
      });
    }
    const live: SharedFieldCandidate[] = pageFieldCandidates
      .filter((candidate) => !representedIdentityKeysOnCurrentPage.has(candidate.fieldIdentityKey))
      .map((candidate) => ({
        key: candidate.fieldIdentityKey,
        durable: false,
        fieldIdentityKey: candidate.fieldIdentityKey,
        observedTitle: candidate.observedTitle,
        label: deriveFieldDisplayLabel(candidate.fieldIdentityKey, candidate.observedTitle ?? undefined, t),
        pageLabel: currentPage
          ? currentPage.userAlias ?? derivePageDisplayLabel(currentPage.identityKey, t)
          : t.thisPageLabel(),
        // Found by scanning this page's own live DOM, so always on it.
        onCurrentPage: true,
        documentOrder: candidate.documentOrder,
      }));
    // In this page is a spatial orientation aid, so it always follows the
    // actual document order. Matching field names never reorder the page.
    return [...durable, ...live].sort((a, b) => {
      if (a.onCurrentPage !== b.onCurrentPage) return a.onCurrentPage ? -1 : 1;
      if (a.onCurrentPage && a.documentOrder !== b.documentOrder) {
        if (a.documentOrder === null) return 1;
        if (b.documentOrder === null) return -1;
        return a.documentOrder - b.documentOrder;
      }
      const byPage = a.pageLabel.localeCompare(b.pageLabel);
      return byPage !== 0 ? byPage : a.label.localeCompare(b.label);
    });
  }, [state, pageProfileId, fieldProfileId, mySharedSet, pageFieldCandidates, contextSiteId, t]);
  // "In this page" is the one place this Picker shows the current page's own
  // Fields - narrowed to onCurrentPage only (never the rest of the Site), so
  // there is exactly one surface for that, not two overlapping ones. Cross-
  // page and cross-Site discovery is Search's job alone (below).
  const onPageFieldCandidates = useMemo(
    () => addFieldCandidates.filter((candidate) => candidate.onCurrentPage),
    [addFieldCandidates],
  );
  const visibleAddFieldCandidates = useMemo(() => {
    if (showAllSharedCandidates) return onPageFieldCandidates;
    if (fieldDocumentOrder === null || fieldDocumentOrder === undefined) {
      return onPageFieldCandidates.slice(0, VISIBLE_SHARED_FIELD_CANDIDATES - 1);
    }
    return onPageFieldCandidates
      .filter((candidate) => candidate.documentOrder === null || candidate.documentOrder > fieldDocumentOrder)
      .slice(0, VISIBLE_SHARED_FIELD_CANDIDATES - 1);
  }, [fieldDocumentOrder, onPageFieldCandidates, showAllSharedCandidates]);
  const beforeCurrentFieldCandidateCount = useMemo(
    () => fieldDocumentOrder === null || fieldDocumentOrder === undefined
      ? 0
      : onPageFieldCandidates.filter((candidate) => candidate.documentOrder !== null && candidate.documentOrder < fieldDocumentOrder).length,
    [fieldDocumentOrder, onPageFieldCandidates],
  );
  const hiddenAddFieldCandidateCount = onPageFieldCandidates.length - visibleAddFieldCandidates.length;
  const onPageCandidateTemplates = useMemo(() => {
    const templatesById = new Map(state?.templates.map((template) => [template.id, template] as const) ?? []);
    const result = new Map<string, TemplateRecord[]>();
    for (const candidate of onPageFieldCandidates) {
      if (!candidate.durable) {
        result.set(candidate.key, []);
        continue;
      }
      const sharedSet = state?.sharedTemplateSets.find((set) =>
        set.memberFieldProfileIds.includes(candidate.fieldProfileId),
      );
      const visibleTemplateIds = sharedSet
        ? (state?.sharedTemplateBindings ?? [])
            .filter((slot) => slot.setId === sharedSet.id)
            .filter((slot) => slot.ownerFieldProfileId === undefined || slot.ownerFieldProfileId === fieldProfileId)
            .sort((left, right) => left.order - right.order)
            .map((slot) => {
              if (slot.ownerFieldProfileId !== fieldProfileId) return slot.templateId;
              const ownerState = state?.sharedTemplateFieldStates.find(
                (entry) => entry.setId === sharedSet.id && entry.slotId === slot.id && entry.fieldProfileId === fieldProfileId,
              );
              return ownerState?.mode === "exclude" ? null : ownerState?.templateId ?? slot.templateId;
            })
            .filter((templateId): templateId is string => templateId !== null)
        : (state?.bindings ?? [])
            .filter((binding) => binding.fieldProfileId === candidate.fieldProfileId)
            .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
            .map((binding) => binding.templateId);
      const templates = visibleTemplateIds
        .map((templateId) => templatesById.get(templateId))
        .filter((template): template is TemplateRecord => template !== undefined);
      result.set(candidate.key, templates);
    }
    return result;
  }, [state, onPageFieldCandidates, fieldProfileId]);
  const findSimilarNormalizedQuery = findSimilarQuery.trim().toLocaleLowerCase();
  // Task 027 Addendum C.3: the current page's own Fields stay reachable while
  // a Search query is present. `findSimilarFieldCandidates` skips any Field
  // with an empty effective Template list (Task 024's accepted discovery
  // rule), so a Field on this page that has no Templates yet is reachable
  // through "In this page" alone - and that section used to disappear the
  // moment the user typed its name. Filtering it by the query keeps Task 024's
  // rule intact: Search still discovers no empty Field on another page.
  const onPageSearchMatches = useMemo(() => {
    if (findSimilarNormalizedQuery.length === 0) return [];
    return onPageFieldCandidates.filter((candidate) =>
      candidate.label.toLocaleLowerCase().includes(findSimilarNormalizedQuery),
    );
  }, [findSimilarNormalizedQuery, onPageFieldCandidates]);
  const findSimilarCandidates = useMemo(
    () => localizeCandidateLabels(findSimilarResult?.candidates ?? NO_FIND_SIMILAR_CANDIDATES, state, t),
    [findSimilarResult, state, t],
  );
  // Cross-page/cross-Site results only ever appear once the user explicitly
  // searches - "In this page" above is the only thing shown by default, and
  // it disappears the moment a Search is typed. Matches are sorted by the
  // repository's own deterministic compatibility evidence, with a display-
  // only boost for a Field whose own label shares a word with the Current
  // Field's (the same presentation aid "In this page" already uses) - it
  // reorders, it never hides a match. Explicit Search is never capped.
  const findSimilarSearchResults =
    findSimilarNormalizedQuery.length === 0
      ? []
      : findSimilarCandidates
          // A Field already sharing this one's Templates has nothing left
          // for Search to offer - it is the same relationship already, not
          // a new one to create.
          .filter((candidate) => !candidate.alreadyLinked)
          .filter((candidate) => {
            const haystack = [candidate.fieldLabel, candidate.pageLabel, candidate.siteLabel, ...candidate.templatePreviews]
              .join(" ")
              .toLocaleLowerCase();
            return haystack.includes(findSimilarNormalizedQuery);
          })
          .sort((a, b) => {
            const aMatches = normalizeFieldNameTokens(a.fieldLabel).some((token) => currentFieldTokens.has(token));
            const bMatches = normalizeFieldNameTokens(b.fieldLabel).some((token) => currentFieldTokens.has(token));
            return aMatches === bMatches ? 0 : aMatches ? -1 : 1;
          });
  // Task 027 Addendum B: the candidate pool for choosing a `Join Set &
  // Share`/`Merge Sets & Share` target - the same Finder candidates, minus
  // any already `alreadyLinked` (that Field already receives this Template
  // once it is shared in-place; a composite Set change is neither needed nor
  // meaningful for it). Shown without requiring a typed Search first, unlike
  // the ordinary Finder, since this is a deliberate two-choice action.
  const shareTargetResults = useMemo(() => {
    if (!shareTargetContext) return [];
    const pool = findSimilarCandidates.filter((candidate) => !candidate.alreadyLinked);
    if (findSimilarNormalizedQuery.length === 0) return pool;
    return pool.filter((candidate) => {
      const haystack = [candidate.fieldLabel, candidate.pageLabel, candidate.siteLabel, ...candidate.templatePreviews]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(findSimilarNormalizedQuery);
    });
  }, [shareTargetContext, findSimilarCandidates, findSimilarNormalizedQuery]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  // Task 003 field-local ordering, repaired 2026-09-07. This list used to be
  // sorted by the *Template's* total usage across every Field, which ignored
  // both halves of the contract: the automatic rule ranks by this Field's own
  // Binding usage, and a Field the user has reordered keeps the order they
  // saved. A drag in the Side Panel was therefore invisible here.
  const templatesById = useMemo(
    () => new Map((state?.templates ?? []).map((template) => [template.id, template] as const)),
    [state],
  );
  // This Field's own usage of each Template - a Binding's count when the Field
  // has its own, a Slot's when the Field resolves through a Shared Template
  // Set. Task 003's automatic rule ranks by this, never by the Template's
  // total across every Field.
  const fieldUsageByTemplateId = useMemo(() => {
    const usage = new Map<string, number>();
    if (!state) return usage;
    const add = (templateId: string, count: number) =>
      usage.set(templateId, (usage.get(templateId) ?? 0) + count);
    if (mySharedSet) {
      for (const slot of state.sharedTemplateBindings) {
        if (slot.setId === mySharedSet.id) add(slot.templateId, slot.usageCount);
      }
      for (const fieldState of state.sharedTemplateFieldStates) {
        if (
          fieldState.mode === "override" &&
          fieldState.fieldProfileId === fieldProfileId &&
          fieldState.templateId
        ) {
          add(fieldState.templateId, fieldState.usageCount ?? 0);
        }
      }
      return usage;
    }
    for (const binding of state.bindings) {
      if (binding.fieldProfileId === fieldProfileId) add(binding.templateId, binding.usageCount);
    }
    return usage;
  }, [state, mySharedSet, fieldProfileId]);
  const boundTemplates = orderFieldTemplateEntries(
    effectiveEntries.map((entry) => ({
      ...entry,
      usageCount: fieldUsageByTemplateId.get(entry.templateId) ?? 0,
    })),
    (templateId) => templatesById.get(templateId)?.content,
  )
    .flatMap((entry) => {
      const template = templatesById.get(entry.templateId);
      return template ? [template] : [];
    })
    .filter(
      (template) =>
        normalizedQuery.length === 0 || template.content.toLocaleLowerCase().includes(normalizedQuery),
    );
  // The Templates Confirm would reuse on this Field: the canonical Page's
  // Field with the exact same identity key this Field already has - the same
  // exact-match rule confirmLogicalPageCandidate itself applies server-side,
  // computed here only to preview it before the user decides.
  const candidatePreviewTemplates = useMemo(() => {
    if (!logicalPageCandidate || !state || !fieldIdentityKey) return [];
    const canonicalField = state.fieldProfiles.find(
      (field) =>
        field.pageProfileId === logicalPageCandidate.canonicalPageProfileId &&
        field.identityKey === fieldIdentityKey,
    );
    if (!canonicalField) return [];
    const canonicalTemplateIds = state.bindings
      .filter((binding) => binding.fieldProfileId === canonicalField.id)
      .map((binding) => binding.templateId);
    return state.templates.filter((template) => canonicalTemplateIds.includes(template.id));
  }, [logicalPageCandidate, state, fieldIdentityKey]);

  const templateEditScope: TemplateEditScope = useMemo(
    () => (editing && state ? resolveTemplateEditScope(state, editing, fieldProfileId) : "single"),
    [editing, fieldProfileId, state],
  );
  // Deliberate Search is the only cross-library discovery path in V1. It is
  // literal body search across the local Template Library; no pre-query
  // recommendation or field-kind prediction is performed.
  const searchResults = useMemo(() => (state
    ? [...searchTemplates(
        state.templates.filter((template) => {
          const direct = state.bindings.some((binding) => binding.templateId === template.id);
          const ordinary = state.sharedTemplateBindings.some(
            (slot) => slot.templateId === template.id && slot.ownerFieldProfileId === undefined,
          );
          const ownedSlot = state.sharedTemplateBindings.some(
            (slot) => slot.templateId === template.id && slot.ownerFieldProfileId === fieldProfileId,
          );
          const ownedOverride = state.sharedTemplateFieldStates.some(
            (fieldState) => fieldState.mode === "override" && fieldState.templateId === template.id &&
              fieldState.fieldProfileId === fieldProfileId,
          );
          const hasAnyRelation = direct || state.sharedTemplateBindings.some((slot) => slot.templateId === template.id) ||
            state.sharedTemplateFieldStates.some((fieldState) => fieldState.mode === "override" && fieldState.templateId === template.id);
          return !hasAnyRelation || direct || ordinary || ownedSlot || ownedOverride;
        }),
        query,
        boundTemplateIds,
      )].sort(DEFAULT_TEMPLATE_ORDER)
    : []), [state, query, boundTemplateIds, fieldProfileId]);
  const siteBadges = useMemo(() => {
    const badges = new Map<string, SiteAffinityBadge>();
    if (!state) return badges;
    for (const template of searchResults) {
      const badge = computeSiteAffinityBadge(template, state.bindings, state.pageProfiles);
      if (badge) badges.set(template.id, badge);
    }
    return badges;
  }, [searchResults, state]);
  const activeList = useMemo(
    () => [
      ...boundTemplates,
      ...searchResults,
    ],
    [boundTemplates, searchResults],
  );

  // Reconciles the highlight when the list changes, and only then. The current
  // highlight is read through the setter rather than from the closure, so this
  // needs no dependency on it - depending on `highlightedId` would re-run the
  // reconciliation on every arrow key, which is not what it is for.
  //
  // Task 036 Addendum J, restoring Task 003's contract: nothing is selected
  // until the user selects it - "the first ArrowDown from Search selects the
  // first visible Template row". A default highlight on the first row showed a
  // Template as selected while Search held the focus, and sent that first
  // ArrowDown to the second row.
  useEffect(() => {
    setHighlightedId((current) =>
      activeList.some((template) => template.id === current) ? current : null,
    );
  }, [activeList]);

  // Task 024 Addendum C: fetch the automatic offer once, while the Picker is
  // open and the Field is usable. Not on focus - a query per focused Field
  // would be work nobody asked for.
  useEffect(() => {
    if (!state || !targetFieldActionable || !bindingSupported) return;
    if (linkOffer !== null || linkOfferDismissed) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await sendRequest({
          type: "FIND_SIMILAR_FIELD_CANDIDATES",
          fieldProfileId,
          newField: {
            pageUrl: location.href,
            pageProfileId,
            fieldProfileId,
            ...(pageIdentityKey ? { pageIdentityKey } : {}),
            ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
            ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
            ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
          },
        });
        if (cancelled || !response.ok || !isFindSimilarFieldCandidatesResult(response.value)) return;
        setLinkOffer(response.value);
      } catch {
        // An offer nobody asked for must never surface an error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    state,
    targetFieldActionable,
    bindingSupported,
    fieldProfileId,
    linkOffer,
    linkOfferDismissed,
    pageProfileId,
    pageIdentityKey,
    fieldIdentityKey,
    fieldDocumentOrder,
    fieldObservedTitle,
  ]);

  // Owner QA 2026-09-11: the flyout is for text the row does not show. A row
  // shows only the first non-empty line, clamped to one or two lines, so a
  // Template needs it when it has more lines than that one, or when the clamp
  // cut its line short - measured, since that depends on the width. It used
  // to open only past 120 characters, which left everything shorter unread.
  // Owner QA 2026-09-14: never while editing, where it lay over the editor.
  const flyoutCandidate =
    editing === null ? activeList.find((template) => template.id === (flyoutHoldId ?? highlightedId)) ?? null : null;
  const [clampedPreviewId, setClampedPreviewId] = useState<string | null>(null);
  const flyoutCandidateId = flyoutCandidate?.id ?? null;
  const flyoutCandidateContent = flyoutCandidate?.content;
  useLayoutEffect(() => {
    if (flyoutCandidateId === null) return;
    const preview = [...(pickerRef.current?.querySelectorAll<HTMLElement>("[data-template-row]") ?? [])]
      .find((row) => row.dataset.templateId === flyoutCandidateId)
      ?.querySelector<HTMLElement>(".template-preview");
    const clamped = preview !== undefined && preview !== null &&
      (preview.scrollHeight > preview.clientHeight + 1 || preview.scrollWidth > preview.clientWidth + 1);
    setClampedPreviewId(clamped ? flyoutCandidateId : null);
  }, [flyoutCandidateId, flyoutCandidateContent]);
  const previewTemplate =
    flyoutCandidate &&
    (derivePreview(flyoutCandidate.content) !== flyoutCandidate.content.trim() || clampedPreviewId === flyoutCandidate.id)
      ? flyoutCandidate
      : null;

  function cancelFlyoutLinger(): void {
    if (flyoutLingerTimer.current !== null) clearTimeout(flyoutLingerTimer.current);
    flyoutLingerTimer.current = null;
  }

  function highlightRow(id: string | null): void {
    cancelFlyoutLinger();
    setFlyoutHoldId(null);
    setHighlightedId(id);
  }

  function lingerFlyout(leavingId: string | null): void {
    if (leavingId === null) return;
    cancelFlyoutLinger();
    setFlyoutHoldId(leavingId);
    flyoutLingerTimer.current = setTimeout(() => {
      flyoutLingerTimer.current = null;
      setFlyoutHoldId(null);
    }, FLYOUT_LINGER_MS);
  }

  useEffect(() => cancelFlyoutLinger, []);

  // Owner QA 2026-09-11: the flyout sits level with the row it belongs to,
  // beside the Picker, so the pointer reaches it by moving straight across.
  // It used to sit level with the Picker's top, and a lower row meant moving
  // up as well. It is never taller than the Picker, and its top and bottom
  // stay within the Picker's: a tall one beside a low row moves up only as
  // far as its measured height needs.
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const placeFlyoutRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const picker = pickerRef.current;
    if (mode !== "list" || !previewTemplate || !picker) {
      placeFlyoutRef.current = () => undefined;
      setFlyoutPosition(null);
      return;
    }
    const templateId = previewTemplate.id;
    function place(): void {
      if (!picker) return;
      const rect = picker.getBoundingClientRect();
      const row = [...picker.querySelectorAll<HTMLElement>("[data-template-row]")]
        .find((candidate) => candidate.dataset.templateId === templateId);
      const fitsRight = rect.right + FLYOUT_GAP + FLYOUT_WIDTH <= window.innerWidth - VIEWPORT_MARGIN;
      const fitsLeft = rect.left - FLYOUT_GAP - FLYOUT_WIDTH >= VIEWPORT_MARGIN;
      const left = fitsRight
        ? rect.right + FLYOUT_GAP
        : fitsLeft
          ? rect.left - FLYOUT_GAP - FLYOUT_WIDTH
          : Math.max(
              VIEWPORT_MARGIN,
              Math.min(rect.left, window.innerWidth - FLYOUT_WIDTH - VIEWPORT_MARGIN),
            );
      const upper = Math.max(VIEWPORT_MARGIN, rect.top);
      const lower = Math.min(window.innerHeight - VIEWPORT_MARGIN, rect.bottom);
      const maxHeight = Math.max(0, Math.min(FLYOUT_MAX_HEIGHT, lower - upper));
      const height = Math.min(maxHeight, flyoutRef.current?.getBoundingClientRect().height ?? 0);
      const rowTop = row?.getBoundingClientRect().top ?? upper;
      const top = Math.max(upper, Math.min(rowTop, lower - height));
      // Owner QA 2026-09-14: a window too narrow for either side leaves the
      // flyout lying over the Picker, which then stays half visible through it.
      const coversPicker = !fitsRight && !fitsLeft;
      setFlyoutPosition((current) =>
        current?.top === top && current.left === left && current.maxHeight === maxHeight &&
        current.coversPicker === coversPicker
          ? current
          : { top, left, maxHeight, coversPicker },
      );
    }
    placeFlyoutRef.current = place;
    place();
    // Scrolling the list moves the row out from beside the flyout.
    picker.addEventListener("scroll", place, true);
    return () => picker.removeEventListener("scroll", place, true);
  }, [mode, previewTemplate, pinned, pickerPosition]);

  // Placed before its height is known, the flyout is placed again once it
  // is rendered, so its bottom stays within the Picker's.
  useLayoutEffect(() => {
    if (flyoutRef.current && flyoutPosition) placeFlyoutRef.current();
  }, [flyoutPosition, previewTemplate?.id]);

  // Task 036 Addendum J. The highlight follows the focus: a row is
  // highlighted while focus is anywhere inside it, and nothing is while focus
  // is on Search or any other control. With pointer movement as the only
  // other thing that sets it, there is never more than one highlighted row.
  function followFocus(event: FocusEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLElement>("[data-template-row]");
    setHighlightedId(row?.dataset.templateId ?? null);
  }

  // Task 036 Addendum J. Editing works like composing: Search and the
  // New template action step aside, the editor takes the focus, and Search
  // gets it back when the edit ends.
  const editingId = editing?.id ?? null;
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editingId) {
      wasEditing.current = true;
      pickerRef.current?.querySelector<HTMLTextAreaElement>(".picker-writing textarea")?.focus();
    } else if (wasEditing.current) {
      wasEditing.current = false;
      // Only when the edit took the focus with it - Save and Cancel remove
      // the control that had it. An edit ended by the user moving elsewhere
      // (another Field, a rename) leaves the focus where they put it.
      if (mode === "list" && focusIsLost()) searchInputRef.current?.focus();
    }
  }, [editingId, mode]);

  function focusIsLost(): boolean {
    const root = pickerRef.current?.getRootNode();
    if (root instanceof ShadowRoot) {
      return (
        root.activeElement === null &&
        (document.activeElement === document.body || document.activeElement === root.host)
      );
    }
    return document.activeElement === null || document.activeElement === document.body;
  }

  // Task 024 Confirmed Contract: "Search has keyboard focus on open."
  useEffect(() => {
    if (mode === "find-similar-field") findSimilarSearchRef.current?.focus();
  }, [mode]);

  // Real keyboard focus moves onto the highlighted row's own template button,
  // which is also what announces the row to assistive technology, so a Tab
  // continues from that row into its own actions (Edit/Bind/Unbind/Delete)
  // instead of jumping back to Search or the first row.
  function focusTemplateRow(templateId: string): void {
    const button = pickerRef.current?.querySelector<HTMLElement>(
      `#template-row-${CSS.escape(templateId)} [data-template-content]`,
    );
    button?.focus();
  }

  function focusHighlight(template: TemplateRecord): void {
    setHighlightedId(template.id);
    focusTemplateRow(template.id);
  }

  // Advances from the row that has focus by `delta` and moves real focus with
  // it. Task 036 Addendum J: counted from focus, not from the highlight, which
  // a moving pointer may have taken to another row.
  function moveHighlight(from: EventTarget | null, delta: 1 | -1): void {
    if (activeList.length === 0) return;
    const currentIndex = rowIndexOf(from);
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), activeList.length - 1);
    const next = activeList[nextIndex];
    if (next) focusHighlight(next);
  }

  function rowIndexOf(target: EventTarget | null): number {
    const row = target instanceof Element ? target.closest<HTMLElement>("[data-template-row]") : null;
    return activeList.findIndex((template) => template.id === row?.dataset.templateId);
  }

  // Keep Open keeps the Picker mounted across inserts, so a template the
  // user clicked once already stays one click away - an accidental double
  // click (or a second look that doesn't register as "already done") can
  // silently duplicate long content without the user noticing. Track how
  // many times each Template has gone into this specific field this
  // session (reset whenever the field changes) and surface it clearly
  // rather than guessing at the user's intent or blocking the insert.
  function handleInsert(template: TemplateRecord): void {
    if (!targetFieldActionable) return;
    cancelFieldAliasEdit();
    setInsertCounts((current) => {
      const next = new Map(current);
      const count = (next.get(template.id) ?? 0) + 1;
      next.set(template.id, count);
      if (count >= 2) {
        setRepeatInsertNotice({ name: derivePreview(template.content), count });
      }
      return next;
    });
    onInsert(template);
  }

  // Bound to the whole Picker section, not just the search input. Up/Down
  // form one combined roving list of Search plus every Template row: moving
  // onto a row sends real keyboard focus there (not just a visual highlight)
  // so a following Tab continues into that row's own actions
  // (Edit/Bind/Unbind/Delete), and Up from the first row returns focus to
  // Search. Arrow keys are only intercepted while focus is on Search or on a
  // row's own template button - left alone anywhere else (e.g. an action
  // button already reached via Tab) so they never fight that button's own
  // native behaviour or an unrelated focused control elsewhere in the page.
  // Enter still only inserts when focus is genuinely on the search box; a
  // focused row's own template button already inserts on its own native
  // Enter activation.
  function handlePickerKeyDown(event: KeyboardEvent): void {
    // IME composition (e.g. CJK input) must never be intercepted as row
    // navigation or trigger an insertion; some browsers still report the
    // confirming keydown as keyCode 229 even once isComposing has cleared.
    if (event.isComposing || (event as unknown as { keyCode?: number }).keyCode === 229) return;
    if (mode !== "list" || editing) return;
    if (event.target instanceof HTMLTextAreaElement) return;
    const targetIsSearch = event.target === searchInputRef.current;
    const targetIsTemplateRow =
      event.target instanceof HTMLElement && event.target.hasAttribute("data-template-content");
    if (event.key === "ArrowDown") {
      if (!targetIsSearch && !targetIsTemplateRow) return;
      event.preventDefault();
      const first = activeList[0];
      if (targetIsSearch && first) focusHighlight(first);
      else moveHighlight(event.target, 1);
    } else if (event.key === "ArrowUp") {
      if (!targetIsSearch && !targetIsTemplateRow) return;
      event.preventDefault();
      const currentIndex = rowIndexOf(event.target);
      if (targetIsTemplateRow && currentIndex <= 0) {
        // Already at the first row: complete the combined Search+Templates
        // roving list by returning real focus to Search.
        searchInputRef.current?.focus();
      } else if (targetIsTemplateRow) {
        moveHighlight(event.target, -1);
      }
      // From Search, Up is already at the top of the roving list - a no-op.
    } else if (
      event.key === "Enter" &&
      event.target === searchInputRef.current &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      // Task 036 Addendum J, the owner's decision: with nothing selected,
      // Enter in Search inserts the first Template - type a filter, press
      // Enter - even though no row is shown as selected beforehand.
      const chosen = activeList.find((template) => template.id === highlightedId) ?? activeList[0];
      if (chosen) {
        event.preventDefault();
        handleInsert(chosen);
      }
    }
  }

  function showError(reason: unknown): void {
    setError(reason instanceof Error ? reason.message : t.actionFailed());
  }

  async function refreshState(): Promise<void> {
    setState(await readState());
  }

  function beginFieldAliasEdit(edit: FieldAliasEdit): void {
    setFieldAliasEdit(edit);
    // Task 023 Addendum B5 (3): renaming edits the name the Field is showing,
    // so the box opens on it. `currentAlias` is undefined until the Field has
    // been renamed once, which used to leave the box empty under a Field that
    // visibly had a name.
    setFieldAliasDraft(edit.currentAlias ?? edit.displayLabel);
    setEditing(null);
    setEditDraft("");
  }

  async function saveFieldAlias(alias = fieldAliasDraft): Promise<void> {
    if (!fieldAliasEdit || fieldAliasBusy) return;
    const savedAlias = alias.trim();
    // Unchanged from what the editor was seeded with is a cancel, not a save:
    // the seed can now be the derived label, and storing that as a user alias
    // would only restate it.
    if (savedAlias === (fieldAliasEdit.currentAlias ?? fieldAliasEdit.displayLabel).trim()) {
      cancelFieldAliasEdit();
      return;
    }
    setFieldAliasBusy(true);
    try {
      clearNotices();
      const response = await sendRequest({
        type: "SET_FIELD_ALIAS",
        fieldProfileId: fieldAliasEdit.fieldProfileId,
        alias,
        ...(fieldAliasEdit.newField ? { newField: fieldAliasEdit.newField } : {}),
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setOutcome({
        tone: "success",
        message: savedAlias.length > 0
          ? t.namedThisField(savedAlias)
          : t.restoredFieldName(fieldAliasEdit.displayLabel),
      });
      setFieldAliasEdit(null);
      setFieldAliasDraft("");
    } catch (reason) {
      showError(reason);
    } finally {
      setFieldAliasBusy(false);
    }
  }

  function cancelFieldAliasEdit(): void {
    setFieldAliasEdit(null);
    setFieldAliasDraft("");
  }

  function currentFieldAliasTarget(): FieldAliasEdit {
    return {
      key: `current:${fieldProfileId}`,
      fieldProfileId,
      displayLabel: fieldLabel,
      currentAlias: currentFieldProfile?.userAlias,
      ...(!currentFieldProfile
        ? {
            newField: {
              pageUrl: location.href,
              pageProfileId,
              fieldProfileId,
              ...(pageIdentityKey ? { pageIdentityKey } : {}),
              ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
              ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined
                ? { fieldDocumentOrder }
                : {}),
              ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
            },
          }
        : {}),
    };
  }

  async function createTemplate(privateToField?: true): Promise<void> {
    if (!isTemplateContentWithinLimit(draft) || draft.length === 0 || !targetFieldActionable) return;
    try {
      if (mySharedSet) {
        const response = await sendRequest({
          type: "CREATE_TEMPLATE_AND_BIND_SHARED",
          setId: mySharedSet.id,
          content: draft,
        });
        if (!response.ok || !isCreatedSharedTemplateBinding(response.value)) {
          throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
        }
        await refreshState();
        setDraft("");
        setMode("list");
        setOutcome({
          tone: "success",
          message: t.savedAndBoundToSet(mySharedSet.memberFieldProfileIds.length),
        });
        onLastActionChange({
          type: "create-bind-shared",
          setId: mySharedSet.id,
          template: response.value.template,
          sharedBindingId: response.value.sharedBinding.id,
        });
        return;
      }
      const response = await sendRequest({
        type: "CREATE_TEMPLATE_AND_BIND",
        content: draft,
        pageUrl: location.href,
        pageProfileId,
        fieldProfileId,
        ...(pageIdentityKey ? { pageIdentityKey } : {}),
        ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
        ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
        ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
        // Task 027 Addendum D: only ever set from the explicit private
        // choice, never by default.
        ...(privateToField ? { privateToField } : {}),
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setDraft("");
      setMode("list");
      setOutcome({
        tone: "success",
        message: privateToField
          ? t.savedFieldOnlyStaysPrivate()
          : t.savedAndBound(),
      });
    } catch (reason) {
      showError(reason);
    }
  }

  /**
   * "Save only for this field" (Task 026, revised under Task 027): a new
   * Template created from a Shared Template Set member is a Field-only
   * relationship owned exclusively by that Field - no other current or
   * future member ever resolves its slot - rather than shared with the
   * whole Set by default.
   */
  async function createTemplateFieldOnly(): Promise<void> {
    if (!isTemplateContentWithinLimit(draft) || draft.length === 0 || !targetFieldActionable || !mySharedSet) return;
    try {
      const response = await sendRequest({
        type: "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY",
        setId: mySharedSet.id,
        fieldProfileId,
        content: draft,
      });
      if (!response.ok || !isCreateTemplateAndBindSharedFieldOnlyResult(response.value)) {
        throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
      }
      await refreshState();
      setDraft("");
      setMode("list");
      setOutcome({ tone: "success", message: t.savedForThisFieldOnly() });
      onLastActionChange({
        type: "create-bind-shared-field-only",
        setId: mySharedSet.id,
        template: response.value.template,
        sharedBindingId: response.value.sharedBinding.id,
      });
    } catch (reason) {
      showError(reason);
    }
  }

  function clearNotices(): void {
    setOutcome(null);
    setRepeatInsertNotice(null);
    // An error had no way to clear itself before this: nothing else ever
    // reset it, so one failed action left a stale alert stacked above every
    // later result until the Picker was destroyed.
    setError("");
  }

  async function bind(template: TemplateRecord): Promise<void> {
    if (!targetFieldActionable) return;
    if (mySharedSet) {
      clearNotices();
      setPendingSharedBind(template);
      return;
    }
    await executeBind(template);
  }

  async function executeBind(template: TemplateRecord): Promise<void> {
    if (!targetFieldActionable) return;
    try {
      clearNotices();
      if (mySharedSet) {
        setSharedActionBusy(true);
        const existingSharedBinding = state?.sharedTemplateBindings.find(
          (slot) => slot.setId === mySharedSet.id && slot.templateId === template.id && slot.ownerFieldProfileId === undefined,
        );
        const previousState = existingSharedBinding
          ? state?.sharedTemplateFieldStates.find(
              (entry) => entry.setId === mySharedSet.id && entry.slotId === existingSharedBinding.id && entry.fieldProfileId === fieldProfileId,
            )
          : undefined;
        const response = await sendRequest({
          type: "BIND_TEMPLATE_SHARED",
          setId: mySharedSet.id,
          templateId: template.id,
          fieldProfileId,
        });
        if (!response.ok || !isSharedTemplateBindingRecord(response.value)) {
          throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
        }
        await refreshState();
        setPendingSharedBind(null);
        setOutcome({
          tone: "success",
          message: t.boundToSet(deriveOutcomePreview(template.content), mySharedSet.memberFieldProfileIds.length),
        });
        if (!existingSharedBinding) {
          onLastActionChange({
            type: "bind-shared",
            setId: mySharedSet.id,
            template,
            sharedBindingId: response.value.id,
            created: true,
          });
        } else if (previousState) {
          onLastActionChange({
            type: "bind-shared",
            setId: mySharedSet.id,
            template,
            sharedBindingId: response.value.id,
            previousState,
            created: false,
          });
        }
        return;
      }
      const response = await sendRequest({
        type: "BIND_TEMPLATE",
        templateId: template.id,
        pageUrl: location.href,
        pageProfileId,
        fieldProfileId,
        ...(pageIdentityKey ? { pageIdentityKey } : {}),
        ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
        ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
        ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setOutcome({ tone: "success", message: t.boundToThisField(deriveOutcomePreview(template.content)) });
      if (isBindingRecord(response.value)) {
        onLastActionChange({ type: "bind", template, bindingId: response.value.id });
      }
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  /**
   * "Bind to this field" (Task 027 Confirmed Contract): for a Shared Set
   * member's Search results, creates a Field-only relationship for an
   * existing Template found elsewhere - it never affects any other member,
   * unlike `bind()`'s "Bind to Shared Set" path.
   */
  async function bindToFieldOnly(template: TemplateRecord): Promise<void> {
    if (!targetFieldActionable || !mySharedSet) return;
    try {
      clearNotices();
      const existingOwnerSlot = state?.sharedTemplateBindings.find(
        (slot) => slot.setId === mySharedSet.id && slot.templateId === template.id && slot.ownerFieldProfileId === fieldProfileId,
      );
      const response = await sendRequest({
        type: "BIND_TEMPLATE_TO_FIELD_ONLY",
        setId: mySharedSet.id,
        fieldProfileId,
        templateId: template.id,
      });
      if (!response.ok || !isBindTemplateToFieldOnlyResult(response.value)) {
        throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
      }
      await refreshState();
      setOutcome({ tone: "success", message: t.boundToThisFieldOnly(deriveOutcomePreview(template.content)) });
      if (!existingOwnerSlot) {
        onLastActionChange({
          type: "bind-to-field-only",
          setId: mySharedSet.id,
          template,
          sharedBinding: response.value.sharedBinding,
        });
      }
    } catch (reason) {
      showError(reason);
    }
  }

  /**
   * "Share this version" (Task 027 Confirmed Contract): promotes a
   * Field-only relationship to a normal Shared Template Slot within the
   * owner's own current Set - every current member then resolves it
   * normally. It never affects an unrelated Set.
   */
  function requestShareThisVersion(template: TemplateRecord): void {
    if (!targetFieldActionable || !mySharedSet) return;
    // Always the owner-only relation's own slot, never the collapsed
    // entry's primary relation - in the mixed case the primary is the
    // ordinary slot, and promoting that is both meaningless and wrong.
    const slotId = entryByTemplateId.get(template.id)?.fieldOnlySlotId;
    if (!slotId) return;
    clearNotices();
    // Mode 2 (Addendum A.3) when the Set already shares this exact Template
    // through an ordinary slot - the same condition the repository itself
    // uses to decide, so the disclosure matches what will happen.
    const willMerge = (state?.sharedTemplateBindings ?? []).some(
      (candidate) =>
        candidate.setId === mySharedSet.id &&
        candidate.templateId === template.id &&
        candidate.ownerFieldProfileId === undefined,
    );
    setPendingShare({ template, slotId, willMerge });
  }

  async function shareThisVersion(template: TemplateRecord, slotId: string): Promise<void> {
    if (!targetFieldActionable || !mySharedSet) return;
    setPendingShare(null);
    try {
      clearNotices();
      const response = await sendRequest({
        type: "PROMOTE_FIELD_ONLY_SLOT",
        setId: mySharedSet.id,
        slotId,
        fieldProfileId,
      });
      if (!response.ok || !isPromoteFieldOnlySlotResult(response.value)) {
        throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
      }
      await refreshState();
      // Task 027 Addendum A.3: mode 2 consumed this Field-only slot into an
      // ordinary slot the Set already had for this Template - the
      // confirmation must say so, not describe it as an ordinary promotion.
      const consumed = response.value.consumedSlot !== undefined;
      setOutcome({
        tone: "success",
        message: consumed
          ? t.sharedWithWholeSetMerged(deriveOutcomePreview(template.content), mySharedSet.memberFieldProfileIds.length)
          : t.sharedWithWholeSetCount(deriveOutcomePreview(template.content), mySharedSet.memberFieldProfileIds.length),
      });
      onLastActionChange({
        type: "share-this-version",
        setId: mySharedSet.id,
        // Task 027 Addendum A.3: the slot the promotion actually left behind
        // - the surviving ordinary slot's id in mode 2, the same slot
        // otherwise - so Undo targets the right record.
        slotId: response.value.sharedBinding.id,
        template,
        previousOwnerFieldProfileId: response.value.previousOwnerFieldProfileId,
        consumedSlot: response.value.consumedSlot,
        previousOrdinarySlot: response.value.previousOrdinarySlot,
        removedFieldStates: response.value.removedFieldStates,
        previousSlot: response.value.previousSlot,
      });
    } catch (reason) {
      showError(reason);
    }
  }

  async function unbind(template: TemplateRecord): Promise<void> {
    if (!targetFieldActionable) return;
    try {
      clearNotices();
      if (mySharedSet) {
        // Task 026 Confirmed Contract: "Remove from this field" always
        // converts to an Exclusion for this Field alone - whether it
        // currently inherits the slot's base Template or has its own
        // Override - never a Set-wide removal affecting other members.
        const slotId = entryByTemplateId.get(template.id)?.slotId;
        if (!slotId) return;
        const previousState =
          state?.sharedTemplateFieldStates.find(
            (candidate) =>
              candidate.setId === mySharedSet.id && candidate.slotId === slotId && candidate.fieldProfileId === fieldProfileId,
          ) ?? null;
        const response = await sendRequest({
          type: "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
          setId: mySharedSet.id,
          slotId,
          fieldProfileId,
        });
        if (!response.ok) throw new Error(response.error);
        await refreshState();
        setOutcome({
          tone: "success",
          message: t.removedStillShared(deriveOutcomePreview(template.content)),
        });
        onLastActionChange({
          type: "exclude-shared-for-field",
          setId: mySharedSet.id,
          slotId,
          fieldProfileId,
          template,
          previousState,
        });
        return;
      }
      const binding = state?.bindings.find(
        (candidate) => candidate.templateId === template.id && candidate.fieldProfileId === fieldProfileId,
      );
      if (!binding) return;
      const remainingBindingCount = (state?.bindings.filter((candidate) => candidate.templateId === template.id).length ?? 1) - 1;
      const response = await sendRequest({
        type: "UNBIND_TEMPLATE",
        templateId: template.id,
        fieldProfileId,
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setOutcome(
        remainingBindingCount > 0
          ? {
              tone: "success",
              message: t.removedStillUsed(deriveOutcomePreview(template.content), remainingBindingCount),
            }
          : {
              tone: "warning",
              message: t.removedNowGlobal(deriveOutcomePreview(template.content)),
              template,
              showDelete: true,
            },
      );
      onLastActionChange({ type: "unbind", template, binding });
    } catch (reason) {
      showError(reason);
    }
  }

  // A candidate found live on the page (never bound to anything) has no
  // real Field Profile ID yet - fabricate one and pair it with the identity
  // data the repository needs to create it on demand, in the same commit as
  // the set change itself.
  function resolveOnPageCandidate(
    candidate: SharedFieldCandidate,
  ): { id: string; newField?: BindingTargetPayload } {
    if (candidate.durable) return { id: candidate.fieldProfileId };
    const id = crypto.randomUUID();
    return {
      id,
      newField: {
        pageUrl: location.href,
        pageProfileId,
        fieldProfileId: id,
        fieldIdentityKey: candidate.fieldIdentityKey,
        ...(pageIdentityKey ? { pageIdentityKey } : {}),
        ...(candidate.documentOrder !== null ? { fieldDocumentOrder: candidate.documentOrder } : {}),
        ...(candidate.observedTitle ? { fieldObservedTitle: candidate.observedTitle } : {}),
      },
    };
  }

  // One click shares immediately - the same instant, no-selection-step
  // interaction the Finder's own Search results use, so "In this page" and
  // cross-page discovery behave identically rather than two different flows.
  async function shareOnPageCandidate(candidate: SharedFieldCandidate): Promise<void> {
    if (sharedActionBusy || !targetFieldActionable) return;
    if (candidate.durable) {
      const templates = onPageCandidateTemplates.get(candidate.key) ?? [];
      requestLinkCandidate({
        fieldProfileId: candidate.fieldProfileId,
        siteId: candidate.siteId,
        pageProfileId: candidate.pageProfileId,
        siteLabel: candidate.siteId,
        pageLabel: candidate.pageLabel,
        fieldLabel: candidate.label,
        crossSite: candidate.siteId !== currentSiteId,
        highConfidence: false,
        decided: false,
        alreadyLinked: false,
        templateCount: templates.length,
        templatePreviews: templates.map((template) => derivePreview(template.content)),
        existingSetId: candidate.existingSetId,
        existingSetMemberCount: candidate.existingSetMemberCount,
      });
      return;
    }
    setSharedActionBusy(true);
    try {
      clearNotices();
      const resolved = resolveOnPageCandidate(candidate);

      if (mySharedSet) {
        const setId = mySharedSet.id;
        const response = await sendRequest({
          type: "ADD_SHARED_TEMPLATE_SET_MEMBER",
          setId,
          fieldProfileId: resolved.id,
          ...(resolved.newField ? { newField: resolved.newField } : {}),
        });
        if (!response.ok || !isAddSharedTemplateSetMemberResult(response.value)) {
          throw new Error(response.ok ? "Invalid add-member response" : response.error);
        }
        await refreshState();
        setOutcome({ tone: "success", message: t.startedSharingWith(candidate.label) });
        onLastActionChange({ type: "add-shared-member", setId, fieldProfileId: resolved.id, undo: response.value.undo });
      } else {
        const response = await sendRequest({
          type: "CREATE_SHARED_TEMPLATE_SET",
          fieldProfileIds: [fieldProfileId, resolved.id],
          // The current Field may never have been bound to anything either,
          // so it may have no durable Field Profile yet - "Two empty Fields
          // may create a Shared Template Set" (Task 015 Accepted Contract)
          // requires the repository be able to create it on demand.
          newFields: [
            {
              pageUrl: location.href,
              pageProfileId,
              fieldProfileId,
              ...(pageIdentityKey ? { pageIdentityKey } : {}),
              ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
              ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
              ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
            },
            ...(resolved.newField ? [resolved.newField] : []),
          ],
        });
        if (!response.ok || !isCreateSharedTemplateSetResult(response.value)) {
          throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
        }
        await refreshState();
        setOutcome({ tone: "success", message: t.startedSharingWith(candidate.label) });
        onLastActionChange({ type: "create-shared-set", setId: response.value.set.id });
      }
      setShowAllSharedCandidates(false);
      setShowFieldsBefore(false);
      setMode("list");
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  async function stopSharing(): Promise<void> {
    if (!mySharedSet || sharedActionBusy || !targetFieldActionable) return;
    const setSnapshot = mySharedSet;
    const endedSharedBindings =
      state?.sharedTemplateBindings.filter((binding) => binding.setId === setSnapshot.id) ?? [];
    setSharedActionBusy(true);
    try {
      clearNotices();
      const response = await sendRequest({
        type: "REMOVE_SHARED_TEMPLATE_SET_MEMBER",
        setId: setSnapshot.id,
        fieldProfileId,
      });
      if (!response.ok || !isRemoveSharedTemplateSetMemberResult(response.value)) {
        throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
      }
      await refreshState();
      setOutcome({
        tone: "success",
        message: t.stoppedSharingOwnAvailable(),
      });
      onLastActionChange({
        type: "stop-sharing",
        fieldProfileId,
        set: setSnapshot,
        endedSharedBindings,
        snapshotBindings: response.value.snapshotBindings,
        dormantBindings: response.value.dormantBindings,
        removedOwnedSlots: response.value.removedOwnedSlots,
        removedFieldStates: response.value.removedFieldStates,
      });
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  // Task 024 Confirmed Contract: "Find similar field" opens a Target Field
  // Picker that never inserts a Template - every result is a target Field.
  // Task 027 Addendum B: the same Finder, opened with a `shareContext`, is
  // also the entry point for choosing a `Join Set & Share`/`Merge Sets &
  // Share` target for one specific Field-only Template - see
  // `shareTargetContext` and `requestShareTarget`.
  async function openFindSimilarField(shareContext?: { template: TemplateRecord; slotId: string }): Promise<void> {
    cancelFieldAliasEdit();
    setPendingShare(null);
    setShareTargetContext(shareContext ?? null);
    setMode("find-similar-field");
    setFindSimilarQuery("");
    setFindSimilarResult(null);
    setExpandedOnPageCandidateTemplates(new Set());
    setFindSimilarLoading(true);
    setShowAllSharedCandidates(false);
    setShowFieldsBefore(false);
    try {
      const response = await sendRequest({
        type: "FIND_SIMILAR_FIELD_CANDIDATES",
        fieldProfileId,
        // The Current Field may never have been bound to anything, so it
        // may have no durable Field Profile yet - same on-demand identity
        // data every other Task 024/015 command already carries, evaluated
        // here without persisting it (Confirmed Contract: "An empty Current
        // Field may still open 'Find similar field'").
        newField: {
          pageUrl: location.href,
          pageProfileId,
          fieldProfileId,
          ...(pageIdentityKey ? { pageIdentityKey } : {}),
          ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
          ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
          ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
        },
      });
      if (!response.ok || !isFindSimilarFieldCandidatesResult(response.value)) {
        throw new Error(response.ok ? "Invalid Compatibility Candidate response" : response.error);
      }
      setFindSimilarResult(response.value);
    } catch (reason) {
      showError(reason);
      setMode("list");
      setShareTargetContext(null);
    } finally {
      setFindSimilarLoading(false);
    }
  }

  // Task 044: the header's Back goes up one level - out of a confirmation to
  // the Field list it came from, or out of the list to the Templates.
  function stepBackFromFindSimilarField(): void {
    if (pendingLink) setPendingLink(null);
    else if (pendingShareTarget) setPendingShareTarget(null);
    else closeFindSimilarField();
  }

  function closeFindSimilarField(): void {
    cancelFieldAliasEdit();
    setMode("list");
    setFindSimilarResult(null);
    setFindSimilarQuery("");
    setExpandedOnPageCandidateTemplates(new Set());
    setPendingLink(null);
    setShowAllSharedCandidates(false);
    setShowFieldsBefore(false);
    setShareTargetContext(null);
    setPendingShareTarget(null);
  }

  // Task 024 Confirmed Contract: "The visible action is Link templates...
  // only an action that joins or merges an existing multi-Field Shared
  // Template Set requires an additional scope confirmation." A brand new
  // 2-member Set (neither Field shared yet) never needs one; joining or
  // merging an existing Set always does, since every stored Set already has
  // 2+ members in practice (a 1-member Set auto-dissolves - Task 015).
  // A "No"-decided pair only ever suppresses the automatic Suggested slot
  // (Confirmed Contract: "these decisions do not train or change the
  // compatibility engine globally"; Search/Browse "must still be able to
  // surface a 'No'-decided Field on explicit user intent") - so `decided`
  // never blocks Linking here, and the row below never goes to a dead end.
  /**
   * Task 024 Addendum C. What the automatic offer would link, if anything.
   *
   * A group when every high-confidence candidate is a rich-text editing host
   * and none of them is shared yet; otherwise the ordinary single candidate
   * the Confirmed Contract has always specified. Nothing at all once the user
   * has dismissed it, or while a Logical Page candidate is asking its own
   * question - two offers at once is nagging, not helping.
   */
  const offeredLinkCandidates = useMemo((): CompatibilityCandidateView[] => {
    // Task 024 Addendum C.2. Sharing is a form of remembering: a link creates
    // a durable Field Profile and puts it in a Shared Template Set. A Field
    // that cannot carry a Binding cannot carry that either, so offering it is
    // offering something that will not hold.
    if (!bindingSupported) return [];
    if (!linkOffer || linkOfferDismissed || logicalPageCandidate) return [];
    const byId = new Map(
      localizeCandidateLabels(linkOffer.candidates, state, t).map((candidate) => [candidate.fieldProfileId, candidate]),
    );
    const group = (linkOffer.suggestedGroupFieldProfileIds ?? [])
      .map((id) => byId.get(id))
      .filter((candidate): candidate is CompatibilityCandidateView => candidate !== undefined);
    if (group.length >= 2) return group;
    const single = linkOffer.suggestedFieldProfileId
      ? byId.get(linkOffer.suggestedFieldProfileId)
      : undefined;
    return single && !single.alreadyLinked ? [single] : [];
  }, [linkOffer, linkOfferDismissed, logicalPageCandidate, bindingSupported, state, t]);

  /**
   * Confirming a group. One `CREATE_SHARED_TEMPLATE_SET` over every Field at
   * once, which is why the group rule only ever offers Fields that belong to
   * no Set: this is a single mutation with a single exact Undo, where a
   * sequence of adds and merges would leave a half-undoable middle.
   */
  async function acceptLinkOffer(candidates: CompatibilityCandidateView[]): Promise<void> {
    if (candidates.length === 0 || sharedActionBusy || !targetFieldActionable) return;
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      // Task 024 Addendum C.2. The scope confirmation lives in the Finder, and
      // this offer is in the list. Asking for it from here used to set a
      // confirmation nothing rendered: the click did nothing visible and the
      // offer stayed on screen, which the owner reported as "I pressed Share
      // and it is still there". Open the Finder on the same candidates so the
      // question the user is being asked is actually in front of them.
      if (Boolean(mySharedSet) || Boolean(candidate.existingSetId)) {
        if (linkOffer) setFindSimilarResult(linkOffer);
        setMode("find-similar-field");
      }
      requestLinkCandidate(candidate);
      return;
    }
    setSharedActionBusy(true);
    try {
      clearNotices();
      const response = await sendRequest({
        type: "CREATE_SHARED_TEMPLATE_SET",
        fieldProfileIds: [fieldProfileId, ...candidates.map((candidate) => candidate.fieldProfileId)],
        newFields: [
          {
            pageUrl: location.href,
            pageProfileId,
            fieldProfileId,
            ...(pageIdentityKey ? { pageIdentityKey } : {}),
            ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
            ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
            ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
          },
        ],
      });
      if (!response.ok || !isCreateSharedTemplateSetResult(response.value)) {
        throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
      }
      await refreshState();
      setLinkOffer(null);
      setLinkOfferDismissed(true);
      setOutcome({
        tone: "success",
        message: t.startedSharingWithOthers(candidates.length),
      });
      onLastActionChange({ type: "create-shared-set", setId: response.value.set.id });
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  /**
   * Declining. The `No` is recorded for **every** pair the offer contained, so
   * a group the user has refused is not then offered one member at a time.
   */
  async function declineLinkOffer(candidates: CompatibilityCandidateView[]): Promise<void> {
    if (candidates.length === 0 || sharedActionBusy) return;
    setSharedActionBusy(true);
    try {
      for (const candidate of candidates) {
        await sendRequest({
          type: "RECORD_COMPATIBILITY_PAIR_NO",
          fieldProfileIdA: fieldProfileId,
          fieldProfileIdB: candidate.fieldProfileId,
        });
      }
      setLinkOffer(null);
      setLinkOfferDismissed(true);
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  function requestLinkCandidate(candidate: CompatibilityCandidateView): void {
    if (sharedActionBusy || !targetFieldActionable || candidate.alreadyLinked) return;
    const needsScopeConfirmation = Boolean(mySharedSet) || Boolean(candidate.existingSetId);
    if (!needsScopeConfirmation) {
      void executeLinkCandidate(candidate);
      return;
    }
    const mySites = mySharedSet ? siteIdsForSharedSet(mySharedSet.id) : new Set([currentSiteId]);
    const theirSites = candidate.existingSetId ? siteIdsForSharedSet(candidate.existingSetId) : new Set([candidate.siteId]);
    const myFieldCount = mySharedSet?.memberFieldProfileIds.length ?? 1;
    const theirFieldCount = candidate.existingSetId ? candidate.existingSetMemberCount : 1;
    setPendingLink({
      candidate,
      fieldCount: myFieldCount + theirFieldCount,
      siteCount: new Set([...mySites, ...theirSites]).size,
    });
  }

  async function executeLinkCandidate(candidate: CompatibilityCandidateView): Promise<void> {
    setSharedActionBusy(true);
    try {
      clearNotices();
      if (mySharedSet && candidate.existingSetId && candidate.existingSetId !== mySharedSet.id) {
        const response = await sendRequest({
          type: "MERGE_SHARED_TEMPLATE_SETS",
          keepSetId: mySharedSet.id,
          removeSetId: candidate.existingSetId,
        });
        if (!response.ok || !isMergeSharedTemplateSetsResult(response.value)) {
          throw new Error(response.ok ? "Invalid merge response" : response.error);
        }
        await refreshState();
        setOutcome({
          tone: "success",
          message: t.startedSharingMerged(candidate.fieldLabel, response.value.removedSet.name, response.value.set.name),
        });
        onLastActionChange({
          type: "merge-shared-sets",
          mergedSet: response.value.set,
          mergedSetBindings: response.value.bindings,
          previousKeepSet: response.value.previousKeepSet,
          previousKeepSetBindings: response.value.previousKeepSetBindings,
          removedSet: response.value.removedSet,
          removedSetBindings: response.value.removedSetBindings,
          remappedFieldStates: response.value.remappedFieldStates,
          previousRemovedSetFieldStates: response.value.previousRemovedSetFieldStates,
        });
      } else if (mySharedSet) {
        const setId = mySharedSet.id;
        const response = await sendRequest({
          type: "ADD_SHARED_TEMPLATE_SET_MEMBER",
          setId,
          fieldProfileId: candidate.fieldProfileId,
          allowCrossSite: candidate.crossSite,
        });
        if (!response.ok || !isAddSharedTemplateSetMemberResult(response.value)) {
          throw new Error(response.ok ? "Invalid add-member response" : response.error);
        }
        await refreshState();
        setOutcome({ tone: "success", message: t.startedSharingWith(candidate.fieldLabel) });
        onLastActionChange({ type: "add-shared-member", setId, fieldProfileId: candidate.fieldProfileId, undo: response.value.undo });
      } else if (candidate.existingSetId) {
        const setId = candidate.existingSetId;
        const response = await sendRequest({
          type: "ADD_SHARED_TEMPLATE_SET_MEMBER",
          setId,
          fieldProfileId,
          allowCrossSite: candidate.crossSite,
          // The Current Field may never have been bound to anything - same
          // on-demand Field Profile creation createSharedTemplateSet uses.
          newField: {
            pageUrl: location.href,
            pageProfileId,
            fieldProfileId,
            ...(pageIdentityKey ? { pageIdentityKey } : {}),
            ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
            ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
            ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
          },
        });
        if (!response.ok || !isAddSharedTemplateSetMemberResult(response.value)) {
          throw new Error(response.ok ? "Invalid add-member response" : response.error);
        }
        await refreshState();
        setOutcome({ tone: "success", message: t.startedSharingWith(candidate.fieldLabel) });
        onLastActionChange({ type: "add-shared-member", setId, fieldProfileId, undo: response.value.undo });
      } else {
        const response = await sendRequest({
          type: "CREATE_SHARED_TEMPLATE_SET",
          fieldProfileIds: [fieldProfileId, candidate.fieldProfileId],
          // "Two empty Fields may create a Shared Template Set" (Task 015
          // Accepted Contract) requires the repository create the Current
          // Field's Profile on demand; the candidate always already has a
          // real one (Task 024: only a discoverable, non-empty Field is
          // ever a candidate here), so it never needs `newFields` of its own.
          newFields: [
            {
              pageUrl: location.href,
              pageProfileId,
              fieldProfileId,
              ...(pageIdentityKey ? { pageIdentityKey } : {}),
              ...(fieldIdentityKey ? { fieldIdentityKey } : {}),
              ...(fieldDocumentOrder !== null && fieldDocumentOrder !== undefined ? { fieldDocumentOrder } : {}),
              ...(fieldObservedTitle ? { fieldObservedTitle } : {}),
            },
          ],
          allowCrossSite: candidate.crossSite,
        });
        if (!response.ok || !isCreateSharedTemplateSetResult(response.value)) {
          throw new Error(response.ok ? "Invalid Shared Template Set response" : response.error);
        }
        await refreshState();
        setOutcome({ tone: "success", message: t.startedSharingWith(candidate.fieldLabel) });
        onLastActionChange({ type: "create-shared-set", setId: response.value.set.id });
      }
      setPendingLink(null);
      setLinkOffer(null);
      setLinkOfferDismissed(true);
      closeFindSimilarField();
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  /**
   * Task 027 Addendum B: "Join Set & Share" / "Merge Sets & Share" - reached
   * from the Finder opened via `openFindSimilarField`'s `shareContext`. A
   * candidate not yet in any Set joins the owner's current Set (`join`); a
   * candidate already in a different existing Set merges that Set into the
   * owner's own (`merge`, Task 024's canonical-slot rule: the owner's Set is
   * always `keepSetId`). Either way, exactly one explicit confirmation
   * states the Set membership change and that every ordinary shared
   * Template from the Sets becomes available in the resulting Set, before
   * one atomic composite mutation and one Undo entry.
   */
  function requestShareTarget(candidate: CompatibilityCandidateView): void {
    if (sharedActionBusy || !targetFieldActionable || !mySharedSet || !shareTargetContext) return;
    if (candidate.alreadyLinked) return;
    const crossSet = Boolean(candidate.existingSetId) && candidate.existingSetId !== mySharedSet.id;
    const mySites = siteIdsForSharedSet(mySharedSet.id);
    const theirSites = candidate.existingSetId ? siteIdsForSharedSet(candidate.existingSetId) : new Set([candidate.siteId]);
    const myFieldCount = mySharedSet.memberFieldProfileIds.length;
    const theirFieldCount = candidate.existingSetId ? candidate.existingSetMemberCount : 1;
    setPendingShareTarget({
      candidate,
      mode: crossSet ? "merge" : "join",
      fieldCount: myFieldCount + theirFieldCount,
      siteCount: new Set([...mySites, ...theirSites]).size,
      resultingTemplateCount: templateCountAfterSharingWith(candidate, crossSet),
    });
  }

  /**
   * The union both a join and a merge produce.
   *
   * Only ordinary slots count: a Field-only slot stays visible to its owner
   * alone, so it never lands on the other side. The Template being shared is
   * added explicitly, because this flow can be reached from a Field-only slot
   * that the same action promotes - it is not yet ordinary at the moment the
   * confirmation is drawn.
   */
  function templateCountAfterSharingWith(
    candidate: CompatibilityCandidateView,
    crossSet: boolean,
  ): number {
    if (!state || !mySharedSet) return 0;
    const ordinarySlotTemplateIds = (setId: string): string[] =>
      state.sharedTemplateBindings
        .filter((binding) => binding.setId === setId && binding.ownerFieldProfileId === undefined)
        .map((binding) => binding.templateId);

    const resulting = new Set(ordinarySlotTemplateIds(mySharedSet.id));
    if (shareTargetContext) resulting.add(shareTargetContext.template.id);
    if (crossSet && candidate.existingSetId) {
      for (const templateId of ordinarySlotTemplateIds(candidate.existingSetId)) resulting.add(templateId);
    } else {
      // An independent Field brings its own Templates into the Set with it.
      for (const binding of state.bindings) {
        if (binding.fieldProfileId === candidate.fieldProfileId) resulting.add(binding.templateId);
      }
    }
    return resulting.size;
  }

  async function executeShareTarget(): Promise<void> {
    if (!pendingShareTarget || !shareTargetContext || !mySharedSet) return;
    const { candidate, mode: shareMode } = pendingShareTarget;
    const { template, slotId } = shareTargetContext;
    setSharedActionBusy(true);
    try {
      clearNotices();
      if (shareMode === "merge") {
        if (!candidate.existingSetId) throw new Error("Selected Field no longer belongs to a Shared Template Set.");
        const response = await sendRequest({
          type: "MERGE_SETS_AND_SHARE",
          keepSetId: mySharedSet.id,
          removeSetId: candidate.existingSetId,
          slotId,
          fieldProfileId,
        });
        if (!response.ok || !isMergeSetsAndShareResult(response.value)) {
          throw new Error(response.ok ? "Invalid Merge Sets & Share response" : response.error);
        }
        await refreshState();
        const consumed = response.value.consumedSlot !== undefined;
        setOutcome({
          tone: "success",
          message: t.mergedSetsAndShared(
            deriveOutcomePreview(template.content),
            candidate.fieldLabel,
            response.value.removedSet.name,
            response.value.set.name,
            consumed,
          ),
        });
        onLastActionChange({
          type: "merge-sets-and-share",
          template,
          mergedSet: response.value.set,
          mergedSetBindings: response.value.bindings,
          previousKeepSet: response.value.previousKeepSet,
          previousKeepSetBindings: response.value.previousKeepSetBindings,
          removedSet: response.value.removedSet,
          removedSetBindings: response.value.removedSetBindings,
          remappedFieldStates: response.value.remappedFieldStates,
          previousRemovedSetFieldStates: response.value.previousRemovedSetFieldStates,
          slotId: response.value.sharedBinding.id,
          previousOwnerFieldProfileId: response.value.previousOwnerFieldProfileId,
          consumedSlot: response.value.consumedSlot,
          previousOrdinarySlot: response.value.previousOrdinarySlot,
          removedFieldStates: response.value.removedFieldStates,
          previousSlot: response.value.previousSlot,
        });
      } else {
        const response = await sendRequest({
          type: "JOIN_SET_AND_SHARE",
          setId: mySharedSet.id,
          slotId,
          fieldProfileId,
          targetFieldProfileId: candidate.fieldProfileId,
          allowCrossSite: candidate.crossSite,
        });
        if (!response.ok || !isJoinSetAndShareResult(response.value)) {
          throw new Error(response.ok ? "Invalid Join Set & Share response" : response.error);
        }
        await refreshState();
        const consumed = response.value.consumedSlot !== undefined;
        setOutcome({
          tone: "success",
          message: t.joinedAndShared(deriveOutcomePreview(template.content), candidate.fieldLabel, consumed),
        });
        onLastActionChange({
          type: "join-set-and-share",
          template,
          setId: mySharedSet.id,
          targetFieldProfileId: candidate.fieldProfileId,
          addUndo: response.value.addUndo,
          slotId: response.value.sharedBinding.id,
          previousOwnerFieldProfileId: response.value.previousOwnerFieldProfileId,
          consumedSlot: response.value.consumedSlot,
          previousOrdinarySlot: response.value.previousOrdinarySlot,
          removedFieldStates: response.value.removedFieldStates,
          previousSlot: response.value.previousSlot,
        });
      }
      setPendingShareTarget(null);
      closeFindSimilarField();
    } catch (reason) {
      showError(reason);
    } finally {
      setSharedActionBusy(false);
    }
  }

  const FIND_SIMILAR_LABEL_CLAMP_LENGTH = 60;

  // A long Field label is clamped to 2 lines with a "more" toggle rather
  // than shown in full - a recognition aid, not a place to read a whole
  // Template. The clamp is CSS-only (no DOM measurement); the character
  // threshold is a presentation heuristic for when "more" is worth offering.
  function renderTruncatableLabel(fieldProfileId: string, label: string) {
    if (label.length <= FIND_SIMILAR_LABEL_CLAMP_LENGTH || findSimilarExpandedLabels.has(fieldProfileId)) {
      return label;
    }
    return (
      <>
        <span class="find-similar-label-clamped">{label}</span>{" "}
        <button
          type="button"
          class="find-similar-label-more"
          aria-label={t.showFullNameOf(label)}
          onClick={(event) => {
            event.stopPropagation();
            setFindSimilarExpandedLabels((current) => new Set(current).add(fieldProfileId));
          }}
        >
          {t.showMore()}
        </button>
      </>
    );
  }

  // Owner QA 2026-09-15. A row's page highlight was cleared only by that row's
  // mouseleave or blur. When the list goes away while the pointer rests on a
  // row - Back pressed from the keyboard, a confirmation opening in the
  // list's place - the row never receives either, and its page Field stayed
  // outlined until the Picker closed. Task 024: a row's hover and its page
  // highlight begin and clear together, so a row no longer drawn takes its
  // highlight with it.
  const highlightedFieldRow = useRef<string | null>(null);
  function highlightFieldRow(key: string, onHighlight: (active: boolean) => void, active: boolean): void {
    if (active) highlightedFieldRow.current = key;
    else if (highlightedFieldRow.current === key) highlightedFieldRow.current = null;
    onHighlight(active);
  }
  useEffect(() => {
    const key = highlightedFieldRow.current;
    if (key === null) return;
    const drawn = [...(pickerRef.current?.querySelectorAll<HTMLElement>("[data-field-row]") ?? [])]
      .some((row) => row.dataset.fieldRow === key);
    if (drawn) return;
    highlightedFieldRow.current = null;
    onSharedFieldCandidateHighlight?.(null);
  });

  // One shared row shape for every field a user can share Templates with in
  // this Picker - "In this page" and Search are the same action with a
  // different candidate pool, and must look and behave identically: same
  // field-label treatment, same trailing action button revealed the same
  // way on hover/focus, never two different-looking controls for one thing.
  function renderFieldRow(row: {
    key: string;
    label: ComponentChildren;
    context?: ComponentChildren;
    preview?: string;
    onShare: () => void;
    onHighlight?: (active: boolean) => void;
    onLocate?: () => void;
    locateLabel?: string;
    summary?: { fieldLabel: string; templates: TemplateRecord[]; expanded: boolean; onToggle(): void };
    alias?: { key: string; currentAlias?: string; onStart(): void };
  }) {
    const isAliasEditing = Boolean(row.alias && fieldAliasEdit?.key === row.alias.key);
    const onHighlight = row.onHighlight;
    const highlight = onHighlight
      ? (active: boolean) => highlightFieldRow(row.key, onHighlight, active)
      : undefined;

    return (
      <li
        key={row.key}
        class="find-similar-row"
        data-field-row={row.key}
        onMouseEnter={() => highlight?.(true)}
        onMouseLeave={() => highlight?.(false)}
      >
        <div class="find-similar-row-primary">
          <span class="find-similar-row-info">
            <span class="find-similar-field-heading">
              {row.summary?.templates.length ? (
                <button
                  type="button"
                  class="find-similar-field-summary-toggle"
                  aria-expanded={row.summary.expanded}
                  aria-label={t.toggleSavedTemplatesFor(row.summary.expanded, row.summary.fieldLabel)}
                  onClick={row.summary.onToggle}
                >
                  <span aria-hidden="true">{row.summary.expanded ? "▾" : "▸"}</span>
                </button>
              ) : null}
              {row.alias && typeof row.label === "string" ? (
                <FieldAliasEditor
                messages={t}
                  displayLabel={row.label}
                  editing={isAliasEditing}
                  draft={fieldAliasDraft}
                  busy={fieldAliasBusy}
                  labelClassName="find-similar-field-label"
                  onStart={row.alias.onStart}
                  onDraftChange={setFieldAliasDraft}
                  onSave={(value) => void saveFieldAlias(value)}
                  onCancel={cancelFieldAliasEdit}
                />
              ) : (
                <strong class="find-similar-field-label">{row.label}</strong>
              )}
              {row.summary && (
                <span
                  class="find-similar-template-count"
                  title={t.savedTemplateCount(row.summary.templates.length)}
                >
                  <span aria-hidden="true">{row.summary.templates.length}</span>
                  <span class="find-similar-template-count-sr">
                    {t.savedTemplateCount(row.summary.templates.length)}
                  </span>
                </span>
              )}
            </span>
            {row.preview && <span class="find-similar-preview">{row.preview}</span>}
          </span>
          {row.context && <span class="find-similar-search-context">{row.context}</span>}
          {!isAliasEditing && (
            <span class="find-similar-row-actions">
              {row.onLocate && row.locateLabel && (
                <button
                  type="button"
                  class="action find-similar-locate"
                  aria-label={row.locateLabel}
                  data-tooltip={t.locateOnPageShort()}
                  disabled={sharedActionBusy || !targetFieldActionable}
                  // A mouse-activated Locate is a transient page preview,
                  // not a persistent selection. Keep keyboard focus intact
                  // for keyboard activation, but do not leave this row in
                  // the Picker's focus-within highlight after a mouse click.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={row.onLocate}
                  onFocus={() => highlight?.(true)}
                  onBlur={() => highlight?.(false)}
                >
                  <MapPinIcon />
                </button>
              )}
              <button
                type="button"
                disabled={sharedActionBusy || !targetFieldActionable}
                onClick={row.onShare}
                onFocus={() => highlight?.(true)}
                onBlur={() => highlight?.(false)}
              >{t.share()}</button>
            </span>
          )}
        </div>
        {row.summary?.expanded && (
          <ul class="find-similar-saved-templates" aria-label={t.savedTemplatesFor(row.summary.fieldLabel)}>
            {row.summary.templates.map((template, index) => (
              <li key={template.id}>
                <span aria-hidden="true">{index + 1}</span>
                <span class="find-similar-saved-template-text">{derivePreview(template.content) || t.emptyTemplate()}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  function renderOnPageFieldRow(candidate: SharedFieldCandidate) {
    const templates = onPageCandidateTemplates.get(candidate.key) ?? [];
    const expanded = expandedOnPageCandidateTemplates.has(candidate.key);
    return renderFieldRow({
      key: candidate.key,
      label: candidate.label,
      summary: {
        fieldLabel: candidate.label,
        templates,
        expanded,
        onToggle: () => {
          setExpandedOnPageCandidateTemplates((current) => {
            const next = new Set(current);
            if (next.has(candidate.key)) next.delete(candidate.key);
            else next.add(candidate.key);
            return next;
          });
        },
      },
      alias: {
        key: `candidate:${candidate.key}`,
        currentAlias: candidate.durable
          ? state?.fieldProfiles.find((field) => field.id === candidate.fieldProfileId)?.userAlias
          : undefined,
        onStart: () => {
          const resolved = resolveOnPageCandidate(candidate);
          const currentAlias = candidate.durable
            ? state?.fieldProfiles.find((field) => field.id === candidate.fieldProfileId)?.userAlias
            : undefined;
          beginFieldAliasEdit({
            key: `candidate:${candidate.key}`,
            fieldProfileId: resolved.id,
            displayLabel: candidate.label,
            currentAlias,
            ...(resolved.newField ? { newField: resolved.newField } : {}),
          });
        },
      },
      onShare: () => void shareOnPageCandidate(candidate),
      onHighlight: (active) =>
        onSharedFieldCandidateHighlight?.(active ? candidate.fieldIdentityKey ?? null : null),
      ...(candidate.fieldIdentityKey
        ? {
            onLocate: () => onSharedFieldCandidateLocate?.(candidate.fieldIdentityKey!),
            locateLabel: t.locateOnPage(candidate.label),
          }
        : {}),
    });
  }

  function renderFindSimilarRow(candidate: CompatibilityCandidateView) {
    const preview =
      candidate.templatePreviews.length > 0
        ? candidate.templatePreviews.join(" · ") +
          (candidate.templateCount > candidate.templatePreviews.length
            ? ` ${t.moreTemplatePreviews(candidate.templateCount - candidate.templatePreviews.length)}`
            : "")
        : undefined;
    return renderFieldRow({
      key: candidate.fieldProfileId,
      label: renderTruncatableLabel(candidate.fieldProfileId, candidate.fieldLabel),
      context: (
        <>
          <strong>{candidate.siteLabel}</strong> · {candidate.pageLabel}
          {candidate.crossSite && ` · ${t.mayHaveDifferentPurpose()}`}
        </>
      ),
      preview,
      onShare: () => (shareTargetContext ? requestShareTarget(candidate) : requestLinkCandidate(candidate)),
    });
  }

  async function updateTemplate(): Promise<void> {
    if (!editing || !isEditContentSavable(editing, editDraft)) return;
    const previousTemplate = editing;
    try {
      clearNotices();
      const response = await sendRequest({
        type: "UPDATE_TEMPLATE",
        templateId: editing.id,
        content: editDraft,
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setEditing(null);
      setEditDraft("");
      if (isTemplateRecord(response.value)) {
        onLastActionChange({
          type: "save",
          template: previousTemplate,
          savedContent: response.value.content,
          expectedRevision: response.value.revision,
        });
        setOutcome({ tone: "success", message: t.savedEverywhere(deriveOutcomePreview(response.value.content)) });
      }
    } catch (reason) {
      showError(reason);
    }
  }

  async function saveCopyForField(): Promise<void> {
    if (!editing || !isEditContentSavable(editing, editDraft) || !targetFieldActionable) return;
    if (mySharedSet) {
      // Task 027 Addendum A (defect F): target the exact slot the current
      // Field's collapsed entry resolves to - never a `templateId`-keyed
      // lookup, which cannot tell an ordinary slot apart from a coexisting
      // owner-only slot for the same Template (A.1).
      const entry = entryByTemplateId.get(editing.id);
      const originalSharedBinding = entry?.slotId
        ? state?.sharedTemplateBindings.find(
            (candidate) => candidate.id === entry.slotId && candidate.setId === mySharedSet.id,
          )
        : undefined;
      if (!originalSharedBinding) {
        showError(t.templateNoLongerSharedWithCurrentField());
        return;
      }
      const previousTemplate = editing;
      try {
        clearNotices();
        const response = await sendRequest({
          type: "SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
          setId: mySharedSet.id,
          slotId: originalSharedBinding.id,
          content: editDraft,
        });
        if (!response.ok) throw new Error(response.error);
        await refreshState();
        setEditing(null);
        setEditDraft("");
        if (isSaveTemplateCopyForSharedSetResult(response.value)) {
          onLastActionChange({
            type: "save-copy-shared",
            template: previousTemplate,
            copyTemplate: response.value.template,
            copyTemplateId: response.value.template.id,
            originalSharedBinding,
          });
          // Task 027 Addendum A (defect F): a private relationship's own
          // wording, never the Set-wide count, when this slot is
          // Field-only.
          setOutcome({
            tone: "success",
            message: entry?.isFieldOnly
              ? t.savedForThisFieldMsg(deriveOutcomePreview(response.value.template.content))
              : t.savedCopyForSharedCount(deriveOutcomePreview(response.value.template.content), mySharedSet.memberFieldProfileIds.length),
          });
        }
      } catch (reason) {
        showError(reason);
      }
      return;
    }
    const originalBinding = state?.bindings.find(
      (candidate) => candidate.templateId === editing.id && candidate.fieldProfileId === fieldProfileId,
    );
    if (!originalBinding) return;
    const previousTemplate = editing;
    try {
      clearNotices();
      const response = await sendRequest({
        type: "SAVE_TEMPLATE_COPY_FOR_FIELD",
        templateId: editing.id,
        fieldProfileId,
        content: editDraft,
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setEditing(null);
      setEditDraft("");
      if (isSaveTemplateCopyResult(response.value)) {
        onLastActionChange({
          type: "save-copy",
          template: previousTemplate,
          copyTemplate: response.value.template,
          copyTemplateId: response.value.template.id,
          originalBinding,
        });
        setOutcome({ tone: "success", message: t.savedCopyForThisField(deriveOutcomePreview(response.value.template.content)) });
      }
    } catch (reason) {
      showError(reason);
    }
  }

  /** "Save for this field" (Task 026 Confirmed Contract): creates an Override for the Current Field only. */
  async function saveOverrideForField(): Promise<void> {
    if (!editing || !isEditContentSavable(editing, editDraft) || !targetFieldActionable || !mySharedSet) return;
    const resolvedSlotId = entryByTemplateId.get(editing.id)?.slotId;
    const slot = resolvedSlotId
      ? state?.sharedTemplateBindings.find(
          (candidate) => candidate.id === resolvedSlotId && candidate.setId === mySharedSet.id,
        )
      : undefined;
    if (!slot) {
      showError(t.templateNoLongerSharedWithCurrentField());
      return;
    }
    const previousFieldState =
      state?.sharedTemplateFieldStates.find(
        (candidate) =>
          candidate.setId === mySharedSet.id && candidate.slotId === slot.id && candidate.fieldProfileId === fieldProfileId,
      ) ?? null;
    try {
      clearNotices();
      const response = await sendRequest({
        type: "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
        setId: mySharedSet.id,
        slotId: slot.id,
        fieldProfileId,
        content: editDraft,
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setEditing(null);
      setEditDraft("");
      if (isSaveTemplateOverrideResult(response.value)) {
        onLastActionChange({
          type: "save-override-for-field",
          copyTemplateId: response.value.template.id,
          previousState: previousFieldState,
        });
        setOutcome({
          tone: "success",
          message: t.savedForThisFieldOnlyMsg(deriveOutcomePreview(response.value.template.content)),
        });
      }
    } catch (reason) {
      showError(reason);
    }
  }

  async function deleteTemplate(template: TemplateRecord): Promise<void> {
    try {
      clearNotices();
      const bindings =
        state?.bindings.filter((binding) => binding.templateId === template.id) ?? [];
      const sharedBindings =
        state?.sharedTemplateBindings.filter((binding) => binding.templateId === template.id) ?? [];
      const removedSlotIds = new Set(sharedBindings.map((binding) => binding.id));
      const fieldStates =
        state?.sharedTemplateFieldStates.filter(
          (entry) => removedSlotIds.has(entry.slotId) || (entry.mode === "override" && entry.templateId === template.id),
        ) ?? [];
      const response = await sendRequest({
        type: "DELETE_TEMPLATE",
        templateId: template.id,
      });
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      const affectedFieldIds = new Set(bindings.map((binding) => binding.fieldProfileId));
      for (const sharedBinding of sharedBindings) {
        const set = state?.sharedTemplateSets.find((candidate) => candidate.id === sharedBinding.setId);
        for (const memberId of set?.memberFieldProfileIds ?? []) affectedFieldIds.add(memberId);
      }
      const affectedFieldCount = affectedFieldIds.size;
      const bindingDescription = affectedFieldCount === 0
        ? t.deletedFromLibrary(deriveOutcomePreview(template.content))
        : t.deletedFromFieldsAndLibrary(deriveOutcomePreview(template.content), affectedFieldCount);
      setOutcome({ tone: "danger", message: bindingDescription, template });
      onLastActionChange({ type: "delete", template, bindings, sharedBindings, fieldStates });
    } catch (reason) {
      showError(reason);
    }
  }

  async function undo(): Promise<void> {
    if (!lastAction || !targetFieldActionable) return;
    const action = lastAction;
    onLastActionChange(null);
    try {
      clearNotices();
      let response: RuntimeResponse;
      switch (action.type) {
        case "delete":
          response = await sendRequest({
            type: "RESTORE_TEMPLATE",
            template: action.template,
            bindings: action.bindings,
            sharedBindings: action.sharedBindings,
            fieldStates: action.fieldStates,
          });
          break;
        case "bind":
          response = await sendRequest({ type: "UNDO_BIND", bindingId: action.bindingId });
          break;
        case "unbind":
          response = await sendRequest({ type: "UNDO_UNBIND", binding: action.binding });
          break;
        case "save":
          response = await sendRequest({
            type: "UNDO_SAVE",
            template: action.template,
            expectedRevision: action.expectedRevision,
          });
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
        case "create-bind-shared":
          response = await sendRequest({
            type: "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED",
            setId: action.setId,
            sharedBindingId: action.sharedBindingId,
            templateId: action.template.id,
          });
          break;
        case "create-bind-shared-field-only":
          response = await sendRequest({
            type: "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY",
            setId: action.setId,
            sharedBindingId: action.sharedBindingId,
            templateId: action.template.id,
          });
          break;
        case "bind-shared":
          response = action.created
            ? await sendRequest({ type: "UNDO_BIND_TEMPLATE_SHARED", sharedBindingId: action.sharedBindingId })
            : await sendRequest({
                type: "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
                setId: action.setId,
                slotId: action.sharedBindingId,
                fieldProfileId,
                previousState: action.previousState ?? null,
              });
          break;
        case "unbind-shared":
          response = await sendRequest({
            type: "UNDO_UNBIND_TEMPLATE_SHARED",
            sharedBinding: action.sharedBinding,
            fieldStates: action.fieldStates,
          });
          break;
        case "bind-to-field-only":
          response = await sendRequest({
            type: "UNDO_BIND_TEMPLATE_TO_FIELD_ONLY",
            setId: action.setId,
            sharedBinding: action.sharedBinding,
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
            previousSlot: action.previousSlot,
          });
          break;
        case "create-shared-set":
          response = await sendRequest({ type: "UNDO_CREATE_SHARED_TEMPLATE_SET", setId: action.setId });
          break;
        case "add-shared-member":
          response = await sendRequest({
            type: "UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER",
            ...action.undo,
            setId: action.setId,
            fieldProfileId: action.fieldProfileId,
          });
          break;
        case "stop-sharing":
          response = await sendRequest({
            type: "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER",
            fieldProfileId: action.fieldProfileId,
            set: action.set,
            endedSharedBindings: action.endedSharedBindings,
            snapshotBindings: action.snapshotBindings,
            dormantBindings: action.dormantBindings,
            removedOwnedSlots: action.removedOwnedSlots,
            removedFieldStates: action.removedFieldStates,
          });
          break;
        case "merge-shared-sets":
          response = await sendRequest({
            type: "UNDO_MERGE_SHARED_TEMPLATE_SETS",
            mergedSet: action.mergedSet,
            mergedSetBindings: action.mergedSetBindings,
            previousKeepSet: action.previousKeepSet,
            previousKeepSetBindings: action.previousKeepSetBindings,
            removedSet: action.removedSet,
            removedSetBindings: action.removedSetBindings,
            remappedFieldStates: action.remappedFieldStates,
            previousRemovedSetFieldStates: action.previousRemovedSetFieldStates,
          });
          break;
        case "join-set-and-share":
          response = await sendRequest({
            type: "UNDO_JOIN_SET_AND_SHARE",
            setId: action.setId,
            targetFieldProfileId: action.targetFieldProfileId,
            addUndo: action.addUndo,
            slotId: action.slotId,
            ownerFieldProfileId: action.previousOwnerFieldProfileId,
            consumedSlot: action.consumedSlot,
            previousOrdinarySlot: action.previousOrdinarySlot,
            removedFieldStates: action.removedFieldStates,
            previousSlot: action.previousSlot,
          });
          break;
        case "merge-sets-and-share":
          response = await sendRequest({
            type: "UNDO_MERGE_SETS_AND_SHARE",
            mergedSet: action.mergedSet,
            mergedSetBindings: action.mergedSetBindings,
            previousKeepSet: action.previousKeepSet,
            previousKeepSetBindings: action.previousKeepSetBindings,
            removedSet: action.removedSet,
            removedSetBindings: action.removedSetBindings,
            remappedFieldStates: action.remappedFieldStates,
            previousRemovedSetFieldStates: action.previousRemovedSetFieldStates,
            slotId: action.slotId,
            ownerFieldProfileId: action.previousOwnerFieldProfileId,
            consumedSlot: action.consumedSlot,
            previousOrdinarySlot: action.previousOrdinarySlot,
            removedFieldStates: action.removedFieldStates,
            previousSlot: action.previousSlot,
          });
          break;
        default:
          assertNever(action);
      }
      // Undo fails closed: a stale-Undo rejection (StaleUndoError, or the
      // underlying record having disappeared) surfaces as a clear error and
      // never guesses, merges, or overwrites a later accepted change.
      if (!response.ok) throw new Error(response.error);
      await refreshState();
      setOutcome({ tone: "success", message: t.undoneOutcome(undoLabel(action)) });
    } catch (reason) {
      showError(reason);
    }
  }

  function undoLabel(action: LastAction): string {
    switch (action.type) {
      case "create-shared-set":
        return t.undoSharing();
      case "add-shared-member":
        return t.undoAddField();
      case "stop-sharing":
        return t.undoStopSharing();
      case "merge-shared-sets":
        return t.undoMerge();
      case "delete":
        return t.undoLabel(t.undoActionDelete(), deriveOutcomePreview(action.template.content));
      case "bind":
      case "bind-shared":
      case "bind-to-field-only":
        return t.undoLabel(t.undoActionBind(), deriveOutcomePreview(action.template.content));
      case "unbind":
      case "unbind-shared":
        return t.undoLabel(t.undoActionUnbind(), deriveOutcomePreview(action.template.content));
      case "share-this-version":
      case "join-set-and-share":
      case "merge-sets-and-share":
        return t.undoLabel(t.undoActionShare(), deriveOutcomePreview(action.template.content));
      case "save-copy":
        return t.undoLabel(t.undoActionCopy(), deriveOutcomePreview(action.copyTemplate.content));
      case "save-copy-shared":
        return t.undoLabel(t.undoActionSharedCopy(), deriveOutcomePreview(action.copyTemplate.content));
      case "save-override-for-field":
        return t.undoSaveForThisField();
      case "exclude-shared-for-field":
        return t.undoLabel(t.undoActionRemove(), deriveOutcomePreview(action.template.content));
      case "create-bind-shared":
        return t.undoLabel(t.undoActionCreate(), deriveOutcomePreview(action.template.content));
      case "create-bind-shared-field-only":
        return t.undoLabel(t.undoActionCreate(), deriveOutcomePreview(action.template.content));
      case "save":
        return t.undoLabel(t.undoActionEdit(), deriveOutcomePreview(action.template.content));
      default:
        return assertNever(action);
    }
  }

  async function confirmLogicalPageCandidate(): Promise<void> {
    if (!logicalPageCandidate || !logicalPageCandidateEvidence || candidateBusy) return;
    setCandidateBusy(true);
    try {
      const response = await sendRequest({
        type: "CONFIRM_LOGICAL_PAGE_CANDIDATE",
        ruleId: logicalPageCandidate.ruleId,
        canonicalPageProfileId: logicalPageCandidate.canonicalPageProfileId,
        pageIdentityKey,
        evidence: logicalPageCandidateEvidence,
      });
      if (!response.ok || !isFieldContextResolution(response.value)) {
        throw new Error(response.ok ? "Invalid Logical Page confirmation response" : response.error);
      }
      const confirmedOutcome: PickerOutcome = {
        tone: "success",
        message: t.reusedExistingTemplates(),
      };
      setMode("list");
      clearNotices();
      onLastActionChange(null);
      // The parent swaps this Picker onto the canonical Field, which remounts
      // per-Field state; hand the result message across that transition.
      carriedOutcome.current = {
        fieldProfileId: response.value.fieldProfileId,
        outcome: confirmedOutcome,
      };
      onLogicalPageCandidateConfirmed(response.value);
      // Also applies directly for the case where the Field identity did not
      // change, when the effect above never fires.
      setOutcome(confirmedOutcome);
    } catch (reason) {
      showError(reason);
    } finally {
      setCandidateBusy(false);
    }
  }

  function dismissLogicalPageCandidate(): void {
    setMode("list");
    onLogicalPageCandidateDismissed();
  }

  function outcomeForAction(action: LastAction): PickerOutcome {
    switch (action.type) {
      case "create-shared-set":
        return { tone: "success", message: t.sharedThisFieldsTemplates() };
      case "add-shared-member":
        return { tone: "success", message: t.addedFieldToSharedSet() };
      case "stop-sharing":
        return { tone: "success", message: t.stoppedSharingForThisField() };
      case "merge-shared-sets":
        return { tone: "success", message: t.mergedWith(action.removedSet.name) };
      case "delete":
        return {
          tone: "danger",
          message: t.deletedQuoted(deriveOutcomePreview(action.template.content)),
          template: action.template,
        };
      case "bind":
      case "bind-shared":
        return { tone: "success", message: t.boundToThisField(deriveOutcomePreview(action.template.content)) };
      case "bind-to-field-only":
        return { tone: "success", message: t.boundToThisFieldOnly(deriveOutcomePreview(action.template.content)) };
      case "unbind":
      case "unbind-shared":
        return { tone: "success", message: t.removedFromThisField(deriveOutcomePreview(action.template.content)) };
      case "share-this-version":
        return { tone: "success", message: t.sharedWithWholeSet(deriveOutcomePreview(action.template.content)) };
      case "join-set-and-share":
        return { tone: "success", message: t.sharedWithSet(deriveOutcomePreview(action.template.content)) };
      case "merge-sets-and-share":
        return {
          tone: "success",
          message: t.sharedMerged(deriveOutcomePreview(action.template.content), action.removedSet.name),
        };
      case "save-copy":
        return {
          tone: "success",
          message: t.savedCopyForThisField(deriveOutcomePreview(action.copyTemplate.content)),
        };
      case "save-copy-shared":
        return {
          tone: "success",
          message: t.savedCopyForSharedFields(deriveOutcomePreview(action.copyTemplate.content)),
        };
      case "save-override-for-field":
        return { tone: "success", message: t.savedForThisFieldOnly() };
      case "exclude-shared-for-field":
        return {
          tone: "success",
          message: t.removedStillShared(deriveOutcomePreview(action.template.content)),
        };
      case "create-bind-shared":
        return { tone: "success", message: t.savedQuoted(deriveOutcomePreview(action.template.content)) };
      case "create-bind-shared-field-only":
        return { tone: "success", message: t.savedForThisFieldMsg(deriveOutcomePreview(action.template.content)) };
      case "save":
        return { tone: "success", message: t.savedEverywhere(deriveOutcomePreview(action.savedContent)) };
      default:
        return assertNever(action);
    }
  }

  // Owner QA 2026-09-14: New template and Edit keep the Picker the size it was
  // in the list, and give that room to the text, instead of shrinking it to a
  // small box. Measured on the way in, because the list is gone once inside.
  const [writingHeight, setWritingHeight] = useState<number | null>(null);
  function rememberListHeight(): void {
    const height = pickerRef.current?.getBoundingClientRect().height;
    setWritingHeight(height && height > 0 ? Math.round(height) : null);
  }
  const writing = mode === "compose" || (mode === "list" && editing !== null);

  // Owner QA 2026-09-15: Use field content never throws away what was typed.
  // An empty field changes nothing; replacing typed text can be undone until
  // the text is edited again or the panel closes.
  const [fieldContentReplacement, setFieldContentReplacement] = useState<{ previous: string; used: string } | null>(null);
  function takeFieldContent(): void {
    const text = readFieldText(targetField);
    if (text.trim().length === 0) return;
    setFieldContentReplacement(draft.trim().length > 0 && draft !== text ? { previous: draft, used: text } : null);
    setDraft(text);
  }
  function undoUseFieldContent(): void {
    if (!fieldContentReplacement) return;
    setDraft(fieldContentReplacement.previous);
    setFieldContentReplacement(null);
  }
  useEffect(() => {
    if (fieldContentReplacement && (mode !== "compose" || draft !== fieldContentReplacement.used)) {
      setFieldContentReplacement(null);
    }
  }, [draft, mode, fieldContentReplacement]);

  function startEdit(template: TemplateRecord): void {
    cancelFieldAliasEdit();
    rememberListHeight();
    setEditing(template);
    setEditDraft(template.content);
  }

  function handleHeaderPointerDown(event: PointerEvent): void {
    if (!pinned || !pickerPosition) return;
    const targetEl = event.target;
    if (targetEl instanceof Element && targetEl.closest("button")) return;
    // Owner QA 2026-09-11: without this the press also did what a press on
    // the page does - took focus out of the Picker and started a text
    // selection that followed the pointer across the page's Fields for the
    // whole drag. Dragging the Picker must leave focus and the page alone.
    event.preventDefault();
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originTop: pickerPosition.top,
      originLeft: pickerPosition.left,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handleHeaderPointerMove(event: PointerEvent): void {
    const drag = dragState.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    onPickerPositionChange(
      {
        top: drag.originTop + (event.clientY - drag.startY),
        left: drag.originLeft + (event.clientX - drag.startX),
      },
      false,
    );
  }

  function handleHeaderPointerUp(event: PointerEvent): void {
    const drag = dragState.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragState.current = null;
    onPickerPositionChange(
      {
        top: drag.originTop + (event.clientY - drag.startY),
        left: drag.originLeft + (event.clientX - drag.startX),
      },
      true,
    );
  }

  // Task 023 Addendum B5 (14): a pinned Picker renders from a stored position
  // that nothing re-checked against the viewport, so zooming in (which shrinks
  // the viewport in CSS pixels) pushed it off-screen and it stayed there.
  // Re-clamping on every resize brings it back; the clamped value is written
  // back through the same handler as a drag, without persisting - a transient
  // zoom must not overwrite the position the user chose.
  useEffect(() => {
    if (!pinned || !pickerPosition) return;
    function clampIntoViewport(): void {
      const element = pickerRef.current;
      if (!element || !pickerPosition) return;
      const rect = element.getBoundingClientRect();
      const clamped = clampPickerPosition(
        pickerPosition,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      if (clamped.top === pickerPosition.top && clamped.left === pickerPosition.left) return;
      onPickerPositionChange(clamped, false);
    }
    clampIntoViewport();
    window.addEventListener("resize", clampIntoViewport);
    return () => window.removeEventListener("resize", clampIntoViewport);
  }, [pinned, pickerPosition, onPickerPositionChange]);

  // Task 035 (R8 follow-up). The service worker refuses past the limit
  // anyway; this stops the user reaching that refusal through a control that
  // looked available. Counted from the same effective list the rows render
  // from, so what the user can see and what the limit counts are the same
  // thing.
  const fieldIsFull = effectiveEntries.length >= MAX_TEMPLATES_PER_FIELD;
  const isDraftSavable = draft.length > 0 && isTemplateContentWithinLimit(draft) && !fieldIsFull;
  const visibleOutcome = outcome ?? (lastAction ? outcomeForAction(lastAction) : null);
  const keepOpenLabel = pinned ? t.turnOffKeepOpen() : t.keepOpen();

  return (
    <>
    <section
      lang={language}
      ref={pickerRef}
      class={["picker", pinned ? "pinned" : "", writing ? "writing" : "", mode === "find-similar-field" ? "finding" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={t.pickerRegion()}
      onKeyDown={(event) => handlePickerKeyDown(event)}
      onFocusCapture={followFocus}
      style={{
        ...(pinned && pickerPosition ? { top: `${pickerPosition.top}px`, left: `${pickerPosition.left}px` } : {}),
        ...(writing && writingHeight ? { minHeight: `${writingHeight}px` } : {}),
      }}
    >
      <header
        onPointerDown={(event) => handleHeaderPointerDown(event)}
        onPointerMove={(event) => handleHeaderPointerMove(event)}
        onPointerUp={(event) => handleHeaderPointerUp(event)}
        onPointerCancel={(event) => handleHeaderPointerUp(event)}
      >
        {/* Task 044 (owner request, 2026-09-15): the header names where the
            reader is. On the Templates it is FillNest, with the mark, so a
            panel drawn on someone else's page says whose it is; on the
            Field list it is that page, with Back in the corner where people
            look for it - reachable without scrolling to the list's end. */}
        {mode === "find-similar-field" ? (
          <span class="header-lead">
            <button type="button" class="back" disabled={sharedActionBusy} onClick={stepBackFromFindSimilarField}>
              <BackIcon />
              {t.back()}
            </button>
            <strong class="header-title">{t.shareWith()}</strong>
          </span>
        ) : (
          <span class="header-lead">
            <BrandIcon class="header-mark" />
            <strong>FillNest</strong>
          </span>
        )}
        <span class="header-actions">
          <button
            type="button"
            class={pinned ? "pin pinned" : "pin"}
            aria-label={keepOpenLabel}
            aria-pressed={pinned}
            title={keepOpenLabel}
            onClick={() => onPinnedChange(!pinned)}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            class="close"
            aria-label={t.close()}
            onClick={() => {
              onPinnedChange(false);
              onClose();
            }}
          >
            ×
          </button>
        </span>
      </header>
      {/* Two rows, deliberately: what this Field *is* (persistent, and its
          affordances) never gets buried by what just *happened* (transient).
          Only the result row is a live region - ambient state is readable
          content, not something to re-announce. */}
      <div
        class={
          targetFieldActionable
            ? `picker-context${
                logicalPageCandidate
                  ? " picker-context-candidate"
                  : mySharedSet
                    ? " picker-context-shared"
                    : ""
              }`
            : "picker-context picker-context-invalid"
        }
      >
          <span class="pinned-dot" aria-hidden="true" />
          {!targetFieldActionable ? (
            <span>{t.noUsableField()}</span>
          ) : (
            <span class="picker-context-field">
              <FieldAliasEditor
                messages={t}
                showHint
                displayLabel={fieldLabel}
                editing={fieldAliasEdit?.key === `current:${fieldProfileId}`}
                draft={fieldAliasDraft}
                busy={fieldAliasBusy}
                onStart={() => beginFieldAliasEdit(currentFieldAliasTarget())}
                onDraftChange={setFieldAliasDraft}
                onSave={(value) => void saveFieldAlias(value)}
                onCancel={cancelFieldAliasEdit}
              />
              {fieldAliasEdit?.key !== `current:${fieldProfileId}` && <span>
                {logicalPageCandidate ? (
                  <>{t.looksLikeFilledBefore()}</>
                ) : mySharedSet ? (
                  // Plain text, matching the sibling "looks like a page..."/
                  // "following focus" status lines below - `<strong>` here
                  // previously matched the Field Name's own bold treatment
                  // one span over, making "Shared" easy to mistake for part
                  // of the Field's name rather than secondary status text.
                  <>
                    {" "}
                    {t.sharedStatus(mySharedSet.memberFieldProfileIds.length)}
                  </>
                ) : (
                  <>{t.followingFocus()}</>
                )}
              </span>}
            </span>
          )}
          {logicalPageCandidate && targetFieldActionable && fieldAliasEdit?.key !== `current:${fieldProfileId}` && (
            <span class="picker-context-actions">
              <button
                type="button"
                class="picker-context-action"
                onClick={() => setMode("review-candidate")}
              >{t.review()}</button>
            </span>
          )}
          {!logicalPageCandidate && targetFieldActionable && bindingSupported && fieldAliasEdit?.key !== `current:${fieldProfileId}` && (
            <span class="picker-context-actions">
              {/* Task 021 Addendum C: icons, to leave the Field's name the
                  room. The name says what each does; the explanation shows
                  at once on hover and on keyboard focus, and is read as the
                  button's description. */}
              {mySharedSet && (
                <button
                  type="button"
                  class="picker-context-action picker-context-icon"
                  aria-label={t.stopSharing()}
                  aria-describedby="fillnest-leave-sharing-hint"
                  data-tooltip={t.leaveSharingHint()}
                  disabled={sharedActionBusy}
                  onClick={() => void stopSharing()}
                ><LeaveSharingIcon /><span id="fillnest-leave-sharing-hint" hidden>{t.leaveSharingHint()}</span></button>
              )}
              <button
                type="button"
                class="picker-context-action picker-context-icon"
                aria-label={t.shareWith()}
                aria-describedby="fillnest-share-with-hint"
                data-tooltip={t.shareWithHint()}
                disabled={sharedActionBusy}
                onClick={() => void openFindSimilarField()}
              ><ShareWithIcon /><span id="fillnest-share-with-hint" hidden>{t.shareWithHint()}</span></button>
            </span>
          )}
      </div>
      {visibleOutcome && (
        <div class={`picker-result picker-result-${visibleOutcome.tone}`} role="status">
          <span>{visibleOutcome.message}</span>
          <span class="picker-result-actions">
            {lastAction && (
              <button
                type="button"
                class="picker-context-action"
                disabled={!targetFieldActionable}
                onClick={() => void undo()}
              >{t.undo()}</button>
            )}
            {visibleOutcome.showDelete && visibleOutcome.template && (
              <button
                type="button"
                class="picker-context-action picker-context-delete"
                onClick={() => void deleteTemplate(visibleOutcome.template!)}
              >{t.deleteTemplateAction()}</button>
            )}
          </span>
        </div>
      )}
      {/* Not `role="status"`: AGENTS.md reserves that region for outcomes and
          errors, and this is an offer with its own actions. A named region
          announced politely says the same thing to a screen reader without
          claiming the outcome slot. */}
      {mode === "list" && offeredLinkCandidates.length > 0 && targetFieldActionable && (
        <div
          class="picker-link-offer"
          role="region"
          aria-label={t.suggestedSharing()}
          aria-live="polite"
        >
          <span>
            {offeredLinkCandidates.length === 1
              ? t.looksLikeSameField(offeredLinkCandidates[0]!.fieldLabel)
              : t.looksLikeSameEditor(offeredLinkCandidates.length)}
          </span>
          {/* Task 024 Addendum C.1: where each box is, not only what it is
              called. A Field's derived name comes from the page's own markup
              and can be something the user has never read, so the page it
              lives on is often the more recognizable half. */}
          <span class="picker-link-offer-fields">
            {offeredLinkCandidates
              .map((candidate) =>
                candidate.pageLabel && candidate.pageLabel !== candidate.fieldLabel
                  ? `${candidate.fieldLabel} (${candidate.pageLabel})`
                  : candidate.fieldLabel,
              )
              .join(" · ")}
          </span>
          <span class="picker-result-actions">
            <button
              type="button"
              class="picker-context-action"
              disabled={sharedActionBusy}
              onClick={() => void acceptLinkOffer(offeredLinkCandidates)}
            >{t.shareTemplates()}</button>
            <button
              type="button"
              class="picker-context-action"
              disabled={sharedActionBusy}
              onClick={() => void declineLinkOffer(offeredLinkCandidates)}
            >{t.notTheSame()}</button>
            <button
              type="button"
              class="picker-context-action"
              aria-label={t.dismissSuggestion()}
              onClick={() => setLinkOfferDismissed(true)}
            >{t.later()}</button>
          </span>
        </div>
      )}
      {!bindingSupported && (
        <p class="picker-note" role="status">
{t.noStableIdentity()}
        </p>
      )}
      {insertionRejectionNotice !== null && (
        <div class="picker-result picker-result-danger" role="alert">
          <span>{t.insertionRejected()}</span>
          <span class="picker-result-actions">
            <button
              type="button"
              class="picker-context-action"
              onClick={() => {
                void onCopyToClipboard(insertionRejectionNotice).then((copied) =>
                  setOutcome({
                    tone: copied ? "success" : "danger",
                    message: copied
                      ? t.copiedToClipboard()
                      : t.clipboardRefused(),
                  }),
                );
              }}
            >{t.copyToClipboard()}</button>
          </span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {repeatInsertNotice && (
        <p role="status" class="repeat-insert-notice">
          {t.repeatInsertNotice(repeatInsertNotice.name, repeatInsertNotice.count)}
        </p>
      )}
      {mode === "list" && pendingSharedBind && (
        <>
          <p>
            <RichText
              parts={t.bindToSetQuestion(
                deriveOutcomePreview(pendingSharedBind.content),
                mySharedSet?.name ?? "",
                mySharedSet?.memberFieldProfileIds.length ?? 0,
              )}
            />
          </p>
          <div class="actions">
            <button
              type="button"
              disabled={!targetFieldActionable || sharedActionBusy}
              onClick={() => void executeBind(pendingSharedBind)}
            >{t.bindToSharedSet()}</button>
            <button type="button" class="secondary" disabled={sharedActionBusy} onClick={() => setPendingSharedBind(null)}>{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "list" && !pendingSharedBind && pendingShare && (
        <>
          <p>
            <RichText
              parts={t.shareQuotedWithSetQuestion(
                deriveOutcomePreview(pendingShare.template.content),
                mySharedSet?.memberFieldProfileIds.length ?? 0,
                mySharedSet?.name ?? "",
              )}
            />
            {pendingShare.willMerge ? ` ${t.privateVersionMergesIntoShared()}` : ""}
          </p>
          <div class="actions">
            <button
              type="button"
              disabled={!targetFieldActionable}
              onClick={() => void shareThisVersion(pendingShare.template, pendingShare.slotId)}
            >{t.shareWithTheSet()}</button>
            <button
              type="button"
              class="secondary"
              disabled={!targetFieldActionable}
              onClick={() =>
                void openFindSimilarField({ template: pendingShare.template, slotId: pendingShare.slotId })
              }
            >{t.shareWithADifferentField()}</button>
            <button type="button" class="secondary" onClick={() => setPendingShare(null)}>{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "list" && editing !== null && (
        <TemplateEditPanel
          template={editing}
          draft={editDraft}
          setDraft={setEditDraft}
          scope={templateEditScope}
          onSaveEverywhere={() => void updateTemplate()}
          onSaveCopyForField={() => void saveCopyForField()}
          onSaveForThisField={() => void saveOverrideForField()}
          onCancel={() => {
            setEditing(null);
            setEditDraft("");
          }}
        />
      )}
      {mode === "list" && editing === null && !pendingShare && !pendingSharedBind && (
        <>
          {/* Task 042: insert, bind and share, on the Picker's first open. It
              sits above Search and takes none of Search's focus. */}
          {tips.shows("picker-start") && (
            <StartCard
              lines={[t.pickerTipCreate(), t.pickerTipInsert(), t.pickerTipManage()]}
              onDismiss={() => tips.dismiss("picker-start")}
            />
          )}
          <label>
            {t.searchTemplates()}
            <input
              ref={searchInputRef}
              type="search"
              aria-label={t.searchTemplates()}
              value={query}
              onInput={(event) => {
                cancelFieldAliasEdit();
                setQuery(event.currentTarget.value);
              }}
            />
          </label>

          {boundTemplates.length === 0 &&
            query.trim().length === 0 && (
              <p>
                {mySharedSet
                  ? t.noTemplatesInSharedSetYet()
                  : fieldRecognized
                    ? t.noTemplatesBoundToField()
                    : t.noSavedMatchForField()}
              </p>
            )}

          {boundTemplates.length > 0 && (
            <>
              <h3 class="group-heading">
                {mySharedSet
                  ? t.sharedSetFieldCount(mySharedSet.memberFieldProfileIds.length)
                  : t.thisFieldHeading()}
                {/* Shown only from within five of the limit: below that a
                    running total is noise on a list whose length is visible at
                    a glance, and above it meeting the limit for the first time
                    as a refusal would be a surprise. */}
                {effectiveEntries.length >= FIELD_TEMPLATE_COUNT_VISIBLE_FROM && (
                  <span class={fieldIsFull ? "picker-field-count full" : "picker-field-count"}>
                    {effectiveEntries.length} / {MAX_TEMPLATES_PER_FIELD}
                  </span>
                )}
              </h3>
              <TemplateList
                templates={boundTemplates}
                onInsert={handleInsert}
                insertionRejected={clipboardFallbackOffered}
                onCopyToClipboard={onCopyToClipboard}
                onUnbind={(template) => void unbind(template)}
                onEdit={startEdit}
                onDelete={(template) => void deleteTemplate(template)}
                highlightedId={highlightedId}
                onHighlight={highlightRow}
                onPointerLeaveList={lingerFlyout}
                insertCounts={insertCounts}
                targetFieldActionable={targetFieldActionable}
                fieldOnlyTemplateIds={fieldOnlyTemplateIds}
                onShareThisVersion={mySharedSet ? (template) => requestShareThisVersion(template) : undefined}
              />
            </>
          )}

          {query.trim().length > 0 &&
            (searchResults.length === 0 ? (
              <p>{t.noMatchingTemplates()}</p>
            ) : (
              <>
                <h3 class="group-heading">{t.allMatchingTemplates()}</h3>
                {fieldIsFull && <p class="picker-length-error" role="status">{t.fieldTemplateLimit(MAX_TEMPLATES_PER_FIELD)}</p>}
                <TemplateList
                  templates={searchResults}
                  onInsert={handleInsert}
                insertionRejected={clipboardFallbackOffered}
                onCopyToClipboard={onCopyToClipboard}
                  onBind={fieldIsFull || !bindingSupported ? undefined : (template) => void bind(template)}
                  onBindToFieldOnly={
                    mySharedSet && !fieldIsFull && bindingSupported
                      ? (template) => void bindToFieldOnly(template)
                      : undefined
                  }
                  onEdit={startEdit}
                  onDelete={(template) => void deleteTemplate(template)}
                  highlightedId={highlightedId}
                  onHighlight={highlightRow}
                  onPointerLeaveList={lingerFlyout}
                  insertCounts={insertCounts}
                  targetFieldActionable={targetFieldActionable}
                  siteBadges={siteBadges}
                />
              </>
            ))}

          <div class="actions">
            <button
              type="button"
              disabled={!targetFieldActionable}
              onClick={() => {
                // Task 036 Addendum A.3: an unsaved rename is abandoned the
                // moment the user does something else, rather than lingering
                // and being saved later against a Field they have left.
                cancelFieldAliasEdit();
                rememberListHeight();
                setMode("compose");
              }}
            >{t.newTemplate()}</button>
            {activeList.length > 0 && (
              <span class="keyboard-hint" aria-hidden="true">
                {t.keyboardHint()}
              </span>
            )}
          </div>
        </>
      )}
      {mode === "compose" && (
        <>
          <label class="picker-writing-field">{t.templateContent()}<textarea
              aria-label={t.templateContent()}
              value={draft}
              onInput={composeInput.onInput}
              ref={composeInput.ref}
            />
          </label>
          {/* Task 035 (R8). Without this the Save buttons would simply be
              disabled with nothing saying why. `role="alert"` because it
              appears in response to what the user just typed. */}
          <TemplateLengthCounter content={draft} />
          {draft.length > 0 && (composeInput.truncated || !isTemplateContentWithinLimit(draft)) && (
            <p class="picker-length-error" role="alert">{t.templateTooLong(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS, MAX_TEMPLATE_CONTENT_BYTES)}</p>
          )}
          {fieldIsFull && <p class="picker-length-error" role="alert">{t.fieldTemplateLimit(MAX_TEMPLATES_PER_FIELD)}</p>}
          {fieldContentReplacement && (
            <p class="picker-replaced" role="status">
              {t.usedFieldContent()}{" "}
              <button type="button" class="secondary" onClick={undoUseFieldContent}>{t.undoUseFieldContent()}</button>
            </p>
          )}
          <div class="actions">
            <button type="button" disabled={!targetFieldActionable} onClick={takeFieldContent}>{t.useFieldContent()}</button>
            {mySharedSet ? (
              <>
                <SaveButton
                  enabled={isDraftSavable && targetFieldActionable && bindingSupported}
                  onClick={() => void createTemplate()}
                >{t.saveForSharedFields()}</SaveButton>
                <SaveButton
                  enabled={isDraftSavable && targetFieldActionable}
                  onClick={() => void createTemplateFieldOnly()}
                >{t.saveForThisField()}</SaveButton>
              </>
            ) : (
              <>
                <SaveButton
                  enabled={isDraftSavable && targetFieldActionable}
                  onClick={() => void createTemplate()}
                >{t.save()}</SaveButton>
                {/* Task 027 Addendum D: at save time both choices are visible
                    to this Field alone, so the label has to state the *future*
                    difference - what happens if this Field is ever shared. */}
                <SaveButton
                  enabled={isDraftSavable && targetFieldActionable && bindingSupported}
                  title={t.keepsPrivateHint()}
                  onClick={() => void createTemplate(true)}
                >{t.saveForThisFieldOnly()}</SaveButton>
              </>
            )}
            <button
              type="button"
              class="secondary"
              onClick={() => {
                setDraft("");
                setMode("list");
              }}
            >{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "review-candidate" && logicalPageCandidate && (
        <>
          <p>{t.matchesSimilarPage()}</p>
          {logicalPageCandidateEvidence && (
            <p class="candidate-route">
              {logicalPageCandidateEvidence.origin}
              {logicalPageCandidateEvidence.routePattern}
            </p>
          )}
          {candidatePreviewTemplates.length > 0 ? (
            <ul class="candidate-template-list">
              {candidatePreviewTemplates.map((template) => (
                <li key={template.id}>{deriveOutcomePreview(template.content)}</li>
              ))}
            </ul>
          ) : (
            <p>{t.couldNotPreview()}</p>
          )}
          <p>{t.confirmMatchExplanation(candidatePreviewTemplates.length, t.stopMatching())}</p>
          <div class="actions">
            <button
              type="button"
              disabled={candidateBusy || !targetFieldActionable}
              onClick={() => void confirmLogicalPageCandidate()}
            >{t.confirm()}</button>
            <button type="button" class="secondary" disabled={candidateBusy} onClick={dismissLogicalPageCandidate}>{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "find-similar-field" && pendingLink && (
        <>
          {/* Task 027 Addendum C.5: this used to say only that the operation
              "affects N fields across M Sites", which never told the reader
              *what* happens to them - whether the target receives this Field's
              Templates, this Field receives theirs, or both. It is the one
              audience-changing confirmation that failed the review's test:
              can the reader state who will see what, before clicking? The
              Join/Merge & Share copy below already states its outcome. */}
          <p>
            <RichText
              parts={t.shareTemplatesWithQuestion(
                pendingLink.candidate.fieldLabel,
                pendingLink.fieldCount,
                pendingLink.siteCount,
              )}
            />
          </p>
          <div class="actions">
            <button type="button" disabled={sharedActionBusy} onClick={() => void executeLinkCandidate(pendingLink.candidate)}>{t.share()}</button>
            <button type="button" class="secondary" disabled={sharedActionBusy} onClick={() => setPendingLink(null)}>{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "find-similar-field" && !pendingLink && pendingShareTarget && shareTargetContext && (
        // Task 027 Addendum B / Explicit Scope UI: names the affected Field
        // and Set and states both the Set membership change and that every
        // ordinary shared Template from the Sets becomes available in the
        // resulting Set - one explicit confirmation, no scope-broadening
        // choice pre-selected, before the single atomic composite mutation.
        <>
          <p>
            {pendingShareTarget.mode === "merge" ? (
              <RichText
                parts={t.mergeSetsAndShareQuestion(
                  deriveOutcomePreview(shareTargetContext.template.content),
                  pendingShareTarget.candidate.fieldLabel,
                  pendingShareTarget.fieldCount,
                  pendingShareTarget.siteCount,
                )}
              />
            ) : (
              <RichText
                parts={t.joinSetAndShareQuestion(
                  pendingShareTarget.candidate.fieldLabel,
                  mySharedSet?.name ?? "",
                  deriveOutcomePreview(shareTargetContext.template.content),
                  pendingShareTarget.fieldCount,
                )}
              />
            )}
          </p>
          {/* The number the confirmation used to leave out. A join and a merge
              both take the union of the two sides, so this is where a Field
              can end up past the limit - and the only place the user gets to
              weigh that against the sharing they came here to do. It is stated
              either way, and flagged when it goes over; it never blocks. */}
          <p
            class={
              pendingShareTarget.resultingTemplateCount > MAX_TEMPLATES_PER_FIELD
                ? "picker-share-count over"
                : "picker-share-count"
            }
            role={pendingShareTarget.resultingTemplateCount > MAX_TEMPLATES_PER_FIELD ? "alert" : undefined}
          >
            {pendingShareTarget.resultingTemplateCount > MAX_TEMPLATES_PER_FIELD ? (
              <RichText parts={t.afterwardsOverLimit(pendingShareTarget.resultingTemplateCount, MAX_TEMPLATES_PER_FIELD)} />
            ) : (
              <RichText parts={t.afterwardsWithinLimit(pendingShareTarget.resultingTemplateCount, MAX_TEMPLATES_PER_FIELD)} />
            )}
          </p>
          <div class="actions">
            <button type="button" disabled={sharedActionBusy} onClick={() => void executeShareTarget()}>
              {pendingShareTarget.mode === "merge" ? t.mergeSetsAndShare() : t.joinSetAndShare()}
            </button>
            <button
              type="button"
              class="secondary"
              disabled={sharedActionBusy}
              onClick={() => setPendingShareTarget(null)}
            >{t.cancel()}</button>
          </div>
        </>
      )}
      {mode === "find-similar-field" && !pendingLink && !pendingShareTarget && (
        <>
          {tips.shows("share-with") && (
            <PageNote text={t.noteShareWith()} onDismiss={() => tips.dismiss("share-with")} />
          )}
          <label>
            {shareTargetContext ? t.searchFieldsToShareWith() : t.searchFieldsLabel()}
            <input
              ref={findSimilarSearchRef}
              type="search"
              aria-label={shareTargetContext ? t.searchFieldsToShareWith() : t.searchFieldsLabel()}
              placeholder={shareTargetContext ? t.searchFieldsToShareTemplateWith() : t.searchFieldsAcrossPages()}
              value={findSimilarQuery}
              onInput={(event) => setFindSimilarQuery(event.currentTarget.value)}
            />
          </label>
          {shareTargetContext ? (
            shareTargetResults.length > 0 ? (
              <ul class="shared-field-candidates">
                {shareTargetResults.map((candidate) => renderFindSimilarRow(candidate))}
              </ul>
            ) : (
              <p>{t.noOtherFieldsToShareWith()}</p>
            )
          ) : findSimilarNormalizedQuery.length === 0 ? (
            // Search is the only entry point to another page or Site - so by
            // default this Picker shows nothing but the current page's own
            // Fields, never an automatic cross-page recommendation.
            onPageFieldCandidates.length > 0 ? (
              <div class="find-similar-on-page">
                <span class="group-heading">{t.inThisPage()}</span>
                <ul class="shared-field-candidates">
                  {beforeCurrentFieldCandidateCount > 0 && !showAllSharedCandidates && !showFieldsBefore && (
                    <li class="find-similar-before-count">
                      <button type="button" class="secondary" onClick={() => setShowFieldsBefore(true)}>
                        {t.showFieldsBefore(beforeCurrentFieldCandidateCount)}
                      </button>
                    </li>
                  )}
                  {(showAllSharedCandidates || showFieldsBefore) && fieldDocumentOrder !== null && fieldDocumentOrder !== undefined &&
                    onPageFieldCandidates
                      .filter((candidate) => candidate.documentOrder !== null && candidate.documentOrder < fieldDocumentOrder)
                      .map((candidate) => renderOnPageFieldRow(candidate))}
                  <li class="find-similar-current-field">
                    <span>{t.focusedField()}</span>
                    <strong>{fieldLabel}</strong>
                  </li>
                  {(showAllSharedCandidates && fieldDocumentOrder !== null && fieldDocumentOrder !== undefined
                    ? onPageFieldCandidates.filter(
                        (candidate) => candidate.documentOrder === null || candidate.documentOrder > fieldDocumentOrder,
                      )
                    : visibleAddFieldCandidates
                  ).map((candidate) => renderOnPageFieldRow(candidate))}
                  {hiddenAddFieldCandidateCount > 0 && (
                    <li class="shared-field-candidates-more">
                      <button type="button" class="secondary" onClick={() => setShowAllSharedCandidates(true)}>
                        {t.showAllOtherFields(onPageFieldCandidates.length)}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <p>{t.noOtherFieldsOnPage()}</p>
            )
          ) : findSimilarLoading ? (
            <p>{t.lookingForSimilarFields()}</p>
          ) : onPageSearchMatches.length > 0 || findSimilarSearchResults.length > 0 ? (
            <>
              {onPageSearchMatches.length > 0 && (
                <div class="find-similar-on-page">
                  <span class="group-heading">{t.inThisPage()}</span>
                  <ul class="shared-field-candidates">
                    {onPageSearchMatches.map((candidate) => renderOnPageFieldRow(candidate))}
                  </ul>
                </div>
              )}
              {findSimilarSearchResults.length > 0 && (
                <ul class="shared-field-candidates">
                  {findSimilarSearchResults.map((candidate) => renderFindSimilarRow(candidate))}
                </ul>
              )}
            </>
          ) : (
            <p>{t.noFieldsMatchSearch()}</p>
          )}
        </>
      )}
    </section>
    {mode === "list" && previewTemplate && flyoutPosition && (
      <div
        ref={flyoutRef}
        lang={language}
        class={flyoutPosition.coversPicker ? "preview-flyout covers-picker" : "preview-flyout"}
        role="note"
        aria-label={t.fullTemplateText()}
        style={{
          top: `${flyoutPosition.top}px`,
          left: `${flyoutPosition.left}px`,
          maxHeight: `${flyoutPosition.maxHeight}px`,
        }}
        onMouseEnter={() => {
          cancelFlyoutLinger();
          setFlyoutHoldId(previewTemplate.id);
        }}
        onMouseLeave={() => setFlyoutHoldId(null)}
      >
        <span class="preview-flyout-label">{t.fullText()}</span>
        <span class="preview-flyout-body">{previewTemplate.content}</span>
      </div>
    )}
    </>
  );
}

/**
 * Owner QA 2026-09-14. A Save button that cannot act yet - nothing changed,
 * nothing typed, too long - stays in the Tab order and says it is unavailable,
 * rather than being `disabled`: a disabled button drops out of the Tab order,
 * so Tab from the editor jumped straight to Cancel and the Save choices seemed
 * not to exist.
 */
function SaveButton({ enabled, onClick, title, children }: {
  enabled: boolean;
  onClick(): void;
  title?: string;
  children: preact.ComponentChildren;
}) {
  return (
    <button
      type="button"
      aria-disabled={enabled ? undefined : "true"}
      title={title}
      onClick={() => {
        if (enabled) onClick();
      }}
    >
      {children}
    </button>
  );
}

/**
 * Owner QA 2026-09-14. Editing a Template opens its own panel, as New template
 * does, instead of an editor squeezed into its row: the text gets the Picker's
 * whole height, and nothing in the list - the full-text flyout above all -
 * can lie over it.
 */
function TemplateEditPanel({
  template,
  draft,
  setDraft,
  scope,
  onSaveEverywhere,
  onSaveCopyForField,
  onSaveForThisField,
  onCancel,
}: {
  template: TemplateRecord;
  draft: string;
  setDraft(value: string): void;
  scope: TemplateEditScope;
  onSaveEverywhere(): void;
  onSaveCopyForField(): void;
  onSaveForThisField(): void;
  onCancel(): void;
}) {
  const t = useMessages();
  const input = useTemplateContentInput(draft, setDraft);
  const savable = isEditContentSavable(template, draft);
  return (
    <div class="picker-writing">
      <label class="picker-writing-field">
        {t.editTemplateContent()}
        <textarea aria-label={t.editTemplateContentLower()} value={draft} onInput={input.onInput} ref={input.ref} />
      </label>
      <TemplateLengthCounter content={draft} />
      {(input.truncated || !isTemplateContentWithinLimit(draft)) && (
        <p class="picker-length-error" role="alert">{t.templateTooLong(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS, MAX_TEMPLATE_CONTENT_BYTES)}</p>
      )}
      <div class="actions">
        {scope === "field-copy" ? (
          <>
            <SaveButton enabled={savable} onClick={onSaveEverywhere}>{t.saveEverywhere()}</SaveButton>
            <SaveButton enabled={savable} onClick={onSaveCopyForField}>{t.saveACopyHere()}</SaveButton>
          </>
        ) : scope === "shared-inherited" ? (
          <>
            <SaveButton enabled={savable} onClick={onSaveCopyForField}>{t.saveForSharedFields()}</SaveButton>
            <SaveButton enabled={savable} onClick={onSaveForThisField}>{t.saveForThisField()}</SaveButton>
          </>
        ) : scope === "shared-field-only" ? (
          // Task 027 Addendum A (defect F): a private relationship offers a
          // single, never Set-wide, save choice - wired to the same Set-level
          // copy command, which stays private because it targets this Field's
          // own owner-only slot.
          <SaveButton enabled={savable} onClick={onSaveCopyForField}>{t.saveForThisField()}</SaveButton>
        ) : (
          <SaveButton enabled={savable} onClick={onSaveEverywhere}>
            {scope === "everywhere-only" ? t.saveEverywhere() : t.save()}
          </SaveButton>
        )}
        <button type="button" class="secondary" onClick={onCancel}>{t.cancel()}</button>
      </div>
    </div>
  );
}

function TemplateList({
  templates,
  onInsert,
  onBind,
  onBindToFieldOnly,
  onUnbind,
  onEdit,
  onDelete,
  highlightedId,
  onHighlight,
  onPointerLeaveList,
  insertCounts,
  targetFieldActionable,
  siteBadges,
  fieldOnlyTemplateIds,
  onShareThisVersion,
  insertionRejected,
  onCopyToClipboard,
}: {
  templates: TemplateRecord[];
  onInsert(template: TemplateRecord): void;
  /** Task 036: this Field's editor has refused an insertion before. */
  insertionRejected: boolean;
  onCopyToClipboard(content: string): Promise<boolean>;
  onBind?(template: TemplateRecord): void;
  // Task 027: present only for a Shared Set member's Search results,
  // alongside `onBind` ("Bind to Shared Set") - "Bind to this field" never
  // affects any other member.
  onBindToFieldOnly?(template: TemplateRecord): void;
  onUnbind?(template: TemplateRecord): void;
  onEdit(template: TemplateRecord): void;
  onDelete(template: TemplateRecord): void;
  highlightedId: string | null;
  onHighlight(id: string | null): void;
  /** The pointer left the list while `leavingId` was highlighted. */
  onPointerLeaveList?(leavingId: string | null): void;
  insertCounts: Map<string, number>;
  targetFieldActionable: boolean;
  // Populated for deliberate Search results so cross-Site matches carry a
  // visible, accessible origin cue instead of looking indistinguishable from
  // the current Field's own Templates.
  siteBadges?: Map<string, SiteAffinityBadge>;
  // Task 027: which of these Templates are a Field-only relationship the
  // current Field owns - offers `Share this version` only for those.
  fieldOnlyTemplateIds?: Set<string>;
  onShareThisVersion?(template: TemplateRecord): void;
}) {
  const t = useMessages();
  return (
    <ul
      // Task 036 Addendum J: when the pointer leaves the list, the highlight
      // goes back to wherever focus is - a row, or nothing - so Enter in Search
      // cannot insert a row the pointer merely passed over.
      onMouseLeave={(event) => {
        const leavingId = highlightedId;
        const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
        const row = root.activeElement?.closest<HTMLElement>("[data-template-row]");
        onHighlight(row?.dataset.templateId ?? null);
        onPointerLeaveList?.(leavingId);
      }}
    >
      {templates.map((template) => {
        const isHighlighted = highlightedId === template.id;
        const repeatCount = insertCounts.get(template.id) ?? 0;
        const siteBadge = siteBadges?.get(template.id);
        return (
          <li
            key={template.id}
            id={`template-row-${template.id}`}
            data-template-row
            data-template-id={template.id}
            data-highlighted={isHighlighted || undefined}
            data-repeat-inserted={repeatCount >= 2 || undefined}
            // Task 036 Addendum J: only a pointer that actually moves chooses a
            // row. A row appearing under a resting pointer - the Picker
            // opening where the user just clicked - fires mouseenter too, and
            // selected a Template the user never pointed at.
            onMouseMove={(event) => {
              if (event.movementX !== 0 || event.movementY !== 0) onHighlight(template.id);
            }}
          >
              <>
                <button
                  class={siteBadge ? "template template-with-badge" : "template"}
                  data-template-content
                  type="button"
                  disabled={!targetFieldActionable}
                  // Task 023 Addendum B5 (13): the Template text is this
                  // button's accessible name, so a screen reader announced
                  // "<text>, button" and never what pressing it would do.
                  // `title` becomes the accessible description alongside that
                  // name rather than replacing it.
                  title={
                    repeatCount >= 2
                      ? t.insertTitleRepeated(repeatCount)
                      : t.insertThisTemplate()
                  }
                  onClick={() => onInsert(template)}
                >
                  <span class="template-preview">{derivePreview(template.content)}</span>
                </button>
                {siteBadge && (
                  <span
                    class="site-badge"
                    aria-label={t.siteAffinityBadge(siteBadge.primarySite, siteBadge.otherCount)}
                  >
                    {siteBadge.primarySite}
                    {siteBadge.otherCount > 0 ? ` +${siteBadge.otherCount}` : ""}
                  </span>
                )}
                <span class="template-actions" data-template-actions>
                  {insertionRejected && (
                    <button
                      type="button"
                      class="action"
                      aria-label={t.copyToClipboard()}
                      title={t.copyInsteadHint()}
                      onClick={() => void onCopyToClipboard(template.content)}
                    >
                      <CopyIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    class="action"
                    aria-label={t.edit()}
                    title={t.edit()}
                    onClick={() => onEdit(template)}
                  >
                    <EditIcon />
                  </button>
                  {onBindToFieldOnly && (
                    <button
                      type="button"
                      disabled={!targetFieldActionable}
                      class="action"
                      aria-label={t.bindToThisField()}
                      title={t.bindToThisField()}
                      onClick={() => onBindToFieldOnly(template)}
                    >
                      <BindIcon />
                    </button>
                  )}
                  {onBind && (
                    <button
                      type="button"
                      disabled={!targetFieldActionable}
                      class="action"
                      aria-label={onBindToFieldOnly ? t.bindToSharedSet() : t.bindToThisField()}
                      title={onBindToFieldOnly ? t.bindToSharedSet() : t.bindToThisField()}
                      onClick={() => onBind(template)}
                    >
                      {onBindToFieldOnly ? <BindSharedSetIcon /> : <BindIcon />}
                    </button>
                  )}
                  {onShareThisVersion && fieldOnlyTemplateIds?.has(template.id) && (
                    <button
                      type="button"
                      disabled={!targetFieldActionable}
                      class="action"
                      aria-label={t.shareThisVersion()}
                      title={t.shareThisVersion()}
                      onClick={() => onShareThisVersion(template)}
                    >
                      <ShareIcon />
                    </button>
                  )}
                  {onUnbind && (
                    <button
                      type="button"
                      disabled={!targetFieldActionable}
                      class="action"
                      aria-label={t.removeFromThisField()}
                      data-tooltip={t.removeFromThisField()}
                      onClick={() => onUnbind(template)}
                    >
                      <RemoveFromFieldIcon />
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  class="template-delete"
                  aria-label={t.deleteTemplateEverywhere()}
                  data-tooltip={t.deleteTemplateEverywhere()}
                  onClick={() => onDelete(template)}
                >
                  <DeleteIcon />
                </button>
              </>

          </li>
        );
      })}
    </ul>
  );
}

async function readState(): Promise<FillNestState> {
  const response = await sendRequest({ type: "READ_STATE" });
  if (!response.ok) throw new Error(response.error);
  if (!isFillNestState(response.value)) throw new Error("Invalid FillNest state response");
  return response.value;
}


function isFillNestState(value: unknown): value is FillNestState {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === CURRENT_SCHEMA_VERSION &&
    "templates" in value &&
    Array.isArray(value.templates) &&
    "bindings" in value &&
    Array.isArray(value.bindings)
  );
}

function isBindingRecord(value: unknown): value is BindingRecord {
  return typeof value === "object" && value !== null && "id" in value && "templateId" in value;
}

function isTemplateRecord(value: unknown): value is TemplateRecord {
  return typeof value === "object" && value !== null && "id" in value && "content" in value && "revision" in value;
}

function isFieldContextResolution(value: unknown): value is FieldContextResolution {
  return (
    typeof value === "object" &&
    value !== null &&
    "pageProfileId" in value &&
    typeof value.pageProfileId === "string" &&
    "fieldProfileId" in value &&
    typeof value.fieldProfileId === "string" &&
    "siteId" in value &&
    typeof value.siteId === "string" &&
    "recognized" in value &&
    typeof value.recognized === "boolean"
  );
}

function isSharedTemplateSetRecord(value: unknown): value is SharedTemplateSetRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "siteId" in value &&
    "memberFieldProfileIds" in value &&
    Array.isArray((value as { memberFieldProfileIds: unknown }).memberFieldProfileIds)
  );
}

function isSharedTemplateBindingRecord(value: unknown): value is SharedTemplateBindingRecord {
  return typeof value === "object" && value !== null && "id" in value && "setId" in value && "templateId" in value;
}

function isBindTemplateToFieldOnlyResult(value: unknown): value is BindTemplateToFieldOnlyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "sharedBinding" in value &&
    isSharedTemplateBindingRecord((value).sharedBinding)
  );
}

function isPromoteFieldOnlySlotResult(value: unknown): value is PromoteFieldOnlySlotResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "sharedBinding" in value &&
    isSharedTemplateBindingRecord((value).sharedBinding) &&
    "previousOwnerFieldProfileId" in value &&
    typeof (value as { previousOwnerFieldProfileId: unknown }).previousOwnerFieldProfileId === "string"
  );
}

function isCreatedSharedTemplateBinding(value: unknown): value is CreatedSharedTemplateBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecord((value).template) &&
    "sharedBinding" in value &&
    isSharedTemplateBindingRecord((value as { sharedBinding: unknown }).sharedBinding)
  );
}

function isRemoveSharedTemplateSetMemberResult(value: unknown): value is RemoveSharedTemplateSetMemberResult {
  return typeof value === "object" && value !== null &&
    Array.isArray((value as { snapshotBindings?: unknown }).snapshotBindings) &&
    Array.isArray((value as { dormantBindings?: unknown }).dormantBindings);
}

function normalizeFieldNameTokens(label: string): string[] {
  return [...new Set(label.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
}

function isCreateSharedTemplateSetResult(value: unknown): value is CreateSharedTemplateSetResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "set" in value &&
    isSharedTemplateSetRecord((value).set)
  );
}

/**
 * Task 040. The service worker names candidate Fields and Pages in English:
 * to it they are search and sort keys. What the Picker shows is derived from
 * the same records, in the reader's language. Done where the candidates are
 * read, not where they arrive, so it follows a language change and never
 * depends on the Picker's own state having loaded first.
 */
function localizeCandidateLabels(
  candidates: CompatibilityCandidateView[],
  state: FillNestState | null,
  messages: Messages,
): CompatibilityCandidateView[] {
  if (!state || candidates.length === 0) return candidates;
  const fields = new Map(state.fieldProfiles.map((field) => [field.id, field] as const));
  const pages = new Map(state.pageProfiles.map((page) => [page.id, page] as const));
  return candidates.map((candidate) => {
    const field = fields.get(candidate.fieldProfileId);
    const page = pages.get(candidate.pageProfileId);
    return {
      ...candidate,
      ...(field ? { fieldLabel: fieldDisplayName(field, messages) } : {}),
      ...(page ? { pageLabel: pageDisplayName(page, messages) } : {}),
    };
  });
}

function isFindSimilarFieldCandidatesResult(value: unknown): value is FindSimilarFieldCandidatesResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { candidates?: unknown }).candidates) &&
    typeof (value as { currentFieldLabel?: unknown }).currentFieldLabel === "string"
  );
}

function isMergeSharedTemplateSetsResult(value: unknown): value is MergeSharedTemplateSetsResult {
  return (
    typeof value === "object" &&
    value !== null &&
    isSharedTemplateSetRecord((value as { set: unknown }).set) &&
    isSharedTemplateSetRecord((value as { removedSet: unknown }).removedSet) &&
    isSharedTemplateSetRecord((value as { previousKeepSet: unknown }).previousKeepSet)
  );
}

// Task 027 Addendum B composites.
function isJoinSetAndShareResult(value: unknown): value is JoinSetAndShareResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isSharedTemplateSetRecord(candidate.set) &&
    isSharedTemplateBindingRecord(candidate.sharedBinding) &&
    "addUndo" in candidate &&
    typeof candidate.previousOwnerFieldProfileId === "string"
  );
}

function isMergeSetsAndShareResult(value: unknown): value is MergeSetsAndShareResult {
  if (!isMergeSharedTemplateSetsResult(value)) return false;
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isSharedTemplateBindingRecord(candidate.sharedBinding) &&
    typeof candidate.previousOwnerFieldProfileId === "string"
  );
}

function isSaveTemplateCopyResult(value: unknown): value is SaveTemplateCopyForFieldResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecord((value).template) &&
    "binding" in value &&
    isBindingRecord((value as { binding: unknown }).binding)
  );
}

function isSaveTemplateCopyForSharedSetResult(
  value: unknown,
): value is SaveTemplateCopyForSharedSetResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecord((value).template) &&
    "sharedBinding" in value &&
    isSharedTemplateBindingRecord((value as { sharedBinding: unknown }).sharedBinding)
  );
}

function isSaveTemplateOverrideResult(
  value: unknown,
): value is SaveTemplateOverrideForFieldResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecord((value).template)
  );
}

function isCreateTemplateAndBindSharedFieldOnlyResult(
  value: unknown,
): value is CreateTemplateAndBindSharedFieldOnlyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "template" in value &&
    isTemplateRecord((value).template) &&
    "sharedBinding" in value &&
    isSharedTemplateBindingRecord((value as { sharedBinding: unknown }).sharedBinding)
  );
}

function assertNever(_value: never): never {
  throw new Error("Unhandled Picker LastAction");
}

function isEditContentSavable(editing: TemplateRecord, draft: string): boolean {
  return draft.trim().length > 0 && draft !== editing.content && isTemplateContentWithinLimit(draft);
}
