import { UserFacingError } from "../messages/user-error";
import {
  createInitialActivationState,
  type ActivationRepository,
  type ActivationState,
} from "../activation/activation-repository";
import {
  createInitialFillNestState,
  InvalidStoredDataError,
  type FillNestRepository,
  type FillNestState,
  type LocalStorageArea,
} from "../storage/fillnest-repository";

export const RESET_JOURNAL_STORAGE_KEY = "_fillnest_reset_journal";

export interface ResetImpactPreview {
  // Task 028 (audit finding C1): `false` when stored business data could not
  // be read - typically a store written by a newer build the user has since
  // downgraded from. Reset does not need to understand the data it is about
  // to destroy, so it reports the condition and proceeds rather than refusing.
  // Every business-derived count is `null` in that case: Reset states what it
  // will clear without fabricating numbers it cannot know.
  businessDataReadable: boolean;
  templates: number | null;
  sites: number | null;
  pageProfiles: number | null;
  fieldProfiles: number | null;
  bindings: number | null;
  aliases: number | null;
  savedPickerPosition: boolean | null;
  // Activation lives in its own store and Website Access comes from Chrome,
  // so both stay accurate even when business data is unreadable.
  globalActivation: ActivationState["global"];
  authorizedOrigins: string[];
  dormantOrigins: number;
}

export interface ResetJournalEntry {
  schemaVersion: 1;
  phase: "prepared" | "permissions_removed";
  origins: string[];
}

export interface WebsiteAccessResetter {
  removeAllWebsiteAccess(): Promise<string[]>;
  getGrantedOrigins(): Promise<string[]>;
}

export function computeResetImpact(
  business: FillNestState | null,
  activation: ActivationState,
  grantedOrigins: string[],
): ResetImpactPreview {
  if (business === null) {
    return {
      businessDataReadable: false,
      templates: null,
      sites: null,
      pageProfiles: null,
      fieldProfiles: null,
      bindings: null,
      aliases: null,
      savedPickerPosition: null,
      globalActivation: activation.global,
      authorizedOrigins: [...grantedOrigins].sort(),
      dormantOrigins: activation.dormantOrigins.length,
    };
  }
  return {
    businessDataReadable: true,
    templates: business.templates.length,
    sites: business.sites.length,
    pageProfiles: business.pageProfiles.length,
    fieldProfiles: business.fieldProfiles.length,
    bindings: business.bindings.length,
    aliases:
      business.pageProfiles.filter((profile) => profile.userAlias !== undefined).length +
      business.fieldProfiles.filter((profile) => profile.userAlias !== undefined).length,
    savedPickerPosition: business.pickerPosition !== null,
    globalActivation: activation.global,
    authorizedOrigins: [...grantedOrigins].sort(),
    dormantOrigins: activation.dormantOrigins.length,
  };
}

export async function computeResetConfirmationToken(preview: ResetImpactPreview): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(preview)));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `cfn-reset-${hex}`;
}

function isJournal(value: unknown): value is ResetJournalEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ResetJournalEntry>;
  return candidate.schemaVersion === 1 &&
    (candidate.phase === "prepared" || candidate.phase === "permissions_removed") &&
    Array.isArray(candidate.origins) && candidate.origins.every((origin) => typeof origin === "string");
}

export class ResetTransactionCoordinator {
  constructor(
    private readonly storage: LocalStorageArea,
    private readonly businessRepo: FillNestRepository,
    private readonly activationRepo: ActivationRepository,
    private readonly websiteAccess: WebsiteAccessResetter,
    /**
     * Task 034. The chosen theme is not in the business record and not in a
     * Backup Archive - it is a display preference for this profile - but Reset
     * returns FillNest to its initial state, and a product that came back
     * still wearing the last user's palette has not done that. Optional so
     * every existing construction of this coordinator keeps working unchanged.
     */
    private readonly appearanceRepo?: { clear(): Promise<void> },
    /**
     * Task 037. The chosen language, cleared for the same reason as the theme:
     * it is a display preference this profile made, and a product returned to
     * its initial state should not still be speaking the last user's language.
     */
    private readonly languageRepo?: { clear(): Promise<void> },
    /**
     * Task 042. The dismissed first-use tips: a product returned to its
     * initial state greets its next user as a first-time one.
     */
    private readonly tipsRepo?: { clear(): Promise<void> },
  ) {}

  async preview(): Promise<{ preview: ResetImpactPreview; confirmationToken: string }> {
    const [business, activation, origins] = await Promise.all([
      this.readBusinessStateForPreview(),
      this.activationRepo.read(),
      this.websiteAccess.getGrantedOrigins(),
    ]);
    const preview = computeResetImpact(business, activation, origins);
    return { preview, confirmationToken: await computeResetConfirmationToken(preview) };
  }

  /**
   * Task 028 (audit finding C1): Reset destroys local data; it never needs to
   * interpret it. `InvalidStoredDataError` therefore reports an unreadable
   * store rather than propagating - otherwise the product's designated escape
   * hatch is unavailable in exactly the situation that calls for it, and the
   * user's only recovery is clearing extension storage by hand.
   *
   * Only that one error is absorbed. A storage-platform failure still
   * propagates, so a transient `chrome.storage.local` outage can never be
   * presented to the user as "your data is corrupt".
   */
  private async readBusinessStateForPreview(): Promise<FillNestState | null> {
    try {
      return await this.businessRepo.read();
    } catch (error: unknown) {
      if (error instanceof InvalidStoredDataError) return null;
      throw error;
    }
  }

  async execute(expectedConfirmationToken: string): Promise<void> {
    const { confirmationToken } = await this.preview();
    if (confirmationToken !== expectedConfirmationToken) {
      throw new UserFacingError(
        "reset-preview-stale",
        "FillNest data or Website Access changed since the reset preview. Review the updated preview before resetting.",
      );
    }
    await this.continueReset();
  }

  // A stored journal only exists after the user confirmed Reset. Resume rather
  // than exposing a half-reset product state after a service-worker restart.
  async recoverInterruptedTransaction(): Promise<boolean> {
    const stored = await this.storage.get(RESET_JOURNAL_STORAGE_KEY);
    const value = stored[RESET_JOURNAL_STORAGE_KEY];
    if (value === undefined) return false;
    if (!isJournal(value)) throw new Error("Reset recovery is blocked because its transaction journal is invalid.");
    await this.continueReset(value);
    return true;
  }

  private async continueReset(existing?: ResetJournalEntry): Promise<void> {
    let journal = existing;
    if (!journal) {
      const origins = await this.websiteAccess.getGrantedOrigins();
      journal = { schemaVersion: 1, phase: "prepared", origins: [...origins].sort() };
      await this.storage.set({ [RESET_JOURNAL_STORAGE_KEY]: journal });
    }

    if (journal.phase === "prepared") {
      await this.websiteAccess.removeAllWebsiteAccess();
      const remaining = await this.websiteAccess.getGrantedOrigins();
      if (remaining.length > 0) {
        throw new UserFacingError(
          "reset-incomplete",
          `Reset could not remove Website Access for: ${remaining.join(", ")}. Local data has been kept. Retry Reset to continue.`,
        );
      }
      journal = { ...journal, phase: "permissions_removed" };
      await this.storage.set({ [RESET_JOURNAL_STORAGE_KEY]: journal });
    }

    // Permission removal has been verified. From here on a restart must finish
    // replacing both records, never resurrecting removed Website Access.
    await this.businessRepo.resetToInitialState();
    await this.activationRepo.replaceState(createInitialActivationState());
    await this.appearanceRepo?.clear();
    await this.languageRepo?.clear();
    await this.tipsRepo?.clear();

    const [business, activation, origins] = await Promise.all([
      this.businessRepo.read(),
      this.activationRepo.read(),
      this.websiteAccess.getGrantedOrigins(),
    ]);
    const isInitial = JSON.stringify(business) === JSON.stringify(createInitialFillNestState()) &&
      JSON.stringify(activation) === JSON.stringify(createInitialActivationState()) && origins.length === 0;
    if (!isInitial) throw new Error("Reset verification failed. FillNest will retry recovery before reporting success.");
    await this.storage.remove(RESET_JOURNAL_STORAGE_KEY);
  }
}
