import { describe, expect, it } from "vitest";

import { DISMISSED_TIPS_STORAGE_KEY, TipsRepository } from "../../src/guidance/tips-repository";

// Task 042: which first-use tips were dismissed, so each appears once.

function storage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    async get(key: string) {
      return { [key]: data[key] };
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items);
    },
    async remove(key: string) {
      delete data[key];
    },
  };
}

describe("TipsRepository", () => {
  it("remembers each dismissed tip once", async () => {
    const area = storage();
    const tips = new TipsRepository(area);
    expect(await tips.read()).toEqual([]);
    expect(await tips.dismiss("popup-start")).toEqual(["popup-start"]);
    expect(await tips.dismiss("popup-start")).toEqual(["popup-start"]);
    expect(await tips.dismiss("sites")).toEqual(["popup-start", "sites"]);
    expect(area.data[DISMISSED_TIPS_STORAGE_KEY]).toEqual(["popup-start", "sites"]);
  });

  it("reads stored nonsense as nothing dismissed, keeping only known tips", async () => {
    expect(await new TipsRepository(storage({ [DISMISSED_TIPS_STORAGE_KEY]: "all" })).read()).toEqual([]);
    expect(await new TipsRepository(storage({ [DISMISSED_TIPS_STORAGE_KEY]: ["sites", "made-up", 3] })).read()).toEqual(["sites"]);
  });

  it("reads a failing store as nothing dismissed", async () => {
    const failing = { ...storage(), get: async () => { throw new Error("gone"); } };
    expect(await new TipsRepository(failing).read()).toEqual([]);
  });

  it("clears, which is what Show tips again and Reset need", async () => {
    const area = storage({ [DISMISSED_TIPS_STORAGE_KEY]: ["sites"] });
    await new TipsRepository(area).clear();
    expect(area.data).toEqual({});
  });
});
