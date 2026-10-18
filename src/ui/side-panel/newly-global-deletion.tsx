import { useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { useMessages } from "../../i18n/useMessages";
import type { FillNestState, RestoreTemplateInput, TemplateRecord } from "../../storage/fillnest-repository";
import {
  ModalDialog,
  rememberFocusedElement,
  restoreFocus,
  type SidePanelNotification,
  sendRequest,
} from "./SidePanelShared";

function isDeleteNewlyGlobalTemplatesResult(value: unknown): value is { deleted: RestoreTemplateInput[] } {
  return typeof value === "object" && value !== null && "deleted" in value &&
    Array.isArray((value).deleted);
}

/**
 * The follow-up every result that made Templates Global offers: delete
 * exactly those Templates, with Undo. Used by the Sites page (Clear Site
 * Data, Remove Site) and the Shared Sets tab (Leave sharing, End sharing).
 * Emptying the whole Library asks for a typed confirmation (Task 028
 * Addendum B); the caller renders `sheet`.
 */
export function useNewlyGlobalDeletion({
  business,
  onRefresh,
  onError,
  onNotify,
}: {
  business: FillNestState;
  onRefresh(): Promise<void>;
  onError(message: string): void;
  onNotify(message: string, detail?: string, action?: SidePanelNotification["action"]): void;
}): { request(templates: TemplateRecord[]): void; sheet: JSX.Element | null } {
  const t = useMessages();
  const [wholeLibrary, setWholeLibrary] = useState<TemplateRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  async function remove(templates: TemplateRecord[], typedConfirmation?: "delete"): Promise<boolean> {
    const response = await sendRequest({
      type: "DELETE_NEWLY_GLOBAL_TEMPLATES",
      templates: templates.map((template) => ({ id: template.id, expectedRevision: template.revision })),
      // Task 028 Addendum B: the service worker re-derives from its own state
      // whether this empties the Library and enforces the gate there.
      ...(typedConfirmation ? { typedConfirmation } : {}),
    });
    if (!response.ok) {
      onError(response.error);
      return false;
    }
    if (!isDeleteNewlyGlobalTemplatesResult(response.value)) {
      onError(t.invalidResult());
      return false;
    }
    await onRefresh();
    const deleted = response.value.deleted;
    onNotify(
      t.deletedNewlyGlobal(deleted.length),
      undefined,
      { label: t.undo(), onClick: () => void undo(deleted) },
    );
    return true;
  }

  async function undo(templates: RestoreTemplateInput[]): Promise<void> {
    const response = await sendRequest({ type: "RESTORE_TEMPLATES", templates });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onNotify(t.restoredTemplates(templates.length));
  }

  function request(templates: TemplateRecord[]): void {
    // Task 028 Addendum B: a single Template is a targeted deletion, never a
    // bulk one - even when it is the last Template in the Library.
    if (templates.length > 1 && templates.length === business.templates.length) {
      triggerRef.current = rememberFocusedElement();
      setWholeLibrary(templates);
      return;
    }
    void remove(templates);
  }

  function confirmWholeLibrary(): void {
    if (busyRef.current || !wholeLibrary) return;
    busyRef.current = true;
    setBusy(true);
    const templates = wholeLibrary;
    setWholeLibrary(null);
    void remove(templates, "delete")
      .then((deleted) => {
        if (deleted) restoreFocus(triggerRef.current);
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  }

  const sheet = wholeLibrary ? (
    <WholeLibraryNewlyGlobalDeleteSheet
      count={wholeLibrary.length}
      onConfirm={confirmWholeLibrary}
      onCancel={() => setWholeLibrary(null)}
      busy={busy}
      restoreFocusTo={triggerRef.current}
    />
  ) : null;

  return { request, sheet };
}

export function WholeLibraryNewlyGlobalDeleteSheet({
  count,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  count: number;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  const [typed, setTyped] = useState("");
  const typedRef = useRef<HTMLInputElement>(null);
  return (
    <ModalDialog
      label={t.deleteNewlyGlobalTemplates()}
      busy={busy}
      onCancel={onCancel}
      initialFocusRef={typedRef}
      restoreFocusTo={restoreFocusTo}
    >
        <span class="clean-up-grabber" aria-hidden="true" />
        <strong class="clean-up-title">{t.deleteAllNewlyGlobalQuestion(count)}</strong>
        <p class="remove-sheet-body">{t.deleteLibraryWarningPrefix()}<code>delete</code>{t.deleteLibraryWarningSuffix()}</p>
        <label class="search">
          <span>{t.typeDeleteToConfirm()}</span>
          <input
            ref={typedRef}
            aria-label={t.typeDeleteToConfirm()}
            value={typed}
            onInput={(event) => setTyped(event.currentTarget.value)}
          />
        </label>
        <div class="confirm-actions">
          <button type="button" class="danger" disabled={typed !== "delete"} onClick={onConfirm}>{t.deleteTemplates()}</button>
          <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>{t.cancel()}</button>
        </div>
    </ModalDialog>
  );
}
