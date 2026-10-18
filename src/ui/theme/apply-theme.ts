import {
  buildThemeCustomProperties,
  DEFAULT_APPEARANCE,
  resolveThemeMode,
  type AppearancePreference,
  type ThemeId,
  type ThemeMode,
} from "./theme-tokens";

/**
 * Writes a theme onto one element as inline custom properties.
 *
 * Inline rather than a generated stylesheet because the Picker's host lives in
 * a page FillNest does not own: an element's own `style` needs no stylesheet
 * insertion, survives the Shadow Root's `all: initial`, and cannot be
 * outweighed by anything the host page declares.
 */
export function applyThemeToElement(element: HTMLElement, themeId: ThemeId, mode: ThemeMode): void {
  const properties = buildThemeCustomProperties(themeId, mode);
  for (const [name, value] of Object.entries(properties)) element.style.setProperty(name, value);
  element.dataset["fnTheme"] = themeId;
  element.dataset["fnMode"] = mode;
  // Native form controls, scrollbars and the canvas behind the page follow
  // this rather than the tokens, so it has to move with them.
  element.style.setProperty("color-scheme", mode);
}

/** True when the host is currently asking for a dark UI. */
export function prefersDark(view?: { matchMedia?: (query: string) => { matches: boolean } }): boolean {
  try {
    const host = view ?? globalThis;
    return host.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Applies an appearance preference to a document, resolving `system` against
 * that document's own view. Returns the resolved mode so a caller can record
 * what it actually painted.
 */
export function applyAppearanceToDocument(
  doc: Document,
  appearance: AppearancePreference = DEFAULT_APPEARANCE,
): ThemeMode {
  const mode = resolveThemeMode(appearance.mode, prefersDark(doc.defaultView ?? undefined));
  applyThemeToElement(doc.documentElement, appearance.themeId, mode);
  return mode;
}

/**
 * Calls `onChange` whenever the host's own light/dark setting changes, so a
 * surface set to `system` follows it without a reload. A no-op where
 * `matchMedia` is unavailable; returns its own unsubscribe.
 */
export function watchSystemMode(
  view: Window | undefined,
  onChange: (systemPrefersDark: boolean) => void,
): () => void {
  const query = view?.matchMedia?.("(prefers-color-scheme: dark)");
  if (!query?.addEventListener) return () => undefined;
  const listener = (event: MediaQueryListEvent): void => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
