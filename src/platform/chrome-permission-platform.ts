import type {
  PermissionPlatform,
  RegisteredContentScript,
} from "../permissions/permission-lifecycle";

export class ChromePermissionPlatform implements PermissionPlatform {
  onRemoved(listener: (patterns: string[]) => Promise<void>): void {
    chrome.permissions.onRemoved.addListener((removed) => {
      const patterns = removed.origins ?? [];
      if (patterns.length === 0) return;
      void listener(patterns).catch((error: unknown) => {
        console.error("FillNest permission cleanup failed", error);
      });
    });
  }

  contains(pattern: string): Promise<boolean> {
    return chrome.permissions.contains({ origins: [pattern] });
  }

  request(pattern: string): Promise<boolean> {
    return chrome.permissions.request({ origins: [pattern] });
  }

  remove(pattern: string): Promise<boolean> {
    return chrome.permissions.remove({ origins: [pattern] });
  }

  removeMany(patterns: string[]): Promise<boolean> {
    return chrome.permissions.remove({ origins: patterns });
  }

  async getGrantedPatterns(): Promise<string[]> {
    const permissions = await chrome.permissions.getAll();
    return permissions.origins ?? [];
  }

  async getRegistrations(): Promise<RegisteredContentScript[]> {
    const registrations = await chrome.scripting.getRegisteredContentScripts();
    return registrations.map((registration) => ({
      id: registration.id,
      js: registration.js ?? [],
      matches: registration.matches ?? [],
      persistAcrossSessions: registration.persistAcrossSessions ?? true,
      runAt: "document_idle",
    }));
  }

  register(script: RegisteredContentScript): Promise<void> {
    return chrome.scripting.registerContentScripts([
      {
        ...script,
        allFrames: false,
      },
    ]);
  }

  unregister(ids: string[]): Promise<void> {
    return chrome.scripting.unregisterContentScripts({ ids });
  }

  async inject(tabId: number): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["assets/content-script.js"],
    });
  }

  // Task 033 Addendum E, as Addendum A did for state broadcasts: the privacy
  // policy says FillNest reads no address outside the Sites the user
  // authorized, and `query({})` returned every open tab's. No pattern means no
  // query at all - an empty `url` filter is not a promise of no match.
  async listTabIds(patterns: string[]): Promise<number[]> {
    if (patterns.length === 0) return [];
    const tabs = await chrome.tabs.query({ url: patterns });
    return tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]));
  }

  async sendRevocation(tabId: number, patterns: string[]): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "PERMISSION_REVOKED",
        patterns,
      });
    } catch {
      // Tabs without an injected FillNest content script have no receiver.
    }
  }
}
