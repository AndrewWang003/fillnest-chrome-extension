import { describe, expect, it } from "vitest";
import { ActivationRepository, type ActivationState } from "../../src/activation/activation-repository";
import {
  RestoreTransactionCoordinator,
  RESTORE_JOURNAL_STORAGE_KEY,
} from "../../src/backup/restore-journal";
import { FillNestRepository, type FillNestState, type LocalStorageArea } from "../../src/storage/fillnest-repository";

class MemoryStorage implements LocalStorageArea {
  private data: Record<string, unknown> = {};

  async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    if (typeof keys === "string") {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        result[k] = this.data[k];
      }
      return result;
    }
    return { ...this.data };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(items)) {
      if (v === undefined) {
        delete this.data[k];
      } else {
        this.data[k] = v;
      }
    }
  }

  async remove(key: string): Promise<void> {
    delete this.data[key];
  }

  dump(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.data)) as Record<string, unknown>;
  }
}

describe("RestoreTransactionCoordinator & Dormant Preferences", () => {
  it("atomically replaces business and activation state when all writes succeed", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);

    await activationRepo.initialize({ installationReason: "install", grantedPatterns: [] });

    // Seed prior data
    await businessRepo.createTemplate({ content: "Prior template", pageUrl: "https://prior.com/page" });
    await activationRepo.setGlobal("paused");

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);

    const targetBusiness: FillNestState = {
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "target.com" }],
      templates: [
        {
          id: "t-target",
          content: "Target content",
          siteAffinities: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 1,
        },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
    logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: { top: 100, left: 200 },
      pageStatusPosition: null,
    };

    const targetActivation: ActivationState = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://target.com:443", mode: "paused" }],
      dormantOrigins: [],
    };

    await coordinator.executeTransaction(targetBusiness, targetActivation);

    const updatedBusiness = await businessRepo.read();
    const updatedActivation = await activationRepo.read();

    expect(updatedBusiness.sites).toEqual([{ id: "target.com" }]);
    expect(updatedBusiness.templates[0]!.id).toBe("t-target");
    expect(updatedBusiness.pickerPosition).toEqual({ top: 100, left: 200 });
    expect(updatedActivation.global).toBe("active");
    expect(updatedActivation.origins).toEqual([{ origin: "https://target.com:443", mode: "paused" }]);

    // Journal must be cleaned up
    const stored = await storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    expect(stored[RESTORE_JOURNAL_STORAGE_KEY]).toBeUndefined();
  });

  it("rolls back business state when activation write fails and clears journal on successful rollback", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);

    await activationRepo.initialize({ installationReason: "install", grantedPatterns: [] });

    const priorTemplate = await businessRepo.createTemplate({ content: "Prior template", pageUrl: "https://prior.com/page" });
    await activationRepo.setGlobal("paused");

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);

    const targetBusiness: FillNestState = {
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "target.com" }],
      templates: [
        {
          id: "t-target",
          content: "Target content",
          siteAffinities: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 1,
        },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
    logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };

    // Invalid target activation that will fail validation in activationRepo.replaceState
    const invalidTargetActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "invalid-origin-format", mode: "active" }],
    } as unknown as ActivationState;

    await expect(coordinator.executeTransaction(targetBusiness, invalidTargetActivation)).rejects.toThrow();

    // Verify rollback: business data must STILL be the prior template, NOT targetBusiness
    const rolledBackBusiness = await businessRepo.read();
    const rolledBackActivation = await activationRepo.read();

    expect(rolledBackBusiness.templates.length).toBe(1);
    expect(rolledBackBusiness.templates[0]!.id).toBe(priorTemplate.id);
    expect(rolledBackBusiness.templates[0]!.content).toBe("Prior template");
    expect(rolledBackActivation.global).toBe("paused");
  });

  it("preserves journal evidence with status 'failed' if rollback itself throws", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);

    await activationRepo.initialize({ installationReason: "install", grantedPatterns: [] });
    await businessRepo.createTemplate({ content: "Prior template", pageUrl: "https://prior.com/page" });

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);

    // Mock businessRepo.replaceState to succeed on target write but fail during rollback
    let callCount = 0;
    const origReplace = businessRepo.replaceState.bind(businessRepo);
    businessRepo.replaceState = async (state) => {
      callCount++;
      if (callCount === 1) {
        return origReplace(state);
      }
      throw new Error("Simulated storage corruption during rollback");
    };

    const targetBusiness: FillNestState = {
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "target.com" }],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
    logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const invalidActivation = { schemaVersion: 119 } as unknown as ActivationState;

    await expect(coordinator.executeTransaction(targetBusiness, invalidActivation)).rejects.toThrow();

    // Journal must STILL EXIST with status "failed" and failureReason recorded!
    const stored = await storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    const journal = stored[RESTORE_JOURNAL_STORAGE_KEY] as Record<string, unknown>;
    expect(journal).toBeDefined();
    expect(journal.status).toBe("failed");
    expect(journal.failureReason).toContain("Simulated storage corruption during rollback");
  });

  it("recovers and restores consistent prior state after simulated worker interruption / crash", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);

    const priorBusiness: FillNestState = {
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "prior.com" }],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
    logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };

    const priorActivation: ActivationState = {
      schemaVersion: 1,
      global: "paused",
      origins: [],
      dormantOrigins: [],
    };

    // Simulate interrupted write: journal is left in 'in_progress' status and partially written state
    await storage.set({
      fillnestState: {
        schemaVersion: 4,
        sites: [{ id: "half-written-corrupted.com" }],
        templates: [],
        pageProfiles: [],
        fieldProfiles: [],
        bindings: [],
        pickerPosition: null,
        pageStatusPosition: null,
      },
      fillnestActivation: {
        schemaVersion: 1,
        global: "active",
        origins: [],
        dormantOrigins: [],
      },
      [RESTORE_JOURNAL_STORAGE_KEY]: {
        transactionId: "txn-12345",
        status: "in_progress",
        createdAt: "2026-08-21T00:00:00.000Z",
        priorState: {
          business: priorBusiness,
          activation: priorActivation,
        },
      },
    });

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);
    const outcome = await coordinator.recoverInterruptedTransaction();

    expect(outcome).toEqual({ recovered: true });

    const restoredBusiness = await businessRepo.read();
    const restoredActivation = await activationRepo.read();

    expect(restoredBusiness.sites).toEqual([{ id: "prior.com" }]);
    expect(restoredActivation.global).toBe("paused");

    // Journal must be cleared
    const stored = await storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    expect(stored[RESTORE_JOURNAL_STORAGE_KEY]).toBeUndefined();
  });

  it("fails closed and preserves an unreadable journal", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);
    await storage.set({
      [RESTORE_JOURNAL_STORAGE_KEY]: {
        transactionId: "txn-corrupt",
        status: "in_progress",
        createdAt: "2026-08-21T00:00:00.000Z",
        priorState: { business: { not: "a valid state" }, activation: { also: "invalid" } },
      },
    });

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);
    await expect(coordinator.recoverInterruptedTransaction()).rejects.toThrow("transaction journal is invalid");
    const stored = await storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    expect(stored[RESTORE_JOURNAL_STORAGE_KEY]).toBeDefined();
  });

  // Task 006 Addendum B (owner decision, 2026-09-11): a failed journal is
  // retried at the next startup instead of being refused forever.
  it("retries a journal whose earlier rollback failed, and puts the prior state back", async () => {
    const storage = new MemoryStorage();
    const businessRepo = new FillNestRepository(storage);
    const activationRepo = new ActivationRepository(storage);
    const priorBusiness: FillNestState = {
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
    logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const priorActivation: ActivationState = { schemaVersion: 1, global: "active", origins: [], dormantOrigins: [] };
    await storage.set({
      [RESTORE_JOURNAL_STORAGE_KEY]: {
        transactionId: "txn-already-failed",
        status: "failed",
        createdAt: "2026-08-21T00:00:00.000Z",
        failureReason: "Simulated prior rollback failure",
        priorState: { business: priorBusiness, activation: priorActivation },
      },
    });

    const coordinator = new RestoreTransactionCoordinator(storage, businessRepo, activationRepo);
    await expect(coordinator.recoverInterruptedTransaction()).resolves.toEqual({ recovered: true });
    expect(coordinator.failedRollback()).toBeNull();
    const stored = await storage.get(RESTORE_JOURNAL_STORAGE_KEY);
    expect(stored[RESTORE_JOURNAL_STORAGE_KEY]).toBeUndefined();
    await expect(activationRepo.read()).resolves.toEqual(priorActivation);
  });

  it("preserves dormant origins and clears revoked origins properly", async () => {
    const storage = new MemoryStorage();
    const activationRepo = new ActivationRepository(storage);

    await activationRepo.initialize({ installationReason: "install", grantedPatterns: [] });

    // Restored state has 1 granted origin and 1 dormant origin
    await activationRepo.replaceState({
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://granted.com:443", mode: "active" }],
      dormantOrigins: [{ origin: "https://dormant-account.org:443", mode: "paused" }],
    });

    // Reconcile keeps dormant preference intact
    const reconciled = await activationRepo.reconcile(["https://granted.com:443/*"]);
    expect(reconciled.origins).toEqual([{ origin: "https://granted.com:443", mode: "active" }]);
    expect(reconciled.dormantOrigins).toEqual([{ origin: "https://dormant-account.org:443", mode: "paused" }]);

    // Remove access explicitly clears the origin
    const afterRemoval = await activationRepo.removeOrigins(["https://granted.com:443"]);
    expect(afterRemoval.origins).toEqual([]);
    expect(afterRemoval.dormantOrigins).toEqual([{ origin: "https://dormant-account.org:443", mode: "paused" }]);
  });
});
