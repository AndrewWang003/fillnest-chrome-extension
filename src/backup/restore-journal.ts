import { isActivationState, type ActivationRepository, type ActivationState } from "../activation/activation-repository";
import { validateCandidateState, type FillNestRepository, type FillNestState, type LocalStorageArea } from "../storage/fillnest-repository";

export const RESTORE_JOURNAL_STORAGE_KEY = "_fillnest_restore_journal";

export interface RestoreJournalEntry {
  transactionId: string;
  status: "in_progress" | "failed";
  createdAt: string;
  failureReason?: string;
  priorState: {
    business: FillNestState;
    activation: ActivationState;
  };
}

export interface RestoreRecoveryOutcome {
  recovered: boolean;
}

// Deliberately reuses the repository's own structural validators rather than
// a shallow shape check: this is the data that gets written straight back
// over the user's live dataset during rollback, so it deserves the same
// rigor as untrusted Archive input, not less.
export function isRestoreJournalEntry(value: unknown): value is RestoreJournalEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<RestoreJournalEntry>;
  if (
    typeof entry.transactionId !== "string" ||
    (entry.status !== "in_progress" && entry.status !== "failed") ||
    typeof entry.createdAt !== "string" ||
    typeof entry.priorState !== "object" ||
    entry.priorState === null
  ) {
    return false;
  }
  try {
    validateCandidateState(entry.priorState.business);
  } catch {
    return false;
  }
  return isActivationState(entry.priorState.activation);
}

export class RestoreTransactionCoordinator {
  private transactionQueue: Promise<void> = Promise.resolve();
  /**
   * Task 006 Addendum A: set once a rollback fails in this worker's lifetime.
   * The journal on disk already holds the prior data and says `failed`; this
   * keeps the running worker from accepting new work on top of it, exactly as
   * finding that journal at startup does. Without it a later Restore
   * overwrote the only copy of the user's prior data.
   */
  private rollbackFailure: Error | null = null;

  failedRollback(): Error | null {
    return this.rollbackFailure;
  }

  /**
   * Task 006 Addendum B (owner decision, 2026-09-11): the one way out when the
   * prior data cannot be put back. Called only after Reset FillNest has
   * deleted every FillNest record, so the journal protects nothing any more.
   */
  async discardFailedJournal(): Promise<void> {
    await this.clearJournal();
    this.rollbackFailure = null;
  }

  constructor(
    private readonly storage: LocalStorageArea,
    private readonly businessRepo: FillNestRepository,
    private readonly activationRepo: ActivationRepository,
  ) {}

  async executeTransaction(
    targetBusiness: FillNestState,
    targetActivation: ActivationState,
  ): Promise<void> {
    const run = async () => {
      const priorBusiness = await this.businessRepo.read();
      const priorActivation = await this.activationRepo.read();

      const transactionId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const journalEntry: RestoreJournalEntry = {
        transactionId,
        status: "in_progress",
        createdAt: new Date().toISOString(),
        priorState: {
          business: priorBusiness,
          activation: priorActivation,
        },
      };

      // 1. Persist transaction journal before executing any mutation
      await this.storage.set({ [RESTORE_JOURNAL_STORAGE_KEY]: journalEntry });

      try {
        // 2. Perform business replacement
        await this.businessRepo.replaceState(targetBusiness);

        // 3. Perform activation replacement
        await this.activationRepo.replaceState(targetActivation);

        // 4. Clean up journal after both writes succeed
        await this.clearJournal();
      } catch (originalError) {
        // Attempt rollback
        try {
          await this.businessRepo.replaceState(priorBusiness);
          await this.activationRepo.replaceState(priorActivation);
          // Rollback succeeded, clear journal
          await this.clearJournal();
        } catch (rollbackError) {
          // Rollback failed: mark journal as failed and preserve evidence
          const failedEntry: RestoreJournalEntry = {
            ...journalEntry,
            status: "failed",
            failureReason: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          };
          // Task 039 R1. The safety lock cannot depend on a second storage
          // write succeeding: storage has already failed during rollback, so
          // persisting the richer `failed` status may fail as well. The
          // original `in_progress` journal already holds the complete prior
          // state and remains valid recovery evidence.
          this.rollbackFailure = new Error(failedEntry.failureReason);
          await this.storage
            .set({ [RESTORE_JOURNAL_STORAGE_KEY]: failedEntry })
            .catch(() => undefined);
        }
        throw originalError;
      }
    };

    const result = this.transactionQueue.then(run, run);
    this.transactionQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async clearJournal(): Promise<void> {
    const stored = await this.storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    if (stored[RESTORE_JOURNAL_STORAGE_KEY] !== undefined) {
      await this.storage.remove(RESTORE_JOURNAL_STORAGE_KEY);
    }
  }

  // Recovery is deliberately fail-closed.  A journal means a previous Restore
  // may have left business and Activation state split; processing new work in
  // that state would make the prior complete state unrecoverable.
  //
  // Task 006 Addendum B (owner decision, 2026-09-11): a `failed` journal is
  // tried again at every startup rather than refused forever. A rollback
  // fails because storage failed at that moment, and a later start usually
  // succeeds; until one does, the worker stays closed except for Reset.
  async recoverInterruptedTransaction(): Promise<RestoreRecoveryOutcome> {
    const stored = await this.storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    const value = stored[RESTORE_JOURNAL_STORAGE_KEY];
    if (value === undefined) {
      return { recovered: false };
    }

    if (!isRestoreJournalEntry(value)) {
      this.rollbackFailure = new Error("Restore recovery is blocked because its transaction journal is invalid.");
      throw this.rollbackFailure;
    }

    try {
      await this.businessRepo.replaceState(value.priorState.business);
      await this.activationRepo.replaceState(value.priorState.activation);
      await this.clearJournal();
      this.rollbackFailure = null;
      return { recovered: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("FillNest restore journal rollback failed.", err);
      const failedEntry: RestoreJournalEntry = {
        ...value,
        status: "failed",
        failureReason: message,
      };
      await this.storage.set({ [RESTORE_JOURNAL_STORAGE_KEY]: failedEntry }).catch(() => undefined);
      this.rollbackFailure = new Error(message);
      throw this.rollbackFailure;
    }
  }
}
