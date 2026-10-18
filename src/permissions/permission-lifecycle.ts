import { exactOriginFromPattern, permissionOriginFromUrl } from "./permission-origin";

export interface RegisteredContentScript {
  id: string;
  js: string[];
  matches: string[];
  persistAcrossSessions: boolean;
  runAt: "document_idle";
}

export interface PermissionPlatform {
  onRemoved(listener: (patterns: string[]) => Promise<void>): void;
  contains(pattern: string): Promise<boolean>;
  request(pattern: string): Promise<boolean>;
  remove(pattern: string): Promise<boolean>;
  removeMany?(patterns: string[]): Promise<boolean>;
  getGrantedPatterns(): Promise<string[]>;
  getRegistrations(): Promise<RegisteredContentScript[]>;
  register(script: RegisteredContentScript): Promise<void>;
  unregister(ids: string[]): Promise<void>;
  inject(tabId: number): Promise<void>;
  /** The open tabs whose address matches one of these patterns; none for none. */
  listTabIds(patterns: string[]): Promise<number[]>;
  sendRevocation(tabId: number, patterns: string[]): Promise<void>;
}

export interface EnableResult {
  granted: boolean;
  pattern: string;
}

export interface RemoveWebsiteAccessResult {
  removedOrigins: string[];
}

function registrationId(pattern: string): string {
  let hash = 0x811c9dc5;

  for (const character of pattern) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fillnest-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export class PermissionLifecycle {
  constructor(
    private readonly platform: PermissionPlatform,
    private readonly afterRemoved?: (patterns: string[]) => Promise<void>,
  ) {
    this.platform.onRemoved(async (patterns) => this.handleRemoved(patterns));
  }

  async requestAccess(pageUrl: string): Promise<EnableResult> {
    const { pattern } = permissionOriginFromUrl(pageUrl);
    return { granted: await this.platform.request(pattern), pattern };
  }

  async ensureRegistration(pattern: string): Promise<void> {
    const registrations = await this.platform.getRegistrations();
    if (!registrations.some((registration) => registration.matches.includes(pattern))) {
      await this.platform.register(createRegistration(pattern));
    }
  }

  async inject(tabId: number): Promise<void> {
    await this.platform.inject(tabId);
  }

  async disableOrigins(origins: string[]): Promise<RemoveWebsiteAccessResult> {
    const uniqueOrigins = [...new Set(origins)].sort();
    if (uniqueOrigins.length === 0) return { removedOrigins: [] };
    const patterns = uniqueOrigins.map((origin) => `${origin}/*`);
    if (this.platform.removeMany) {
      const removed = await this.platform.removeMany(patterns);
      return { removedOrigins: removed ? uniqueOrigins : [] };
    }
    const removedOrigins: string[] = [];
    for (const origin of uniqueOrigins) {
      if (await this.platform.remove(`${origin}/*`)) removedOrigins.push(origin);
    }
    return { removedOrigins };
  }

  async getGrantedOrigins(): Promise<string[]> {
    const patterns = await this.platform.getGrantedPatterns();
    return [...new Set(
      patterns.map(exactOriginFromPattern).filter((origin): origin is string => origin !== null),
    )].sort();
  }

  async removeAllWebsiteAccess(): Promise<string[]> {
    const origins = await this.getGrantedOrigins();
    const { removedOrigins } = await this.disableOrigins(origins);
    // The permissions event normally unregisters these scripts. Reconcile is
    // also required here because the Reset success invariant includes no
    // FillNest registration surviving a removed permission.
    await this.reconcile();
    // Chrome dispatches permissions.onRemoved independently of the remove()
    // promise. Reset must not report success while an already-open page still
    // exposes an operable Picker merely because that event has not run yet.
    // Deliver the same idempotent revocation explicitly for the permissions
    // this call actually removed; the event path remains the external-removal
    // fallback and may harmlessly deliver it again.
    await this.notifyRevokedPatterns(removedOrigins.map((origin) => `${origin}/*`));
    return origins;
  }

  async reconcile(): Promise<void> {
    const [grantedPatterns, registrations] = await Promise.all([
      this.platform.getGrantedPatterns(),
      this.platform.getRegistrations(),
    ]);
    const exactGrantedPatterns = grantedPatterns.filter((pattern) => exactOriginFromPattern(pattern) !== null);
    const staleIds = registrations
      .filter(
        (registration) =>
          registration.id.startsWith("fillnest-") &&
          !registration.matches.some((match) => exactGrantedPatterns.includes(match)),
      )
      .map((registration) => registration.id);

    await this.unregisterIfPresent(staleIds);

    for (const pattern of exactGrantedPatterns) {
      const alreadyRegistered = registrations.some((registration) =>
        registration.matches.includes(pattern),
      );
      if (!alreadyRegistered) await this.platform.register(createRegistration(pattern));
    }

    // Task 033 Addendum E: only the tabs the registrations above cover. Asking
    // for every tab read each one's address, on every start of the worker,
    // to try injecting into pages FillNest may not touch.
    const tabIds = await this.platform.listTabIds(exactGrantedPatterns);
    await Promise.allSettled(tabIds.map((tabId) => this.platform.inject(tabId)));
  }

  private async handleRemoved(patterns: string[]): Promise<void> {
    const registrations = await this.platform.getRegistrations();
    const removedRegistrationIds = registrations
      .filter((registration) =>
        registration.matches.some((match) => patterns.includes(match)),
      )
      .map((registration) => registration.id);

    await this.unregisterIfPresent(removedRegistrationIds);

    await this.notifyRevokedPatterns(patterns);
    await this.afterRemoved?.(patterns);
  }

  /**
   * Unregister scripts that may already be gone.
   *
   * Removing a permission has two independent unregistration paths: this
   * class reconciles registrations itself, and Chrome dispatches
   * `permissions.onRemoved` on its own schedule, which reconciles again.
   * Both compute the same stale ids, so whichever loses the race is told
   * "Nonexistent script ID". That is the end state both were asking for, not
   * a failure - but it was propagating out of Reset, which then reported the
   * raw Chrome message and aborted.
   *
   * Chrome rejects the whole batch when any id in it is unknown, so this does
   * not simply absorb the error: it re-reads the registrations and retries
   * with whatever is genuinely still registered, otherwise a batch containing
   * one already-removed id would silently leave the rest behind.
   */
  private async unregisterIfPresent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.platform.unregister(ids);
      return;
    } catch (error) {
      if (!isMissingScriptError(error)) throw error;
    }

    const stillRegistered = new Set(
      (await this.platform.getRegistrations()).map((registration) => registration.id),
    );
    const remaining = ids.filter((id) => stillRegistered.has(id));
    if (remaining.length === 0) return;
    try {
      await this.platform.unregister(remaining);
    } catch (error) {
      if (!isMissingScriptError(error)) throw error;
    }
  }

  private async notifyRevokedPatterns(patterns: string[]): Promise<void> {
    if (patterns.length === 0) return;
    // A page FillNest ran on is still on the address that was revoked.
    const tabIds = await this.platform.listTabIds(patterns);
    await Promise.all(
      tabIds.map(async (tabId) => this.platform.sendRevocation(tabId, patterns)),
    );
  }
}

function createRegistration(pattern: string): RegisteredContentScript {
  return {
    id: registrationId(pattern),
    js: ["assets/content-script.js"],
    matches: [pattern],
    persistAcrossSessions: true,
    runAt: "document_idle",
  };
}

function isMissingScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /nonexistent script id/iu.test(message);
}
