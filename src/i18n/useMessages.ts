import { useEffect, useState } from "preact/hooks";

import type { RuntimeRequest, RuntimeResponse } from "../messages/runtime-messages";
import { messagesFor, type Messages } from "./catalogue";
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  isLanguagePreference,
  resolveLanguage,
  type LanguageId,
  type LanguagePreference,
} from "./language";

/**
 * Task 037. The words this surface speaks, and keeping them current.
 *
 * Three things can change the answer, and all three are handled here: the user
 * choosing a language in Settings, another surface choosing one (which arrives
 * as `LANGUAGE_CHANGED`), and - while the preference is `system` - nothing
 * else, because a browser does not change its UI language while it is running.
 *
 * The same shape as `useAppearance`, deliberately: two preferences that behave
 * differently for no reason would be two things to learn.
 */
/**
 * The preference this surface last heard, for code that runs outside a
 * component - a runtime request's error text (Task 037 acceptance 6). Every
 * surface is its own JavaScript realm, so this is per surface, as it must be.
 */
let activePreference: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE;

export function activeLanguage(): LanguageId {
  return resolveLanguage(activePreference);
}

export function useLanguagePreference(): LanguagePreference {
  const [preference, setPreference] = useState<LanguagePreference>(activePreference);

  useEffect(() => {
    // A surface can be rendered without an extension runtime around it - a
    // component test does exactly that. The default catalogue is a complete,
    // correct UI, so this asks for a better answer and never insists on one.
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    let cancelled = false;
    void (async () => {
      try {
        const response: RuntimeResponse = await chrome.runtime.sendMessage({
          type: "GET_LANGUAGE",
        } satisfies RuntimeRequest);
        if (cancelled || !response.ok || !isLanguagePreference(response.value)) return;
        activePreference = response.value;
        setPreference(response.value);
      } catch {
        // A language nobody could read is still better than a broken surface:
        // the default is a complete, correct UI.
      }
    })();

    const listener = (message: unknown): void => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "LANGUAGE_CHANGED" &&
        "language" in message &&
        isLanguagePreference(message.language)
      ) {
        activePreference = message.language;
        setPreference(message.language);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return preference;
}

export function useMessages(): Messages {
  return messagesFor(resolveLanguage(useLanguagePreference()));
}

/** The language this surface speaks, as a BCP 47 tag for a `lang` attribute. */
export function useLanguage(): LanguageId {
  return resolveLanguage(useLanguagePreference());
}

/**
 * Codex review, 2026-09-13: the Popup and the Side Panel switched their words
 * to Chinese while their documents still said `lang="en"`, so a screen reader
 * read the Chinese with English rules. A surface that owns its whole document
 * keeps the document's language with its words.
 */
export function useDocumentLanguage(): void {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}

export type { Messages };
