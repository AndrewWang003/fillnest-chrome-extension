import { describe, expect, it } from "vitest";

import { ActivationRepository } from "../../src/activation/activation-repository";
import { AppearanceRepository } from "../../src/appearance/appearance-repository";
import {
  RESET_JOURNAL_STORAGE_KEY,
  ResetTransactionCoordinator,
  type WebsiteAccessResetter,
} from "../../src/reset/reset-transaction";
import { FillNestRepository, type LocalStorageArea } from "../../src/storage/fillnest-repository";
import { DEFAULT_APPEARANCE } from "../../src/ui/theme/theme-tokens";

class MemoryStorage implements LocalStorageArea {
  readonly values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(items));
  }

  async remove(key: string): Promise<void> {
    delete this.values[key];
  }
}

class MemoryWebsiteAccess implements WebsiteAccessResetter {
  constructor(readonly origins: string[], private readonly removable = true) {}

  async getGrantedOrigins(): Promise<string[]> {
    return [...this.origins];
  }

  async removeAllWebsiteAccess(): Promise<string[]> {
    const before = [...this.origins];
    if (this.removable) this.origins.splice(0);
    return before;
  }
}

async function setup() {
  const storage = new MemoryStorage();
  let nextId = 0;
  const business = new FillNestRepository(storage, { createId: () => `template-${++nextId}`, now: () => "2026-08-24T00:00:00.000Z" });
  const activation = new ActivationRepository(storage);
  await activation.initialize({ installationReason: "install", grantedPatterns: [] });
  await business.createTemplate({ content: "Keep me unless reset completes", pageUrl: "https://example.test/form" });
  await activation.setGlobal("active");
  return { storage, business, activation };
}

describe("ResetTransactionCoordinator", () => {
  it("does not delete local data when Website Access cannot be removed", async () => {
    const { storage, business, activation } = await setup();
    const coordinator = new ResetTransactionCoordinator(
      storage, business, activation, new MemoryWebsiteAccess(["https://example.test:443"], false),
    );
    const { confirmationToken } = await coordinator.preview();

    await expect(coordinator.execute(confirmationToken)).rejects.toThrow("could not remove Website Access");
    expect((await business.read()).templates).toHaveLength(1);
    expect((await activation.read()).global).toBe("active");
    expect(storage.values[RESET_JOURNAL_STORAGE_KEY]).toMatchObject({ phase: "prepared" });
  });

  it("clears the chosen theme, which is not business data and not in a Backup, but is part of the initial state (Task 034)", async () => {
    const { storage, business, activation } = await setup();
    const appearance = new AppearanceRepository(storage);
    await appearance.write({ themeId: "ocean", mode: "dark" });

    const coordinator = new ResetTransactionCoordinator(
      storage, business, activation, new MemoryWebsiteAccess([]), appearance,
    );
    const { confirmationToken } = await coordinator.preview();
    await coordinator.execute(confirmationToken);

    expect(await appearance.read()).toEqual(DEFAULT_APPEARANCE);
  });

  it("rejects a stale impact preview before any destructive operation", async () => {
    const { storage, business, activation } = await setup();
    const access = new MemoryWebsiteAccess([]);
    const coordinator = new ResetTransactionCoordinator(storage, business, activation, access);
    const { confirmationToken } = await coordinator.preview();
    await business.createTemplate({ content: "Changed after preview", pageUrl: "https://example.test/form" });

    await expect(coordinator.execute(confirmationToken)).rejects.toThrow("changed since the reset preview");
    expect((await business.read()).templates).toHaveLength(2);
  });

  it("resumes a confirmed reset after an interruption and verifies initial state", async () => {
    const { storage, business, activation } = await setup();
    storage.values[RESET_JOURNAL_STORAGE_KEY] = {
      schemaVersion: 1,
      phase: "permissions_removed",
      origins: ["https://example.test:443"],
    };
    const coordinator = new ResetTransactionCoordinator(storage, business, activation, new MemoryWebsiteAccess([]));

    await expect(coordinator.recoverInterruptedTransaction()).resolves.toBe(true);
    expect((await business.read()).templates).toHaveLength(0);
    expect((await activation.read()).global).toBe("paused");
    expect(storage.values[RESET_JOURNAL_STORAGE_KEY]).toBeUndefined();
  });

  it("removes access and all local state only after confirmation", async () => {
    const { storage, business, activation } = await setup();
    const access = new MemoryWebsiteAccess(["https://example.test:443"]);
    const coordinator = new ResetTransactionCoordinator(storage, business, activation, access);
    const { confirmationToken } = await coordinator.preview();

    await coordinator.execute(confirmationToken);
    expect(access.origins).toEqual([]);
    expect(await business.read()).toMatchObject({ templates: [], sites: [], pageProfiles: [], fieldProfiles: [], bindings: [], pickerPosition: null });
    expect(await activation.read()).toEqual({ schemaVersion: 1, global: "paused", origins: [], dormantOrigins: [] });
  });
  // Task 028 Slice 1 (audit finding C1): Reset is the product's designated
  // escape hatch, and it must not require the store it is about to destroy to
  // be readable. Before this, `preview()` propagated InvalidStoredDataError
  // and `execute()` re-previewed, so a store no migration recognized left the
  // user with no in-product recovery at all.
  it("previews and completes a Reset when local business data is unreadable", async () => {
    const { storage, business, activation } = await setup();
    // The shape a user has after installing a newer build and downgrading.
    storage.values["fillnestState"] = { schemaVersion: 99, templates: [{ id: "t", content: "from a newer build" }] };
    const access = new MemoryWebsiteAccess(["https://example.test:443"]);
    const coordinator = new ResetTransactionCoordinator(storage, business, activation, access);

    const { preview, confirmationToken } = await coordinator.preview();
    expect(preview.businessDataReadable).toBe(false);
    // Counts it cannot know are not fabricated; Website Access comes from
    // Chrome, not the store, so it stays accurate.
    expect(preview.templates).toBeNull();
    expect(preview.authorizedOrigins).toEqual(["https://example.test:443"]);

    await coordinator.execute(confirmationToken);
    expect(access.origins).toEqual([]);
    expect(await business.read()).toMatchObject({ templates: [], bindings: [] });
    expect(await activation.read()).toMatchObject({ global: "paused" });
  });

  it("rejects an unreadable-store confirmation once the store becomes readable again", async () => {
    const { storage, business, activation } = await setup();
    storage.values["fillnestState"] = { schemaVersion: 99, templates: [] };
    const coordinator = new ResetTransactionCoordinator(
      storage, business, activation, new MemoryWebsiteAccess([]),
    );
    const { confirmationToken } = await coordinator.preview();

    // A repaired store between preview and confirm is a different dataset;
    // the stale-preview rule must still fire.
    delete storage.values["fillnestState"];
    await business.createTemplate({ content: "Repaired", pageUrl: "https://example.test/form" });

    await expect(coordinator.execute(confirmationToken)).rejects.toThrow("changed since the reset preview");
  });

  it("propagates a storage-platform failure instead of reporting an unreadable store", async () => {
    const { storage, activation } = await setup();
    const failing = {
      ...storage,
      get: async () => { throw new Error("chrome.storage.local is unavailable"); },
      set: storage.set.bind(storage),
      remove: storage.remove.bind(storage),
    } as unknown as LocalStorageArea;
    const coordinator = new ResetTransactionCoordinator(
      storage, new FillNestRepository(failing), activation, new MemoryWebsiteAccess([]),
    );

    await expect(coordinator.preview()).rejects.toThrow("chrome.storage.local is unavailable");
  });
});
