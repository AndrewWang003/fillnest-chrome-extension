import { exactOriginFromPattern } from "../permissions/permission-origin";

const ACTIVATION_STORAGE_KEY = "fillnestActivation";

export type ActivationMode = "active" | "paused";

export interface OriginActivationRecord {
  origin: string;
  mode: ActivationMode;
}

export interface ActivationState {
  schemaVersion: 1;
  global: ActivationMode;
  origins: OriginActivationRecord[];
  dormantOrigins: OriginActivationRecord[];
}

export function createInitialActivationState(): ActivationState {
  return {
    schemaVersion: 1,
    global: "paused",
    origins: [],
    dormantOrigins: [],
  };
}

export interface ActivationStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface InitializeActivationInput {
  installationReason: "install" | "update";
  grantedPatterns: string[];
}

export { exactOriginFromPattern } from "../permissions/permission-origin";

function isActivationMode(value: unknown): value is ActivationMode {
  return value === "active" || value === "paused";
}

export function isCanonicalPermissionOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = exactOriginFromPattern(`${value}/*`);
  return parsed === value;
}

export function isActivationState(value: unknown): value is ActivationState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ActivationState>;
  if (
    candidate.schemaVersion !== 1 ||
    !isActivationMode(candidate.global) ||
    !Array.isArray(candidate.origins) ||
    !Array.isArray(candidate.dormantOrigins ?? [])
  ) {
    return false;
  }

  const seen = new Set<string>();
  const validOrigins = candidate.origins.every((record) => {
    if (typeof record !== "object" || record === null) return false;
    const originRecord = record as Partial<OriginActivationRecord>;
    if (
      !isCanonicalPermissionOrigin(originRecord.origin) ||
      !isActivationMode(originRecord.mode)
    ) {
      return false;
    }
    if (seen.has(originRecord.origin)) return false;
    seen.add(originRecord.origin);
    return true;
  });
  if (!validOrigins) return false;

  const dormant = candidate.dormantOrigins ?? [];
  return dormant.every((record) => {
    if (typeof record !== "object" || record === null) return false;
    const originRecord = record as Partial<OriginActivationRecord>;
    if (
      !isCanonicalPermissionOrigin(originRecord.origin) ||
      !isActivationMode(originRecord.mode)
    ) {
      return false;
    }
    if (seen.has(originRecord.origin)) return false;
    seen.add(originRecord.origin);
    return true;
  });
}

export class ActivationRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: ActivationStorageArea) {}

  async read(): Promise<ActivationState> {
    await this.mutationQueue;
    return this.readExisting();
  }

  async initialize(input: InitializeActivationInput): Promise<ActivationState> {
    return this.runMutation(() => this.initializeUnlocked(input));
  }

  private async initializeUnlocked(input: InitializeActivationInput): Promise<ActivationState> {
    const stored = await this.storage.get(ACTIVATION_STORAGE_KEY);
    const value = stored[ACTIVATION_STORAGE_KEY];
    if (value !== undefined) {
      if (!isActivationState(value)) throw new Error("Invalid FillNest activation state");
      return value;
    }

    const state: ActivationState = {
      ...createInitialActivationState(),
      global: input.installationReason === "update" ? "active" : "paused",
      origins:
        input.installationReason === "update"
          ? [...new Set(
              input.grantedPatterns
                .map(exactOriginFromPattern)
                .filter((origin): origin is string => origin !== null),
            )]
              .sort()
              .map((origin) => ({ origin, mode: "active" as const }))
          : [],
      dormantOrigins: [],
    };
    await this.storage.set({ [ACTIVATION_STORAGE_KEY]: state });
    return state;
  }

  async reconcile(grantedPatterns: string[]): Promise<ActivationState> {
    return this.runMutation(async () => {
      const current = await this.readExisting();
      const grantedOrigins = [...new Set(
        grantedPatterns
          .map(exactOriginFromPattern)
          .filter((origin): origin is string => origin !== null),
      )].sort();

      const preferences = new Map<string, ActivationMode>();
      for (const d of current.dormantOrigins) {
        preferences.set(d.origin, d.mode);
      }
      for (const o of current.origins) {
        preferences.set(o.origin, o.mode);
      }

      const grantedSet = new Set(grantedOrigins);

      const nextOrigins: OriginActivationRecord[] = grantedOrigins.map((origin) => ({
        origin,
        mode: preferences.get(origin) ?? "active",
      }));

      const nextDormant: OriginActivationRecord[] = current.dormantOrigins
        .filter((d) => !grantedSet.has(d.origin))
        .sort((a, b) => a.origin.localeCompare(b.origin));

      const next: ActivationState = {
        schemaVersion: 1,
        global: current.global,
        origins: nextOrigins,
        dormantOrigins: nextDormant,
      };

      if (JSON.stringify(next) !== JSON.stringify(current)) {
        await this.storage.set({ [ACTIVATION_STORAGE_KEY]: next });
      }
      return next;
    });
  }

  async removeOrigins(originsToRemove: string[]): Promise<ActivationState> {
    return this.runMutation(async () => {
      if (originsToRemove.length === 0) return this.readExisting();
      const removeSet = new Set(originsToRemove);
      const current = await this.readExisting();
      const nextOrigins = current.origins.filter((o) => !removeSet.has(o.origin));
      const nextDormant = current.dormantOrigins.filter((d) => !removeSet.has(d.origin));
      const next: ActivationState = {
        ...current,
        origins: nextOrigins,
        dormantOrigins: nextDormant,
      };
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        await this.storage.set({ [ACTIVATION_STORAGE_KEY]: next });
      }
      return next;
    });
  }

  async setGlobal(mode: ActivationMode): Promise<ActivationState> {
    return this.runMutation(async () => {
      const current = await this.readExisting();
      if (current.global === mode) return current;
      const next = { ...current, global: mode };
      await this.storage.set({ [ACTIVATION_STORAGE_KEY]: next });
      return next;
    });
  }

  async setOrigin(
    origin: string,
    mode: ActivationMode,
    grantedPatterns: string[],
  ): Promise<ActivationState> {
    return this.runMutation(async () => {
      if (!isCanonicalPermissionOrigin(origin)) throw new Error("Invalid Permission Origin");
      const grantedOrigins = new Set(
        grantedPatterns
          .map(exactOriginFromPattern)
          .filter((value): value is string => value !== null),
      );
      if (!grantedOrigins.has(origin)) throw new Error("Website access is not granted");

      const current = await this.readExisting();
      const existing = current.origins.find((record) => record.origin === origin);
      if (existing?.mode === mode) return current;
      const origins = existing
        ? current.origins.map((record) =>
            record.origin === origin ? { ...record, mode } : record,
          )
        : [...current.origins, { origin, mode }].sort((left, right) =>
            left.origin.localeCompare(right.origin),
          );

      const nextDormant = current.dormantOrigins.filter((d) => d.origin !== origin);

      const next: ActivationState = {
        ...current,
        origins,
        dormantOrigins: nextDormant,
      };
      await this.storage.set({ [ACTIVATION_STORAGE_KEY]: next });
      return next;
    });
  }

  async replaceState(nextState: ActivationState): Promise<ActivationState> {
    return this.runMutation(async () => {
      const normalizedState: ActivationState = {
        schemaVersion: 1,
        global: nextState.global,
        origins: nextState.origins,
        dormantOrigins: nextState.dormantOrigins ?? [],
      };
      if (!isActivationState(normalizedState)) throw new Error("Invalid FillNest activation state");
      await this.storage.set({ [ACTIVATION_STORAGE_KEY]: normalizedState });
      return normalizedState;
    });
  }

  private async readExisting(): Promise<ActivationState> {
    const stored = await this.storage.get(ACTIVATION_STORAGE_KEY);
    const value = stored[ACTIVATION_STORAGE_KEY];
    if (value === undefined) throw new Error("Activation state uninitialized");
    if (!isActivationState(value)) throw new Error("Invalid FillNest activation state");
    return {
      schemaVersion: 1,
      global: value.global,
      origins: value.origins,
      dormantOrigins: value.dormantOrigins ?? [],
    };
  }

  public runMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
