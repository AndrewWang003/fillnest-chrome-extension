import { describe, expect, it } from "vitest";

import type { PermissionLifecycle } from "../../src/permissions/permission-lifecycle";
import { RemoveSiteTransactionCoordinator } from "../../src/sites/remove-site-transaction";
import { FillNestRepository, type LocalStorageArea } from "../../src/storage/fillnest-repository";

class MemoryStorage implements LocalStorageArea {
  private readonly values = new Map<string, unknown>();
  async get(key: string): Promise<Record<string, unknown>> { return this.values.has(key) ? { [key]: this.values.get(key) } : {}; }
  async set(items: Record<string, unknown>): Promise<void> { for (const [key, value] of Object.entries(items)) this.values.set(key, value); }
  async remove(key: string): Promise<void> { this.values.delete(key); }
}

describe("RemoveSiteTransactionCoordinator", () => {
  it("restores the exact local state when Chrome cannot remove every selected origin", async () => {
    const storage = new MemoryStorage();
    const repository = new FillNestRepository(storage);
    const initial = await repository.read();
    const state = {
      ...initial,
      sites: [{ id: "example.test" as const }],
      templates: [{ id: "template-1", content: "Keep me", siteAffinities: ["example.test" as const], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" as const }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
      bindings: [{ id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 }],
    };
    await repository.replaceState(state);
    const permissions = { disableOrigins: async () => ({ removedOrigins: [] }) } as unknown as PermissionLifecycle;
    const coordinator = new RemoveSiteTransactionCoordinator(storage, repository, permissions);

    await expect(coordinator.execute(["https://example.test:443"], [{ siteId: "example.test", expectedImpact: { pageProfileCount: 1, fieldProfileCount: 1, bindingCount: 1, pageAliasCount: 0, fieldAliasCount: 0, templateAffinityCount: 1, logicalPageRuleCount: 0, sharedTemplateSetCount: 0 } }]))
      .rejects.toThrow("Your saved Site data was restored");

    expect(await repository.read()).toEqual(state);
  });
});
