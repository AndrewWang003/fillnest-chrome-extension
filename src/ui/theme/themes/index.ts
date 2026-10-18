import { amberTheme } from "./amber";
import { defaultTheme } from "./default";
import { forestTheme } from "./forest";
import { graphiteTheme } from "./graphite";
import { oceanTheme } from "./ocean";
import { plumTheme } from "./plum";

export type { AccentPalette, ThemeDefinition } from "./theme-definition";

/**
 * The registry. Adding a theme means adding its file and one entry here -
 * there is no second list to keep in step, because `ThemeId` is derived from
 * this array rather than declared beside it.
 *
 * The first entry is the default: `findTheme` falls back to it, so it must
 * stay the one FillNest shipped with.
 */
export const THEMES = [
  defaultTheme,
  graphiteTheme,
  oceanTheme,
  forestTheme,
  plumTheme,
  amberTheme,
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((theme) => theme.id);

export const DEFAULT_THEME_ID: ThemeId = THEMES[0].id;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function findTheme(themeId: ThemeId): (typeof THEMES)[number] {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}
