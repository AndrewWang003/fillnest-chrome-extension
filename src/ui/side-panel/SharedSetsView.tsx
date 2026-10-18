import { useMemo, useRef, useState } from "preact/hooks";

import { useMessages } from "../../i18n/useMessages";
import { fieldDisplayName, pageDisplayName } from "../../labels/display-label";
import type {
  BindingRecord,
  FillNestState,
  SharedTemplateBindingRecord,
  SharedTemplateFieldStateRecord,
  SharedTemplateSetRecord,
  TemplateRecord,
} from "../../storage/fillnest-repository";
import { buildSharedSetViews, type SharedSetMemberView, type SharedSetView } from "../../templates/shared-set-view";
import { derivePreview } from "../../templates/template-preview";
import { useNewlyGlobalDeletion } from "./newly-global-deletion";
import {
  ModalDialog,
  rememberFocusedElement,
  restoreFocus,
  type SidePanelNotification,
  sendRequest,
} from "./SidePanelShared";
import { AliasLabel, TreeNodeRow } from "./TemplatesPage";

export interface EndSharingFlow {
  set: SharedTemplateSetRecord;
  sharedBindings: SharedTemplateBindingRecord[];
  endedFieldStates: SharedTemplateFieldStateRecord[];
}

export interface RemoveSharedMemberFlow {
  set: SharedTemplateSetRecord;
  fieldProfileId: string;
  fieldLabel: string;
  endedSharedBindings: SharedTemplateBindingRecord[];
}

function isRemoveSharedMemberResult(
  value: unknown,
): value is {
  set: SharedTemplateSetRecord | null;
  ended: boolean;
  newlyGlobalTemplates: TemplateRecord[];
  snapshotBindings: BindingRecord[];
  dormantBindings: BindingRecord[];
  removedOwnedSlots: SharedTemplateBindingRecord[];
  removedFieldStates: SharedTemplateFieldStateRecord[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "ended" in value &&
    typeof (value).ended === "boolean" &&
    "newlyGlobalTemplates" in value &&
    Array.isArray((value as { newlyGlobalTemplates: unknown }).newlyGlobalTemplates) &&
    "snapshotBindings" in value &&
    Array.isArray((value as { snapshotBindings: unknown }).snapshotBindings) &&
    "dormantBindings" in value &&
    Array.isArray((value as { dormantBindings: unknown }).dormantBindings) &&
    "removedOwnedSlots" in value &&
    Array.isArray((value as { removedOwnedSlots: unknown }).removedOwnedSlots) &&
    "removedFieldStates" in value &&
    Array.isArray((value as { removedFieldStates: unknown }).removedFieldStates)
  );
}

function isEndSharedTemplateSetResult(
  value: unknown,
): value is {
  memberFieldProfileIds: string[];
  newlyGlobalTemplates: TemplateRecord[];
  endedFieldStates: SharedTemplateFieldStateRecord[];
  convertedBindings: BindingRecord[];
  dormantBindings: BindingRecord[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "memberFieldProfileIds" in value &&
    Array.isArray((value).memberFieldProfileIds) &&
    "newlyGlobalTemplates" in value &&
    Array.isArray((value as { newlyGlobalTemplates: unknown }).newlyGlobalTemplates) &&
    "endedFieldStates" in value &&
    Array.isArray((value as { endedFieldStates: unknown }).endedFieldStates) &&
    "convertedBindings" in value &&
    Array.isArray((value as { convertedBindings: unknown }).convertedBindings) &&
    "dormantBindings" in value &&
    Array.isArray((value as { dormantBindings: unknown }).dormantBindings)
  );
}

/**
 * Task 040. The Templates page's Shared Sets tab: every Shared Template Set,
 * its shared list once, and each member Field with where it is and how it
 * differs from that list (owner decisions 1A and 2A). It renames a Set or a
 * member Field, and runs Leave sharing and End sharing with their Task 021
 * confirmations, results and Undo (owner decision 3A).
 */
export function SharedSetsView({
  business,
  onRefresh,
  onError,
  onNotify,
}: {
  business: FillNestState;
  onRefresh(): Promise<void>;
  onError(message: string): void;
  onNotify(message: string, detail?: string, action?: SidePanelNotification["action"]): void;
}) {
  const t = useMessages();
  const views = useMemo(() => buildSharedSetViews(business), [business]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [endSharingFlow, setEndSharingFlow] = useState<EndSharingFlow | null>(null);
  const [removeMemberFlow, setRemoveMemberFlow] = useState<RemoveSharedMemberFlow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const newlyGlobalDeletion = useNewlyGlobalDeletion({ business, onRefresh, onError, onNotify });

  function toggle(setId: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }

  function fieldLabel(fieldProfileId: string): string {
    const field = business.fieldProfiles.find((candidate) => candidate.id === fieldProfileId);
    return field ? fieldDisplayName(field, t) : t.unknownField();
  }

  // The control that opened a confirmation is usually gone once it succeeds
  // - the member left, or the Set ended - so focus falls back to this tab.
  function restoreConfirmationFocus(): void {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger?.isConnected) {
      restoreFocus(trigger);
      return;
    }
    restoreFocus(document.querySelector<HTMLElement>(".library-tabs button[aria-current='true']"));
  }

  function runConfirmation(action: () => Promise<unknown>): void {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    void action().finally(() => {
      confirmingRef.current = false;
      setConfirming(false);
    });
  }

  async function renameSet(setId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const response = await sendRequest({ type: "RENAME_SHARED_TEMPLATE_SET", setId, name: trimmed });
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

  function beginRemoveMember(set: SharedTemplateSetRecord, fieldProfileId: string): void {
    triggerRef.current = rememberFocusedElement();
    setRemoveMemberFlow({
      set,
      fieldProfileId,
      fieldLabel: fieldLabel(fieldProfileId),
      endedSharedBindings: business.sharedTemplateBindings.filter((binding) => binding.setId === set.id),
    });
  }

  async function confirmRemoveMember(): Promise<void> {
    if (!removeMemberFlow) return;
    const { set, fieldProfileId, fieldLabel: label, endedSharedBindings } = removeMemberFlow;
    const response = await sendRequest({ type: "REMOVE_SHARED_TEMPLATE_SET_MEMBER", setId: set.id, fieldProfileId });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    if (!isRemoveSharedMemberResult(response.value)) {
      onError(t.invalidResult());
      return;
    }
    const { ended, newlyGlobalTemplates, snapshotBindings, dormantBindings, removedOwnedSlots, removedFieldStates } = response.value;
    setRemoveMemberFlow(null);
    await onRefresh();
    restoreConfirmationFocus();
    onNotify(
      ended ? t.stoppedSharingSetEnded(label, set.name) : t.stoppedSharingInSet(label, set.name),
      undefined,
      newlyGlobalTemplates.length > 0
        ? {
            label: t.deleteAction(),
            description: t.templatesNowGlobal(newlyGlobalTemplates.length),
            tone: "danger",
            onClick: () => newlyGlobalDeletion.request(newlyGlobalTemplates),
          }
        : {
            label: t.undo(),
            onClick: () =>
              void undoRemoveMember({
                fieldProfileId,
                set,
                removedFieldStates,
                endedSharedBindings,
                snapshotBindings,
                dormantBindings,
                removedOwnedSlots,
              }),
          },
    );
  }

  async function undoRemoveMember(undo: {
    fieldProfileId: string;
    set: SharedTemplateSetRecord;
    removedFieldStates: SharedTemplateFieldStateRecord[];
    endedSharedBindings: SharedTemplateBindingRecord[];
    snapshotBindings: BindingRecord[];
    dormantBindings: BindingRecord[];
    removedOwnedSlots: SharedTemplateBindingRecord[];
  }): Promise<void> {
    const response = await sendRequest({ type: "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER", ...undo });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onNotify(t.undidStopSharing());
  }

  function beginEndSharing(set: SharedTemplateSetRecord): void {
    triggerRef.current = rememberFocusedElement();
    setEndSharingFlow({
      set,
      sharedBindings: business.sharedTemplateBindings.filter((binding) => binding.setId === set.id),
      endedFieldStates: business.sharedTemplateFieldStates.filter((entry) => entry.setId === set.id),
    });
  }

  async function confirmEndSharing(): Promise<void> {
    if (!endSharingFlow) return;
    const { set, sharedBindings, endedFieldStates } = endSharingFlow;
    const response = await sendRequest({ type: "END_SHARED_TEMPLATE_SET", setId: set.id });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    if (!isEndSharedTemplateSetResult(response.value)) {
      // The Set has ended; only the details an Undo needs are missing. Close
      // the dialog and say what happened - left open, it invited a second
      // confirmation that could only report the Set as not found.
      setEndSharingFlow(null);
      await onRefresh();
      restoreConfirmationFocus();
      onNotify(t.endedSet(set.name, set.memberFieldProfileIds.length));
      return;
    }
    const { memberFieldProfileIds, newlyGlobalTemplates, convertedBindings, dormantBindings } = response.value;
    setEndSharingFlow(null);
    await onRefresh();
    restoreConfirmationFocus();
    onNotify(
      t.endedSet(set.name, memberFieldProfileIds.length),
      undefined,
      newlyGlobalTemplates.length > 0
        ? {
            label: t.deleteAction(),
            description: t.templatesNowGlobal(newlyGlobalTemplates.length),
            tone: "danger",
            onClick: () => newlyGlobalDeletion.request(newlyGlobalTemplates),
          }
        : {
            label: t.undo(),
            onClick: () => void undoEndSharing({ set, sharedBindings, endedFieldStates, convertedBindings, dormantBindings }),
          },
    );
  }

  async function undoEndSharing(undo: {
    set: SharedTemplateSetRecord;
    sharedBindings: SharedTemplateBindingRecord[];
    endedFieldStates: SharedTemplateFieldStateRecord[];
    convertedBindings: BindingRecord[];
    dormantBindings: BindingRecord[];
  }): Promise<void> {
    const response = await sendRequest({ type: "UNDO_END_SHARED_TEMPLATE_SET", ...undo });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    await onRefresh();
    onNotify(t.undidEndSet());
  }

  return (
    <>
      {views.length === 0 ? (
        <p class="shared-sets-empty">{t.noSharedSets()}</p>
      ) : (
        <div class="shared-template-sets" aria-label={t.viewSharedSets()}>
          {views.map((view) => (
            <SharedSetRow
              key={view.set.id}
              view={view}
              expanded={expanded.has(view.set.id)}
              onToggle={() => toggle(view.set.id)}
              activeEditor={activeEditor}
              onActiveEditorChange={setActiveEditor}
              onRenameSet={(name) => void renameSet(view.set.id, name)}
              onRenameField={(fieldProfileId, alias) => void renameField(fieldProfileId, alias)}
              onLeave={(fieldProfileId) => beginRemoveMember(view.set, fieldProfileId)}
              onEnd={() => beginEndSharing(view.set)}
            />
          ))}
        </div>
      )}
      {endSharingFlow && (
        <EndSharingSheet
          flow={endSharingFlow}
          onConfirm={() => runConfirmation(confirmEndSharing)}
          onCancel={() => setEndSharingFlow(null)}
          busy={confirming}
          restoreFocusTo={triggerRef.current}
        />
      )}
      {removeMemberFlow && (
        <RemoveSharedMemberSheet
          flow={removeMemberFlow}
          onConfirm={() => runConfirmation(confirmRemoveMember)}
          onCancel={() => setRemoveMemberFlow(null)}
          busy={confirming}
          restoreFocusTo={triggerRef.current}
        />
      )}
      {newlyGlobalDeletion.sheet}
    </>
  );
}

function SharedSetRow({
  view,
  expanded,
  onToggle,
  activeEditor,
  onActiveEditorChange,
  onRenameSet,
  onRenameField,
  onLeave,
  onEnd,
}: {
  view: SharedSetView;
  expanded: boolean;
  onToggle(): void;
  activeEditor: string | null;
  onActiveEditorChange(editorId: string | null): void;
  onRenameSet(name: string): void;
  onRenameField(fieldProfileId: string, alias: string): void;
  onLeave(fieldProfileId: string): void;
  onEnd(): void;
}) {
  const t = useMessages();
  const { set, sharedTemplates, siteIds, members } = view;
  return (
    <div class="shared-template-set-row">
      <TreeNodeRow
        depth={0}
        expanded={expanded}
        onToggle={onToggle}
        count={members.length}
        chevronLabel={t.expandOrCollapseNamed(expanded, set.name)}
      >
        <span class="shared-set-title">
          <AliasLabel
            displayLabel={set.name}
            currentAlias={set.name}
            onSave={onRenameSet}
            editorId={`set:${set.id}`}
            activeEditorId={activeEditor}
            onActiveEditorChange={onActiveEditorChange}
            triggerLabel={t.renameSetNamed(set.name)}
          />
          <span class="shared-set-summary">{t.sharedSetSummary(members.length, sharedTemplates.length, siteIds.length)}</span>
        </span>
      </TreeNodeRow>
      {expanded && (
        <div class="shared-template-set-detail">
          <section>
            <h4 class="shared-set-heading">{t.sharedTemplatesHeading()}</h4>
            {sharedTemplates.length === 0 ? (
              <p class="shared-set-note">{t.noTemplatesInSetYet()}</p>
            ) : (
              <ol class="shared-set-templates">
                {sharedTemplates.map((template) => (
                  <li key={template.id}>{derivePreview(template.content)}</li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <h4 class="shared-set-heading">{t.setFieldsHeading()}</h4>
            <ul class="shared-template-set-members" aria-label={t.setMembers(set.name)}>
              {members.map((member) => (
                <SharedSetMemberRow
                  key={member.fieldProfileId}
                  member={member}
                  activeEditor={activeEditor}
                  onActiveEditorChange={onActiveEditorChange}
                  onRename={(alias) => onRenameField(member.fieldProfileId, alias)}
                  onLeave={() => onLeave(member.fieldProfileId)}
                />
              ))}
            </ul>
          </section>
          <div class="shared-template-set-footer">
            <button type="button" class="danger" onClick={onEnd}>
              {t.endSharing()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SharedSetMemberRow({
  member,
  activeEditor,
  onActiveEditorChange,
  onRename,
  onLeave,
}: {
  member: SharedSetMemberView;
  activeEditor: string | null;
  onActiveEditorChange(editorId: string | null): void;
  onRename(alias: string): void;
  onLeave(): void;
}) {
  const t = useMessages();
  const name = member.field ? fieldDisplayName(member.field, t) : t.unknownField();
  const differences = [
    ...member.overrides.map(({ base, own }) => t.memberOwnVersion(derivePreview(base.content), derivePreview(own.content))),
    ...member.exclusions.map((template) => t.memberDoesNotUse(derivePreview(template.content))),
    ...member.fieldOnly.map((template) => t.memberOnlyThisField(derivePreview(template.content))),
  ];
  return (
    <li class="shared-set-member">
      <div class="shared-set-member-head">
        <span class="shared-set-member-identity">
          {member.field ? (
            <AliasLabel
              displayLabel={name}
              currentAlias={member.field.userAlias}
              onSave={onRename}
              editorId={`field:${member.fieldProfileId}`}
              activeEditorId={activeEditor}
              onActiveEditorChange={onActiveEditorChange}
            />
          ) : (
            <span class="shared-set-member-name">{name}</span>
          )}
          {member.page && (
            <span class="shared-set-member-location">
              {member.page.siteId} › {pageDisplayName(member.page, t)}
            </span>
          )}
        </span>
        <button type="button" class="secondary" aria-label={t.leaveSharingFor(name)} onClick={onLeave}>
          {t.stopSharing()}
        </button>
      </div>
      {differences.length === 0 ? (
        <p class="shared-set-note">{t.memberUsesEverything()}</p>
      ) : (
        <ul class="shared-set-differences">
          {differences.map((difference) => (
            <li key={difference}>{difference}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function EndSharingSheet({
  flow,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  flow: EndSharingFlow;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  const memberCount = flow.set.memberFieldProfileIds.length;
  return (
    <ModalDialog label={t.endSharing()} busy={busy} onCancel={onCancel} restoreFocusTo={restoreFocusTo}>
      <span class="clean-up-grabber" aria-hidden="true" />
      <strong class="clean-up-title">{t.endSetQuestion(flow.set.name)}</strong>
      <p class="remove-sheet-body">{t.endSetBody(memberCount)}</p>
      <div class="confirm-actions">
        <button type="button" class="danger" onClick={onConfirm}>
          {t.endSharing()}
        </button>
        <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>
          {t.cancel()}
        </button>
      </div>
    </ModalDialog>
  );
}

export function RemoveSharedMemberSheet({
  flow,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  flow: RemoveSharedMemberFlow;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  return (
    <ModalDialog label={t.stopSharingForThisField()} busy={busy} onCancel={onCancel} restoreFocusTo={restoreFocusTo}>
      <span class="clean-up-grabber" aria-hidden="true" />
      <strong class="clean-up-title">{t.stopSharingForQuestion(flow.fieldLabel)}</strong>
      <p class="remove-sheet-body">{t.stopSharingBody(flow.fieldLabel, flow.set.name)}</p>
      <div class="confirm-actions">
        <button type="button" onClick={onConfirm}>
          {t.stopSharing()}
        </button>
        <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>
          {t.cancel()}
        </button>
      </div>
    </ModalDialog>
  );
}
