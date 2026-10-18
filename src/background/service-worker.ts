import {
  businessStateFromArchive,
  createBackupArchive,
  generateBackupFilename,
  parseAndValidateBackupArchive,
  serializeBackupArchive,
} from "../backup/archive-contract";
import {
  computeRestoreImpact,
} from "../backup/restore-impact";
import { RestoreTransactionCoordinator } from "../backup/restore-journal";
import {
  isRuntimeRequest,
  type OpaqueLogicalPageCandidateEvidencePayload,
  type RuntimeRequest,
  type RuntimeResponse,
  type PageStatusPositionResetNotification,
  type StateChangeNotification,
} from "../messages/runtime-messages";
import type { LogicalPageEvidence } from "../recognition/logical-page-matching";
import { userErrorCodeOf, UserFacingError } from "../messages/user-error";
import { BUSINESS_STATE_BROADCAST, FIELD_IDENTITY_INVALIDATION } from "./business-state-broadcast";
import {
  requireExtensionPage as requireAuthorizedExtensionPage,
  requireExactContentOriginSender as requireAuthorizedExactContentOriginSender,
  requireOriginActivationSender as requireAuthorizedOriginActivationSender,
} from "./message-authorization";
import { assertBulkDeleteConfirmation, assertTypedWord } from "./destructive-operation-policy";
import { SerializedOperationQueue } from "./serialized-operation-queue";
import { ActivationAuthority } from "../activation/activation-authority";
import { isExpectedActivationBootstrapState } from "../activation/activation-bootstrap";
import { ActivationRepository, exactOriginFromPattern } from "../activation/activation-repository";
import { AppearanceRepository } from "../appearance/appearance-repository";
import { DEFAULT_LANGUAGE_PREFERENCE } from "../i18n/language";
import { LanguageRepository } from "../i18n/language-repository";
import { TipsRepository } from "../guidance/tips-repository";
import { DEFAULT_APPEARANCE } from "../ui/theme/theme-tokens";
import { PermissionLifecycle } from "../permissions/permission-lifecycle";
import { permissionOriginFromUrl } from "../permissions/permission-origin";
import { ChromePermissionPlatform } from "../platform/chrome-permission-platform";
import { FillNestRepository } from "../storage/fillnest-repository";
import {
  assertFieldCanTakeAnotherTemplate,
  assertSharedSetCanTakeAnotherTemplate,
} from "../templates/field-template-limit";
import { assertTemplateContentWithinLimit } from "../templates/template-content";
import { ResetTransactionCoordinator } from "../reset/reset-transaction";
import { RemoveSiteTransactionCoordinator } from "../sites/remove-site-transaction";

const chromePermissionPlatform = new ChromePermissionPlatform();
const runtimeOperationQueue = new SerializedOperationQueue();
const activationRepository = new ActivationRepository(chrome.storage.local);
const appearanceRepository = new AppearanceRepository(chrome.storage.local);
const languageRepository = new LanguageRepository(chrome.storage.local);
const tipsRepository = new TipsRepository(chrome.storage.local);
// Declared before `activationAuthority` and assigned after it: the two
// construct in terms of each other, and the authority only calls into the
// lifecycle lazily. `prefer-const` reads this as a single assignment; making
// it `const` is not valid TypeScript.
// eslint-disable-next-line prefer-const
let permissionLifecycle: PermissionLifecycle;
const activationAuthority = new ActivationAuthority(activationRepository, {
  getGrantedPatterns: () => chromePermissionPlatform.getGrantedPatterns(),
  reconcileWebsiteAccess: () => permissionLifecycle.reconcile(),
  broadcast: async (message) => {
    await broadcastActivationChanged(message);
  },
  requestWebsiteAccess: (pageUrl) => permissionLifecycle.requestAccess(pageUrl),
  ensureRegistration: (pattern) => permissionLifecycle.ensureRegistration(pattern),
  inject: (tabId) => permissionLifecycle.inject(tabId),
});
permissionLifecycle = new PermissionLifecycle(
  chromePermissionPlatform,
  async () => {
    await runtimeOperationQueue.run(async () => {
      await activationReady;
      await activationAuthority.handleWebsiteAccessRemoved();
    });
  },
);
const repository = new FillNestRepository(chrome.storage.local);
const restoreCoordinator = new RestoreTransactionCoordinator(
  chrome.storage.local,
  repository,
  activationRepository,
);
const resetCoordinator = new ResetTransactionCoordinator(
  chrome.storage.local,
  repository,
  activationRepository,
  permissionLifecycle,
  appearanceRepository,
  languageRepository,
  tipsRepository,
);
const removeSiteCoordinator = new RemoveSiteTransactionCoordinator(chrome.storage.local, repository, permissionLifecycle);

const recoveryReady = restoreCoordinator.recoverInterruptedTransaction()
  .then(() => resetCoordinator.recoverInterruptedTransaction())
  .then(() => removeSiteCoordinator.recoverInterruptedTransaction());
let activationReady = recoveryReady
  .then(() => activationAuthority.reconcileExisting())
  .catch((error: unknown) => {
    if (isExpectedActivationBootstrapState(error)) return undefined;
    console.error("FillNest service worker boot/recovery failed", error);
    throw error;
  });
// Logged above. While a failed Restore journal keeps the worker closed, no
// request awaits this (Task 006 Addendum B), so it must not surface as an
// unhandled rejection; every request that does await it still sees the error.
activationReady.catch(() => undefined);

chrome.runtime.onInstalled.addListener((details) => {
  activationReady = activationReady.then(() =>
    activationAuthority.start(details.reason === "install" ? "install" : "update"),
  );
  void activationReady.catch((error: unknown) => {
    console.error("FillNest activation initialization failed", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRuntimeRequest(message)) return false;

  if (message.type === "ENABLE_SITE") {
    requireExtensionPage(sender);
    // Permission request begins immediately in the click stack.  Only its
    // durable follow-up is queued, so it cannot lose Chrome's user gesture or
    // race a Restore recovery.
    void activationAuthority.requestWebsiteAccess(message.pageUrl)
      .then((permission) => {
        if (!permission.granted) return { status: "denied" } as const;
        return runtimeOperationQueue.run(async () => {
          await activationReady;
          return activationAuthority.completeGrantedWebsiteAccess(message.pageUrl, message.tabId, permission.pattern);
        });
      })
      .then((value) => sendResponse({ ok: true, value }))
      .catch((error: unknown) => sendResponse(failureResponse(error)));
    return true;
  }

  void runtimeOperationQueue.run(() => handleMessage(message, sender))
    .then(async (value) => {
      // Broadcast before resolving the originating request. This lets every
      // existing Undo be invalidated before the originating surface records
      // its replacement Undo, rather than racing a later broadcast that
      // would immediately clear the new action.
      if (shouldBroadcastBusinessChange(message, value))
        await broadcastBusinessChanged(FIELD_IDENTITY_INVALIDATION[message.type]);
      sendResponse({ ok: true, value });
    })
    .catch((error: unknown) => sendResponse(failureResponse(error)));

  return true;
});

type QueuedRuntimeRequest = Exclude<RuntimeRequest, { type: "ENABLE_SITE" }>;

const AVAILABLE_WHILE_RESTORE_BLOCKED: ReadonlySet<QueuedRuntimeRequest["type"]> = new Set([
  "GET_RESET_PREVIEW",
  "RESET_FILLNEST",
  "GET_LANGUAGE",
  "SET_LANGUAGE",
  "GET_APPEARANCE",
  "SET_APPEARANCE",
]);
type RuntimeSuccessValue = Extract<RuntimeResponse, { ok: true }>["value"];

function shouldBroadcastBusinessChange(message: QueuedRuntimeRequest, value: RuntimeSuccessValue): boolean {
  if (!BUSINESS_STATE_BROADCAST[message.type]) return false;
  if (message.type !== "RESET_SITE_MAPPINGS_BATCH") return true;
  return typeof value === "object" && value !== null && "didMutate" in value && value.didMutate === true;
}

async function handleMessage(
  message: QueuedRuntimeRequest,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeSuccessValue> {
  // Task 006 Addenda A and B: while a Restore's prior data could not be put
  // back - found at startup or failed in this session - nothing more is
  // written on top of it. Only Reset FillNest, the owner's chosen way out,
  // and the two preferences a surface renders in, stay available. Both can
  // still be changed - someone locked out in a language they cannot read
  // must be able to pick one they can - and neither is part of the data the
  // journal protects.
  await recoveryReady.catch(() => undefined);
  if (restoreCoordinator.failedRollback()) {
    if (!AVAILABLE_WHILE_RESTORE_BLOCKED.has(message.type)) {
      throw new UserFacingError(
        "restore-recovery-blocked",
        "A restore could not finish, so FillNest has stopped to keep your previous data safe. Restart the browser to try putting it back, or use Reset FillNest in Settings to start over - that deletes all FillNest data.",
      );
    }
  } else {
    await activationReady;
  }

  // Task 035 (R8). Every message that carries newly authored Template text
  // does so as a top-level `content`, so one check at the boundary covers all
  // eight of them and any that come later. Deliberately not applied to
  // `RESTORE_TEMPLATE`/`RESTORE_TEMPLATES`/the Undos, whose content arrives
  // nested: those carry text FillNest already accepted, and refusing to give
  // a user their own data back would be a worse failure than the one this
  // prevents.
  if ("content" in message && typeof message.content === "string") {
    assertTemplateContentWithinLimit(message.content);
  }

  // Task 035 (R8 follow-up): how many Templates one Field may offer. Checked
  // here rather than inside six command bodies for the same reason
  // `DELETE_TEMPLATES` checks its confirmation here - `handleMessage` runs
  // inside `runtimeOperationQueue`, so nothing can mutate between this read
  // and the command that follows it.
  //
  // Only the ordinary "put this Template on this Field" actions are listed.
  // The structural Set operations, Restore and every Undo are deliberately
  // absent; `field-template-limit.ts` records why.
  switch (message.type) {
    case "BIND_TEMPLATE":
    case "CREATE_TEMPLATE_AND_BIND":
    case "BIND_TEMPLATE_TO_FIELD_ONLY":
    case "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY":
      assertFieldCanTakeAnotherTemplate(await repository.read(), message.fieldProfileId);
      break;
    case "BIND_TEMPLATE_SHARED":
      if (message.fieldProfileId !== undefined) {
        assertFieldCanTakeAnotherTemplate(await repository.read(), message.fieldProfileId);
      } else {
        assertSharedSetCanTakeAnotherTemplate(await repository.read(), message.setId);
      }
      break;
    case "CREATE_TEMPLATE_AND_BIND_SHARED":
      assertSharedSetCanTakeAnotherTemplate(await repository.read(), message.setId);
      break;
    default:
      break;
  }

  switch (message.type) {
    case "REMOVE_WEBSITE_ACCESS":
      requireExtensionPage(sender);
      return permissionLifecycle.disableOrigins(message.origins);
    case "REMOVE_SITE":
      requireExtensionPage(sender);
      return removeSiteCoordinator.execute(message.origins, message.sites);
    case "RESET_SITE_MAPPINGS_BATCH":
      requireExtensionPage(sender);
      return repository.resetSiteMappingsBatch(message);
    case "DELETE_NEWLY_GLOBAL_TEMPLATES": {
      // Task 028 Addendum B: this path can also empty the Template Library
      // (every Template made Global by a Clear Site Data, then deleted), so it
      // consults the same rule as its DELETE_TEMPLATES sibling. Its Side Panel
      // sheet already collected a typed word; only enforcement was missing.
      requireExtensionPage(sender);
      const { templates } = await repository.read();
      assertBulkDeleteConfirmation(
        templates,
        message.templates.map((template) => template.id),
        message.typedConfirmation,
      );
      return repository.deleteNewlyGlobalTemplates(message);
    }
    case "RETRY_SITE_ACTIVATION":
      requireExtensionPage(sender);
      return activationAuthority.retryWebsiteActivation(message.pageUrl, message.tabId);
    case "GET_ACTIVATION_SNAPSHOT":
      return activationAuthority.getSnapshot(message.pageUrl);
    case "GET_ACTIVATION_MANAGEMENT":
      requireExtensionPage(sender);
      return activationAuthority.getManagementSnapshot();
    case "SET_GLOBAL_ACTIVATION":
      requireExtensionPage(sender);
      return activationAuthority.setGlobal(message.mode);
    case "SET_ORIGIN_ACTIVATION":
      requireOriginActivationSender(sender, message.origin);
      return activationAuthority.setOrigin(message.origin, message.mode);
    case "READ_STATE":
      return repository.read();
    case "GET_LOGICAL_PAGE_SITE_KEY":
      requireExactContentOriginSender(sender, permissionOriginFromUrl(message.pageUrl).origin);
      return repository.getOrCreateLogicalPageSiteKey(message.pageUrl);
    case "RECORD_LOGICAL_PAGE_OBSERVATION":
      requireExactContentOriginSender(sender, permissionOriginFromUrl(message.pageUrl).origin);
      return repository.recordLogicalPageObservation({
        pageUrl: message.pageUrl,
        pageProfileId: message.pageProfileId,
        siteKeyId: message.siteKeyId,
        evidence: {
          origin: message.evidence.origin,
          routePattern: message.evidence.routePattern,
          fieldFeatures: new Set(message.evidence.fieldFeatureHashes),
          groupedFieldFeatures: new Set(message.evidence.groupedFieldFeatureHashes),
          fieldIdentityKey: null,
        },
      }).then(() => true);
    case "RESOLVE_LOGICAL_PAGE_CANDIDATE":
      requireExactContentOriginSender(sender, permissionOriginFromUrl(message.evidence.origin).origin);
      return repository.resolveLogicalPageCandidate({ evidence: opaqueCandidateEvidenceToRepository(message.evidence) });
    case "CONFIRM_LOGICAL_PAGE_CANDIDATE":
      requireExactContentOriginSender(sender, permissionOriginFromUrl(message.evidence.origin).origin);
      return repository.confirmLogicalPageCandidate({
        ruleId: message.ruleId,
        canonicalPageProfileId: message.canonicalPageProfileId,
        pageIdentityKey: message.pageIdentityKey,
        evidence: opaqueCandidateEvidenceToRepository(message.evidence),
      });
    case "STOP_LOGICAL_PAGE_MATCHING":
      requireExtensionPage(sender);
      return repository.stopLogicalPageMatching(message);
    case "CREATE_TEMPLATE":
      return repository.createTemplate(message);
    case "UPDATE_TEMPLATE":
      return repository.updateTemplate(message);
    case "DELETE_TEMPLATE":
      // Deliberately NOT restricted to an extension page. The Inline Picker
      // exposes `Delete template everywhere` on its own Template rows
      // (PROJECT.md: "Inline Picker Template rows reveal Edit, contextual
      // Bind or Unbind, and Delete actions"), so this arrives from a content
      // script by design. Task 028 Slice 2 first added the guard here for
      // symmetry with DELETE_TEMPLATES and the headed E2E suite caught the
      // resulting regression; see that contract's amendment.
      return repository.deleteTemplate(message);
    case "RESTORE_TEMPLATE":
      return repository.restoreTemplate(message);
    case "DELETE_TEMPLATES": {
      // Task 028 (audit finding C2) + Addendum B: PROJECT.md requires typed
      // `delete` for a BULK operation whose final result empties the Template
      // Library, "regardless of entry point" - enforced here, at the same
      // boundary as RESET_FILLNEST and RESTORE_BACKUP_ARCHIVE, rather than in
      // the Side Panel alone. Both "is this bulk" and "does this empty the
      // Library" are judged from current state, never the caller's claim.
      //
      // The read and the delete are two operations, but `handleMessage` runs
      // inside `runtimeOperationQueue`, so no other message can mutate between
      // them.
      requireExtensionPage(sender);
      const { templates } = await repository.read();
      assertBulkDeleteConfirmation(templates, message.templateIds, message.typedConfirmation);
      return repository.deleteTemplates(message);
    }
    case "RESTORE_TEMPLATES":
      return repository.restoreTemplates(message);
    case "GET_APPEARANCE":
      return appearanceRepository.read();
    case "SET_APPEARANCE": {
      const appearance = await appearanceRepository.write(message.appearance);
      // Every open surface repaints from this one notification, so the Side
      // Panel, the Popup and every live Picker cannot disagree about the theme.
      await broadcastToExtensionAndTabs({ type: "APPEARANCE_CHANGED", appearance });
      return appearance;
    }
    case "GET_LANGUAGE":
      return languageRepository.read();
    case "SET_LANGUAGE": {
      const language = await languageRepository.write(message.language);
      // Task 037: every open surface re-renders its own words from this one
      // notification, so the Side Panel, the Popup and every live Picker
      // cannot disagree about which language FillNest speaks.
      await broadcastToExtensionAndTabs({ type: "LANGUAGE_CHANGED", language });
      return language;
    }
    case "GET_PICKER_POSITION":
      return repository.getPickerPosition();
    case "SET_PICKER_POSITION":
      return repository.setPickerPosition(message.position);
    case "GET_PAGE_STATUS_POSITION":
      return repository.getPageStatusPosition();
    case "SET_PAGE_STATUS_POSITION":
      return repository.setPageStatusPosition(message.position);
    case "GET_DISMISSED_TIPS":
      return tipsRepository.read();
    case "DISMISS_TIP":
      return tipsRepository.dismiss(message.tip);
    case "SHOW_TIPS_AGAIN":
      requireExtensionPage(sender);
      await tipsRepository.clear();
      return true;
    case "RESET_PAGE_STATUS_POSITION": {
      requireExtensionPage(sender);
      const changed = await repository.setPageStatusPosition(null);
      // Open pages move their button at once: the person asking is usually
      // looking at a page where they cannot find it.
      await broadcastToExtensionAndTabs({ type: "PAGE_STATUS_POSITION_RESET" });
      return changed;
    }
    case "SET_PAGE_ALIAS":
      return repository.setPageAlias(message);
    case "SET_FIELD_ALIAS":
      return repository.setFieldAlias(message);
    case "RECORD_INSERTION":
      return repository.recordInsertion(message);
    case "RECORD_INSERTION_REJECTION":
      return repository.recordInsertionRejection(message);
    case "SAVE_TEMPLATE_COPY_FOR_FIELD":
      return repository.saveTemplateCopyForField(message);
    case "SAVE_TEMPLATE_COPY_FOR_SHARED_SET":
      return repository.saveTemplateCopyForSharedSet(message);
    case "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD":
      return repository.saveTemplateOverrideForField(message);
    case "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD":
      return repository.undoSaveTemplateOverrideForField(message).then(() => true);
    case "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD":
      return repository.excludeSharedTemplateForField(message);
    case "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD":
      return repository.undoExcludeSharedTemplateForField(message).then(() => true);
    case "UNDO_BIND":
      return repository.undoBind(message).then(() => true);
    case "UNDO_UNBIND":
      return repository.undoUnbind(message).then(() => true);
    case "UNDO_SAVE":
      return repository.undoSave(message);
    case "UNDO_SAVE_COPY_FOR_FIELD":
      return repository.undoSaveCopyForField(message).then(() => true);
    case "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET":
      return repository.undoSaveTemplateCopyForSharedSet(message).then(() => true);
    case "CREATE_TEMPLATE_AND_BIND":
      return repository.createTemplateAndBind(message);
    case "BIND_TEMPLATE":
      return repository.bindTemplate(message);
    case "RESOLVE_FIELD_CONTEXT":
      return repository.resolveFieldContext(message);
    case "UNBIND_TEMPLATE":
      return repository.unbindTemplate(message);
    case "CREATE_SHARED_TEMPLATE_SET":
      return repository.createSharedTemplateSet(message);
    case "UNDO_CREATE_SHARED_TEMPLATE_SET":
      return repository.undoCreateSharedTemplateSet(message).then(() => true);
    case "ADD_SHARED_TEMPLATE_SET_MEMBER":
      return repository.addSharedTemplateSetMember(message);
    case "UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER":
      return repository.undoAddSharedTemplateSetMember(message).then(() => true);
    case "REMOVE_SHARED_TEMPLATE_SET_MEMBER":
      return repository.removeSharedTemplateSetMember(message);
    case "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER":
      return repository.undoRemoveSharedTemplateSetMember(message).then(() => true);
    case "END_SHARED_TEMPLATE_SET":
      return repository.endSharedTemplateSet(message);
    case "UNDO_END_SHARED_TEMPLATE_SET":
      return repository.undoEndSharedTemplateSet(message).then(() => true);
    case "RENAME_SHARED_TEMPLATE_SET":
      return repository.renameSharedTemplateSet(message);
    case "CREATE_TEMPLATE_AND_BIND_SHARED":
      return repository.createTemplateAndBindShared(message);
    case "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED":
      return repository.undoCreateTemplateAndBindShared(message).then(() => true);
    case "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY":
      return repository.createTemplateAndBindSharedFieldOnly(message);
    case "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY":
      return repository.undoCreateTemplateAndBindSharedFieldOnly(message).then(() => true);
    case "BIND_TEMPLATE_SHARED":
      return repository.bindTemplateShared(message);
    case "UNDO_BIND_TEMPLATE_SHARED":
      return repository.undoBindTemplateShared(message).then(() => true);
    case "UNBIND_TEMPLATE_SHARED":
      return repository.unbindTemplateShared(message);
    case "UNDO_UNBIND_TEMPLATE_SHARED":
      return repository.undoUnbindTemplateShared(message).then(() => true);
    case "BIND_TEMPLATE_TO_FIELD_ONLY":
      return repository.bindTemplateToFieldOnly(message);
    case "UNDO_BIND_TEMPLATE_TO_FIELD_ONLY":
      return repository.undoBindTemplateToFieldOnly(message).then(() => true);
    case "PROMOTE_FIELD_ONLY_SLOT":
      return repository.promoteFieldOnlySlot(message);
    case "UNDO_PROMOTE_FIELD_ONLY_SLOT":
      return repository.undoPromoteFieldOnlySlot(message).then(() => true);
    case "JOIN_SET_AND_SHARE":
      return repository.joinSetAndShare(message);
    case "UNDO_JOIN_SET_AND_SHARE":
      return repository.undoJoinSetAndShare(message).then(() => true);
    case "MERGE_SETS_AND_SHARE":
      return repository.mergeSetsAndShare(message);
    case "UNDO_MERGE_SETS_AND_SHARE":
      return repository.undoMergeSetsAndShare(message).then(() => true);
    case "FIND_SIMILAR_FIELD_CANDIDATES":
      return repository.findSimilarFieldCandidates(message);
    case "RECORD_COMPATIBILITY_PAIR_NO":
      return repository.recordCompatibilityPairNo(message);
    case "MERGE_SHARED_TEMPLATE_SETS":
      return repository.mergeSharedTemplateSets(message);
    case "UNDO_MERGE_SHARED_TEMPLATE_SETS":
      return repository.undoMergeSharedTemplateSets(message).then(() => true);
    case "CREATE_BACKUP_ARCHIVE": {
      requireExtensionPage(sender);
      const businessState = await repository.read();
      const activationState = await activationRepository.read();
      const archive = createBackupArchive(
        businessState,
        {
          global: activationState.global,
          origins: activationState.origins,
          dormantOrigins: activationState.dormantOrigins,
        },
        { appVersion: chrome.runtime.getManifest().version },
      );
      const archiveJson = serializeBackupArchive(archive);
      const defaultFilename = generateBackupFilename(archive.createdAt);
      return { archiveJson, defaultFilename };
    }
    case "GET_RESET_PREVIEW":
      requireExtensionPage(sender);
      return resetCoordinator.preview();
    case "RESET_FILLNEST": {
      requireExtensionPage(sender);
      assertTypedWord(message.type, message.typedConfirmation);
      await resetCoordinator.execute(message.expectedConfirmationToken);
      // Task 006 Addendum B: Reset deleted everything the failed journal was
      // protecting, so the journal goes too and FillNest starts normally.
      if (restoreCoordinator.failedRollback()) {
        await restoreCoordinator.discardFailedJournal();
        activationReady = removeSiteCoordinator.recoverInterruptedTransaction()
          .then(() => activationAuthority.reconcileExisting());
      }
      // Reset cleared the stored theme; the surfaces still hold the old one in
      // memory and would keep wearing it until they were reloaded (Task 034).
      await broadcastToExtensionAndTabs({ type: "APPEARANCE_CHANGED", appearance: DEFAULT_APPEARANCE });
      // Task 037 Addendum D: and the chosen language, for the same reason.
      await broadcastToExtensionAndTabs({ type: "LANGUAGE_CHANGED", language: DEFAULT_LANGUAGE_PREFERENCE });
      const activationBroadcast = await broadcastActivationChanged({ type: "ACTIVATION_STATE_CHANGED" });
      const businessBroadcast = await broadcastBusinessChanged(true);
      void activationBroadcast;
      void businessBroadcast;
      return { success: true };
    }
    case "VALIDATE_BACKUP_ARCHIVE": {
      requireExtensionPage(sender);
      const archive = parseAndValidateBackupArchive(message.archiveJson);
      const businessState = await repository.read();
      const activationState = await activationRepository.read();
      const grantedPatterns = await chromePermissionPlatform.getGrantedPatterns();
      const grantedOrigins = [...new Set(
        grantedPatterns
          .map(exactOriginFromPattern)
          .filter((origin): origin is string => origin !== null),
      )].sort();
      const { preview, confirmationToken } = await computeRestoreImpact(
        businessState,
        activationState,
        grantedOrigins,
        archive,
      );
      return { preview, confirmationToken };
    }
    case "RESTORE_BACKUP_ARCHIVE": {
      requireExtensionPage(sender);
      assertTypedWord(message.type, message.typedConfirmation);

      const archive = parseAndValidateBackupArchive(message.archiveJson);
      const currentBusiness = await repository.read();
      const currentActivation = await activationRepository.read();
      const grantedPatterns = await chromePermissionPlatform.getGrantedPatterns();
      const grantedOrigins = [...new Set(
        grantedPatterns
          .map(exactOriginFromPattern)
          .filter((origin): origin is string => origin !== null),
      )].sort();

      const { confirmationToken } = await computeRestoreImpact(
        currentBusiness,
        currentActivation,
        grantedOrigins,
        archive,
      );

      if (confirmationToken !== message.expectedConfirmationToken) {
        throw new UserFacingError(
          "restore-preview-stale",
          "The library, settings, or target backup changed since the restore preview was generated. Review the updated preview before restoring.",
        );
      }

      const grantedSet = new Set(grantedOrigins);
      const targetGrantedOrigins = archive.payload.activation.origins.filter((o) => grantedSet.has(o.origin));
      const targetDormantOrigins = archive.payload.activation.origins.filter((o) => !grantedSet.has(o.origin));

      // Execute transaction with journal and rollback
      await restoreCoordinator.executeTransaction(
        businessStateFromArchive(archive),
        {
          schemaVersion: 1,
          global: archive.payload.activation.global,
          origins: targetGrantedOrigins,
          dormantOrigins: targetDormantOrigins,
        },
      );

      await activationAuthority.reconcileExisting();
      const activationBroadcast = await broadcastActivationChanged({ type: "ACTIVATION_STATE_CHANGED" });
      const businessBroadcast = await broadcastBusinessChanged(true);
      const unreachableTabsCount = new Set([
        ...activationBroadcast.unreachableTabIds,
        ...businessBroadcast.unreachableTabIds,
      ]).size;
      return { success: true, unreachableTabsCount };
    }
    default:
      return assertNever(message);
  }
}

async function broadcastActivationChanged(
  message: { type: "ACTIVATION_STATE_CHANGED" },
): Promise<{ unreachableTabIds: number[] }> {
  return broadcastToExtensionAndTabs(message);
}

async function broadcastBusinessChanged(
  fieldIdentitiesInvalidated: boolean,
): Promise<{ unreachableTabIds: number[] }> {
  return broadcastToExtensionAndTabs({ type: "BUSINESS_STATE_CHANGED", fieldIdentitiesInvalidated });
}

async function broadcastToExtensionAndTabs(
  message: StateChangeNotification | PageStatusPositionResetNotification,
): Promise<{ unreachableTabIds: number[] }> {
  const grantedPatterns = await chromePermissionPlatform.getGrantedPatterns();
  const grantedOrigins = new Set(
    grantedPatterns
      .map(exactOriginFromPattern)
      .filter((origin): origin is string => origin !== null),
  );

  // Task 033 Addendum A: ask Chrome only for tabs on authorized Sites, whose
  // address the host permission already shows. The store listing says FillNest
  // reads no other tab's address; `query({})` read every one of them, then
  // threw most away. The exact-Origin filter below still applies, because a
  // Chrome match pattern is looser than a Permission Origin.
  const tabs = grantedPatterns.length === 0 ? [] : await chrome.tabs.query({ url: grantedPatterns });
  const authorizedTabs = tabs.filter((tab) => {
    if (!tab.url) return false;
    try {
      const { origin } = permissionOriginFromUrl(tab.url);
      return grantedOrigins.has(origin);
    } catch {
      return false;
    }
  });

  const addressedTabs = authorizedTabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]));
  const tabPromises = addressedTabs.map((tabId) => chrome.tabs.sendMessage(tabId, message));
  const [, ...tabResults] = await Promise.allSettled([
    chrome.runtime.sendMessage(message).catch(() => undefined),
    ...tabPromises,
  ]);
  const unreachableTabIds = tabResults.flatMap((result, index) =>
    result.status === "rejected" ? [addressedTabs[index]!] : [],
  );
  return { unreachableTabIds };
}

/**
 * Task 037 acceptance 6: the English text for a log and the English surface,
 * and - for an error a user can meet - the code another language looks up.
 */
function failureResponse(error: unknown): Extract<RuntimeResponse, { ok: false }> {
  const message = error instanceof Error ? error.message : "Unknown FillNest error";
  const errorCode = userErrorCodeOf(error);
  return errorCode === undefined ? { ok: false, error: message } : { ok: false, error: message, errorCode };
}

function requireExtensionPage(sender: chrome.runtime.MessageSender): void {
  requireAuthorizedExtensionPage(sender, extensionRuntime());
}

function requireOriginActivationSender(
  sender: chrome.runtime.MessageSender,
  origin: string,
): void {
  requireAuthorizedOriginActivationSender(sender, origin, extensionRuntime());
}

function requireExactContentOriginSender(
  sender: chrome.runtime.MessageSender,
  origin: string,
): void {
  requireAuthorizedExactContentOriginSender(sender, origin, extensionRuntime());
}

function opaqueCandidateEvidenceToRepository(
  evidence: OpaqueLogicalPageCandidateEvidencePayload,
): LogicalPageEvidence {
  return {
    origin: evidence.origin,
    routePattern: evidence.routePattern,
    fieldFeatures: new Set(evidence.fieldFeatureHashes),
    groupedFieldFeatures: new Set(evidence.groupedFieldFeatureHashes),
    fieldIdentityKey: evidence.fieldIdentityKey,
  };
}

function extensionRuntime(): { id: string; extensionUrlPrefix: string } {
  return { id: chrome.runtime.id, extensionUrlPrefix: chrome.runtime.getURL("") };
}

function assertNever(_value: never): never {
  throw new Error("Unhandled FillNest runtime request");
}
