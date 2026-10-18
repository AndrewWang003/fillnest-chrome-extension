import { isTipId, type TipId } from "./tips";

export const DISMISSED_TIPS_STORAGE_KEY = "fillnestDismissedTips";

export interface TipsStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Task 042. Which first-use tips this browser has dismissed, in its own
 * storage key beside the language and the theme, and for the same reasons: it
 * is a preference of this profile, not user data, so it is outside the
 * business record, the schema, the Backup Archive and the restore preview.
 * Reset clears it, and so does `Show tips again`.
 */
export class TipsRepository {
  constructor(private readonly storage: TipsStorageArea) {}

  /** Never throws: an unreadable record means no tip was dismissed. */
  async read(): Promise<TipId[]> {
    try {
      const stored = await this.storage.get(DISMISSED_TIPS_STORAGE_KEY);
      const value = stored[DISMISSED_TIPS_STORAGE_KEY];
      return Array.isArray(value) ? [...new Set(value.filter(isTipId))] : [];
    } catch {
      return [];
    }
  }

  async dismiss(tip: TipId): Promise<TipId[]> {
    const dismissed = await this.read();
    if (dismissed.includes(tip)) return dismissed;
    const next = [...dismissed, tip];
    await this.storage.set({ [DISMISSED_TIPS_STORAGE_KEY]: next });
    return next;
  }

  async clear(): Promise<void> {
    await this.storage.remove(DISMISSED_TIPS_STORAGE_KEY);
  }
}
