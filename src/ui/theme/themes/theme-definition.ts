import type { AccentTokenName, TintableTokenName } from "../token-names";

/**
 * What one theme declares.
 *
 * The accent tokens are **required**: TypeScript will not accept a theme that
 * leaves one out, in either mode. The three tints are optional and fall back to
 * the shared neutral ramp, so a theme that only wants a new accent says only
 * that.
 *
 * ## Adding a theme
 *
 * 1. Copy any file in this directory, change the `id` and the colours, and give
 *    the theme a name in every message catalogue (`src/i18n/`) - `themeLabel`
 *    will not compile until it has one.
 * 2. Add it to the array in `index.ts`. That is the only registration - the id
 *    union, the Settings chooser and the contrast test all read from it.
 * 3. Run `npm test`. `theme-contrast.test.ts` computes the real WCAG ratios for
 *    the new theme in both modes and fails the build if anything is short.
 *
 * There is deliberately no step for "and remember to also update X".
 */
export type AccentPalette = Record<AccentTokenName, string> &
  Partial<Record<TintableTokenName, string>>;

export interface ThemeDefinition {
  id: string;
  light: AccentPalette;
  dark: AccentPalette;
}
