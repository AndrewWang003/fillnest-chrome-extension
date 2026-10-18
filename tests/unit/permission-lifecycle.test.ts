import { describe, expect, it } from "vitest";

import {
  PermissionLifecycle,
  type PermissionPlatform,
  type RegisteredContentScript,
} from "../../src/permissions/permission-lifecycle";
import {
  FillNestRepository,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";

class InMemoryLocalStorage implements LocalStorageArea {
  readonly values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: this.values[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(items));
  }

  async remove(key: string): Promise<void> {
    delete this.values[key];
  }
}

class InMemoryPermissionPlatform implements PermissionPlatform {
  readonly grantedPatterns = new Set<string>();
  readonly registrations = new Map<string, RegisteredContentScript>();
  readonly injectedTabs: number[] = [];
  readonly revocations: Array<{ tabId: number; patterns: string[] }> = [];
  readonly tabIds = [11, 12];
  /** The patterns each tab lookup asked for (Task 033 Addendum E). */
  readonly tabQueries: string[][] = [];
  emitRemovalEvents = true;
  private readonly removalListeners: Array<
    (patterns: string[]) => Promise<void>
  > = [];

  onRemoved(listener: (patterns: string[]) => Promise<void>): void {
    this.removalListeners.push(listener);
  }

  async contains(pattern: string): Promise<boolean> {
    return this.grantedPatterns.has(pattern);
  }

  async request(pattern: string): Promise<boolean> {
    this.grantedPatterns.add(pattern);
    return true;
  }

  async remove(pattern: string): Promise<boolean> {
    const removed = this.grantedPatterns.delete(pattern);
    if (removed && this.emitRemovalEvents) {
      for (const listener of this.removalListeners) await listener([pattern]);
    }
    return removed;
  }

  async getGrantedPatterns(): Promise<string[]> {
    return [...this.grantedPatterns];
  }

  async getRegistrations(): Promise<RegisteredContentScript[]> {
    return [...this.registrations.values()];
  }

  async register(script: RegisteredContentScript): Promise<void> {
    this.registrations.set(script.id, script);
  }

  async unregister(ids: string[]): Promise<void> {
    // Faithful to chrome.scripting.unregisterContentScripts: an unknown id
    // rejects the whole batch and unregisters nothing. A forgiving double is
    // why the Reset race below went unnoticed.
    const missing = ids.find((id) => !this.registrations.has(id));
    if (missing !== undefined) throw new Error(`Nonexistent script ID '${missing}'`);
    for (const id of ids) this.registrations.delete(id);
  }

  async inject(tabId: number): Promise<void> {
    this.injectedTabs.push(tabId);
  }

  // The tabs on these patterns. Matching an address to a pattern is Chrome's
  // job, so the double answers every non-empty lookup with all its tabs.
  async listTabIds(patterns: string[]): Promise<number[]> {
    this.tabQueries.push(patterns);
    return patterns.length > 0 ? this.tabIds : [];
  }

  async sendRevocation(tabId: number, patterns: string[]): Promise<void> {
    this.revocations.push({ tabId, patterns });
  }
}

describe("PermissionLifecycle", () => {
  // Task 033 Addendum E. The privacy policy says FillNest reads the address of
  // no tab outside the Sites the user authorized. Reconciling and revoking
  // used to ask Chrome for every open tab.
  it("asks only for the tabs a reconciliation or a revocation concerns", async () => {
    const platform = new InMemoryPermissionPlatform();
    const lifecycle = new PermissionLifecycle(platform);
    platform.grantedPatterns.add("https://a.test:443/*");
    // A broad grant made in Chrome's own settings is not Website Access, and
    // FillNest registers nothing for it.
    platform.grantedPatterns.add("https://*/*");

    await lifecycle.reconcile();
    await lifecycle.disableOrigins(["https://a.test:443"]);

    expect(platform.tabQueries).toEqual([["https://a.test:443/*"], ["https://a.test:443/*"]]);
  });

  it("activates no tab when no Site is authorized", async () => {
    const platform = new InMemoryPermissionPlatform();
    const lifecycle = new PermissionLifecycle(platform);

    await lifecycle.reconcile();

    expect(platform.injectedTabs).toEqual([]);
  });

  it("grants and activates only the current exact origin", async () => {
    const platform = new InMemoryPermissionPlatform();
    const lifecycle = new PermissionLifecycle(platform);

    // Mirrors the production grant sequence ActivationAuthority drives:
    // request in the click stack, then register, then inject.
    const result = await lifecycle.requestAccess("http://127.0.0.1:4173/customer/42");
    await lifecycle.ensureRegistration(result.pattern);
    await lifecycle.inject(23);

    expect(result).toEqual({
      granted: true,
      pattern: "http://127.0.0.1:4173/*",
    });
    expect([...platform.grantedPatterns]).toEqual([
      "http://127.0.0.1:4173/*",
    ]);
    expect([...platform.registrations.values()]).toEqual([
      {
        id: expect.stringMatching(/^fillnest-[a-f0-9]{8}$/),
        js: ["assets/content-script.js"],
        matches: ["http://127.0.0.1:4173/*"],
        persistAcrossSessions: true,
        runAt: "document_idle",
      },
    ]);
    expect(platform.injectedTabs).toEqual([23]);
    // A sibling port is a different Permission Origin and stays ungranted.
    await expect(platform.contains("http://127.0.0.1:4174/*")).resolves.toBe(false);
  });

  it("routes access removal through the shared permission-removal cleanup", async () => {
    const platform = new InMemoryPermissionPlatform();
    const lifecycle = new PermissionLifecycle(platform);
    const granted = await lifecycle.requestAccess("http://127.0.0.1:4173/customer/42");
    await lifecycle.ensureRegistration(granted.pattern);

    await lifecycle.disableOrigins(["http://127.0.0.1:4173"]);

    expect([...platform.grantedPatterns]).toEqual([]);
    expect([...platform.registrations.values()]).toEqual([]);
    expect(platform.revocations).toEqual([
      { tabId: 11, patterns: ["http://127.0.0.1:4173/*"] },
      { tabId: 12, patterns: ["http://127.0.0.1:4173/*"] },
    ]);
  });

  it("Reset removal explicitly notifies live tabs without waiting for Chrome's removal event", async () => {
    const platform = new InMemoryPermissionPlatform();
    const lifecycle = new PermissionLifecycle(platform);
    const granted = await lifecycle.requestAccess("https://app.example.test/customer/42");
    await lifecycle.ensureRegistration(granted.pattern);
    platform.emitRemovalEvents = false;

    await expect(lifecycle.removeAllWebsiteAccess()).resolves.toEqual([
      "https://app.example.test:443",
    ]);

    expect(platform.revocations).toEqual([
      { tabId: 11, patterns: ["https://app.example.test:443/*"] },
      { tabId: 12, patterns: ["https://app.example.test:443/*"] },
    ]);
  });

  it("reconciles persistent registrations with Chrome-granted origins", async () => {
    const platform = new InMemoryPermissionPlatform();
    platform.grantedPatterns.add("https://forms.example.test:443/*");
    platform.registrations.set("fillnest-stale", {
      id: "fillnest-stale",
      js: ["assets/content-script.js"],
      matches: ["https://removed.example.test:443/*"],
      persistAcrossSessions: true,
      runAt: "document_idle",
    });

    const lifecycle = new PermissionLifecycle(platform);
    await lifecycle.reconcile();

    expect([...platform.registrations.values()]).toEqual([
      {
        id: expect.stringMatching(/^fillnest-[a-f0-9]{8}$/),
        js: ["assets/content-script.js"],
        matches: ["https://forms.example.test:443/*"],
        persistAcrossSessions: true,
        runAt: "document_idle",
      },
    ]);
    expect(platform.injectedTabs).toEqual([11, 12]);
  });

  it("notifies activation authority after external Website Access cleanup", async () => {
    const platform = new InMemoryPermissionPlatform();
    const cleanedPatterns: string[][] = [];
    const lifecycle = new PermissionLifecycle(platform, async (patterns) => {
      cleanedPatterns.push(patterns);
    });
    const granted = await lifecycle.requestAccess("https://app.example.test/customer/42");
    await lifecycle.ensureRegistration(granted.pattern);

    await lifecycle.disableOrigins(["https://app.example.test:443"]);

    expect(cleanedPatterns).toEqual([["https://app.example.test:443/*"]]);
  });

  it("never requests a wildcard or broader-than-single-origin permission pattern", async () => {
    const platform = new InMemoryPermissionPlatform();
    const requestedPatterns: string[] = [];
    const originalRequest = platform.request.bind(platform);
    platform.request = async (pattern: string) => {
      requestedPatterns.push(pattern);
      return originalRequest(pattern);
    };
    const lifecycle = new PermissionLifecycle(platform);

    await requestRegisterAndInject(lifecycle, "https://app.example.test/customer/42", 23);
    await requestRegisterAndInject(lifecycle, "http://127.0.0.1:4173/customer/42", 24);
    await requestRegisterAndInject(lifecycle, "https://sub.example.test:8443/deep/path?x=1", 25);

    expect(requestedPatterns).toEqual([
      "https://app.example.test:443/*",
      "http://127.0.0.1:4173/*",
      "https://sub.example.test:8443/*",
    ]);

    // Every requested pattern is an exact single origin (scheme://host:port/*)
    // and never a broad or wildcard-host pattern.
    const forbiddenPatterns = ["<all_urls>", "*://*/*", "http://*/*", "https://*/*"];
    for (const pattern of requestedPatterns) {
      expect(forbiddenPatterns).not.toContain(pattern);
      expect(pattern).toMatch(/^https?:\/\/[^*]+:\d+\/\*$/);
      // The only "*" in the pattern is the trailing path wildcard - the host
      // portion is always the exact requested hostname, never a wildcard host.
      expect(pattern.indexOf("*")).toBe(pattern.length - 1);
    }
  });

  it("leaves a Template's siteAffinities byte-exact when the Site's last granted origin is revoked", async () => {
    // Task 007 Slice 2 gap: PermissionLifecycle's onRemoved path only ever
    // notifies the Activation authority (see service-worker.ts's afterRemoved
    // wiring) and never touches the Template repository. This proves that
    // decoupling holds end-to-end: after the only granted origin for a Site
    // is revoked, the Template's siteAffinities array is unchanged - not
    // reset to [] (Global), not reordered, not deduplicated differently.
    const businessStorage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(businessStorage, {
      createId: () => "template-001",
      now: () => "2026-08-08T06:00:00.000Z",
    });
    const created = await repository.createTemplate({
      content: "Jordan Lee",
      pageUrl: "https://example.test/customer/42",
    });
    const originalSiteAffinities = structuredClone(created.siteAffinities);

    const permissionPlatform = new InMemoryPermissionPlatform();
    let notifiedRemovedPatterns: string[] | null = null;
    const lifecycle = new PermissionLifecycle(permissionPlatform, async (patterns) => {
      notifiedRemovedPatterns = patterns;
      // Mirrors the production wiring in service-worker.ts: only the
      // Activation authority is notified here. The repository is
      // intentionally never referenced from this callback.
    });
    await requestRegisterAndInject(lifecycle, "https://example.test/customer/42", 11);
    expect([...permissionPlatform.grantedPatterns]).toEqual(["https://example.test:443/*"]);

    // Chrome revokes the only granted origin for this Site from outside the
    // extension (the user removed it from chrome://extensions, or it was the
    // Site's last remaining Website Access grant).
    await permissionPlatform.remove("https://example.test:443/*");
    expect(notifiedRemovedPatterns).toEqual(["https://example.test:443/*"]);

    const afterRevocation = await repository.read();
    const template = afterRevocation.templates.find((candidate) => candidate.id === created.id);
    expect(template?.siteAffinities).toEqual(originalSiteAffinities);
    expect(template?.siteAffinities).toEqual(["example.test"]);
    expect(template?.siteAffinities).not.toEqual([]);
  });
});

async function requestRegisterAndInject(
  lifecycle: PermissionLifecycle,
  pageUrl: string,
  tabId: number,
): Promise<void> {
  const permission = await lifecycle.requestAccess(pageUrl);
  if (!permission.granted) return;
  await lifecycle.ensureRegistration(permission.pattern);
  await lifecycle.inject(tabId);
}

// Task 009 Addendum A.1. Removing a permission has two independent
// unregistration paths - this class's own reconcile, and Chrome dispatching
// permissions.onRemoved on its own schedule. Both compute the same stale ids,
// so whichever loses the race is told "Nonexistent script ID". That error was
// propagating out of Reset, which reported the raw Chrome message and aborted.
//
// Found by the headed Factory Reset E2E, which failed twice in eight full
// suites and passed in isolation, and was read as a timing flake until the
// assertion was changed to surface the dialog's own error text.
describe("PermissionLifecycle: concurrent unregistration", () => {
  class RacingPlatform extends InMemoryPermissionPlatform {
    /** Ids another path removes between our read and our unregister call. */
    readonly removedBehindOurBack = new Set<string>();

    override async getRegistrations(): Promise<RegisteredContentScript[]> {
      const registrations = await super.getRegistrations();
      for (const id of this.removedBehindOurBack) this.registrations.delete(id);
      this.removedBehindOurBack.clear();
      return registrations;
    }
  }

  async function grantAndRegister(
    lifecycle: PermissionLifecycle,
    pattern: string,
  ): Promise<void> {
    await lifecycle.requestAccess(pattern.replace("/*", "/page"));
    await lifecycle.ensureRegistration(pattern);
  }

  it("completes when another path already unregistered the same scripts", async () => {
    const platform = new RacingPlatform();
    platform.emitRemovalEvents = false;
    const lifecycle = new PermissionLifecycle(platform);
    await grantAndRegister(lifecycle, "https://example.test:443/*");
    const registeredId = [...platform.registrations.keys()][0]!;

    // Reconcile reads the registrations, then the permissions event handler
    // unregisters them before this call gets there.
    platform.removedBehindOurBack.add(registeredId);

    await expect(lifecycle.removeAllWebsiteAccess()).resolves.toEqual([
      "https://example.test:443",
    ]);
    expect(platform.registrations.size).toBe(0);
  });

  it("still removes the registrations that are genuinely present", async () => {
    const platform = new RacingPlatform();
    platform.emitRemovalEvents = false;
    const lifecycle = new PermissionLifecycle(platform);
    await grantAndRegister(lifecycle, "https://example.test:443/*");
    await grantAndRegister(lifecycle, "https://other.test:443/*");
    expect(platform.registrations.size).toBe(2);
    const [firstId] = [...platform.registrations.keys()];

    // Chrome rejects the whole batch when one id is unknown, so absorbing the
    // error without retrying would leave the second registration behind.
    platform.removedBehindOurBack.add(firstId!);

    await lifecycle.removeAllWebsiteAccess();
    expect(platform.registrations.size).toBe(0);
  });

  it("still reports an unregistration failure that is not the race", async () => {
    class FailingPlatform extends InMemoryPermissionPlatform {
      override async unregister(): Promise<void> {
        throw new Error("Extension context invalidated");
      }
    }
    const platform = new FailingPlatform();
    platform.emitRemovalEvents = false;
    const lifecycle = new PermissionLifecycle(platform);
    await grantAndRegister(lifecycle, "https://example.test:443/*");
    platform.grantedPatterns.clear();

    await expect(lifecycle.reconcile()).rejects.toThrow("Extension context invalidated");
  });
});

