import { describe, expect, it } from "vitest";

import { ActivationAuthority } from "../../src/activation/activation-authority";
import {
  ActivationRepository,
  type ActivationStorageArea,
} from "../../src/activation/activation-repository";

class InMemoryStorage implements ActivationStorageArea {
  failNextSet = false;
  readonly values: Record<string, unknown> = {
    fillnestActivation: {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "active" }],
    },
  };

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: structuredClone(this.values[key]) };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error("storage unavailable");
    }
    Object.assign(this.values, structuredClone(items));
  }
}

describe("ActivationAuthority", () => {
  it("persists Global Pause and broadcasts an authoritative-state invalidation", async () => {
    const storage = new InMemoryStorage();
    const notifications: unknown[] = [];
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async (message) => {
          notifications.push(message);
        },
      },
    );

    await expect(authority.setGlobal("paused")).resolves.toMatchObject({
      global: "paused",
    });
    expect(storage.values.fillnestActivation).toMatchObject({ global: "paused" });
    expect(notifications).toEqual([{ type: "ACTIVATION_STATE_CHANGED" }]);
  });

  it("does not broadcast when an Activation request is a no-op", async () => {
    const storage = new InMemoryStorage();
    const notifications: unknown[] = [];
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async (message) => { notifications.push(message); },
      },
    );

    await authority.setGlobal("active");
    await authority.setOrigin("https://app.example.test:443", "active");
    expect(notifications).toEqual([]);
  });

  it("starts idempotently by reconciling Task 001 Website Access before exposing state", async () => {
    const storage = new InMemoryStorage();
    delete storage.values.fillnestActivation;
    const events: string[] = [];
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => {
          events.push("website-access");
        },
        broadcast: async () => undefined,
      },
    );

    await expect(authority.start("update")).resolves.toEqual({
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "active" }],
      dormantOrigins: [],
    });
    await expect(authority.start("update")).resolves.toMatchObject({ global: "active" });
    expect(events).toEqual(["website-access", "website-access"]);
  });

  it("persists Origin Pause only for a currently authorized Permission Origin", async () => {
    const storage = new InMemoryStorage();
    const notifications: unknown[] = [];
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async (message) => {
          notifications.push(message);
        },
      },
    );

    await expect(
      authority.setOrigin("https://app.example.test:443", "paused"),
    ).resolves.toMatchObject({
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
    });
    await expect(
      authority.setOrigin("https://other.example.test:443", "active"),
    ).rejects.toThrow("Website access is not granted");
    expect(notifications).toEqual([{ type: "ACTIVATION_STATE_CHANGED" }]);
  });

  it("resolves a missing authorized-origin preference as Active in the authoritative snapshot", async () => {
    const storage = new InMemoryStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [],
    };
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:8443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async () => undefined,
      },
    );

    await expect(
      authority.getSnapshot("https://app.example.test:8443/customer/1"),
    ).resolves.toEqual({
      global: "active",
      page: {
        status: "available",
        origin: "https://app.example.test:8443",
        pattern: "https://app.example.test:8443/*",
        websiteAccess: true,
        originActivation: "active",
      },
    });
  });

  it("preserves dormant preferences in repository and updates management snapshot after Chrome Website Access removal", async () => {
    const storage = new InMemoryStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [
        { origin: "https://keep.example.test:443", mode: "paused" },
        { origin: "https://remove.example.test:443", mode: "active" },
      ],
    };
    const notifications: unknown[] = [];
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://keep.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async (message) => {
          notifications.push(message);
        },
      },
    );

    await authority.handleWebsiteAccessRemoved();
    const snapshot = await authority.getManagementSnapshot();
    expect(snapshot.origins).toEqual([
      { origin: "https://keep.example.test:443", originActivation: "paused" },
    ]);
    expect(notifications).toEqual([{ type: "ACTIVATION_STATE_CHANGED" }]);
  });

  it("reports a post-grant persistence failure without hiding granted Website Access", async () => {
    const storage = new InMemoryStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [],
    };
    storage.failNextSet = true;
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async () => undefined,
        requestWebsiteAccess: async () => ({
          granted: true,
          pattern: "https://app.example.test:443/*",
        }),
        ensureRegistration: async () => undefined,
        inject: async () => undefined,
      },
    );

    const permission = await authority.requestWebsiteAccess("https://app.example.test/form");
    await expect(
      authority.completeGrantedWebsiteAccess("https://app.example.test/form", 12, permission.pattern),
    ).resolves.toEqual({
      status: "incomplete",
      stage: "persistence",
      message: "storage unavailable",
    });
    await expect(
      authority.getSnapshot("https://app.example.test/form"),
    ).resolves.toMatchObject({
      page: { websiteAccess: true, originActivation: "active" },
    });
  });

  it("reports registration and injection failures at their completed-step boundary", async () => {
    const storage = new InMemoryStorage();
    let registrationFails = true;
    let injectionFails = true;
    let permissionRequests = 0;
    const authority = new ActivationAuthority(
      new ActivationRepository(storage),
      {
        getGrantedPatterns: async () => ["https://app.example.test:443/*"],
        reconcileWebsiteAccess: async () => undefined,
        broadcast: async () => undefined,
        requestWebsiteAccess: async () => {
          permissionRequests += 1;
          return {
            granted: true,
            pattern: "https://app.example.test:443/*",
          };
        },
        ensureRegistration: async () => {
          if (registrationFails) throw new Error("registration unavailable");
        },
        inject: async () => {
          if (injectionFails) throw new Error("tab navigated");
        },
      },
    );

    const permission = await authority.requestWebsiteAccess("https://app.example.test/form");
    await expect(
      authority.completeGrantedWebsiteAccess("https://app.example.test/form", 12, permission.pattern),
    ).resolves.toMatchObject({ status: "incomplete", stage: "registration" });
    registrationFails = false;
    await expect(
      authority.retryWebsiteActivation("https://app.example.test/form", 12),
    ).resolves.toMatchObject({ status: "incomplete", stage: "injection" });
    injectionFails = false;
    await expect(
      authority.retryWebsiteActivation("https://app.example.test/form", 12),
    ).resolves.toMatchObject({ status: "active" });
    expect(permissionRequests).toBe(1);
  });
});
