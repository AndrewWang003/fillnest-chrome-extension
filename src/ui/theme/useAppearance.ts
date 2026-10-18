import { useEffect, useRef, useState } from "preact/hooks";

import type { RuntimeRequest, RuntimeResponse } from "../../messages/runtime-messages";
import { applyAppearanceToDocument, watchSystemMode } from "./apply-theme";
import {
  DEFAULT_APPEARANCE,
  isThemeId,
  isThemeModePreference,
  type AppearancePreference,
} from "./theme-tokens";

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return (
    typeof value === "object" &&
    value !== null &&
    "themeId" in value &&
    "mode" in value &&
    isThemeId((value as AppearancePreference).themeId) &&
    isThemeModePreference((value as AppearancePreference).mode)
  );
}

/**
 * Paints the surface it is used on, and keeps it painted.
 *
 * Three things can change the answer and all three are handled here: the user
 * choosing a theme in Settings, another surface choosing one (which arrives as
 * `APPEARANCE_CHANGED`), and the operating system flipping light/dark while
 * the preference is `system`.
 *
 * The default palette is applied by `bootstrapAppearance` before the first
 * render, so this hook never has a blank frame to cover - it only replaces one
 * complete theme with another.
 */
export function useAppearance(): AppearancePreference {
  const [appearance, setAppearance] = useState<AppearancePreference>(DEFAULT_APPEARANCE);
  const current = useRef(appearance);
  current.current = appearance;

  useEffect(() => {
    let cancelled = false;

    function paint(next: AppearancePreference): void {
      if (cancelled) return;
      setAppearance(next);
      applyAppearanceToDocument(document, next);
    }

    void (async () => {
      try {
        const response: RuntimeResponse = await chrome.runtime.sendMessage({
          type: "GET_APPEARANCE",
        } satisfies RuntimeRequest);
        if (response.ok && isAppearancePreference(response.value)) paint(response.value);
      } catch {
        // The default palette is already on screen; a surface that cannot
        // reach the service worker must still be usable.
      }
    })();

    const handleMessage = (message: unknown): void => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "APPEARANCE_CHANGED" &&
        "appearance" in message &&
        isAppearancePreference(message.appearance)
      ) {
        paint(message.appearance);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    // `system` has to follow the host live, not only at load.
    const stopWatchingSystem = watchSystemMode(window, () => {
      if (current.current.mode === "system") applyAppearanceToDocument(document, current.current);
    });

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(handleMessage);
      stopWatchingSystem();
    };
  }, []);

  return appearance;
}
