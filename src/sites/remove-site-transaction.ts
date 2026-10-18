import { UserFacingError } from "../messages/user-error";
import type { PermissionLifecycle, RemoveWebsiteAccessResult } from "../permissions/permission-lifecycle";
import type {
  FillNestRepository,
  FillNestState,
  LocalStorageArea,
  ResetSiteMappingsBatchInput,
  ResetSiteMappingsResult,
} from "../storage/fillnest-repository";

export const REMOVE_SITE_JOURNAL_STORAGE_KEY = "_fillnest_remove_site_journal";

interface RemoveSiteJournal {
  priorState: FillNestState;
}

function isJournal(value: unknown): value is RemoveSiteJournal {
  return typeof value === "object" && value !== null && "priorState" in value;
}

export interface RemoveSiteResult extends ResetSiteMappingsResult, RemoveWebsiteAccessResult {}

// Chrome Website Access cannot be re-requested as rollback because it requires
// a user gesture. The journal therefore protects the user-authored local data:
// a failed or interrupted removal always restores that exact prior state.
export class RemoveSiteTransactionCoordinator {
  constructor(
    private readonly storage: LocalStorageArea,
    private readonly repository: FillNestRepository,
    private readonly permissions: PermissionLifecycle,
  ) {}

  async recoverInterruptedTransaction(): Promise<boolean> {
    const stored = await this.storage.get(REMOVE_SITE_JOURNAL_STORAGE_KEY);
    const journal = stored[REMOVE_SITE_JOURNAL_STORAGE_KEY];
    if (journal === undefined) return false;
    if (!isJournal(journal)) throw new Error("Remove site recovery is blocked because its transaction journal is invalid.");
    await this.repository.replaceState(journal.priorState);
    await this.storage.remove(REMOVE_SITE_JOURNAL_STORAGE_KEY);
    return true;
  }

  async execute(origins: string[], sites: ResetSiteMappingsBatchInput["sites"]): Promise<RemoveSiteResult> {
    const priorState = await this.repository.read();
    await this.storage.set({ [REMOVE_SITE_JOURNAL_STORAGE_KEY]: { priorState } satisfies RemoveSiteJournal });
    try {
      const cleanup = await this.repository.resetSiteMappingsBatch({ sites });
      const removal = await this.permissions.disableOrigins(origins);
      const expected = [...new Set(origins)].sort();
      if (removal.removedOrigins.length !== expected.length || expected.some((origin) => !removal.removedOrigins.includes(origin))) {
        throw new UserFacingError(
          "remove-site-incomplete",
          "Chrome could not remove every selected Website Access permission. Your saved Site data was restored.",
        );
      }
      await this.storage.remove(REMOVE_SITE_JOURNAL_STORAGE_KEY);
      return { ...cleanup, ...removal };
    } catch (error) {
      await this.repository.replaceState(priorState);
      await this.storage.remove(REMOVE_SITE_JOURNAL_STORAGE_KEY);
      throw error;
    }
  }
}
