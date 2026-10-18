import { render } from "preact";

import type { ActivationSnapshot } from "../activation/activation-authority";
import {
  asSupportedField,
  FIELD_CANDIDATE_SELECTOR,
  isEditingHost,
  isFieldBindable,
  isNativeField,
  isSupportedExceptReadOnly,
  readFieldText,
  type SupportedField,
} from "../fields/dom-field";
import {
  applyTextInsertion,
  captureFieldSelection,
  insertionWasAccepted,
  type FieldSelectionSnapshot,
} from "../insertion/apply-text-insertion";
import {
  isPageStatusPositionResetNotification,
  isStateChangeNotification,
  type OpaqueLogicalPageCandidateEvidencePayload,
  type RuntimeResponse,
} from "../messages/runtime-messages";
import { messagesFor } from "../i18n/catalogue";
import { useLanguage, useMessages } from "../i18n/useMessages";
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  isLanguagePreference,
  resolveLanguage,
  type LanguagePreference,
} from "../i18n/language";
import { permissionOriginFromUrl } from "../permissions/permission-origin";
import {
  hasGenericSemanticKind,
  readDomRecognitionEvidence,
  readLogicalPageEvidence,
  snapshotPageFields,
  type PageFieldSnapshot,
} from "../recognition/dom-recognition";
import { buildPageIdentityKey } from "../recognition/recognition-evidence";
import type {
  FieldContextResolution,
  FillNestState,
  LogicalPageCandidateResolution,
  LogicalPageReviewCandidate,
  PickerPosition,
} from "../storage/fillnest-repository";
import type { TemplateRecord } from "../storage/fillnest-repository";
import { InlinePicker, type LastAction } from "../ui/picker/InlinePicker";
import { FieldControlIcon } from "../ui/icons/FillNestIcons";
import {
  clampPickerPosition as clampPickerPositionWithin,
  fieldControlSize,
  PICKER_VIEWPORT_MARGIN,
  pickerWidthWithin,
} from "../ui/picker/field-control-geometry";
import { pickerStyles } from "../ui/picker/picker-styles";
import { applyThemeToElement, prefersDark, watchSystemMode } from "../ui/theme/apply-theme";
import {
  DEFAULT_APPEARANCE,
  isThemeId,
  isThemeModePreference,
  resolveThemeMode,
  type AppearancePreference,
} from "../ui/theme/theme-tokens";
import {
  PageStatusControl,
  pageStatusStyles,
} from "../ui/page-status/PageStatusControl";
import { sendRequest } from "../ui/shared/runtime-request";

// Task 030: fixed at build time - "closed" in every production build, "open"
// only under `npm run build:e2e` so Playwright can drive the Picker through
// ordinary locators. A host page can read an open Shadow Root from its own
// main world, and the Picker renders Template content including full-library
// Search results, so the shipped artifact must be closed. The content script
// runs in an isolated world, so a page cannot patch `attachShadow` to defeat
// it, and every root is held in a closure rather than read back off its host.
const PICKER_SHADOW_MODE = __FILLNEST_PICKER_SHADOW_MODE__;

const ACTIVE_MARKER = "data-fillnest-extension-active";
const OVERLAY_MARKER = "data-fillnest-overlay";
const FIELD_MARKER = "data-fillnest-field";
const SELECTION_PREVIEW_MARKER = "data-fillnest-selection-preview";
/**
 * Task 036 Addendum A. The events that must not escape FillNest's own
 * interface into the page. Text input and clipboard only: pointer and focus
 * events still reach the page, which needs them to behave normally.
 */
/** The shortest gap between two attempts to bring a stale Field context up to date. */
const CONTEXT_REPAIR_INTERVAL_MS = 300;
const CONTAINED_UI_EVENTS = [
  "keydown",
  "keypress",
  "keyup",
  "beforeinput",
  "input",
  "paste",
  "cut",
  "copy",
] as const;

/**
 * The limits on what may count as an editing host's own visual box - see
 * `fieldAnchorBounds`.
 *
 * Task 036 Addendum A.2. These were absolute pixel margins and were too tight:
 * ChatGPT's composer is a good deal wider than the text node inside it, so the
 * box was rejected and the control landed back inside it, over the model
 * picker. Viewport-relative caps plus a generous multiple of the host describe
 * "a composer" without pretending to know its padding.
 */
const ANCHOR_MAX_HOST_WIDTH_RATIO = 3;
const ANCHOR_MAX_VIEWPORT_WIDTH_RATIO = 0.95;
const ANCHOR_MAX_EXTRA_HEIGHT = 260;
const PAGE_STATUS_MARKER = "data-fillnest-page-status";
/** Task 038: the control's own size, and how far a pointer travels before a click becomes a drag. */
const PAGE_STATUS_SIZE = 42;
const PAGE_STATUS_MARGIN = 16;
const PAGE_STATUS_DRAG_THRESHOLD = 4;
const SHARED_CANDIDATE_HIGHLIGHT_MARKER = "data-fillnest-shared-candidate-highlight";

const CONTROLLER_KEY = "__fillnestActivationController";

/**
 * Task 034. The Picker and the page-status control are Shadow Roots on hosts
 * FillNest injects into a page it does not own, so the theme cannot arrive
 * through a stylesheet on that page's document. It is written as custom
 * properties onto each host element instead - see `applyThemeToElement`.
 *
 * Held at module scope because the two hosts are created at different times
 * and by different scopes; whichever appears next must already know the theme
 * rather than paint a default first and correct itself.
 */
let currentAppearance: AppearancePreference = DEFAULT_APPEARANCE;
const themedHosts = new Set<HTMLElement>();

function isAppearanceValue(value: unknown): value is AppearancePreference {
  return (
    typeof value === "object" &&
    value !== null &&
    "themeId" in value &&
    "mode" in value &&
    isThemeId((value as AppearancePreference).themeId) &&
    isThemeModePreference((value as AppearancePreference).mode)
  );
}

function paintHost(host: HTMLElement): void {
  const mode = resolveThemeMode(currentAppearance.mode, prefersDark(window));
  applyThemeToElement(host, currentAppearance.themeId, mode);
}

function registerThemedHost(host: HTMLElement): void {
  themedHosts.add(host);
  paintHost(host);
}

function releaseThemedHost(host: HTMLElement | null): void {
  if (host) themedHosts.delete(host);
}

function repaintThemedHosts(): void {
  for (const host of themedHosts) {
    if (host.isConnected) paintHost(host);
    else themedHosts.delete(host);
  }
}

function startAppearanceSync(): void {
  void (async () => {
    try {
      const response = await sendRequest({ type: "GET_APPEARANCE" });
      if (response.ok && isAppearanceValue(response.value)) {
        currentAppearance = response.value;
        repaintThemedHosts();
      }
    } catch {
      // The default palette is complete and correct; a Picker must not fail
      // to appear because the theme could not be read.
    }
  })();

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "APPEARANCE_CHANGED" &&
      "appearance" in message &&
      isAppearanceValue(message.appearance)
    ) {
      currentAppearance = message.appearance;
      repaintThemedHosts();
    }
  });

  watchSystemMode(window, () => {
    if (currentAppearance.mode === "system") repaintThemedHosts();
  });
}

interface ReplacementEvidence {
  pageIdentityKey: string | null;
  // Task 036 Addendum I: which address the evidence was recorded under.
  addressEpoch: number;
  fieldIdentityKey: string | null;
  hasGenericSemanticKind: boolean;
}

// A saved position is only ever restored inside the current viewport. The
// height allowance is a floor rather than the Picker's real height, which is
// not known until it renders - the Picker re-clamps itself against its own
// measured box once it is on screen.
function clampPickerPosition(position: PickerPosition): PickerPosition {
  return clampPickerPositionWithin(
    position,
    { width: pickerWidthWithin(window.innerWidth), height: 40 },
    { width: window.innerWidth, height: window.innerHeight },
  );
}

function defaultPickerPosition(): PickerPosition {
  const width = pickerWidthWithin(window.innerWidth);
  return {
    top: 20,
    left: Math.max(PICKER_VIEWPORT_MARGIN, window.innerWidth - width - 20),
  };
}

type FillNestGlobal = typeof globalThis & {
  [CONTROLLER_KEY]?: boolean;
};

if (window === window.top && !(globalThis as FillNestGlobal)[CONTROLLER_KEY]) {
  (globalThis as FillNestGlobal)[CONTROLLER_KEY] = true;
  startActivationController();
}

function startActivationController(): void {
  let stopRuntime: (() => void) | null = null;
  // Task 037: the language the page's own surfaces speak, kept current by the
  // same broadcast every other surface listens to.
  let languagePreference: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE;
  let statusHost: HTMLDivElement | null = null;
  let statusRoot: ShadowRoot | null = null;
  // Task 038: the same live-versus-saved split the pinned Picker uses.
  let savedPageStatusPosition: PickerPosition | null = null;
  let livePageStatusPosition: PickerPosition | null = null;
  let refreshRevision = 0;

  async function refresh(): Promise<void> {
    const revision = ++refreshRevision;
    let response: RuntimeResponse;
    try {
      response = await sendRequest({
        type: "GET_ACTIVATION_SNAPSHOT",
        pageUrl: location.href,
      });
    } catch {
      window.setTimeout(() => void refresh(), 250);
      return;
    }
    if (revision !== refreshRevision) return;

    if (!response.ok) {
      window.setTimeout(() => void refresh(), 250);
      return;
    }

    const snapshot = asActivationSnapshot(response.value);
    let shouldRun = false;
    if (
      snapshot?.global === "active" &&
      snapshot.page.status === "available" &&
      snapshot.page.websiteAccess
    ) {
      showPageStatus(snapshot.page.originActivation);
      shouldRun = snapshot.page.originActivation === "active";
    } else {
      removePageStatus();
    }
    if (shouldRun && !stopRuntime) stopRuntime = startContentRuntime();
    if (!shouldRun && stopRuntime) {
      stopRuntime();
      stopRuntime = null;
    }
  }

  /**
   * Task 038. Where the page status control sits.
   *
   * Its default is the bottom-right corner, expressed as `right`/`bottom` so
   * it stays in the corner as the window changes size. Once the user has
   * dragged it, the position is a `top`/`left` point, clamped to the viewport
   * by the same helper the pinned Picker uses - one rule for both floating
   * pieces of FillNest rather than two.
   */
  function applyPageStatusPosition(): void {
    if (!statusHost) return;
    // Only the four position properties. The element's base declarations -
    // including `all: initial` - are written once when it is created, before
    // the theme puts its custom properties on the same element. Re-applying
    // `all: initial` here erased those, and the control kept its position and
    // lost its colours; an existing permission-lifecycle assertion caught it.
    const style = statusHost.style;
    const point = livePageStatusPosition ?? savedPageStatusPosition;
    const clamped = point
      ? clampPickerPositionWithin(
          point,
          { width: PAGE_STATUS_SIZE, height: PAGE_STATUS_SIZE },
          { width: window.innerWidth, height: window.innerHeight },
        )
      : null;
    // The default is a corner rather than a point, so an untouched control
    // follows that corner as the window resizes.
    style.setProperty("top", clamped ? `${clamped.top}px` : "");
    style.setProperty("left", clamped ? `${clamped.left}px` : "");
    style.setProperty("right", clamped ? "" : `${PAGE_STATUS_MARGIN}px`);
    style.setProperty("bottom", clamped ? "" : `${PAGE_STATUS_MARGIN}px`);
  }

  /**
   * A drag begins only after the pointer has travelled past a threshold.
   * Without it an unsteady click becomes a one-pixel drag, and the activation
   * toggle stops working for exactly the people least able to work around it.
   * The position is written to storage once, on release - never during the
   * drag, which is one decision rather than sixty.
   */
  function beginPageStatusDrag(event: PointerEvent): void {
    if (!statusHost || event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    const bounds = statusHost.getBoundingClientRect();
    const grab = { x: start.x - bounds.left, y: start.y - bounds.top };
    let dragging = false;

    const move = (moveEvent: PointerEvent): void => {
      if (!dragging) {
        const travelled = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
        if (travelled < PAGE_STATUS_DRAG_THRESHOLD) return;
        dragging = true;
      }
      livePageStatusPosition = { top: moveEvent.clientY - grab.y, left: moveEvent.clientX - grab.x };
      applyPageStatusPosition();
    };

    const finish = (): void => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      if (!dragging || !livePageStatusPosition) return;
      // A drag that moved is not also a click on the toggle.
      statusHost?.addEventListener("click", swallowOnce, { capture: true, once: true });
      const clamped = clampPickerPositionWithin(
        livePageStatusPosition,
        { width: PAGE_STATUS_SIZE, height: PAGE_STATUS_SIZE },
        { width: window.innerWidth, height: window.innerHeight },
      );
      savedPageStatusPosition = clamped;
      livePageStatusPosition = null;
      applyPageStatusPosition();
      void sendRequest({ type: "SET_PAGE_STATUS_POSITION", position: clamped }).catch(() => undefined);
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
  }

  function swallowOnce(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function showPageStatus(mode: "active" | "paused"): void {
    if (!statusHost) {
      statusHost = document.createElement("div");
      statusHost.setAttribute(PAGE_STATUS_MARKER, "");
      statusHost.style.cssText =
        `all:initial;position:fixed;z-index:2147483645;width:${PAGE_STATUS_SIZE}px;height:${PAGE_STATUS_SIZE}px;`;
      registerThemedHost(statusHost);
      statusRoot = statusHost.attachShadow({ mode: PICKER_SHADOW_MODE });
      statusRoot.addEventListener("click", blockUntrustedClick, { capture: true });
      statusHost.addEventListener("pointerdown", beginPageStatusDrag);
      // A window smaller than the stored position brings the control back into
      // view rather than leaving it off screen.
      window.addEventListener("resize", applyPageStatusPosition);
      document.documentElement.append(statusHost);
      applyPageStatusPosition();
      loadPageStatusPosition();
    }
    if (!statusRoot) return;
    render(
      <>
        <style>{pageStatusStyles}</style>
        <PageStatusControl
          mode={mode}
          messages={messagesFor(resolveLanguage(languagePreference))}
          lang={resolveLanguage(languagePreference)}
          onToggle={() => {
            // Best effort: a stale content script (extension reloaded/updated
            // while this page stayed open) throws "Extension context
            // invalidated" here - the user's own reload of the page is what
            // recovers it, not a retry loop, so this only needs to not crash.
            void sendRequest({
              type: "SET_ORIGIN_ACTIVATION",
              origin: permissionOriginFromUrl(location.href).origin,
              mode: mode === "active" ? "paused" : "active",
            })
              .then(() => refresh())
              .catch(() => undefined);
          }}
        />
      </>,
      statusRoot,
    );
  }

  function loadPageStatusPosition(): void {
    void sendRequest({ type: "GET_PAGE_STATUS_POSITION" })
      .then((response) => {
        if (response.ok) {
          savedPageStatusPosition = (response.value as PickerPosition | null) ?? null;
          applyPageStatusPosition();
        }
      })
      .catch(() => undefined);
  }

  function removePageStatus(): void {
    if (statusRoot) render(null, statusRoot);
    releaseThemedHost(statusHost);
    window.removeEventListener("resize", applyPageStatusPosition);
    statusHost?.remove();
    statusHost = null;
    statusRoot = null;
    livePageStatusPosition = null;
  }

  function handleActivationMessage(message: unknown): void {
    if (!isActivationChangedMessage(message) && !isRevocationMessage(message)) return;
    void refresh();
  }

  chrome.runtime.onMessage.addListener(handleActivationMessage);
  // Task 006 Addendum A, owner QA 2026-09-11: Restore and Reset replace the
  // stored position of an open page's status control too. They announce it as
  // a change that invalidates Field identities; without re-reading, the
  // control stayed put until the page was reloaded.
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (isStateChangeNotification(message) && message.type === "BUSINESS_STATE_CHANGED" && message.fieldIdentitiesInvalidated && statusHost) {
      loadPageStatusPosition();
    }
  });
  // Task 038 Addendum B: Settings put the page button back in its corner.
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isPageStatusPositionResetNotification(message)) return;
    savedPageStatusPosition = null;
    livePageStatusPosition = null;
    applyPageStatusPosition();
  });
  startAppearanceSync();
  // Task 037: the page's surfaces follow the same language choice the Side
  // Panel and Popup do, and re-render when it changes.
  void sendRequest({ type: "GET_LANGUAGE" })
    .then((response) => {
      if (!response.ok || !isLanguagePreference(response.value)) return;
      languagePreference = response.value;
      void refresh();
    })
    .catch(() => undefined);
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "LANGUAGE_CHANGED" &&
      "language" in message &&
      isLanguagePreference(message.language)
    ) {
      languagePreference = message.language;
      void refresh();
    }
  });
  void refresh();
}

/**
 * Task 037 Addendum B. The Field Control's accessible name, in the reader's
 * language - the one piece of FillNest a screen reader meets on every page.
 */
function FieldControlButton(props: {
  onMouseDown(event: MouseEvent): void;
  onClick(): void;
  children: preact.ComponentChildren;
}) {
  const t = useMessages();
  // Inside a page, whose own `lang` says nothing about FillNest's words.
  const language = useLanguage();
  return (
    <button class="control" type="button" lang={language} aria-label={t.openFillNest()} onMouseDown={props.onMouseDown} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function blockUntrustedClick(event: Event): void {
  if (event.isTrusted) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function startContentRuntime(): () => void {
  document.documentElement.setAttribute(ACTIVE_MARKER, "");
  let overlayHost: HTMLDivElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let selectionPreviewHost: HTMLElement | null = null;
  let richSelectionPreview = false;
  let targetField: SupportedField | null = null;
  let sharedCandidateHighlight: SupportedField | null = null;
  let sharedCandidateHighlightTimer: number | null = null;
  const sharedCandidateHighlightStyle = document.createElement("style");
  sharedCandidateHighlightStyle.textContent = `[${SHARED_CANDIDATE_HIGHLIGHT_MARKER}] { outline: 3px solid #4f5fd0 !important; outline-offset: 2px !important; box-shadow: 0 0 0 5px rgb(79 95 208 / 25%) !important; }`;
  document.documentElement.append(sharedCandidateHighlightStyle);
  let pickerOpen = false;
  let pinned = false;
  /**
   * Evidence that FillNest's own interface has just taken focus from the page.
   * Set the instant it happens and consumed within one frame - see
   * `isTransientlyReadOnly`.
   */
  let focusTakenByOurInterface = false;
  /**
   * The Field judged read-only *because* FillNest took its focus. The judgement
   * is made once, at the transition, because afterwards a focus-driven
   * component and a genuinely read-only Field look identical.
   */
  let transientlyReadOnlyField: SupportedField | null = null;
  // Task 003, addendum of 2026-09-11: the selection an insertion replaces
  // belongs to the Field it was read from, and to one insertion. A pinned
  // Picker outlives both, so the snapshot names its Field and is consumed
  // when used.
  let fieldSelection: { field: SupportedField; snapshot: FieldSelectionSnapshot | null } | null = null;
  // Task 036. `insertionRejected` mirrors the stored Field fact; the content
  // and Field id below belong to the rejection the user is looking at now.
  let insertionRejected = false;
  let insertionRejectedContent: string | null = null;
  // Keyed on the element, not on a Field Profile id: an unbound Field is
  // resolved to a fresh id on every focus, and inserting focuses the Field.
  let insertionRejectedField: SupportedField | null = null;
  // Task 036 Addendum A: what had focus inside the Picker, and whether a
  // keystroke is being delivered right now. Together they identify a
  // page-driven focus steal without catching anything else.
  let pickerFocusedElement: HTMLElement | null = null;
  let focusWasInsideOverlay = false;
  // Task 036 Addendum H: every focus change bumps the sequence, so a deferred
  // answer to focus leaving the overlay can tell it has been superseded.
  let focusSequence = 0;
  let overlayExit: { from: HTMLElement; at: number } | null = null;
  let overlayExitTimer: number | null = null;
  let textEntryInFlight = false;
  let positionFrame = 0;
  let context: FieldContextResolution | null = null;
  let pageIdentityKey: string | null = null;
  let fieldIdentityKey: string | null = null;
  let fieldDocumentOrder: number | null = null;
  let fieldObservedTitle: string | null = null;
  let focusRevision = 0;
  let lastAction: LastAction | null = null;
  let lastActionFieldProfileId: string | null = null;
  let logicalPageCandidate: LogicalPageReviewCandidate | null = null;
  let logicalPageCandidateFieldProfileId: string | null = null;
  let logicalPageCandidateEvidence: OpaqueLogicalPageCandidateEvidencePayload | null = null;
  // Task 014: "The same page session is not prompted repeatedly." A page
  // session is one visit to one record URL, so this is keyed on the URL and
  // not on the canonical Page - keying on the canonical Page would suppress
  // every later record in an SPA that only pushState-navigates, and keying on
  // nothing would re-offer on every refocus of the same field.
  const offeredLogicalPageSessions = new Set<string>();
  let savedPickerPosition: PickerPosition | null = null;
  let livePickerPosition: PickerPosition | null = null;
  let targetFieldActionable = true;
  let recoveryField: SupportedField | null = null;
  let lifecycleFlushQueued = false;
  // Includes a previously marked element for one final reconciliation after
  // it stops satisfying `SupportedField` (Task 039 C3).
  const lifecycleFields = new Set<Element>();
  const detachedFieldEvidence: ReplacementEvidence[] = [];
  // Task 036 Addendum G: a removed Field changes its peers' ordinals without
  // queuing any of them, so the removal itself has to be remembered.
  let fieldRemovedSinceReconcile = false;
  // Task 036 Addendum A.4: replaced wholesale when the address changes, so a
  // Field marked fresh on one page does not stay marked on the next. A WeakSet
  // cannot be emptied, and a stale mark is permanent for that element's life.
  let freshCandidates = new WeakSet<SupportedField>();
  let lastPageIdentityKey = buildPageIdentityKey(location.href);
  // Task 036 Addendum I: bumped on every address change, with the Page that
  // was on screen before it, so a Field present across the change can be
  // attributed to the page it came from.
  let addressEpoch = 0;
  let pageBeforeAddressChange: string | null = null;
  // Task 036 Addendum A.7: the address the live context was resolved for, and
  // a guard so the per-frame check cannot stack resolutions on top of itself.
  let contextPageIdentityKey: string | null = null;
  // Task 036 Addendum F: a context belongs to a Field identity as well as a
  // Page identity. An SPA can expose a temporary ancestor chain while moving
  // a native Field, so the settled lifecycle pass must be able to distinguish
  // that temporary resolution from the Target Field now on screen.
  let contextFieldIdentityKey: string | null = null;
  let contextResolveInFlight = false;
  let lastContextRepairAt = 0;
  const observedFieldEvidence = new WeakMap<Element, ReplacementEvidence>();
  let fieldContexts = new WeakMap<
    SupportedField,
    { context: FieldContextResolution; pageUrl: string; fieldIdentityKey: string | null }
  >();

  // Best effort: a stale content script (extension reloaded/updated while
  // this page stayed open) throws "Extension context invalidated" here -
  // the saved position just stays at its default until the page reloads.
  function loadSavedPickerPosition(): void {
    void sendRequest({ type: "GET_PICKER_POSITION" })
      .then((response) => {
        if (response.ok) {
          savedPickerPosition = (response.value as PickerPosition | null) ?? null;
          if (pinned) renderOverlay();
        }
      })
      .catch(() => undefined);
  }
  loadSavedPickerPosition();

  function currentPickerPosition(): PickerPosition {
    return livePickerPosition ?? clampPickerPosition(savedPickerPosition ?? defaultPickerPosition());
  }

  function persistPickerPosition(position: PickerPosition): void {
    const clamped = clampPickerPosition(position);
    savedPickerPosition = clamped;
    livePickerPosition = null;
    // Best effort: the position already applied locally; a stale content
    // script (extension reloaded/updated while this page stayed open) must
    // not crash just because it can no longer persist it.
    void sendRequest({ type: "SET_PICKER_POSITION", position: clamped }).catch(() => undefined);
  }

  /**
   * `convergence` marks a re-resolution FillNest starts on its own because the
   * live context no longer matches the page (Addenda A.7, F and G). The user
   * did nothing, so an open Picker stays open; only a focus closes it.
   */
  async function showForField(
    field: SupportedField,
    snapshot?: PageFieldSnapshot,
    convergence = false,
  ): Promise<void> {
    if (targetField && targetField !== field) {
      // The judgement in `isTransientlyReadOnly` belongs to one Field.
      transientlyReadOnlyField = null;
      removeSelectionPreview();
      // Moving to another Field is one of the ways a user declines an offer.
      retireLogicalPageCandidate();
    }
    const revision = ++focusRevision;
    const evidence = readDomRecognitionEvidence(field, snapshot);
    if (freshCandidates.has(field)) evidence.fieldIdentityKey = null;
    const pageUrl = location.href;
    const cacheableWithinDocument = freshCandidates.has(field) || evidence.pageIdentityKey === null;
    const cached = cacheableWithinDocument ? fieldContexts.get(field) : undefined;
    let resolved: FieldContextResolution;
    try {
      resolved =
        cached && cached.pageUrl === pageUrl && cached.fieldIdentityKey === evidence.fieldIdentityKey
          ? cached.context
          : await resolveFieldContext(evidence);
    } catch {
      // Best effort: a stale content script (extension reloaded/updated
      // while this page stayed open) throws "Extension context invalidated"
      // resolving this Field's context - every caller here fires this
      // fire-and-forget on plain focus, so it must not surface an unhandled
      // rejection just because the user tabbed into a field.
      return;
    }
    if (revision !== focusRevision || !isRuntimeEligible(field)) return;
    targetField = field;
    field.setAttribute(FIELD_MARKER, "");
    context = resolved;
    contextPageIdentityKey = evidence.pageIdentityKey;
    contextFieldIdentityKey = evidence.fieldIdentityKey;
    pageIdentityKey = evidence.pageIdentityKey;
    fieldIdentityKey = evidence.fieldIdentityKey;
    fieldDocumentOrder = evidence.documentOrder;
    fieldObservedTitle = evidence.observedTitle;
    void recordLogicalPageObservation(field, resolved);
    if (resolved.recognized) {
      logicalPageCandidate = null;
      logicalPageCandidateFieldProfileId = null;
      logicalPageCandidateEvidence = null;
    } else {
      const resolvedForPageIdentityKey = evidence.pageIdentityKey;
      void resolveLogicalPageCandidateForField(field, resolved).then((result) => {
        if (revision !== focusRevision || targetField !== field || !result) return;
        const { resolution, evidence } = result;
        if (resolution.recognized) {
          context = resolution;
          contextPageIdentityKey = resolvedForPageIdentityKey;
          logicalPageCandidate = null;
          logicalPageCandidateFieldProfileId = null;
          logicalPageCandidateEvidence = null;
        } else if (resolution.candidate && !offeredLogicalPageSessions.has(location.href)) {
          logicalPageCandidate = resolution.candidate;
          logicalPageCandidateFieldProfileId = resolved.fieldProfileId;
          logicalPageCandidateEvidence = evidence;
        } else {
          logicalPageCandidate = null;
          logicalPageCandidateFieldProfileId = null;
          logicalPageCandidateEvidence = null;
        }
        renderOverlay();
      });
    }
    if (cacheableWithinDocument) {
      // A same-document DOM Field object is stronger than a new node. Caching
      // avoids losing a deliberate Binding for a fresh candidate while never
      // allowing that candidate's normal fingerprint to inherit a prior Binding.
      fieldContexts.set(field, {
        context: resolved,
        pageUrl,
        fieldIdentityKey: evidence.fieldIdentityKey,
      });
    }
    targetFieldActionable = true;
    // lastAction/lastActionFieldProfileId are intentionally left untouched
    // here: merely focusing a different Field must not destroy a pending
    // Undo, only hide it while that other Field is focused (see the
    // lastAction prop below). Only a new key data operation - handled via
    // onLastActionChange - or a full teardown replaces it.
    // Task 036. Inserting focuses the Field, which arrives back here as an
    // ordinary focus and would close the Picker - including the notice saying
    // the insertion was refused, which is the one thing the user needs to see
    // at that moment. A live rejection for this same Field keeps it open. A
    // move to any other Field retires the notice.
    if (insertionRejectedField !== field) {
      insertionRejectedContent = null;
      insertionRejectedField = null;
      insertionRejected = false;
    }
    if (!pinned && !convergence && !hasLiveInsertionRejection(field)) pickerOpen = false;
    ensureOverlay();
    positionOverlay();
    renderOverlay();
    if (positionFrame === 0) positionFrame = requestAnimationFrame(trackPosition);
  }

  function ensureOverlay(): void {
    if (overlayHost) return;
    overlayHost = document.createElement("div");
    overlayHost.setAttribute(OVERLAY_MARKER, "");
    overlayHost.style.cssText =
      "all:initial;position:fixed;z-index:2147483647;width:28px;height:28px;";
    registerThemedHost(overlayHost);
    shadowRoot = overlayHost.attachShadow({ mode: PICKER_SHADOW_MODE });
    shadowRoot.addEventListener(
      "click",
      (event) => {
        if (!event.isTrusted) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
    // Task 036 Addendum A. Keep FillNest's own keyboard away from the page.
    //
    // A chat composer commonly listens on `document` for "type anywhere and I
    // will focus the composer for you". FillNest's Picker is a Shadow Root
    // inside that same document, so every keystroke the user typed into the
    // Picker reached the page, the page pulled focus to its own composer, and
    // the Picker closed mid-edit. Reported by the owner on ChatGPT and Claude,
    // where it made Template creation impossible.
    //
    // Stopping propagation as the event leaves the host defeats an ordinary
    // bubble-phase page listener. It cannot defeat a capture-phase one, which
    // runs on the way down; `restorePickerFocus` covers that case.
    for (const type of CONTAINED_UI_EVENTS) {
      overlayHost.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    }
    // Task 036 Addendum H: which control inside the Picker has the focus, from
    // the Shadow Root itself, where `focus` names the real element. `focusin`
    // reaching `handleFocus` can report the host instead, and a stale answer
    // sent a reclaimed Tab from the wrong control.
    shadowRoot.addEventListener(
      "focus",
      (event) => {
        if (event.target instanceof HTMLElement) pickerFocusedElement = event.target;
      },
      { capture: true },
    );
    document.documentElement.append(overlayHost);
  }

  // Owner QA 2026-09-11: a pinned Picker dragged past the viewport edge was
  // drawn again and again - one real Picker and a trail of copies that could
  // not be closed. The Picker re-clamps itself from an effect and reports the
  // clamped position here; re-rendering the whole overlay synchronously from
  // inside that effect made Preact insert a new Picker instead of updating the
  // one it had. A live position is drawn on the next frame instead, which is
  // also at most once per frame however many moves arrive.
  let overlayRenderFrame = 0;
  function scheduleOverlayRender(): void {
    if (overlayRenderFrame !== 0) return;
    overlayRenderFrame = requestAnimationFrame(() => {
      overlayRenderFrame = 0;
      renderOverlay();
    });
  }

  function renderOverlay(): void {
    if (!shadowRoot || !targetField) return;
    const field = targetField;
    if (!context) return;
    // Captured so an async callback from this render can tell whether the
    // Field context it was created for is still the current one.
    const fieldProfileIdAtRender = context.fieldProfileId;

    render(
      <>
        <style>{pickerStyles}</style>
        <FieldControlButton
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!isRuntimeEligible(field)) {
              removeOverlay();
              return;
            }
            fieldSelection = { field, snapshot: captureFieldSelection(field) };
            showSelectionPreview(field, fieldSelection.snapshot);
            pickerOpen = true;
            renderOverlay();
            positionOverlay();
          }}
        >
          <FieldControlIcon />
        </FieldControlButton>
        {pickerOpen && (
          <InlinePicker
            targetField={field}
            siteId={context.siteId}
            pageProfileId={context.pageProfileId}
            fieldProfileId={context.fieldProfileId}
            fieldRecognized={context.recognized}
            pageIdentityKey={pageIdentityKey}
            fieldIdentityKey={fieldIdentityKey}
            fieldDocumentOrder={fieldDocumentOrder}
            fieldObservedTitle={fieldObservedTitle}
            onInsert={(template) => insertTemplate(field, template)}
            onClose={closePicker}
            pinned={pinned}
            onPinnedChange={(next) => {
              if (!next && pinned) persistPickerPosition(currentPickerPosition());
              pinned = next;
              renderOverlay();
              positionOverlay();
            }}
            pickerPosition={pinned ? currentPickerPosition() : null}
            onPickerPositionChange={(position, persist) => {
              if (persist) {
                persistPickerPosition(position);
                renderOverlay();
              } else {
                livePickerPosition = clampPickerPosition(position);
                scheduleOverlayRender();
              }
            }}
            lastAction={lastActionFieldProfileId === context.fieldProfileId ? lastAction : null}
            onLastActionChange={(action) => {
              lastAction = action;
              lastActionFieldProfileId = context?.fieldProfileId ?? null;
              renderOverlay();
            }}
            targetFieldActionable={targetFieldActionable}
            insertionRejected={insertionRejected}
            insertionRejectionNotice={insertionRejectedField === field ? insertionRejectedContent : null}
            onCopyToClipboard={copyToClipboard}
            bindingSupported={isFieldBindable(field)}
            logicalPageCandidate={
              logicalPageCandidateFieldProfileId === context.fieldProfileId ? logicalPageCandidate : null
            }
            logicalPageCandidateEvidence={logicalPageCandidateEvidence}
            onLogicalPageCandidateConfirmed={(resolution) => {
              // Focus can move while the confirmation is in flight. Adopting
              // the canonical context then would leave the Picker describing
              // a Field the user is no longer in, so a later Bind or Insert
              // would act on the wrong Field Profile. The Rule is still
              // created either way; only this Picker's context is skipped.
              if (targetField !== field || context?.fieldProfileId !== fieldProfileIdAtRender) return;
              context = resolution;
              logicalPageCandidate = null;
              logicalPageCandidateFieldProfileId = null;
              logicalPageCandidateEvidence = null;
              renderOverlay();
            }}
            onLogicalPageCandidateDismissed={() => {
              retireLogicalPageCandidate();
              renderOverlay();
            }}
            pageFieldCandidates={pageFieldCandidates(field)}
            onSharedFieldCandidateHighlight={(identityKey) => highlightSharedCandidate(identityKey, true)}
            onSharedFieldCandidateLocate={(identityKey) => locateSharedCandidate(identityKey)}
          />
        )}
      </>,
      shadowRoot,
    );
  }

  function insertTemplate(field: SupportedField, template: TemplateRecord): void {
    if (!targetFieldActionable) return;
    // Taken before `field.focus()` below, whose focus event may arrive
    // synchronously and supersede the snapshot. Without one, the insertion
    // lands at the Field's own live caret.
    const selection = fieldSelection?.field === field ? fieldSelection.snapshot : null;
    fieldSelection = null;
    // Task 016 Addendum D. Give a focus-driven component the one thing it is
    // waiting for before judging the Field: its own focus. A component that
    // marks its input `readonly` while unfocused clears it here, so the
    // insertion lands in a genuinely editable Field rather than being written
    // into one the page considers read-only. A Field that is read-only for any
    // other reason is unmoved by this, and fails the check below exactly as
    // before.
    if (isSupportedExceptReadOnly(field)) field.focus();
    if (!isRuntimeEligible(field)) {
      if (pinned) {
        targetFieldActionable = false;
        renderOverlay();
      } else {
        removeOverlay();
      }
      return;
    }
    if (!pinned) pickerOpen = false;
    removeSelectionPreview();
    renderOverlay();
    applyTextInsertion(field, template.content, selection);
    positionOverlay();
    verifyInsertion(field, template.content);
    if (context) {
      // Best effort: the insertion already happened in the DOM; a stale
      // content script (extension reloaded/updated while this page stayed
      // open) must not crash just because it can no longer record usage.
      void sendRequest({
        type: "RECORD_INSERTION",
        templateId: template.id,
        fieldProfileId: context.fieldProfileId,
      }).catch(() => undefined);
    }
  }

  /**
   * Task 036. Did the editor keep it?
   *
   * Checked a frame later rather than assumed, because the failure that
   * matters is not a refusal - it is a document-model editor that accepts the
   * DOM change and overwrites it on its next render, leaving the user with
   * text that appears and then vanishes with no explanation.
   *
   * The outcome is remembered on the Field so the next visit can offer the
   * clipboard fallback up front, and a success clears it so an editor that
   * fixes itself stops carrying a warning.
   */
  function hasLiveInsertionRejection(field: SupportedField): boolean {
    return insertionRejectedContent !== null && insertionRejectedField === field;
  }

  function verifyInsertion(field: SupportedField, content: string): void {
    // Native controls are not verified, for two reasons. `setRangeText` has a
    // defined result and no document model to fight, so there is nothing to
    // catch; and checking would mean reading `field.value` outside the two
    // cases AGENTS.md allows a Field's value to be read at all. The read below
    // is confined to a Rich Text Field, happens only as a direct consequence
    // of the user's own insertion, and nothing but a boolean survives it.
    if (isNativeField(field)) return;
    const fieldProfileId = context?.fieldProfileId ?? null;
    requestAnimationFrame(() => {
      if (targetField !== field || !field.isConnected) return;
      const accepted = insertionWasAccepted(field, content);
      if (!accepted) {
        insertionRejectedContent = content;
        insertionRejectedField = field;
      } else if (insertionRejectedField === field) {
        insertionRejectedContent = null;
        insertionRejectedField = null;
      }
      if (accepted === insertionRejected) {
        // The stored fact disagrees with what just happened.
        insertionRejected = !accepted;
        renderOverlay();
      }
      if (fieldProfileId) {
        void sendRequest({
          type: "RECORD_INSERTION_REJECTION",
          fieldProfileId,
          rejected: !accepted,
        }).catch(() => undefined);
      }
      if (!accepted) {
        pickerOpen = true;
        renderOverlay();
        positionOverlay();
      }
    });
  }

  /**
   * The one thing FillNest will do with the clipboard, and only ever from the
   * user's own click on the offer. Silently replacing what someone is carrying
   * in their clipboard is not ours to do, so there is no automatic copy on
   * success, on failure, or anywhere else.
   */
  async function copyToClipboard(content: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The box the Field Control is placed beside.
   *
   * Task 036 Addendum A. For a native control this is the control itself. For
   * a Rich Text Field it is not: the editing host is the inner text node of a
   * composer, and the composer's own toolbar - attach, dictate, send - lives
   * in the visual box around it. Anchoring to the host put FillNest's control
   * inside that box, over the page's own buttons. Reported by the owner on all
   * three named targets.
   *
   * The visual box is found generically, by walking up while each ancestor is
   * still hugging the host - no more than a modest amount wider or taller -
   * and taking the last one that draws itself (a border, a radius, or a
   * background of its own). That is what a composer is: the rounded box the
   * user sees. If nothing qualifies, the host's own box is used, which is the
   * behaviour every other Field has.
   */
  function fieldAnchorBounds(field: SupportedField): DOMRect {
    const hostBounds = field.getBoundingClientRect();
    if (isNativeField(field)) return hostBounds;

    let anchor: DOMRect = hostBounds;
    let ancestor = field.parentElement;
    for (let depth = 0; ancestor && depth < 6; depth += 1, ancestor = ancestor.parentElement) {
      const bounds = ancestor.getBoundingClientRect();
      const hugs =
        bounds.width <= hostBounds.width * ANCHOR_MAX_HOST_WIDTH_RATIO &&
        bounds.width <= window.innerWidth * ANCHOR_MAX_VIEWPORT_WIDTH_RATIO &&
        bounds.height <= hostBounds.height + ANCHOR_MAX_EXTRA_HEIGHT &&
        bounds.width > 0 &&
        bounds.height > 0;
      if (!hugs) break;
      const style = getComputedStyle(ancestor);
      const draws =
        parseFloat(style.borderTopLeftRadius) > 0 ||
        parseFloat(style.borderTopWidth) > 0 ||
        (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent");
      if (draws) anchor = bounds;
    }
    return anchor;
  }

  function positionOverlay(): void {
    if (!overlayHost || !targetField || !targetField.isConnected) return;
    const fieldBounds = fieldAnchorBounds(targetField);
    const controlSize = fieldControlSize(fieldBounds.height);
    const gap = 4;
    const fitsRight = fieldBounds.right + gap + controlSize <= window.innerWidth - gap;
    const left = fitsRight
      ? fieldBounds.right + gap
      : Math.max(gap, fieldBounds.left - gap - controlSize);
    const alignedTop = fieldBounds.top + (fieldBounds.height - controlSize) / 2;
    const top = Math.max(gap, Math.min(alignedTop, window.innerHeight - controlSize - gap));
    overlayHost.style.width = `${controlSize}px`;
    overlayHost.style.height = `${controlSize}px`;
    overlayHost.style.setProperty("--fillnest-control-size", `${controlSize}px`);
    overlayHost.style.left = `${Math.round(left)}px`;
    overlayHost.style.top = `${Math.round(top)}px`;
    // Task 023 Addendum B5 (15): the Picker is no more than the viewport
    // wide, so the offset that keeps it on screen has to be computed from its
    // real width rather than a hard-coded 348.
    const pickerWidth = pickerWidthWithin(window.innerWidth);
    const pickerLeft = Math.max(
      gap - left,
      Math.min(0, window.innerWidth - left - pickerWidth - gap),
    );
    overlayHost.style.setProperty("--fillnest-picker-left", `${Math.round(pickerLeft)}px`);
    const picker = shadowRoot?.querySelector<HTMLElement>(".picker");
    if (picker) {
      const pickerHeight = picker.getBoundingClientRect().height;
      // Anchored to the Field's own top/bottom edges, not the control's
      // vertical-center position on it (which sits inside a tall multi-line
      // Field) - the Picker/Finder never covers any part of the Field it is
      // attached to, in any mode, and re-flips cleanly whenever its own
      // content height changes (e.g. opening the Finder from "Share with…").
      const below = fieldBounds.bottom + gap;
      const above = fieldBounds.top - pickerHeight - gap;
      const belowFits = below + pickerHeight <= window.innerHeight - gap;
      const aboveFits = above >= gap;
      // While the Finder has a Shared-field candidate highlighted (hovered
      // or just "Locate on Page"d), also avoid covering that candidate
      // Field - its whole purpose is to make that Field visible, not sit on
      // top of it once the page has scrolled it into view.
      const candidateRect =
        sharedCandidateHighlight?.isConnected ? sharedCandidateHighlight.getBoundingClientRect() : null;
      const pickerAbsoluteLeft = left + pickerLeft;
      const overlapsCandidate = (candidateTop: number): boolean =>
        candidateRect !== null &&
        pickerAbsoluteLeft < candidateRect.right &&
        pickerAbsoluteLeft + pickerWidth > candidateRect.left &&
        candidateTop < candidateRect.bottom &&
        candidateTop + pickerHeight > candidateRect.top;
      const preferred =
        belowFits && !overlapsCandidate(below)
          ? below
          : aboveFits && !overlapsCandidate(above)
            ? above
            : belowFits
              ? below
              : above;
      const viewportTop = Math.max(
        gap,
        Math.min(preferred, window.innerHeight - pickerHeight - gap),
      );
      overlayHost.style.setProperty(
        "--fillnest-picker-top",
        `${Math.round(viewportTop - top)}px`,
      );
    }
    positionSelectionPreview();
  }

  function showSelectionPreview(
    field: SupportedField,
    selection: FieldSelectionSnapshot | null,
  ): void {
    removeSelectionPreview();
    if (!selection) return;
    if (selection.kind === "rich") {
      showRichSelectionPreview(field, selection.range);
      return;
    }
    const { start, end } = selection;
    if (start === end) return;

    const computed = getComputedStyle(field);
    const previewHost = document.createElement("fillnest-selection-preview");
    for (const [property, value] of [
      ["position", "fixed"],
      ["pointer-events", "none"],
      ["overflow", "hidden"],
      ["z-index", "2147483646"],
      ["box-sizing", "border-box"],
      ["display", "block"],
    ] as const) {
      previewHost.style.setProperty(property, value, "important");
    }
    const previewRoot = previewHost.attachShadow({ mode: PICKER_SHADOW_MODE });
    const preview = document.createElement("div");
    preview.style.cssText = [
      "all:initial",
      "display:block",
      "width:100%",
      "height:100%",
      "overflow:hidden",
      "box-sizing:border-box",
      `padding:${computed.padding}`,
      `border-style:${computed.borderStyle}`,
      `border-width:${computed.borderWidth}`,
      "border-color:transparent",
      `font:${computed.font}`,
      `letter-spacing:${computed.letterSpacing}`,
      `line-height:${computed.lineHeight}`,
      `text-align:${computed.textAlign}`,
      `text-indent:${computed.textIndent}`,
      field instanceof HTMLTextAreaElement
        ? "white-space:pre-wrap;overflow-wrap:break-word"
        : "white-space:pre",
    ].join(";");

    const content = readFieldText(field);
    const inner = document.createElement("div");
    inner.style.cssText = [
      "position:relative",
      "width:100%",
      `transform:translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`,
    ].join(";");
    const before = document.createElement("span");
    before.textContent = content.slice(0, start);
    before.style.color = "transparent";
    const selected = document.createElement("span");
    selected.setAttribute(SELECTION_PREVIEW_MARKER, "");
    selected.setAttribute("aria-hidden", "true");
    selected.textContent = content.slice(start, end);
    selected.style.cssText =
      "color:transparent;background:rgb(49 87 213 / 32%);border-radius:2px;";
    const after = document.createElement("span");
    after.textContent = content.slice(end);
    after.style.color = "transparent";
    inner.append(before, selected, after);
    preview.append(inner);
    previewRoot.append(preview);
    document.documentElement.append(previewHost);
    selectionPreviewHost = previewHost;
    positionSelectionPreview();
  }

  /**
   * Task 036. A Rich Text Field's selection cannot be re-drawn by copying its
   * text and slicing it at two offsets - its content is a node tree. The Range
   * already knows where it is on screen, so the preview is drawn from
   * `getClientRects()` instead, which is both simpler and exactly accurate
   * across wrapped lines and inline elements.
   *
   * The preview is decoration only: no text is copied out of the page, and
   * nothing about it is persisted.
   */
  function showRichSelectionPreview(field: SupportedField, range: Range): void {
    if (range.collapsed || !field.contains(range.commonAncestorContainer)) return;
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) return;

    const previewHost = document.createElement("fillnest-selection-preview");
    for (const [property, value] of [
      ["position", "fixed"],
      ["pointer-events", "none"],
      ["z-index", "2147483646"],
      ["inset", "0"],
      ["display", "block"],
    ] as const) {
      previewHost.style.setProperty(property, value, "important");
    }
    const previewRoot = previewHost.attachShadow({ mode: PICKER_SHADOW_MODE });
    for (const rect of rects) {
      const highlight = document.createElement("div");
      highlight.setAttribute(SELECTION_PREVIEW_MARKER, "");
      highlight.setAttribute("aria-hidden", "true");
      highlight.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        "background:rgb(49 87 213 / 32%)",
        "border-radius:2px",
      ].join(";");
      previewRoot.append(highlight);
    }
    document.documentElement.append(previewHost);
    selectionPreviewHost = previewHost;
    richSelectionPreview = true;
  }

  function positionSelectionPreview(): void {
    if (!selectionPreviewHost || !targetField) return;
    // A rich preview is drawn in viewport coordinates from the Range's own
    // rects, so it is not positioned from the Field's box. It is torn down on
    // scroll instead, because the rects it was drawn from have moved.
    if (richSelectionPreview) {
      removeSelectionPreview();
      return;
    }
    const bounds = targetField.getBoundingClientRect();
    selectionPreviewHost.style.setProperty("left", `${bounds.left}px`, "important");
    selectionPreviewHost.style.setProperty("top", `${bounds.top}px`, "important");
    selectionPreviewHost.style.setProperty("width", `${bounds.width}px`, "important");
    selectionPreviewHost.style.setProperty("height", `${bounds.height}px`, "important");
  }

  function removeSelectionPreview(): void {
    selectionPreviewHost?.remove();
    selectionPreviewHost = null;
    richSelectionPreview = false;
  }

  function removeOverlay(): void {
    focusTakenByOurInterface = false;
    transientlyReadOnlyField = null;
    focusRevision += 1;
    targetField?.removeAttribute(FIELD_MARKER);
    highlightSharedCandidate(null);
    if (shadowRoot) render(null, shadowRoot);
    if (overlayRenderFrame !== 0) cancelAnimationFrame(overlayRenderFrame);
    overlayRenderFrame = 0;
    releaseThemedHost(overlayHost);
    overlayHost?.remove();
    removeSelectionPreview();
    overlayHost = null;
    shadowRoot = null;
    targetField = null;
    context = null;
    contextFieldIdentityKey = null;
    pickerOpen = false;
    pinned = false;
    lastAction = null;
    lastActionFieldProfileId = null;
    livePickerPosition = null;
    targetFieldActionable = true;
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
  }

  /**
   * Records that this page session has had its offer and takes the candidate
   * down. Task 014 treats "choosing not to review" and "dismissing the
   * dialog" alike, so every way of declining routes through here - the
   * dialog's Cancel, closing the Picker, and moving to another Field - not
   * only the explicit Cancel button.
   */
  function retireLogicalPageCandidate(): void {
    if (!logicalPageCandidate) return;
    offeredLogicalPageSessions.add(location.href);
    logicalPageCandidate = null;
    logicalPageCandidateFieldProfileId = null;
    logicalPageCandidateEvidence = null;
  }

  function closePicker(): void {
    retireLogicalPageCandidate();
    if (pinned) persistPickerPosition(currentPickerPosition());
    pickerOpen = false;
    pinned = false;
    removeSelectionPreview();
    renderOverlay();
    targetField?.focus();
  }

  function handleDocumentMouseDown(event: MouseEvent): void {
    // Task 016 Addendum D: recorded before any of the early returns below,
    // because it has to be true from the very first mousedown - the Field's
    // blur, and a focus-driven component's reaction to it, both happen before
    // the click that would open the Picker ever fires.
    if (overlayHost !== null && event.composedPath().includes(overlayHost)) {
      focusTakenByOurInterface = true;
    }


    if (!overlayHost || !targetField || !pickerOpen) return;
    if (pinned) return;
    const path = event.composedPath();
    if (path.includes(overlayHost)) return;
    if (path.includes(targetField)) return;
    closePicker();
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (pickerOpen && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePicker();
      return;
    }
    // Forward Tab from the Target Field itself jumps into the FillNest
    // control - see the comment above `findNextFocusableAfter`. Backward
    // Shift+Tab from the Field is left alone: nothing of ours sits before
    // it, so the page's own default behavior is already correct there.
    if (
      isPlainTabKey(event) &&
      !event.shiftKey &&
      overlayHost &&
      shadowRoot &&
      targetField &&
      event.target === targetField
    ) {
      const button = shadowRoot.querySelector<HTMLButtonElement>("button.control");
      if (button) {
        event.preventDefault();
        button.focus();
      }
    }
  }

  /**
   * The per-page bookkeeping of an address change, on its own so the mutation
   * observer can bring it up to date before judging a replacement.
   */
  function syncAddressEpoch(): string | null {
    const currentPageIdentityKey = buildPageIdentityKey(location.href);
    if (currentPageIdentityKey !== lastPageIdentityKey) {
      pageBeforeAddressChange = lastPageIdentityKey;
      lastPageIdentityKey = currentPageIdentityKey;
      addressEpoch += 1;
      freshCandidates = new WeakSet<SupportedField>();
      fieldContexts = new WeakMap();
    }
    return currentPageIdentityKey;
  }

  /**
   * Task 036 Addendum I. The Page a Field's removal belongs to.
   *
   * A Field recorded under the current address belongs to this Page. A Field
   * last recorded before the address changed was on screen when it changed,
   * so it came from the Page before - and its removal is part of leaving that
   * Page, which Addendum A.4 says is never a replacement.
   */
  function evidencePage(evidence: ReplacementEvidence): string | null {
    return evidence.addressEpoch === addressEpoch ? evidence.pageIdentityKey : pageBeforeAddressChange;
  }

  /**
   * Task 036 Addendum A.5. Everything that has to happen when the address
   * changes underneath a live page.
   *
   * A Field's context is resolved when it receives focus, and an SPA can
   * change page while the composer keeps both the element and the focus -
   * Gemini does exactly that between its new-conversation page and a
   * conversation. The Picker then went on offering the previous page's
   * Templates while the Side Panel, which fetches for itself, showed the right
   * ones. And a fresh-candidate mark belongs to the page it was made on.
   *
   * Called from the lifecycle reconciliation and from the per-frame position
   * loop, because a route change need not produce a DOM mutation FillNest is
   * watching, and `pushState` fires no event of its own.
   */
  function noticeAddressChange(): void {
    const currentPageIdentityKey = syncAddressEpoch();
    // Task 036 Addendum A.7. The invariant, checked every frame rather than
    // acted on once: **the live Field context must belong to the address the
    // user is looking at.**
    //
    // A.5 re-resolved at the moment the address changed, and one attempt is
    // not enough. The attempt can be lost - the composer is momentarily
    // ineligible while the application swaps it, or a focus event that fired
    // before the address updated resolves last and wins - and because the
    // address marker had already advanced, nothing ever tried again. The
    // Picker then offered the previous page's Templates for the rest of the
    // visit, which is what the owner saw on Gemini: `HISTORY` in the Picker
    // and `NEWCHAT` in the Side Panel, for the same page, at the same moment.
    //
    // Comparing what the context was resolved *for* against the current
    // address heals whatever the ordering was, and stops as soon as they
    // agree.
    if (!context || contextPageIdentityKey === currentPageIdentityKey) return;
    if (contextResolveInFlight) return;
    if (!targetField || !isRuntimeEligible(targetField)) return;
    // Throttled: this check runs every frame, and a repair that cannot succeed
    // yet - the application is still swapping its editor - must not turn into
    // sixty resolutions a second against the service worker.
    if (Date.now() - lastContextRepairAt < CONTEXT_REPAIR_INTERVAL_MS) return;
    lastContextRepairAt = Date.now();
    contextResolveInFlight = true;
    void showForField(targetField, undefined, true).finally(() => {
      contextResolveInFlight = false;
    });
  }

  function trackPosition(): void {
    positionFrame = 0;
    noticeAddressChange();
    if (!overlayHost || !targetField) return;
    if (!isRuntimeEligible(targetField)) {
      // Task 016 Addendum D. This runs every frame, so it is the first of the
      // three eligibility checks to see a focus-driven component restore its
      // `readonly` - within one frame of the user pressing FillNest's own
      // control. Same narrow test as the other two.
      if (isTransientlyReadOnly(targetField)) {
        positionOverlay();
        positionFrame = requestAnimationFrame(trackPosition);
        return;
      }
      if (pinned) {
        targetFieldActionable = false;
        removeSelectionPreview();
        renderOverlay();
        positionFrame = requestAnimationFrame(trackPosition);
        return;
      }
      if (targetField.isConnected) recoveryField = targetField;
      removeOverlay();
      return;
    }
    positionOverlay();
    // Consumed here so the evidence lasts one frame. Anything arriving later
    // without a focus change of ours is a page-driven change, and tears down.
    focusTakenByOurInterface = false;
    positionFrame = requestAnimationFrame(trackPosition);
  }

  /**
   * Task 036 Addendum H. Tab pressed inside FillNest's interface is FillNest's
   * alone.
   *
   * A page can answer Tab in two ways FillNest has to survive. A composer that
   * focuses itself on a key pressed "outside an editable element" sees only
   * FillNest's host - a plain element, because the Picker is in a Shadow Root -
   * and a focus-management library that runs its own Tab order moves the focus
   * to the next element *it* knows about. Either way the user was sent back to
   * the page on every Tab. Addendum A.2's focus restoration cannot help: it is
   * scoped to printable keys, because the browser's own Tab navigation runs
   * after the listeners and would be undone as well.
   *
   * Stopping the Tab here, on `window` in the capture phase, keeps it from
   * every listener the page puts on `document` or below. A listener the page
   * registered on `window` before this content script ran still sees it first
   * - measured on a real product - so when such a listener has already moved
   * the focus out during this same keystroke (`handleFocus` defers its answer
   * for exactly this), FillNest moves it to the control the Tab was heading
   * for and cancels the navigation. The browser's own navigation is otherwise
   * untouched: Tab still moves through the Shadow Root and out of it at either
   * end, so this is not a trap.
   */
  function containTabInOverlay(event: KeyboardEvent): void {
    if (!overlayHost || !shadowRoot || !isPlainTabKey(event)) return;
    if (!event.composedPath().includes(overlayHost)) return;
    event.stopImmediatePropagation();
    // A focus change that happened after this keystroke began belongs to it.
    const exit = overlayExit && overlayExit.at >= event.timeStamp ? overlayExit : null;
    const from = exit?.from ?? shadowRoot.activeElement;
    if (!(from instanceof HTMLElement)) return;
    const field = targetField;
    if (field && from.classList.contains("control")) {
      if (event.shiftKey) {
        // Backward: the control is conceptually attached to the Field, so
        // Shift+Tab returns focus there.
        event.preventDefault();
        overlayExit = null;
        field.focus();
        return;
      }
      // Forward while the Picker is closed: nothing of ours should still be in
      // the way, so hand focus to whatever would have followed the Field if
      // this control didn't exist. Once the Picker is open, its own content is
      // rendered right after this button in the same Shadow DOM, so ordinary
      // Tab already lands on it correctly.
      if (!pickerOpen) {
        event.preventDefault();
        overlayExit = null;
        (findNextFocusableAfter(field) ?? field).focus();
        return;
      }
    }
    if (!exit) return;
    const next = adjacentOverlayControl(from, event.shiftKey);
    // Past the Picker's last control the Tab was leaving anyway, so the page's
    // choice stands and the deferred answer to it runs as usual.
    if (!next) return;
    event.preventDefault();
    overlayExit = null;
    next.focus();
  }

  function adjacentOverlayControl(from: HTMLElement, backward: boolean): HTMLElement | null {
    if (!shadowRoot) return null;
    const wanted = backward ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    const candidates = [...shadowRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (candidate) =>
        candidate !== from &&
        isVisibleFocusTarget(candidate) &&
        (from.compareDocumentPosition(candidate) & wanted) !== 0,
    );
    return (backward ? candidates.at(-1) : candidates[0]) ?? null;
  }

  /**
   * Task 036 Addendum H. Focus moving into or within FillNest's interface is
   * not the page's business.
   *
   * Measured on a real product: a focus-management library records the
   * focused element from `focusin` on `document`, and on Tab pressed while it
   * holds one it moves the focus itself and stops the keystroke outright -
   * so FillNest's own Tab handling never ran. Told nothing about FillNest's
   * interface, the library sees only the page's composer lose focus, holds no
   * element, and leaves Tab alone. `focusin` and `focusout` whose path passes
   * through FillNest's host stop here, on `window` in the capture phase, which
   * every `document` listener comes after. Nothing inside the Picker listens
   * for either; FillNest's own `handleFocus` is called directly. The page
   * still sees its own elements lose and regain focus.
   */
  function containOverlayFocusEvent(event: FocusEvent): void {
    if (!overlayHost || !event.composedPath().includes(overlayHost)) return;
    if (event.type === "focusin") handleFocus(event);
    event.stopImmediatePropagation();
  }

  function markTextEntry(event: Event): void {
    if (event instanceof KeyboardEvent) {
      const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!printable) return;
    }
    textEntryInFlight = true;
    // Cleared on the next task, not the next microtask: the microtask queue is
    // drained after *each* listener callback, which would clear this before the
    // page's own listener on `document` ever ran - the exact listener this
    // exists to catch.
    window.setTimeout(() => {
      textEntryInFlight = false;
    }, 0);
  }

  function handleFocus(event: FocusEvent): void {
    focusSequence += 1;
    if (overlayHost && event.composedPath().includes(overlayHost)) {
      // Task 036 Addendum A: remember what inside the Picker holds the focus,
      // so it can be given back if the page takes it away.
      pickerFocusedElement = (shadowRoot?.activeElement as HTMLElement | null) ?? pickerFocusedElement;
      focusWasInsideOverlay = true;
      // Task 016 Addendum D. This is the moment FillNest's interface takes the
      // Field's focus - the Picker's own Search box receiving it as the Picker
      // opens. `blur` on the Field has already fired, so a focus-driven
      // component has already restored its `readonly`; the eligibility checks
      // run on the next frame and need to know why.
      focusTakenByOurInterface = true;
      return;
    }
    const element = event.target;
    if (!(element instanceof Element)) return;
    // Task 036 Addendum A. A page whose `document` keydown listener runs in the
    // capture phase gets the keystroke before FillNest can contain it, and
    // answers by focusing its own composer - which is how typing a Template on
    // ChatGPT and Claude ended up in their chat box with the Picker closed
    // behind it.
    //
    // The test is narrow on purpose: focus left FillNest's interface *while a
    // printable keystroke or a paste was being delivered*. That is the shape of
    // "type anywhere and I will focus the composer" and nothing else - not a
    // click into the page, not Tab, not a programmatic focus, each of which
    // must still work exactly as before. `textEntryInFlight` is set from a
    // listener on `window`, which the capture path reaches before any listener
    // the page can install on `document`.
    const leftOverlay = focusWasInsideOverlay && pickerFocusedElement?.isConnected === true;
    const stolenFromOverlay = pickerOpen && leftOverlay && textEntryInFlight;
    focusWasInsideOverlay = false;
    if (stolenFromOverlay) {
      pickerFocusedElement?.focus();
      return;
    }
    // Task 036 Addendum H. Focus leaving FillNest's interface is answered one
    // task later, not now.
    //
    // A page that runs its own Tab order - a focus-management library listening
    // on `window` in the capture phase, registered before this content script
    // could be - moves the focus while the Tab is still being delivered, before
    // `containTabInOverlay` sees it. Answering at once tore the Picker down
    // before the Tab could be recognised as ours. Waiting one task lets the
    // same keystroke reclaim the focus; anything else - a click into the page,
    // a programmatic focus, Tab past the Picker's last control - is answered
    // exactly as before, one task later.
    if (leftOverlay && pickerFocusedElement) {
      const sequence = focusSequence;
      overlayExit = { from: pickerFocusedElement, at: event.timeStamp };
      overlayExitTimer = window.setTimeout(() => {
        overlayExitTimer = null;
        if (sequence !== focusSequence) return;
        overlayExit = null;
        handleFocusOutsideOverlay(element);
      }, 0);
      return;
    }
    handleFocusOutsideOverlay(element);
  }

  function handleFocusOutsideOverlay(element: Element): void {
    const field = asSupportedField(element);
    if (field && isRuntimeEligible(field)) {
      // The user is placing their own caret; a selection read earlier no
      // longer describes where they want the text (Task 003, addendum of 2026-09-11).
      fieldSelection = null;
      void showForField(field);
      return;
    }
    // Task 016 Addendum D. Clicking FillNest's own control moves focus off the
    // Field - to `body`, which arrives here as focus landing on nothing
    // supported. A focus-driven component has by then marked its input
    // `readonly` again, so the Field the user is working on looks ineligible
    // at exactly the moment they asked for the Picker. Same narrow test as the
    // lifecycle path: `readonly` alone, and FillNest's own interface is what
    // took the focus.
    if (targetField && isTransientlyReadOnly(targetField)) return;
    if (pinned) {
      targetFieldActionable = false;
      renderOverlay();
    } else {
      removeOverlay();
    }
  }

  function handleRevocation(message: unknown): void {
    if (!isRevocationMessage(message)) return;
    if (!message.patterns.includes(permissionOriginFromUrl(location.href).pattern)) return;
    teardown();
  }

  function handleUndoInvalidation(message: unknown): void {
    if (!isStateChangeNotification(message)) return;
    if (message.type === "BUSINESS_STATE_CHANGED" && message.fieldIdentitiesInvalidated) {
      // Clear Site Data can remove the durable Page/Field Profiles referenced
      // by this document-lifetime cache while leaving the DOM Field itself in
      // place. Re-resolve the focused Field immediately so a still-open Picker
      // cannot reuse the identity on its next interaction.
      //
      // Only such a change may do this. The cache is also what keeps an
      // SPA-reconstructed Field's identity stable within the document - a
      // fresh candidate resolves with no field identity key, so re-resolving
      // it mints a new Field Profile id - and clearing it after an ordinary
      // mutation discarded the identity that mutation was recorded against.
      fieldContexts = new WeakMap();
      // Restore and Reset replace the Picker's saved position as well.
      loadSavedPickerPosition();
    }
    // The service worker sends mutation broadcasts before resolving the
    // originating request, so this clears the prior Field-scoped action while
    // leaving the just-completed action free to become the next one.
    lastAction = null;
    lastActionFieldProfileId = null;
    if (targetField && context) void recordLogicalPageObservation(targetField, context);
    renderOverlay();
  }

  function handleSidePanelFieldHighlight(message: unknown): void {
    if (!isSidePanelFieldHighlightMessage(message)) return;
    highlightSharedCandidate(message.fieldIdentityKey);
  }

  function teardown(): void {
    if (overlayExitTimer !== null) window.clearTimeout(overlayExitTimer);
    removeOverlay();
    document.documentElement.removeAttribute(ACTIVE_MARKER);
    window.removeEventListener("popstate", noticeAddressChange);
    window.removeEventListener("hashchange", noticeAddressChange);
    window.removeEventListener("keydown", markTextEntry, true);
    window.removeEventListener("keydown", containTabInOverlay, true);
    window.removeEventListener("focusin", containOverlayFocusEvent, true);
    window.removeEventListener("focusout", containOverlayFocusEvent, true);
    window.removeEventListener("paste", markTextEntry, true);
    document.removeEventListener("focusin", handleFocus, true);
    document.removeEventListener("mousedown", handleDocumentMouseDown, true);
    document.removeEventListener("keydown", handleDocumentKeyDown, true);
    window.removeEventListener("scroll", positionOverlay, true);
    window.removeEventListener("resize", positionOverlay);
    chrome.runtime.onMessage.removeListener(handleRevocation);
    chrome.runtime.onMessage.removeListener(handleUndoInvalidation);
    chrome.runtime.onMessage.removeListener(handleSidePanelFieldHighlight);
    lifecycleObserver.disconnect();
    if (sharedCandidateHighlightTimer !== null) window.clearTimeout(sharedCandidateHighlightTimer);
    sharedCandidateHighlightStyle.remove();
  }

  /**
   * Whether this Field is read-only only because FillNest took its focus.
   *
   * Task 016 Addendum D. A focus-driven component - Element UI's `el-select`,
   * and every typeahead built the same way - marks its own input `readonly`
   * whenever it does not have focus. Opening the Picker takes that focus, so
   * the Field goes read-only at the exact moment the user asked to use it, and
   * all three eligibility checks tore it down.
   *
   * After the transition the two cases are identical: a component reacting to
   * focus and a page that genuinely made a Field read-only both leave a
   * read-only Field under an open Picker. Only the transition tells them
   * apart, so the judgement is made **once**, while the evidence exists, and
   * then remembered for this Field until the overlay moves or goes away.
   *
   * `focusTakenByOurInterface` is deliberately short-lived - `trackPosition`
   * consumes it every frame. A page-driven `readonly` toggle arriving later,
   * with no focus change of ours, finds no evidence and tears down, which is
   * SPEC-016-READONLY-01 and the Task 016 contract this addendum leaves
   * intact.
   */
  function isTransientlyReadOnly(field: SupportedField): boolean {
    if (!isSupportedExceptReadOnly(field)) return false;
    if (transientlyReadOnlyField === field) return true;
    if (!focusTakenByOurInterface) return false;
    transientlyReadOnlyField = field;
    return true;
  }

  function isRuntimeEligible(field: SupportedField): boolean {
    if (!field.isConnected || asSupportedField(field) !== field) return false;
    for (let element: Element | null = field; element; element = element.parentElement) {
      if (element.hasAttribute("hidden")) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }

  function markCandidate(element: Element, snapshot?: PageFieldSnapshot): void {
    const field = asSupportedField(element);
    if (field && isRuntimeEligible(field)) {
      rememberFieldEvidence(field, snapshot);
      field.setAttribute(FIELD_MARKER, "");
    } else {
      observedFieldEvidence.delete(element);
      element.removeAttribute(FIELD_MARKER);
    }
  }

  function fieldsWithin(node: Node): SupportedField[] {
    const elements = node instanceof Element ? [node, ...node.querySelectorAll(FIELD_CANDIDATE_SELECTOR)] : [];
    return elements.filter(
      (element): element is SupportedField => isNativeField(element) || isEditingHost(element),
    );
  }

  // Every other reliably identified Field currently on this page, whether
  // or not it has ever been bound to anything - a Field only gets a
  // durable Field Profile in storage from an actual Bind, so a page's
  // freshly-added, never-touched Fields (e.g. from a "add another" button)
  // would otherwise be invisible to the Shared Template Set "Add Fields"
  // flow even though the Confirmed Contract explicitly allows sharing with
  // an empty Field.
  function pageFieldCandidates(excluding: SupportedField): {
    fieldIdentityKey: string;
    documentOrder: number | null;
    observedTitle: string | null;
  }[] {
    const candidates: { fieldIdentityKey: string; documentOrder: number | null; observedTitle: string | null }[] = [];
    const snapshot = snapshotPageFields();
    for (const field of snapshot.fields) {
      if (field === excluding || !isRuntimeEligible(field)) continue;
      const evidence = readDomRecognitionEvidence(field, snapshot);
      if (!evidence.fieldIdentityKey) continue;
      candidates.push({
        fieldIdentityKey: evidence.fieldIdentityKey,
        documentOrder: evidence.documentOrder,
        observedTitle: evidence.observedTitle,
      });
    }
    return candidates;
  }

  // `fromHover` marks a call driven by the Finder row's own onMouseEnter/
  // onMouseLeave. A deliberate "Locate on Page" already owns its highlight
  // for the full duration of its own removal timer - reactive positioning
  // (this same click's own scroll moves the Picker overlay to keep following
  // the anchor Field it's attached to) can shift a Finder row out from under
  // a stationary pointer mid-scroll, firing a native mouseleave that must
  // not cancel the Locate's highlight it did not knowingly ask to leave.
  // Every other caller (teardown, a genuine hover onto a *different*
  // candidate, or the Locate's own timeout) still clears unconditionally.
  function highlightSharedCandidate(identityKey: string | null, fromHover = false): void {
    if (fromHover && identityKey === null && sharedCandidateHighlightTimer !== null) return;
    if (sharedCandidateHighlightTimer !== null) {
      window.clearTimeout(sharedCandidateHighlightTimer);
      sharedCandidateHighlightTimer = null;
    }
    sharedCandidateHighlight?.removeAttribute(SHARED_CANDIDATE_HIGHLIGHT_MARKER);
    sharedCandidateHighlight = null;
    if (!identityKey) return;
    const snapshot = snapshotPageFields();
    for (const candidate of snapshot.fields) {
      if (!isRuntimeEligible(candidate)) continue;
      if (readDomRecognitionEvidence(candidate, snapshot).fieldIdentityKey !== identityKey) continue;
      candidate.setAttribute(SHARED_CANDIDATE_HIGHLIGHT_MARKER, "");
      sharedCandidateHighlight = candidate;
      return;
    }
  }

  function locateSharedCandidate(identityKey: string): void {
    highlightSharedCandidate(identityKey);
    if (!sharedCandidateHighlight) return;
    sharedCandidateHighlight.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    sharedCandidateHighlightTimer = window.setTimeout(() => {
      sharedCandidateHighlight?.removeAttribute(SHARED_CANDIDATE_HIGHLIGHT_MARKER);
      sharedCandidateHighlight = null;
      sharedCandidateHighlightTimer = null;
    }, 1_800);
  }

  function rememberFieldEvidence(field: SupportedField, snapshot?: PageFieldSnapshot): void {
    const evidence = readDomRecognitionEvidence(field, snapshot);
    const previous = observedFieldEvidence.get(field);
    observedFieldEvidence.set(field, {
      // Task 036 Addendum I. Re-recording a Field never moves it onto a Page
      // it arrived at from another one.
      //
      // Found in the owner's recording of a real product opening a
      // conversation: the address changes first, the view around the old
      // composer is touched while it is still mounted, and only then is the
      // composer replaced. Re-recording on that touch moved the old composer
      // onto the new address, so its removal counted as a replacement *on this
      // page* - Addendum A.4 says only those can be - and the new composer was
      // marked a fresh candidate. The mark then outlived every later
      // conversation, because they share one Page identity.
      pageIdentityKey: previous ? evidencePage(previous) : evidence.pageIdentityKey,
      addressEpoch,
      fieldIdentityKey: evidence.fieldIdentityKey,
      hasGenericSemanticKind: hasGenericSemanticKind(field, snapshot),
    });
  }

  function fieldsAffectedBy(node: Node): Element[] {
    const lifecycleElements = node instanceof Element
      ? [node, ...node.querySelectorAll(`${FIELD_CANDIDATE_SELECTOR}, [${FIELD_MARKER}]`)]
      : [];
    const fields = new Set<Element>(
      lifecycleElements.filter(
        (candidate) =>
          isNativeField(candidate) || isEditingHost(candidate) || candidate.hasAttribute(FIELD_MARKER),
      ),
    );
    const element = node instanceof Element ? node : node.parentElement;
    // Task 039 C3. A former Rich Text Field can stop being an editing host
    // because it changed itself or because an ancestor became editable. Its
    // marker keeps both the mutation target and marked descendants in this
    // final teardown pass after `isEditingHost` stops recognizing them.
    const label = element?.closest("label");
    if (label instanceof HTMLLabelElement && label.control) {
      if (label.control instanceof HTMLInputElement || label.control instanceof HTMLTextAreaElement) {
        fields.add(label.control);
      }
    }
    return [...fields];
  }

  function queueLifecycleField(field: Element): void {
    lifecycleFields.add(field);
  }

  function reconcileLifecycle(): void {
    lifecycleFlushQueued = false;
    // Task 036 Addendum A.4: a new address means every fresh-candidate mark
    // belonged to the page before it.
    noticeAddressChange();
    // Task 035 R7: one page snapshot for the whole flush. Judging each Field
    // used to re-enumerate the page and rebuild every peer's key, which is
    // quadratic in the number of Fields - 686ms on a 200-Field page under
    // churn, against the page's own 13ms.
    const snapshot = lifecycleFields.size > 0 ? snapshotPageFields() : undefined;
    for (const field of lifecycleFields) {
      markCandidate(field, snapshot);
    }
    lifecycleFields.clear();

    if (targetField && !isRuntimeEligible(targetField)) {
      // Task 016 Addendum D. A focus-driven component marks its own input
      // `readonly` the moment it loses focus - and what took the focus was
      // FillNest's own Picker, opening on that very field. Tearing down here
      // removes the interface the user is in the middle of using, which is
      // what happened on Element UI's "Search User" select.
      //
      // Narrow on purpose: `readonly` must be the *only* obstacle, and the
      // focus must be inside FillNest's own UI. A site that genuinely
      // disables, hides, detaches or re-types a Field still tears down, which
      // is the Task 016 contract this addendum leaves intact.
      if (isTransientlyReadOnly(targetField)) return;
      if (pinned) {
        targetFieldActionable = false;
        removeSelectionPreview();
        renderOverlay();
      } else {
        if (targetField.isConnected) recoveryField = targetField;
        removeOverlay();
      }
    }

    if (recoveryField && isRuntimeEligible(recoveryField)) {
      const field = recoveryField;
      recoveryField = null;
      void showForField(field);
    }
    // Task 036 Addendum F. A.7 converges the Page identity on every frame;
    // Field identity converges here, where a structural change is already
    // known to have happened and one shared Page snapshot already exists.
    //
    // A native Field's key contains its ancestor chain and form. During an SPA
    // transition it may be resolved inside a temporary wrapper, after which
    // the Page identity is correct but the Field context is not. The settled
    // DOM mutation must trigger another resolution even when focus never moves.
    // `showForField`'s revision makes the latest lifecycle state win if a
    // previous resolution is still in flight.
    //
    // Task 036 Addendum G. A removal needs the check too, even when it queued
    // nothing. A native key carries its ordinal among identical peers, so an
    // application that mounts the next view's composer while the previous
    // view's identical one is still in the document resolves the new one at
    // ordinal 1. Emptying the previous view - a container that does not hold
    // the Target Field - moves it back to 0 and queues no Field at all.
    const fieldRemoved = fieldRemovedSinceReconcile;
    fieldRemovedSinceReconcile = false;
    if (context && targetField && isRuntimeEligible(targetField) && (snapshot || fieldRemoved)) {
      const currentEvidence = readDomRecognitionEvidence(targetField, snapshot ?? snapshotPageFields());
      const currentFieldIdentityKey = freshCandidates.has(targetField)
        ? null
        : currentEvidence.fieldIdentityKey;
      if (contextFieldIdentityKey !== currentFieldIdentityKey) {
        void showForField(targetField, snapshot, true);
      }
    }
    detachedFieldEvidence.length = 0;
  }

  function handleLifecycleMutations(records: MutationRecord[]): void {
    // Task 035 finding R7, after measuring. Every record used to be answered
    // with a `querySelectorAll` over its target's whole subtree, and a busy
    // conversation list sends a thousand records whose target is the *same*
    // container - so that container was scanned a thousand times per batch.
    // Measured at 500 append-and-remove batches over a 2,000-node list: 44ms
    // with FillNest against 14ms without, three times the page's own cost.
    // Scanning each distinct target once is the same answer for less work:
    // `queueLifecycleField` collects into a Set, so a target seen repeatedly
    // never contributed anything a single scan does not.
    const affectedTargets = new Set<Node>();
    // A native Field may be associated with a Form outside its own subtree.
    // Mutating that Form cannot be discovered by walking the mutation target,
    // so collect external controls once for the whole observer batch. All are
    // queued because an id mutation can sever the association before the
    // observer runs, leaving no reliable DOM link back to the changed Form.
    let externalFormAssociationMayHaveChanged = false;
    // Task 035 R7, third measurement. The replacement check below reads full
    // recognition evidence for every added Field, and that reads the whole
    // page. Five hundred added Fields on a 200-Field page meant five hundred
    // page enumerations in one batch - 522ms of the 535ms measured. One
    // snapshot answers all of them, built lazily so a batch with no added
    // Fields pays nothing.
    let snapshot: PageFieldSnapshot | undefined;
    const pageFields = (): PageFieldSnapshot => (snapshot ??= snapshotPageFields());
    // Task 036 Addendum I: an address change the per-frame check has not seen
    // yet still has to separate this Page's removals from the previous one's.
    syncAddressEpoch();
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.removedNodes) {
          if (
            node instanceof HTMLFormElement ||
            (node instanceof Element && node.querySelector("form") !== null)
          ) {
            externalFormAssociationMayHaveChanged = true;
          }
          for (const field of fieldsWithin(node)) {
            fieldRemovedSinceReconcile = true;
            const evidence = observedFieldEvidence.get(field);
            if (evidence) detachedFieldEvidence.push(evidence);
          }
        }
        for (const node of record.addedNodes) {
          if (
            node instanceof HTMLFormElement ||
            (node instanceof Element && node.querySelector("form") !== null)
          ) {
            externalFormAssociationMayHaveChanged = true;
          }
          for (const field of fieldsWithin(node)) {
            if (!asSupportedField(field)) {
              queueLifecycleField(field);
              continue;
            }
            const evidence = readDomRecognitionEvidence(field, pageFields());
            // Task 036 Addendum A.4. Only a removal from *this* page is a
            // replacement.
            //
            // Found from the owner's ChatGPT recording, where the Field's
            // identity was byte-identical across eighteen samples and the
            // Templates still came and went. The correlation was exact:
            // arriving at a conversation from the new-conversation page showed
            // nothing; arriving from another conversation showed everything.
            //
            // An SPA route change removes the old page's composer and adds the
            // new page's, in one batch. The detached evidence then carries the
            // *previous* page's identity, so the comparison below could never
            // match, the new composer was marked a fresh candidate, and a fresh
            // candidate has its identity deliberately nulled - which is how a
            // Field with a perfectly stable key ends up offering nothing. It
            // then stayed marked for that element's whole life.
            //
            // A navigation is not a replacement, and the fail-closed boundary
            // Task 016 draws is about a Field being swapped underneath the user
            // *on one page*. Evidence from another page is discarded rather
            // than counted as a failure to match.
            const samePageDetachedEvidence = detachedFieldEvidence.filter(
              (detached) => evidencePage(detached) === evidence.pageIdentityKey,
            );
            const reliablyReplacesDetachedField = samePageDetachedEvidence.some(
              (detached) =>
                detached.hasGenericSemanticKind &&
                hasGenericSemanticKind(field, pageFields()) &&
                detached.fieldIdentityKey === evidence.fieldIdentityKey,
            );
            // A delayed page-hydration Field has no detached predecessor and
            // must use ordinary reliable recognition. Only an actual removal
            // batch needs the replacement fail-closed boundary.
            if (samePageDetachedEvidence.length > 0 && !reliablyReplacesDetachedField) {
              freshCandidates.add(field);
            }
            queueLifecycleField(field);
          }
        }
        affectedTargets.add(record.target);
      } else {
        affectedTargets.add(record.target);
        if (
          record.target instanceof HTMLFormElement &&
          (record.attributeName === "id" ||
            record.attributeName === "name" ||
            record.attributeName === "aria-label")
        ) {
          externalFormAssociationMayHaveChanged = true;
        }
      }
    }
    for (const target of affectedTargets) {
      for (const field of fieldsAffectedBy(target)) queueLifecycleField(field);
    }
    if (externalFormAssociationMayHaveChanged) {
      for (const candidate of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[form], textarea[form]",
      )) {
        const field = asSupportedField(candidate);
        if (!field || !isNativeField(field)) continue;
        queueLifecycleField(field);
      }
    }
    if (lifecycleFlushQueued) return;
    lifecycleFlushQueued = true;
    queueMicrotask(reconcileLifecycle);
  }

  const lifecycleObserver = new MutationObserver(handleLifecycleMutations);

  // Task 036 Addendum A. On `window`, which the capture path reaches before
  // `document` - so this is set before any page listener can react to the same
  // keystroke by moving the focus. Modifier combinations and Tab are excluded:
  // a shortcut is not text entry, and trapping Tab would be a keyboard trap.
  // Task 036 Addendum A.6. History navigation carries no DOM mutation of its
  // own, so the two checks A.5 added can both miss it. These two cost nothing
  // when nothing happens.
  //
  // A 250ms poll stood here as well, and was removed once the Gemini defect it
  // was insurance against turned out to be stale data from an earlier build.
  // It guarded no case the lifecycle reconciliation, the per-frame position
  // loop and the next focus did not already cover, and a recurring timer on
  // every authorized page is not something to carry on a hunch.
  window.addEventListener("popstate", noticeAddressChange);
  window.addEventListener("hashchange", noticeAddressChange);
  window.addEventListener("keydown", markTextEntry, true);
  window.addEventListener("keydown", containTabInOverlay, true);
  window.addEventListener("focusin", containOverlayFocusEvent, true);
  window.addEventListener("focusout", containOverlayFocusEvent, true);
  window.addEventListener("paste", markTextEntry, true);
  document.addEventListener("focusin", handleFocus, true);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
  document.addEventListener("keydown", handleDocumentKeyDown, true);
  window.addEventListener("scroll", positionOverlay, true);
  window.addEventListener("resize", positionOverlay);
  chrome.runtime.onMessage.addListener(handleRevocation);
  chrome.runtime.onMessage.addListener(handleUndoInvalidation);
  chrome.runtime.onMessage.addListener(handleSidePanelFieldHighlight);
  lifecycleObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "hidden",
      "disabled",
      "readonly",
      "style",
      "class",
      "type",
      "role",
      "autocomplete",
      "form",
      "name",
      "id",
      "aria-label",
      "aria-controls",
      "data-provide",
      "placeholder",
      "for",
      // Task 036: the three attributes that decide whether an editing host is
      // a Field at all, and whether it stays one.
      "contenteditable",
      "aria-multiline",
      "aria-labelledby",
    ],
    characterData: true,
  });
  for (const element of document.querySelectorAll(FIELD_CANDIDATE_SELECTOR)) {
    const field = asSupportedField(element);
    if (field) queueLifecycleField(field);
  }
  reconcileLifecycle();

  if (document.activeElement instanceof Element) {
    const activeField = asSupportedField(document.activeElement);
    if (activeField) void showForField(activeField);
  }

  return teardown;
}

async function resolveFieldContext(
  evidence: ReturnType<typeof readDomRecognitionEvidence>,
): Promise<FieldContextResolution> {
  const response = await sendRequest({
    type: "RESOLVE_FIELD_CONTEXT",
    pageUrl: location.href,
    ...evidence,
  });
  if (!response.ok || !isFieldContextResolution(response.value)) {
    throw new Error(response.ok ? "Invalid field context response" : response.error);
  }
  return response.value;
}

async function recordLogicalPageObservation(
  field: SupportedField,
  fieldContext: FieldContextResolution,
): Promise<void> {
  // Best effort by design, same as collectOpaqueLogicalPageEvidence: a
  // stale content script (extension reloaded/updated while this page
  // stayed open) throws "Extension context invalidated" on any of these
  // requests - it must resolve quietly rather than surface an unhandled
  // rejection, since both call sites fire this without awaiting it.
  try {
    const pageUrl = location.href;
    // Task 014 Addendum C Slice 2: an Observation is recorded for any bound
    // Page, not only one whose address already spelled a record position. That
    // gate is what made the whole mechanism unreachable on sites whose records
    // are slugs - there was never anything stored to compare against. The set
    // stays bounded: Observations are pruned to Pages that still have a
    // Binding.

    const stateResponse = await sendRequest({ type: "READ_STATE" });
    if (location.href !== pageUrl || !stateResponse.ok || !isLogicalPageState(stateResponse.value)) return;
    const hasDirectBinding = stateResponse.value.bindings.some(
      (binding) =>
        binding.pageProfileId === fieldContext.pageProfileId &&
        binding.fieldProfileId === fieldContext.fieldProfileId,
    );
    const alreadyObserved = stateResponse.value.logicalPageObservations.some(
      (observation) => observation.pageProfileId === fieldContext.pageProfileId,
    );
    if (!hasDirectBinding || alreadyObserved || !field.isConnected) return;

    const collected = await collectOpaqueLogicalPageEvidence(field, pageUrl);
    if (!collected) return;

    await sendRequest({
      type: "RECORD_LOGICAL_PAGE_OBSERVATION",
      pageUrl,
      pageProfileId: fieldContext.pageProfileId,
      siteKeyId: collected.siteKeyId,
      evidence: {
        origin: collected.payload.origin,
        routePattern: collected.payload.routePattern,
        fieldFeatureHashes: collected.payload.fieldFeatureHashes,
        groupedFieldFeatureHashes: collected.payload.groupedFieldFeatureHashes,
      },
    });
  } catch {
    return;
  }
}

/**
 * Fetches the Site key and derives this Field's opaque Logical Page evidence,
 * shared by Observation recording and candidate resolution so the keyed
 * hashing is defined - and paid for - once per focus rather than twice.
 *
 * Best effort by design: any failure - a race with the page's own DOM
 * changes, a rejected request, an interrupted navigation - resolves to null
 * rather than surfacing an unhandled rejection or interrupting whatever the
 * user is doing with the Target Field.
 */
async function collectOpaqueLogicalPageEvidence(
  field: SupportedField,
  pageUrl: string,
): Promise<{ siteKeyId: string; payload: OpaqueLogicalPageCandidateEvidencePayload } | null> {
  try {
    if (!field.isConnected) return null;
    const keyResponse = await sendRequest({ type: "GET_LOGICAL_PAGE_SITE_KEY", pageUrl });
    if (
      location.href !== pageUrl ||
      !keyResponse.ok ||
      !isLogicalPageSiteKeyResult(keyResponse.value) ||
      !field.isConnected
    ) return null;

    const evidence = await readLogicalPageEvidence(field, keyResponse.value.encodedHmacKey, pageUrl);
    if (location.href !== pageUrl || !field.isConnected || evidence.routePattern === null) return null;

    return {
      siteKeyId: keyResponse.value.siteKeyId,
      payload: {
        origin: evidence.origin,
        routePattern: evidence.routePattern,
        fieldFeatureHashes: [...evidence.fieldFeatures],
        groupedFieldFeatureHashes: [...evidence.groupedFieldFeatures],
        fieldIdentityKey: evidence.fieldIdentityKey,
      },
    };
  } catch {
    return null;
  }
}

async function resolveLogicalPageCandidateForField(
  field: SupportedField,
  fieldContext: FieldContextResolution,
): Promise<{ resolution: LogicalPageCandidateResolution; evidence: OpaqueLogicalPageCandidateEvidencePayload } | null> {
  const pageUrl = location.href;
  if (fieldContext.recognized || !field.isConnected) return null;

  try {
    const collected = await collectOpaqueLogicalPageEvidence(field, pageUrl);
    if (!collected) return null;
    const payload = collected.payload;

    const response = await sendRequest({ type: "RESOLVE_LOGICAL_PAGE_CANDIDATE", evidence: payload });
    if (location.href !== pageUrl || !response.ok || !isLogicalPageCandidateResolution(response.value)) return null;
    return { resolution: response.value, evidence: payload };
  } catch {
    return null;
  }
}

// The FillNest control button lives in a Shadow DOM host appended to
// `document.documentElement` for stacking/positioning reasons, so its real
// DOM position has nothing to do with the Target Field it is visually
// pinned beside - a keyboard user tabbing forward from the Field would
// never naturally reach it. `handleDocumentKeyDown`/`containTabInOverlay`
// splice it into the tab sequence: Field -> control -> whatever would have
// followed the Field anyway, so reaching or skipping it never traps focus.
const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function isVisibleFocusTarget(element: HTMLElement): boolean {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function findNextFocusableAfter(field: SupportedField): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      isVisibleFocusTarget(element) &&
      !element.closest(`[${OVERLAY_MARKER}]`) &&
      !element.closest(`[${PAGE_STATUS_MARKER}]`),
  );
  const index = candidates.indexOf(field);
  if (index === -1) return null;
  return candidates[index + 1] ?? null;
}

function isPlainTabKey(event: KeyboardEvent): boolean {
  return event.key === "Tab" && !event.altKey && !event.metaKey && !event.ctrlKey;
}


function isLogicalPageState(value: unknown): value is FillNestState {
  return (
    typeof value === "object" &&
    value !== null &&
    "bindings" in value &&
    Array.isArray(value.bindings) &&
    "logicalPageObservations" in value &&
    Array.isArray(value.logicalPageObservations)
  );
}

function isLogicalPageSiteKeyResult(
  value: unknown,
): value is { siteKeyId: string; encodedHmacKey: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "siteKeyId" in value &&
    typeof value.siteKeyId === "string" &&
    "encodedHmacKey" in value &&
    typeof value.encodedHmacKey === "string"
  );
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

function isLogicalPageReviewCandidate(value: unknown): value is LogicalPageReviewCandidate {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "ruleId" in value &&
    typeof value.ruleId === "string" &&
    "canonicalPageProfileId" in value &&
    typeof value.canonicalPageProfileId === "string" &&
    "reviewRequired" in value &&
    value.reviewRequired === true
  );
}

function isLogicalPageCandidateResolution(value: unknown): value is LogicalPageCandidateResolution {
  return (
    isFieldContextResolution(value) &&
    "candidate" in value &&
    (value.candidate === null || isLogicalPageReviewCandidate(value.candidate))
  );
}

function isRevocationMessage(
  value: unknown,
): value is { type: "PERMISSION_REVOKED"; patterns: string[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "PERMISSION_REVOKED" &&
    "patterns" in value &&
    Array.isArray(value.patterns) &&
    value.patterns.every((pattern) => typeof pattern === "string")
  );
}

function isSidePanelFieldHighlightMessage(
  value: unknown,
): value is { type: "HIGHLIGHT_SIDEPANEL_FIELD"; fieldIdentityKey: string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "HIGHLIGHT_SIDEPANEL_FIELD" &&
    "fieldIdentityKey" in value &&
    (typeof value.fieldIdentityKey === "string" || value.fieldIdentityKey === null)
  );
}

function isActivationChangedMessage(
  value: unknown,
): value is { type: "ACTIVATION_STATE_CHANGED" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "ACTIVATION_STATE_CHANGED"
  );
}

function asActivationSnapshot(value: unknown): ActivationSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("global" in value) || (value.global !== "active" && value.global !== "paused")) {
    return null;
  }
  if (!("page" in value) || typeof value.page !== "object" || value.page === null) return null;
  if (!("status" in value.page)) return null;
  if (value.page.status === "unavailable") return value as ActivationSnapshot;
  if (
    value.page.status === "available" &&
    "websiteAccess" in value.page &&
    typeof value.page.websiteAccess === "boolean" &&
    "originActivation" in value.page &&
    (value.page.originActivation === "active" || value.page.originActivation === "paused")
  ) {
    return value as ActivationSnapshot;
  }
  return null;
}
