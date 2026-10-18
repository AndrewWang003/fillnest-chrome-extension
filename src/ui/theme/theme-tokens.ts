/**
 * FillNest's appearance system - the public surface.
 *
 * The pieces live beside this file so that adding a colour, or a whole theme,
 * cannot be half-done:
 *
 * - `token-names.ts` names every `--fn-` property once, as data. Types are
 *   derived from it, so a new token is a compile error in both neutral ramps
 *   until both define it, and a test fails if a stylesheet reads a token that
 *   is not on the list or if a listed token is read by nothing.
 * - `neutral-ramp.ts` holds the two shared ramps - one per mode - that supply
 *   everything a user has to be able to read.
 * - `themes/` holds one file per theme, plus the registry that derives
 *   `ThemeId` from itself rather than from a parallel list.
 *
 * A theme chooses an accent and, at most, a tint for three background layers.
 * That limit is deliberate: it is what keeps twelve palettes from becoming
 * twelve separate contrast problems. `tests/unit/theme-contrast.test.ts`
 * computes the real WCAG ratios for every theme and mode regardless, so a new
 * palette passes a measurement rather than an inspection.
 *
 * The generic pattern - a named palette resolved to custom properties on a root
 * element - is taken from the earlier prototype as UI evidence, per PROJECT.md. The
 * token vocabulary, the palettes and the light/dark split are FillNest's own.
 */

import { NEUTRAL_RAMP, type ThemeMode } from "./neutral-ramp";
import { DERIVED_TOKEN_NAMES, type ThemeTokens } from "./token-names";
import { DEFAULT_THEME_ID, findTheme, isThemeId, THEME_IDS, THEMES, type ThemeId } from "./themes";

export type { ThemeMode } from "./neutral-ramp";
export type { AccentPalette, ThemeDefinition, ThemeId } from "./themes";
export type { ThemeTokenName, ThemeTokens } from "./token-names";
export { THEME_TOKEN_NAMES } from "./token-names";
export { DEFAULT_THEME_ID, findTheme, isThemeId, THEME_IDS, THEMES };

/** What the user picks. `system` follows the OS setting live. */
export type ThemeModePreference = ThemeMode | "system";

export const DEFAULT_THEME_MODE: ThemeModePreference = "system";

export interface AppearancePreference {
  themeId: ThemeId;
  mode: ThemeModePreference;
}

export const DEFAULT_APPEARANCE: AppearancePreference = {
  themeId: DEFAULT_THEME_ID,
  mode: DEFAULT_THEME_MODE,
};

export function isThemeModePreference(value: unknown): value is ThemeModePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Resolves the effective mode. `system` reads the host's own setting, which is
 * why this takes it as an argument rather than calling `matchMedia` itself:
 * the content script, the Side Panel and the tests all supply their own.
 */
export function resolveThemeMode(preference: ThemeModePreference, prefersDark: boolean): ThemeMode {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

/** The complete token set for one theme and one resolved mode. */
export function buildThemeTokens(themeId: ThemeId, mode: ThemeMode): ThemeTokens {
  const theme = findTheme(themeId);
  // The neutral ramp first, then the theme's accent and any tints it declares:
  // a tint is a neutral a theme is allowed to override, so it has to land after.
  const tokens = { ...NEUTRAL_RAMP[mode], ...theme[mode] } as ThemeTokens;
  for (const name of DERIVED_TOKEN_NAMES) {
    // Derived from the accent so a theme never states them, and so they can
    // never drift from the accent they are meant to match.
    if (name === "focus-ring") tokens[name] = `color-mix(in srgb, ${tokens.accent} 75%, transparent)`;
  }
  return tokens;
}

/** The same tokens as `--fn-` custom properties, ready to write onto an element. */
export function buildThemeCustomProperties(themeId: ThemeId, mode: ThemeMode): Record<string, string> {
  const tokens = buildThemeTokens(themeId, mode);
  const properties: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) properties[`--fn-${name}`] = value;
  return properties;
}
