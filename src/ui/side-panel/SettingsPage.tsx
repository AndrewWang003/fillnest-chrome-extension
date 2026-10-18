import { useRef, useState } from "preact/hooks";

import { MAX_BACKUP_JSON_BYTES } from "../../backup/archive-contract";
import type { RestoreImpactPreview } from "../../backup/restore-impact";
import type { ResetImpactPreview } from "../../reset/reset-transaction";
import {
  isCreateBackupArchiveResultShape,
  isResetFillNestResultShape,
  isResetPreviewResultShape,
  isRestoreBackupArchiveResultShape,
  isValidateBackupArchiveResultShape,
} from "../../messages/runtime-messages";
import { messagesFor, type Messages } from "../../i18n/catalogue";
import { isLanguagePreference, LANGUAGE_IDS } from "../../i18n/language";
import { useLanguagePreference, useMessages } from "../../i18n/useMessages";
import { themeLabel } from "../theme/theme-label";
import { buildThemeTokens, resolveThemeMode, THEMES, type AppearancePreference, type ThemeModePreference } from "../theme/theme-tokens";
import { prefersDark } from "../theme/apply-theme";
import { WarningIcon } from "../icons/FillNestIcons";
import {
  ModalDialog,
  rememberFocusedElement,
  restoreFocus,
  sendRequest,
} from "./SidePanelShared";
import { LanguageIcon } from "../icons/FillNestIcons";

// Labels come from `modeLabel`, in the reader's language.
const MODE_CHOICES: ReadonlyArray<{ value: ThemeModePreference }> = [
  { value: "system" },
  { value: "light" },
  { value: "dark" },
];

/**
 * Task 034. The theme is chosen by looking at it, not by reading about it, so
 * each option is a swatch drawn from that theme's own tokens in the mode that
 * is currently selected - switch to Dark and every swatch shows its dark
 * palette before you commit to one.
 */
export function ThemeChooser({
  appearance,
  onChange,
}: {
  appearance: AppearancePreference;
  onChange(next: AppearancePreference): void;
}) {
  const t = useMessages();
  const resolvedMode = resolveThemeMode(appearance.mode, prefersDark(window));
  return (
    <div class="theme-chooser">
      <div class="theme-mode" role="radiogroup" aria-label={t.lightOrDark()}>
        {MODE_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={appearance.mode === choice.value}
            class={appearance.mode === choice.value ? "theme-mode-option selected" : "theme-mode-option"}
            onClick={() => onChange({ ...appearance, mode: choice.value })}
          >
            {modeLabel(choice.value, t)}
          </button>
        ))}
      </div>
      <ul class="theme-swatches" role="radiogroup" aria-label={t.colourTheme()}>
        {THEMES.map((theme) => {
          const tokens = buildThemeTokens(theme.id, resolvedMode);
          const selected = appearance.themeId === theme.id;
          return (
            <li key={theme.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                class={selected ? "theme-swatch selected" : "theme-swatch"}
                onClick={() => onChange({ ...appearance, themeId: theme.id })}
              >
                <span
                  class="theme-swatch-preview"
                  aria-hidden="true"
                  style={{
                    background: tokens["canvas"],
                    borderColor: tokens["border"],
                  }}
                >
                  <span class="theme-swatch-bar" style={{ background: tokens["accent"] }} />
                  <span class="theme-swatch-card" style={{ background: tokens["surface"], borderColor: tokens["border"] }}>
                    <span class="theme-swatch-line" style={{ background: tokens["text"] }} />
                    <span class="theme-swatch-line short" style={{ background: tokens["text-muted"] }} />
                  </span>
                </span>
                {/* Task 037. The name alone. The owner's judgement after
                    seeing it translated: a swatch shows what a theme looks
                    like, and a sentence under it explains what the picture
                    already said. */}
                <span class="theme-swatch-name">{themeLabel(theme.id, t)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Task 037. The light/dark choice, which the owner found still in English.
 */
function modeLabel(mode: ThemeModePreference, messages: Messages): string {
  switch (mode) {
    case "light":
      return messages.modeLight();
    case "dark":
      return messages.modeDark();
    default:
      return messages.modeSystem();
  }
}

interface RestoreFlowState {
  archiveJson: string;
  preview: RestoreImpactPreview;
  confirmationToken: string;
  typedConfirmation: string;
}

interface ResetFlowState {
  preview: ResetImpactPreview;
  confirmationToken: string;
  typedConfirmation: string;
}

export function SettingsPage({
  appearance,
  onRefresh,
  onError,
  onNotify,
  recoveryOnly = false,
}: {
  appearance: AppearancePreference;
  onRefresh(): Promise<void>;
  onError(message: string): void;
  onNotify(message: string, detail?: string): void;
  /**
   * Task 006 Addendum B: a failed Restore keeps FillNest closed. The service
   * worker then refuses Backup and Restore, so they are not offered; the
   * language, the theme and Reset FillNest still work.
   */
  recoveryOnly?: boolean;
}) {
  const t = useMessages();
  const languagePreference = useLanguagePreference();
  const [exporting, setExporting] = useState(false);

  const [restoreFlow, setRestoreFlow] = useState<RestoreFlowState | null>(null);
  const [validatingRestore, setValidatingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [resetFlow, setResetFlow] = useState<ResetFlowState | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);
  const restoreTriggerRef = useRef<HTMLElement | null>(null);
  const resetConfirmationRef = useRef<HTMLInputElement | null>(null);
  const restoreConfirmationRef = useRef<HTMLInputElement | null>(null);

  async function saveLanguage(value: string): Promise<void> {
    if (!isLanguagePreference(value)) return;
    const response = await sendRequest({ type: "SET_LANGUAGE", language: value });
    // The service worker broadcasts LANGUAGE_CHANGED, which re-renders this
    // surface, the Popup and every live Picker - so nothing is applied here.
    if (!response.ok) onError(response.error);
  }

  async function saveAppearance(next: AppearancePreference): Promise<void> {
    const response = await sendRequest({ type: "SET_APPEARANCE", appearance: next });
    // The service worker broadcasts APPEARANCE_CHANGED, which repaints this
    // surface, the Popup and every live Picker - so nothing is applied here.
    if (!response.ok) onError(response.error);
  }

  // Task 042. Every start card and page note appears again - after a
  // confirmation (owner QA 2026-09-15), since it undoes every tip closed.
  const [confirmingTips, setConfirmingTips] = useState(false);
  const [showingTips, setShowingTips] = useState(false);
  const tipsTriggerRef = useRef<HTMLElement | null>(null);
  function askShowTipsAgain(): void {
    tipsTriggerRef.current = rememberFocusedElement();
    setConfirmingTips(true);
  }
  async function showTipsAgain(): Promise<void> {
    setShowingTips(true);
    const response = await sendRequest({ type: "SHOW_TIPS_AGAIN" });
    setShowingTips(false);
    setConfirmingTips(false);
    restoreFocus(tipsTriggerRef.current);
    if (!response.ok) {
      onError(response.error);
      return;
    }
    onNotify(t.tipsWillShowAgain());
  }

  // Task 038 Addendum B. Open pages move their button at once.
  async function movePageButtonToCorner(): Promise<void> {
    const response = await sendRequest({ type: "RESET_PAGE_STATUS_POSITION" });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    onNotify(t.pageButtonMovedToCorner());
  }

  async function startReset(): Promise<void> {
    resetTriggerRef.current = rememberFocusedElement();
    setResetError(null);
    const response = await sendRequest({ type: "GET_RESET_PREVIEW" });
    if (!response.ok) {
      setResetError(response.error);
      return;
    }
    if (isResetPreviewResultShape(response.value)) {
      setResetFlow({ ...response.value, typedConfirmation: "" });
    }
  }

  async function confirmReset(): Promise<void> {
    if (!resetFlow || resetFlow.typedConfirmation !== "reset") return;
    setResetting(true);
    setResetError(null);
    try {
      const response = await sendRequest({
        type: "RESET_FILLNEST",
        expectedConfirmationToken: resetFlow.confirmationToken,
        typedConfirmation: "reset",
      });
      if (!response.ok) {
        setResetError(response.error);
        return;
      }
      if (isResetFillNestResultShape(response.value)) {
        setResetFlow(null);
        onNotify(t.resetComplete());
        await onRefresh();
        restoreFocus(resetTriggerRef.current);
        resetTriggerRef.current = null;
      }
    } catch (error) {
      setResetError(error instanceof Error ? error.message : t.resetFailed());
    } finally {
      setResetting(false);
    }
  }

  async function exportBackup(): Promise<void> {
    setExporting(true);
    try {
      const response = await sendRequest({ type: "CREATE_BACKUP_ARCHIVE" });
      if (!response.ok) {
        onError(response.error);
        return;
      }
      if (isCreateBackupArchiveResultShape(response.value)) {
        downloadJsonFile(response.value.defaultFilename, response.value.archiveJson);
        return;
      }
      return;
    } catch (err) {
      onError(err instanceof Error ? err.message : t.exportBackupFailed());
      return;
    } finally {
      setExporting(false);
    }
  }

  function downloadJsonFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    // Checked before reading the file into memory - file.size is available
    // for free, so an oversized selection is rejected in O(1) rather than
    // after loading the whole thing (potentially gigabytes) into the side
    // panel's heap and structured-cloning it to the service worker only to
    // have the byte check there reject it anyway.
    if (file.size > MAX_BACKUP_JSON_BYTES) {
      setRestoreError(t.backupTooLarge());
      return;
    }

    setRestoreError(null);
    setValidatingRestore(true);
    try {
      const text = await file.text();
      const response = await sendRequest({ type: "VALIDATE_BACKUP_ARCHIVE", archiveJson: text });
      if (!response.ok) {
        setRestoreError(response.error);
        return;
      }
      if (isValidateBackupArchiveResultShape(response.value)) {
        setRestoreFlow({
          archiveJson: text,
          preview: response.value.preview,
          confirmationToken: response.value.confirmationToken,
          typedConfirmation: "",
        });
      }
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : t.readBackupFailed());
    } finally {
      setValidatingRestore(false);
    }
  }

  function beginRestore(): void {
    restoreTriggerRef.current = rememberFocusedElement();
    document.getElementById("restore-file-input")?.click();
  }

  async function confirmRestore(): Promise<void> {
    if (!restoreFlow || restoreFlow.typedConfirmation !== "restore") {
      return;
    }
    setRestoring(true);
    try {
      const response = await sendRequest({
        type: "RESTORE_BACKUP_ARCHIVE",
        archiveJson: restoreFlow.archiveJson,
        expectedConfirmationToken: restoreFlow.confirmationToken,
        typedConfirmation: "restore",
      });
      if (!response.ok) {
        setRestoreError(response.error);
        return;
      }
      setRestoreFlow(null);
      await onRefresh();
      if (isRestoreBackupArchiveResultShape(response.value) && response.value.unreachableTabsCount > 0) {
        onNotify(
          t.backupRestored(),
          t.tabsNotUpdated(response.value.unreachableTabsCount),
        );
      } else {
        onNotify(t.backupRestored());
      }
      restoreFocus(restoreTriggerRef.current);
      restoreTriggerRef.current = null;
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : t.restoreBackupFailed());
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <h1>{t.settingsHeading()}</h1>

      {/* Task 034. Every row used to lead with two or three lines of prose, so
          three actions filled the page and the actions themselves were the
          least prominent thing on it. Each row now carries one short line that
          says what the action does; the consequences that genuinely need
          spelling out are in the confirmation each action already opens, which
          is where the user is actually deciding. */}
      <section class="setting-section">
        <h2>{t.appearanceHeading()}</h2>
        <ThemeChooser appearance={appearance} onChange={(next) => void saveAppearance(next)} />
      </section>

      {/* Task 037. Beside Appearance because it is the same kind of choice:
          how FillNest presents itself, not what it knows. */}
      <section class="setting-section">
        <h2 class="language-heading"><LanguageIcon class="language-icon" />{t.languageHeading()}</h2>
        <div class="setting-row">
          <div>
            <p>{t.languageDescription()}</p>
          </div>
          <label class="language-choice">
            <span class="visually-hidden">{t.languageHeading()}</span>
            <select
              value={languagePreference}
              onChange={(event) => void saveLanguage(event.currentTarget.value)}
            >
              <option value="system">{t.languageSystem()}</option>
              {LANGUAGE_IDS.map((language) => (
                <option key={language} value={language}>
                  {messagesFor(language).languageName()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!recoveryOnly && (
        <section class="setting-section">
          <h2>{t.tipsHeadingSettings()}</h2>
          <div class="setting-row">
            <div>
              <p>{t.tipsDescription()}</p>
            </div>
            <button type="button" class="secondary" onClick={askShowTipsAgain}>
              {t.showTipsAgain()}
            </button>
          </div>
        </section>
      )}

      {/* Task 038 Addendum B: the page button can be dragged anywhere, so there
          is a way back for one moved out of sight. */}
      {!recoveryOnly && (
        <section class="setting-section">
          <h2>{t.pageButtonHeading()}</h2>
          <div class="setting-row">
            <div>
              <p>{t.pageButtonDescription()}</p>
            </div>
            <button type="button" class="secondary" onClick={() => void movePageButtonToCorner()}>
              {t.movePageButtonToCorner()}
            </button>
          </div>
        </section>
      )}

      {!recoveryOnly && (
        <section class="setting-section">
          <h2>{t.dataManagement()}</h2>
          <div class="setting-row">
            <div>
              <h3>
                {t.backupHeading()}
                {/* The privacy point belongs to this action and only matters at
                    the moment of exporting, so it hangs off the action rather
                    than standing as a block of its own. It is not hover-only:
                    the control is focusable, the whole warning is its accessible
                    name, and the tooltip opens on focus and tap as well as
                    hover - so nobody has to own a mouse to read it. */}
                <button
                  type="button"
                  class="setting-hint"
                  aria-label={t.backupPrivacyWarning()}
                  data-tooltip={t.backupPrivacyWarning()}
                >
                  <WarningIcon />
                </button>
              </h3>
              <p>{t.backupDescription()}</p>
            </div>
            <button
              type="button"
              class="secondary"
              onClick={() => void exportBackup()}
              disabled={exporting}
            >
              {exporting ? t.exporting() : t.exportBackup()}
            </button>
          </div>

          <div class="setting-row setting-row-stacked">
            <div>
              <h3>{t.restore()}</h3>
              <p>{t.restoreDescription()}</p>
            </div>
            <div>
              <input
                type="file"
                id="restore-file-input"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => void handleFileSelect(e)}
              />
              <button
                type="button"
                class="secondary"
                onClick={beginRestore}
                disabled={validatingRestore}
              >
                {validatingRestore ? t.validatingBackup() : t.restoreEllipsis()}
              </button>
            </div>
          </div>
          {restoreError && <p class="panel-error" role="alert">{restoreError}</p>}
        </section>
      )}

      <section class="setting-row danger-zone">
        <div>
          <h2>{t.resetFillNest()}</h2>
          <p>{t.resetDescription()}</p>
        </div>
        <button type="button" class="danger" onClick={() => void startReset()}>{t.resetFillNest()}</button>
      </section>
      {resetError && <p class="panel-error" role="alert">{resetError}</p>}

      {confirmingTips && (
        <ModalDialog
          labelledBy="tips-confirm-title"
          busy={showingTips}
          onCancel={() => setConfirmingTips(false)}
          restoreFocusTo={tipsTriggerRef.current}
        >
          <div class="clean-up-grabber" />
          <h2 id="tips-confirm-title" class="clean-up-title">{t.showTipsAgain()}</h2>
          <p class="remove-sheet-body">{t.confirmShowTipsAgain()}</p>
          <div class="confirm-actions">
            <button type="button" onClick={() => void showTipsAgain()}>{t.showTipsAgainAction()}</button>
            <button type="button" class="secondary" data-dialog-cancel onClick={() => setConfirmingTips(false)}>
              {t.cancel()}
            </button>
          </div>
        </ModalDialog>
      )}

      {resetFlow && (
        <ModalDialog labelledBy="reset-title" busy={resetting} onCancel={() => setResetFlow(null)} initialFocusRef={resetConfirmationRef} restoreFocusTo={resetTriggerRef.current}>
            <div class="clean-up-grabber" />
            <h2 id="reset-title" class="clean-up-title">{t.resetFillNest()}</h2>
            <p class="remove-sheet-body">{t.resetWarning()}</p>
            <div class="restore-impact-summary">
              <h3>{t.resetImpact()}</h3>
              {/* Task 028 (audit finding C1): when the stored business data
                  cannot be read, Reset still works - it destroys that data
                  rather than interpreting it - but it must say so plainly
                  instead of showing counts it cannot know. */}
              {!resetFlow.preview.businessDataReadable && (
                <p class="panel-error" role="status">
                  {t.resetImpactUnreadable()}
                </p>
              )}
              <table class="restore-impact-table">
                <tbody>
                  <tr><td>{t.templatesLabel()}</td><td>{formatResetCount(resetFlow.preview.templates, t)}</td></tr>
                  <tr><td>{t.sitesLabel()}</td><td>{formatResetCount(resetFlow.preview.sites, t)}</td></tr>
                  <tr><td>{t.pageProfiles()}</td><td>{formatResetCount(resetFlow.preview.pageProfiles, t)}</td></tr>
                  <tr><td>{t.fieldProfiles()}</td><td>{formatResetCount(resetFlow.preview.fieldProfiles, t)}</td></tr>
                  <tr><td>{t.bindings()}</td><td>{formatResetCount(resetFlow.preview.bindings, t)}</td></tr>
                  <tr><td>{t.aliases()}</td><td>{formatResetCount(resetFlow.preview.aliases, t)}</td></tr>
                  <tr><td>{t.websiteAccessPermissions()}</td><td>{resetFlow.preview.authorizedOrigins.length}</td></tr>
                  <tr><td>{t.dormantWebsitePreferences()}</td><td>{resetFlow.preview.dormantOrigins}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="warning-callout">
              <strong>{t.recommendedLabel()}</strong> {t.exportBeforeReset()}
              <div style={{ marginTop: "8px" }}>
                <button type="button" class="secondary" onClick={() => void exportBackup()} disabled={exporting}>
                  {exporting ? t.exporting() : t.exportBackup()}
                </button>
              </div>
            </div>
            {resetError && <p class="panel-error" role="alert">{resetError}</p>}
            <div class="batch-delete-confirm">
              <label for="reset-confirmation-input">
                {t.typeResetPrefix()} <strong>reset</strong> {t.typeBelowSuffix()}
              </label>
              <input
                id="reset-confirmation-input"
                ref={resetConfirmationRef}
                type="text"
                value={resetFlow.typedConfirmation}
                onInput={(event) => {
                  const typedConfirmation = (event.target as HTMLInputElement).value;
                  setResetFlow((current) => current ? { ...current, typedConfirmation } : null);
                }}
                placeholder="reset"
                autocomplete="off"
                spellcheck={false}
              />
            </div>
            <div class="dialog-actions">
              <button type="button" class="secondary" data-dialog-cancel onClick={() => setResetFlow(null)} disabled={resetting}>{t.cancel()}</button>
              <button type="button" class="danger" onClick={() => void confirmReset()} disabled={resetting || resetFlow.typedConfirmation !== "reset"}>
                {resetting ? t.resetting() : t.resetFillNest()}
              </button>
            </div>
        </ModalDialog>
      )}

      {restoreFlow && (
        <ModalDialog labelledBy="restore-title" busy={restoring} onCancel={() => setRestoreFlow(null)} initialFocusRef={restoreConfirmationRef} restoreFocusTo={restoreTriggerRef.current}>
            <div class="clean-up-grabber" />
            <h2 id="restore-title" class="clean-up-title">{t.restoreTitle()}</h2>
            <p class="remove-sheet-body">
              {t.restoringWillPrefix()} <strong>{t.completelyReplace()}</strong> {t.restoringWillSuffix()}
            </p>

            <div class="restore-impact-summary">
              <h3>{t.impactPreview()}</h3>
              <table class="restore-impact-table">
                <thead>
                  <tr>
                    <th>{t.itemColumn()}</th>
                    <th>{t.currentColumn()}</th>
                    <th>{t.afterRestoreColumn()}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t.templatesLabel()}</td>
                    <td>{restoreFlow.preview.templates.current}</td>
                    <td>{restoreFlow.preview.templates.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.sitesLabel()}</td>
                    <td>{restoreFlow.preview.sites.current}</td>
                    <td>{restoreFlow.preview.sites.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.pageProfiles()}</td>
                    <td>{restoreFlow.preview.pageProfiles.current}</td>
                    <td>{restoreFlow.preview.pageProfiles.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.fieldProfiles()}</td>
                    <td>{restoreFlow.preview.fieldProfiles.current}</td>
                    <td>{restoreFlow.preview.fieldProfiles.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.bindings()}</td>
                    <td>{restoreFlow.preview.bindings.current}</td>
                    <td>{restoreFlow.preview.bindings.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.aliases()}</td>
                    <td>{restoreFlow.preview.aliases.current}</td>
                    <td>{restoreFlow.preview.aliases.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.logicalPageMatchingRules()}</td>
                    <td>{restoreFlow.preview.logicalPageRules.current}</td>
                    <td>{restoreFlow.preview.logicalPageRules.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.sharedTemplateSets()}</td>
                    <td>{restoreFlow.preview.sharedTemplateSets.current}</td>
                    <td>{restoreFlow.preview.sharedTemplateSets.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.globalActivation()}</td>
                    <td>{restoreFlow.preview.globalActivation.current}</td>
                    <td>{restoreFlow.preview.globalActivation.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.authorizedSitesActive()}</td>
                    <td>{restoreFlow.preview.authorizedOriginsActive.current}</td>
                    <td>{restoreFlow.preview.authorizedOriginsActive.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.authorizedSitesPaused()}</td>
                    <td>{restoreFlow.preview.authorizedOriginsPaused.current}</td>
                    <td>{restoreFlow.preview.authorizedOriginsPaused.backup}</td>
                  </tr>
                  <tr>
                    <td>{t.savedPickerPosition()}</td>
                    <td>{restoreFlow.preview.pickerPositionSaved.current ? t.pickerPositionSavedValue() : t.pickerPositionDefaultValue()}</td>
                    <td>{restoreFlow.preview.pickerPositionSaved.backup ? t.pickerPositionSavedValue() : t.pickerPositionDefaultValue()}</td>
                  </tr>
                </tbody>
              </table>

              <p class="remove-sheet-note">
                {restoreFlow.preview.websiteAccessNotice}
              </p>
              {restoreFlow.preview.dormantOriginsCount > 0 && (
                <p class="remove-sheet-note">
                  {t.dormantWebsitePreferencesNote(restoreFlow.preview.dormantOriginsCount)}
                </p>
              )}
            </div>

            {restoreFlow.preview.hasCurrentData && (
              <div class="warning-callout">
                <strong>{t.recommendedLabel()}</strong> {t.exportBeforeRestore()}
                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    class="secondary"
                    onClick={() => void exportBackup()}
                  >{t.exportCurrentBackup()}</button>
                </div>
              </div>
            )}

            <div class="batch-delete-confirm">
              {restoreError && <p class="panel-error" role="alert">{restoreError}</p>}
              <label for="restore-confirmation-input">
                {t.typeRestorePrefix()} <strong>restore</strong> {t.typeBelowSuffix()}
              </label>
              <input
                id="restore-confirmation-input"
                ref={restoreConfirmationRef}
                type="text"
                value={restoreFlow.typedConfirmation}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  setRestoreFlow((current) => current ? { ...current, typedConfirmation: val } : null);
                }}
                placeholder="restore"
                autocomplete="off"
                spellcheck={false}
              />
            </div>

            <div class="dialog-actions">
              <button
                type="button"
                class="secondary"
                data-dialog-cancel
                onClick={() => setRestoreFlow(null)}
                disabled={restoring}
              >{t.cancel()}</button>
              <button
                type="button"
                class="danger"
                onClick={() => void confirmRestore()}
                disabled={
                  restoring ||
                  restoreFlow.typedConfirmation !== "restore"
                }
              >
                {restoring ? t.restoring() : t.restoreData()}
              </button>
            </div>
        </ModalDialog>
      )}
    </>
  );
}

// A business-derived Reset count is `null` only when the store is unreadable
// (Task 028, audit finding C1). Showing "Unknown" is honest; showing 0 would
// tell the user nothing will be removed, which is the opposite of the truth.
function formatResetCount(count: number | null, messages: Messages): string {
  return count === null ? messages.unknownCount() : String(count);
}

