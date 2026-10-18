import { describe, expect, it } from "vitest";

import {
  ActivationRepository,
  type ActivationStorageArea,
} from "../../src/activation/activation-repository";

class InMemoryActivationStorage implements ActivationStorageArea {
  readonly values: Record<string, unknown> = {};
  setCount = 0;

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.setCount += 1;
    Object.assign(this.values, structuredClone(items));
  }
}

describe("ActivationRepository", () => {
  it("initializes a fresh installation globally Paused with no Origin Activation", async () => {
    const storage = new InMemoryActivationStorage();
    const repository = new ActivationRepository(storage);

    const state = await repository.initialize({
      installationReason: "install",
      grantedPatterns: [],
    });

    expect(state).toEqual({
      schemaVersion: 1,
      global: "paused",
      origins: [],
      dormantOrigins: [],
    });
    expect(storage.values.fillnestActivation).toEqual(state);
    expect(storage.setCount).toBe(1);
  });

  it("migrates a Task 001 update to Active for every exact granted Permission Origin", async () => {
    const storage = new InMemoryActivationStorage();
    const businessState = {
      schemaVersion: 1,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
    };
    storage.values.fillnestState = structuredClone(businessState);
    const repository = new ActivationRepository(storage);

    const state = await repository.initialize({
      installationReason: "update",
      grantedPatterns: [
        "https://app.example.test:443/*",
        "https://admin.example.test:8443/*",
        "https://*/*",
      ],
    });

    expect(state).toEqual({
      schemaVersion: 1,
      global: "active",
      origins: [
        { origin: "https://admin.example.test:8443", mode: "active" },
        { origin: "https://app.example.test:443", mode: "active" },
      ],
      dormantOrigins: [],
    });
    expect(storage.values.fillnestState).toEqual(businessState);
  });

  it("preserves an existing activation record without rewriting user preferences", async () => {
    const storage = new InMemoryActivationStorage();
    const existing = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
      dormantOrigins: [],
    };
    storage.values.fillnestActivation = structuredClone(existing);
    const repository = new ActivationRepository(storage);

    const state = await repository.initialize({
      installationReason: "update",
      grantedPatterns: ["https://app.example.test:443/*"],
    });

    expect(state).toEqual(existing);
    expect(storage.setCount).toBe(0);
  });

  it("rejects malformed persisted activation data without overwriting it", async () => {
    const storage = new InMemoryActivationStorage();
    const malformed = {
      schemaVersion: 1,
      global: "sometimes",
      origins: [],
    };
    storage.values.fillnestActivation = structuredClone(malformed);
    const repository = new ActivationRepository(storage);

    await expect(
      repository.initialize({ installationReason: "update", grantedPatterns: [] }),
    ).rejects.toThrow("Invalid FillNest activation state");
    expect(storage.values.fillnestActivation).toEqual(malformed);
    expect(storage.setCount).toBe(0);
  });

  it("reconciles granted origins while preserving existing Pause and dormant preferences", async () => {
    const storage = new InMemoryActivationStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [
        { origin: "https://keep.example.test:443", mode: "paused" },
      ],
      dormantOrigins: [
        { origin: "https://dormant.example.test:443", mode: "paused" },
      ],
    };
    const repository = new ActivationRepository(storage);

    const state = await repository.reconcile([
      "https://new.example.test:443/*",
      "https://keep.example.test:443/*",
    ]);

    expect(state).toEqual({
      schemaVersion: 1,
      global: "active",
      origins: [
        { origin: "https://keep.example.test:443", mode: "paused" },
        { origin: "https://new.example.test:443", mode: "active" },
      ],
      dormantOrigins: [
        { origin: "https://dormant.example.test:443", mode: "paused" },
      ],
    });
    expect(storage.setCount).toBe(1);

    await expect(repository.reconcile([
      "https://keep.example.test:443/*",
      "https://new.example.test:443/*",
    ])).resolves.toEqual(state);
    expect(storage.setCount).toBe(1);
  });

  it("persists Global Activation transitions without changing origin preferences", async () => {
    const storage = new InMemoryActivationStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
      dormantOrigins: [],
    };
    const repository = new ActivationRepository(storage);

    await expect(repository.setGlobal("paused")).resolves.toEqual({
      schemaVersion: 1,
      global: "paused",
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
      dormantOrigins: [],
    });
    expect(storage.setCount).toBe(1);
  });

  it("changes Origin Activation only while Website Access remains granted", async () => {
    const storage = new InMemoryActivationStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "active" }],
      dormantOrigins: [],
    };
    const repository = new ActivationRepository(storage);
    const grantedPatterns = ["https://app.example.test:443/*"];

    await expect(
      repository.setOrigin("https://app.example.test:443", "paused", grantedPatterns),
    ).resolves.toMatchObject({
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
    });
    await expect(
      repository.setOrigin("https://revoked.example.test:443", "active", grantedPatterns),
    ).rejects.toThrow("Website access is not granted");
    expect(storage.setCount).toBe(1);
  });

  it("serializes concurrent Global and Origin transitions without losing either action", async () => {
    const storage = new InMemoryActivationStorage();
    storage.values.fillnestActivation = {
      schemaVersion: 1,
      global: "active",
      origins: [{ origin: "https://app.example.test:443", mode: "active" }],
      dormantOrigins: [],
    };
    const repository = new ActivationRepository(storage);

    await Promise.all([
      repository.setGlobal("paused"),
      repository.setOrigin(
        "https://app.example.test:443",
        "paused",
        ["https://app.example.test:443/*"],
      ),
    ]);

    await expect(repository.read()).resolves.toEqual({
      schemaVersion: 1,
      global: "paused",
      origins: [{ origin: "https://app.example.test:443", mode: "paused" }],
      dormantOrigins: [],
    });
  });
});
