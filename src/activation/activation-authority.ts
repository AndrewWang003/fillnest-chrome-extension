import {
  type ActivationMode,
  type ActivationState,
  ActivationRepository,
} from "./activation-repository";
import { exactOriginFromPattern, permissionOriginFromUrl } from "../permissions/permission-origin";

export interface ActivationStateChangedMessage {
  type: "ACTIVATION_STATE_CHANGED";
}

export interface ActivationAuthorityPlatform {
  getGrantedPatterns(): Promise<string[]>;
  reconcileWebsiteAccess(): Promise<void>;
  broadcast(message: ActivationStateChangedMessage): Promise<void>;
  requestWebsiteAccess?(pageUrl: string): Promise<{ granted: boolean; pattern: string }>;
  ensureRegistration?(pattern: string): Promise<void>;
  inject?(tabId: number): Promise<void>;
}

export type AllowWebsiteAccessResult =
  | { status: "denied" }
  | { status: "active"; state: ActivationState }
  | {
      status: "incomplete";
      stage: "persistence" | "registration" | "injection";
      message: string;
    };

export type ActivationSnapshot = {
  global: ActivationMode;
  page:
    | { status: "unavailable" }
    | {
        status: "available";
        origin: string;
        pattern: string;
        websiteAccess: boolean;
        originActivation: ActivationMode;
      };
};

export interface ActivationManagementSnapshot {
  global: ActivationMode;
  origins: Array<{ origin: string; originActivation: ActivationMode }>;
}

export class ActivationAuthority {
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: ActivationRepository,
    private readonly platform: ActivationAuthorityPlatform,
  ) {}

  async start(reason: "install" | "update"): Promise<ActivationState> {
    return this.runOperation(async () => {
      const grantedPatterns = await this.platform.getGrantedPatterns();
      await this.repository.initialize({
        installationReason: reason,
        grantedPatterns,
      });
      await this.platform.reconcileWebsiteAccess();
      return this.repository.reconcile(await this.platform.getGrantedPatterns());
    });
  }

  async reconcileExisting(): Promise<ActivationState> {
    return this.runOperation(async () => {
      await this.repository.read();
      await this.platform.reconcileWebsiteAccess();
      return this.repository.reconcile(await this.platform.getGrantedPatterns());
    });
  }

  async setGlobal(mode: ActivationMode): Promise<ActivationState> {
    const previous = await this.repository.read();
    const state = await this.repository.setGlobal(mode);
    if (JSON.stringify(state) !== JSON.stringify(previous)) {
      await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
    }
    return state;
  }

  async setOrigin(origin: string, mode: ActivationMode): Promise<ActivationState> {
    const previous = await this.repository.read();
    const state = await this.repository.setOrigin(
      origin,
      mode,
      await this.platform.getGrantedPatterns(),
    );
    if (JSON.stringify(state) !== JSON.stringify(previous)) {
      await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
    }
    return state;
  }

  async getSnapshot(pageUrl?: string | null): Promise<ActivationSnapshot> {
    const state = await this.repository.read();
    if (!pageUrl) return { global: state.global, page: { status: "unavailable" } };

    let permissionOrigin: ReturnType<typeof permissionOriginFromUrl>;
    try {
      permissionOrigin = permissionOriginFromUrl(pageUrl);
    } catch {
      return { global: state.global, page: { status: "unavailable" } };
    }

    const grantedPatterns = await this.platform.getGrantedPatterns();
    const websiteAccess = grantedPatterns.includes(permissionOrigin.pattern);
    const preference = state.origins.find(
      (record) => record.origin === permissionOrigin.origin,
    );
    return {
      global: state.global,
      page: {
        status: "available",
        ...permissionOrigin,
        websiteAccess,
        originActivation: websiteAccess ? (preference?.mode ?? "active") : "paused",
      },
    };
  }

  async getManagementSnapshot(): Promise<ActivationManagementSnapshot> {
    const state = await this.repository.read();
    const preferences = new Map(state.origins.map((record) => [record.origin, record.mode]));
    const origins = (await this.platform.getGrantedPatterns())
      .map(exactOriginFromPattern)
      .filter((origin): origin is string => origin !== null)
      .sort()
      .map((origin) => ({
        origin,
        originActivation: preferences.get(origin) ?? "active",
      }));
    return { global: state.global, origins };
  }

  async handleWebsiteAccessRemoved(): Promise<ActivationState> {
    const grantedPatterns = await this.platform.getGrantedPatterns();
    const grantedOrigins = new Set(
      grantedPatterns
        .map(exactOriginFromPattern)
        .filter((origin): origin is string => origin !== null),
    );
    const current = await this.repository.read();
    const revoked = current.origins
      .filter((record) => !grantedOrigins.has(record.origin))
      .map((record) => record.origin);
    const state = await this.repository.removeOrigins(revoked);
    await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
    return state;
  }

  /** Must be called in the originating click stack; Chrome rejects a delayed permission request. */
  async requestWebsiteAccess(pageUrl: string): Promise<{ granted: boolean; pattern: string }> {
    const request = this.platform.requestWebsiteAccess;
    if (!request) throw new Error("Website Access operations are unavailable");
    return request(pageUrl);
  }

  /** Serializes the durable work after Website Access was granted. */
  async completeGrantedWebsiteAccess(
    pageUrl: string,
    tabId: number,
    pattern: string,
  ): Promise<AllowWebsiteAccessResult> {
    return this.runOperation(() => this.completeWebsiteActivation(pageUrl, tabId, pattern));
  }

  async retryWebsiteActivation(
    pageUrl: string,
    tabId: number,
  ): Promise<AllowWebsiteAccessResult> {
    const { pattern } = permissionOriginFromUrl(pageUrl);
    if (!(await this.platform.getGrantedPatterns()).includes(pattern)) {
      return { status: "denied" };
    }
    return this.runOperation(() =>
      this.completeWebsiteActivation(pageUrl, tabId, pattern),
    );
  }

  private async completeWebsiteActivation(
    pageUrl: string,
    tabId: number,
    pattern: string,
  ): Promise<AllowWebsiteAccessResult> {
    const ensureRegistration = this.platform.ensureRegistration;
    const inject = this.platform.inject;
    if (!ensureRegistration || !inject) {
      throw new Error("Website Access operations are unavailable");
    }
    const { origin } = permissionOriginFromUrl(pageUrl);

    const current = await this.repository.read();
    const dormant = current.dormantOrigins.find((d) => d.origin === origin);
    const mode = dormant ? dormant.mode : "active";

    let state: ActivationState;
    try {
      state = await this.repository.setOrigin(
        origin,
        mode,
        await this.platform.getGrantedPatterns(),
      );
    } catch (error) {
      return incomplete("persistence", error);
    }

    try {
      await ensureRegistration(pattern);
    } catch (error) {
      await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
      return incomplete("registration", error);
    }

    try {
      await inject(tabId);
    } catch (error) {
      await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
      return incomplete("injection", error);
    }

    await this.platform.broadcast({ type: "ACTIVATION_STATE_CHANGED" });
    return { status: "active", state };
  }

  private runOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function incomplete(
  stage: "persistence" | "registration" | "injection",
  error: unknown,
): AllowWebsiteAccessResult {
  return {
    status: "incomplete",
    stage,
    message: error instanceof Error ? error.message : "Unknown FillNest error",
  };
}
