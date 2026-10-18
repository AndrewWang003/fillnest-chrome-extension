import {
  DEFAULT_LANGUAGE_PREFERENCE,
  isLanguagePreference,
  type LanguagePreference,
} from "./language";

export const LANGUAGE_STORAGE_KEY = "fillnestLanguage";

/**
 * Task 037. The chosen language lives in its own storage key, beside the
 * theme's and for the same reasons.
 *
 * It is a display preference for this browser profile, not user data: it says
 * nothing about Templates, Sites or Fields, and a Backup Archive restored onto
 * another machine has no business changing what language that machine speaks.
 * Keeping it out of the business record keeps it out of the schema version,
 * the migration chain, the archive contract and the restore impact preview.
 *
 * Reset clears it, because Reset returns FillNest to its initial state.
 */
export interface LanguageStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LanguageRepository {
  constructor(private readonly storage: LanguageStorageArea) {}

  /**
   * Never throws. An unreadable preference means `system`, which is a complete
   * and correct answer rather than a failure the user has to act on.
   */
  async read(): Promise<LanguagePreference> {
    try {
      const stored = await this.storage.get(LANGUAGE_STORAGE_KEY);
      const value = stored[LANGUAGE_STORAGE_KEY];
      return isLanguagePreference(value) ? value : DEFAULT_LANGUAGE_PREFERENCE;
    } catch {
      return DEFAULT_LANGUAGE_PREFERENCE;
    }
  }

  async write(preference: LanguagePreference): Promise<LanguagePreference> {
    const next = isLanguagePreference(preference) ? preference : DEFAULT_LANGUAGE_PREFERENCE;
    await this.storage.set({ [LANGUAGE_STORAGE_KEY]: next });
    return next;
  }

  async clear(): Promise<void> {
    await this.storage.remove(LANGUAGE_STORAGE_KEY);
  }
}
