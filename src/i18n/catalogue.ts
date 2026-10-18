import type { LanguageId } from "./language";
import { en, type Messages } from "./messages";
import { zhHans } from "./messages.zh-Hans";

/**
 * Every language's catalogue, by id.
 *
 * ## Adding a language
 *
 * 1. Add it to `LANGUAGES` in `language.ts`: an id, its `public/_locales/`
 *    folder name, and which browser languages it claims. This file then stops
 *    compiling until step 2 is done.
 * 2. Write `messages.<id>.ts` answering every entry of `Messages` - a missing
 *    one is a `tsc` error - and list it below. Its `languageName` is the
 *    language's own name for itself, which is what Settings shows.
 * 3. Add `public/_locales/<chromeLocale>/messages.json` with the extension's
 *    name and description. A unit test fails until it exists.
 *
 * Nothing else changes: Settings, `system` resolution and the catalogue tests
 * all read `LANGUAGES`. A right-to-left language would need layout work that
 * this recipe does not cover.
 */
const CATALOGUES: Readonly<Record<LanguageId, Messages>> = {
  en,
  "zh-Hans": zhHans,
};

export function messagesFor(language: LanguageId): Messages {
  return CATALOGUES[language];
}

export type { Messages };
