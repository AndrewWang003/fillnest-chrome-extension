import { describe, expect, it } from "vitest";

import {
  APPEARANCE_STORAGE_KEY,
  AppearanceRepository,
} from "../../src/appearance/appearance-repository";
import { DEFAULT_APPEARANCE } from "../../src/ui/theme/theme-tokens";

function memoryStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    },
    remove: async (key: string) => {
      delete store[key];
    },
  };
}

describe("AppearanceRepository (Task 034)", () => {
  it("returns the default palette when nothing has been chosen", async () => {
    const repository = new AppearanceRepository(memoryStorage());
    expect(await repository.read()).toEqual(DEFAULT_APPEARANCE);
  });

  it("round-trips a chosen theme and mode", async () => {
    const storage = memoryStorage();
    const repository = new AppearanceRepository(storage);
    await repository.write({ themeId: "ocean", mode: "dark" });
    expect(await repository.read()).toEqual({ themeId: "ocean", mode: "dark" });
    expect(storage.store[APPEARANCE_STORAGE_KEY]).toEqual({ themeId: "ocean", mode: "dark" });
  });

  it("falls back per field rather than discarding a half-valid preference", async () => {
    const repository = new AppearanceRepository(
      memoryStorage({ [APPEARANCE_STORAGE_KEY]: { themeId: "forest", mode: "sepia" } }),
    );
    expect(await repository.read()).toEqual({ themeId: "forest", mode: DEFAULT_APPEARANCE.mode });
  });

  it("normalizes what it writes, so an unknown theme can never reach storage", async () => {
    const storage = memoryStorage();
    const repository = new AppearanceRepository(storage);
    await repository.write({ themeId: "neon" as never, mode: "light" });
    expect(storage.store[APPEARANCE_STORAGE_KEY]).toEqual({
      themeId: DEFAULT_APPEARANCE.themeId,
      mode: "light",
    });
  });

  it("treats an unreadable store as the default rather than an error the user must act on", async () => {
    const repository = new AppearanceRepository({
      get: async () => {
        throw new Error("storage unavailable");
      },
      set: async () => undefined,
      remove: async () => undefined,
    });
    expect(await repository.read()).toEqual(DEFAULT_APPEARANCE);
  });

  it("clears back to the default", async () => {
    const storage = memoryStorage({ [APPEARANCE_STORAGE_KEY]: { themeId: "plum", mode: "dark" } });
    const repository = new AppearanceRepository(storage);
    await repository.clear();
    expect(APPEARANCE_STORAGE_KEY in storage.store).toBe(false);
    expect(await repository.read()).toEqual(DEFAULT_APPEARANCE);
  });
});
