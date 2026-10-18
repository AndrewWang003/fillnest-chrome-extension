import { describe, expect, it } from "vitest";

import { messagesFor } from "../../src/i18n/catalogue";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isLanguagePreference,
  LANGUAGE_IDS,
  LANGUAGE_PREFERENCES,
  LANGUAGES,
  resolveLanguage,
} from "../../src/i18n/language";
import { LanguageRepository } from "../../src/i18n/language-repository";
import { en, type Messages } from "../../src/i18n/messages";
import { zhHans } from "../../src/i18n/messages.zh-Hans";

/**
 * Task 037. The catalogue's contract, and the one thing the compiler cannot
 * check for us.
 */
describe("the message catalogues", () => {
  it("have exactly the same keys, in both directions", () => {
    // A missing entry is already a `tsc` error. This catches the other
    // direction - an entry that outlived the key it answered - which the
    // compiler is happy to ignore.
    for (const language of LANGUAGE_IDS) {
      expect(Object.keys(messagesFor(language)).sort(), language).toEqual(Object.keys(en).sort());
    }
  });

  it("gives every registered language its own name and a Chrome locale folder", () => {
    // Task 037, final step: the registry is the one list, so these follow it -
    // a language added there is checked here without editing this test.
    const names = LANGUAGE_IDS.map((language) => messagesFor(language).languageName());
    expect(new Set(names).size).toBe(LANGUAGE_IDS.length);
    for (const language of LANGUAGES) {
      const manifestStrings = join(process.cwd(), "public", "_locales", language.chromeLocale, "messages.json");
      expect(existsSync(manifestStrings), manifestStrings).toBe(true);
      const parsed = JSON.parse(readFileSync(manifestStrings, "utf8")) as Record<string, { message?: string }>;
      for (const entry of Object.values(parsed)) expect(entry.message?.length ?? 0, language.id).toBeGreaterThan(0);
    }
  });

  it("answers every key with a non-empty string in both languages", () => {
    for (const language of LANGUAGE_IDS) {
      for (const [key, value] of renderedEntries(messagesFor(language))) {
        expect(typeof value, `${language}.${key}`).toBe("string");
        expect(value.length, `${language}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the product's name in English in both catalogues", () => {
    // FillNest is a name, not a word. Translating it would make the product
    // unrecognizable to the person who installed it.
    expect(en.openFillNest()).toContain("FillNest");
    expect(zhHans.openFillNest()).toContain("FillNest");
  });

  it("says Field as 输入框, never 字段", () => {
    // Task 024 Addendum C.1 found "field" to be jargon ordinary people do not
    // know and changed the English to say "box". A harder Chinese word would
    // rebuild that defect in a second language.
    const chinese = renderedEntries(zhHans)
      .map(([, value]) => value)
      .join(" ");
    expect(chinese).not.toContain("字段");
  });
});

describe("resolveLanguage", () => {
  it("follows the browser only while the preference is `system`", () => {
    expect(resolveLanguage("system", "zh-CN")).toBe("zh-Hans");
    expect(resolveLanguage("system", "en-GB")).toBe("en");
    // An explicit choice overrides the browser in both directions - which is
    // the whole reason the preference exists rather than reading the browser.
    expect(resolveLanguage("en", "zh-CN")).toBe("en");
    expect(resolveLanguage("zh-Hans", "en-GB")).toBe("zh-Hans");
  });

  it("treats every Simplified locale as Chinese, and no Traditional one", () => {
    for (const locale of ["zh", "zh-CN", "zh-Hans", "zh-SG", "ZH-cn"]) {
      expect(resolveLanguage("system", locale), locale).toBe("zh-Hans");
    }
    // Showing a Traditional reader Simplified text is a worse answer than
    // English, and Traditional Chinese is not in this Task's scope.
    for (const locale of ["zh-TW", "zh-HK", "zh-Hant", "zh-MO"]) {
      expect(resolveLanguage("system", locale), locale).toBe("en");
    }
  });

  it("falls back to English for a language FillNest does not speak", () => {
    expect(resolveLanguage("system", "de-DE")).toBe("en");
    expect(resolveLanguage("system", "")).toBe("en");
  });
});

describe("LanguageRepository", () => {
  it("stores and returns a preference", async () => {
    const repository = new LanguageRepository(memoryStorage());
    expect(await repository.read()).toBe("system");
    await repository.write("zh-Hans");
    expect(await repository.read()).toBe("zh-Hans");
  });

  it("returns `system` for stored nonsense rather than failing", async () => {
    const storage = memoryStorage({ fillnestLanguage: "klingon" });
    expect(await new LanguageRepository(storage).read()).toBe("system");
  });

  it("returns `system` when storage itself throws", async () => {
    const broken = {
      get: () => Promise.reject(new Error("storage unavailable")),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    expect(await new LanguageRepository(broken).read()).toBe("system");
  });

  it("clears, which is what Reset needs of it", async () => {
    const storage = memoryStorage();
    const repository = new LanguageRepository(storage);
    await repository.write("en");
    await repository.clear();
    expect(await repository.read()).toBe("system");
  });

  it("accepts exactly the preferences the type allows", () => {
    for (const preference of LANGUAGE_PREFERENCES) expect(isLanguagePreference(preference)).toBe(true);
    for (const other of ["zh", "zh-TW", "", "fr", null, 3]) expect(isLanguagePreference(other)).toBe(false);
  });
});

function memoryStorage(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (key: string) => Promise.resolve(store.has(key) ? { [key]: store.get(key) } : {}),
    set: (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
      return Promise.resolve();
    },
    remove: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

// The interface is the contract: this line fails to compile if a catalogue
// drifts from it.
const catalogues: Messages[] = [en, zhHans];
void catalogues;

/**
 * Every entry, rendered to text. Entries take up to five arguments of mixed
 * kinds - an origin, a preview, a count, a Set name - so each is given the same
 * plausible values; a Task 037 Addendum B rich entry returns parts, which are
 * joined the way `RichText` renders them.
 */
function renderedEntries(messages: object): Array<[string, string]> {
  const sample = ["example.test", 2, "Contact fields", 3, 4] as never[];
  return Object.entries(messages as Record<string, (...args: never[]) => unknown>).map(([key, entry]) => {
    const value = entry(...sample);
    const text = Array.isArray(value)
      ? value.map((part: string | { strong: string }) => (typeof part === "string" ? part : part.strong)).join("")
      : value;
    return [key, text as string];
  });
}
