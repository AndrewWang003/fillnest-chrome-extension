import {
  DEFAULT_APPEARANCE,
  isThemeId,
  isThemeModePreference,
  type AppearancePreference,
} from "../ui/theme/theme-tokens";

export const APPEARANCE_STORAGE_KEY = "fillnestAppearance";

/**
 * The chosen theme lives in its own storage key rather than in `FillNestState`.
 *
 * It is a display preference for this browser profile, not user data: it says
 * nothing about Templates, Sites or Fields, it carries no privacy weight, and a
 * Backup Archive restored onto another machine has no business repainting that
 * machine. Keeping it out of the business record also keeps it out of the
 * schema version, the migration chain, the archive contract and the restore
 * impact preview - four things that exist to protect data integrity and have
 * nothing to protect here.
 *
 * Reset still clears it: Reset returns FillNest to its initial state, and the
 * theme is part of that state even though a Backup is not.
 */
export interface AppearanceStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

function normalize(value: unknown): AppearancePreference {
  if (typeof value !== "object" || value === null) return DEFAULT_APPEARANCE;
  const candidate = value as Partial<AppearancePreference>;
  return {
    themeId: isThemeId(candidate.themeId) ? candidate.themeId : DEFAULT_APPEARANCE.themeId,
    mode: isThemeModePreference(candidate.mode) ? candidate.mode : DEFAULT_APPEARANCE.mode,
  };
}

export class AppearanceRepository {
  constructor(private readonly storage: AppearanceStorageArea) {}

  /**
   * Never throws and never reports a stored-data problem. An unreadable or
   * corrupt preference means the default palette, which is a complete, correct
   * UI - not a failure the user has to act on.
   */
  async read(): Promise<AppearancePreference> {
    try {
      const stored = await this.storage.get(APPEARANCE_STORAGE_KEY);
      return normalize(stored[APPEARANCE_STORAGE_KEY]);
    } catch {
      return DEFAULT_APPEARANCE;
    }
  }

  async write(preference: AppearancePreference): Promise<AppearancePreference> {
    const next = normalize(preference);
    await this.storage.set({ [APPEARANCE_STORAGE_KEY]: next });
    return next;
  }

  async clear(): Promise<void> {
    await this.storage.remove(APPEARANCE_STORAGE_KEY);
  }
}
