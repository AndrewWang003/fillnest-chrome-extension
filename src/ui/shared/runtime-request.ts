import { messagesFor, type Messages } from "../../i18n/catalogue";
import { FALLBACK_LANGUAGE, type LanguageId } from "../../i18n/language";
import { activeLanguage } from "../../i18n/useMessages";
import type { RuntimeRequest, RuntimeResponse } from "../../messages/runtime-messages";
import type { UserErrorCode } from "../../messages/user-error";
import { MAX_TEMPLATES_PER_FIELD } from "../../templates/field-template-limit";
import { MAX_TEMPLATE_CONTENT_BYTES, MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS } from "../../templates/template-content";

/**
 * Every surface's one way to ask the service worker for something.
 *
 * Task 037 acceptance 6: a failure the worker reported with a code comes back
 * with its text in the language this surface speaks, so every place that shows
 * `response.error` speaks it too. It used to be five identical one-line copies,
 * each handing the core's English straight to the reader.
 */
export async function sendRequest(request: RuntimeRequest): Promise<RuntimeResponse> {
  const response: RuntimeResponse = await chrome.runtime.sendMessage(request);
  return localizeFailure(response, activeLanguage());
}

/**
 * The core speaks English, so an English surface shows the core's own
 * sentence - it can name the exact key, Site or word involved, which a
 * catalogue entry cannot. Any other language looks the code up.
 */
export function localizeFailure(response: RuntimeResponse, language: LanguageId): RuntimeResponse {
  // A test double, or a worker that answered nothing, can hand back undefined.
  if (!response || response.ok || response.errorCode === undefined || language === FALLBACK_LANGUAGE) {
    return response;
  }
  return { ...response, error: userErrorText(messagesFor(language), response.errorCode) };
}

function userErrorText(t: Messages, code: UserErrorCode): string {
  switch (code) {
    case "field-template-limit":
      return t.fieldTemplateLimit(MAX_TEMPLATES_PER_FIELD);
    case "set-template-limit":
      return t.setTemplateLimit(MAX_TEMPLATES_PER_FIELD);
    case "template-too-long":
      return t.templateTooLong(MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS, MAX_TEMPLATE_CONTENT_BYTES);
    case "stale-undo":
      return t.errorStaleUndo();
    case "stale-impact":
      return t.errorStaleImpact();
    case "stale-page-match":
      return t.errorStalePageMatch();
    case "inconsistent-data":
      return t.errorInconsistentData();
    case "backup-invalid":
      return t.errorBackupInvalid();
    case "backup-too-large":
      return t.errorBackupTooLarge();
    case "restore-preview-stale":
      return t.errorRestorePreviewStale();
    case "restore-recovery-blocked":
      return t.errorRestoreRecoveryBlocked();
    case "reset-preview-stale":
      return t.errorResetPreviewStale();
    case "reset-incomplete":
      return t.errorResetIncomplete();
    case "remove-site-incomplete":
      return t.errorRemoveSiteIncomplete();
    case "confirmation-mismatch":
      return t.errorConfirmationMismatch();
  }
}
