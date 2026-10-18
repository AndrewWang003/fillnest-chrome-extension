/**
 * Task 037. Which language the interface speaks, and how that choice reaches
 * every surface.
 *
 * The choice is the user's, not the browser's alone: `system` follows the
 * browser, and the two explicit values override it. Someone whose browser is
 * in English may still want the extension in Chinese, and that is ordinary
 * rather than exotic.
 */
/**
 * The languages the interface is written in: **the one list a new language is
 * added to.** Everything else reads it - the Settings choice, `system`
 * resolution, and the tests that check every catalogue - and `catalogue.ts`
 * will not compile until the new id has a catalogue. See `catalogue.ts` for
 * the whole recipe.
 *
 * - `chromeLocale` names the `public/_locales/` folder carrying the manifest's
 *   name and description, which Chrome picks by browser language alone.
 * - `matchesBrowserLanguage` receives the browser's language tag, lower-cased,
 *   and says whether `system` should mean this language. English is the
 *   fallback and claims nothing.
 */
export const LANGUAGES = [
  { id: "en", chromeLocale: "en", matchesBrowserLanguage: (_tag: string) => false },
  {
    id: "zh-Hans",
    chromeLocale: "zh_CN",
    // Anything beginning `zh` is a reader of Simplified Chinese - `zh`,
    // `zh-CN`, `zh-Hans`, `zh-SG` - except the Traditional variants. Showing
    // them Simplified text would be a worse answer than English, and
    // Traditional Chinese is not written yet.
    matchesBrowserLanguage: (tag: string) =>
      tag.startsWith("zh") && !["hant", "tw", "hk", "mo"].some((part) => tag.includes(part)),
  },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const LANGUAGE_IDS: readonly LanguageId[] = LANGUAGES.map((language) => language.id);

/** The source catalogue, and what `system` becomes when nothing else matches. */
export const FALLBACK_LANGUAGE: LanguageId = "en";

export type LanguagePreference = "system" | LanguageId;

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ["system", ...LANGUAGE_IDS];

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = "system";

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === "string" && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

/**
 * The language a preference resolves to: an explicit choice as it stands, and
 * `system` as the first language that claims the browser's own UI language.
 */
export function resolveLanguage(
  preference: LanguagePreference,
  browserLanguage: string = typeof navigator === "undefined" ? "en" : navigator.language,
): LanguageId {
  if (preference !== "system") return preference;
  const tag = browserLanguage.toLowerCase();
  return LANGUAGES.find((language) => language.matchesBrowserLanguage(tag))?.id ?? FALLBACK_LANGUAGE;
}
