import { describe, expect, it } from "vitest";

import {
  buildThemeTokens,
  THEMES,
  THEME_IDS,
  type ThemeMode,
  type ThemeTokenName,
} from "../../src/ui/theme/theme-tokens";
import { themeLabel } from "../../src/ui/theme/theme-label";
import { messagesFor } from "../../src/i18n/catalogue";
import { LANGUAGE_IDS } from "../../src/i18n/language";

/**
 * Task 034. Twelve palettes are twelve chances to reintroduce exactly the
 * failures Task 023's static contrast audit removed by hand. Rather than
 * re-audit by eye every time a theme is added, the ratios are computed here:
 * a palette that fails is a failing build, not a shipped regression.
 *
 * Thresholds are WCAG 2.1 AA - 4.5:1 for normal text, 3:1 for UI components
 * and graphical objects (1.4.3 and 1.4.11).
 */

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

const MODES: ThemeMode[] = ["light", "dark"];

/** Every layer real text is painted onto. */
const TEXT_BACKGROUNDS = ["canvas", "surface", "surface-sunken", "surface-raised"] as const satisfies readonly ThemeTokenName[];

/** Text tokens that carry real informational text, and their required ratio. */
const TEXT_TOKENS: ReadonlyArray<readonly [ThemeTokenName, number]> = [
  ["text", 4.5],
  ["text-secondary", 4.5],
  ["text-muted", 4.5],
  ["icon", 3],
  // `text-disabled` is deliberately absent: WCAG contrast requirements do not
  // apply to disabled controls, and Task 023 already recorded that exemption.
];

describe("theme contrast (Task 034)", () => {
  it("is a well-formed registry: unique ids, unique names, the shipped palette first", () => {
    // `ThemeId` and `THEME_IDS` are both derived from `THEMES`, so there is no
    // parallel list to fall out of step. What is still worth asserting is what
    // derivation cannot check.
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
    // Task 037 Addendum B: a theme is named only in the catalogue.
    for (const language of LANGUAGE_IDS) {
      const messages = messagesFor(language);
      expect(new Set(THEME_IDS.map((id) => themeLabel(id, messages))).size, language).toBe(THEMES.length);
    }
    // `findTheme` falls back to the first entry, so it has to be the default.
    expect(THEMES[0].id).toBe("default");
  });

  for (const themeId of THEME_IDS) {
    for (const mode of MODES) {
      describe(`${themeId} / ${mode}`, () => {
        const tokens = buildThemeTokens(themeId, mode);
        const at = (name: ThemeTokenName): string => tokens[name];

        it("keeps informational text readable on every background layer it can sit on", () => {
          for (const [token, minimum] of TEXT_TOKENS) {
            for (const background of TEXT_BACKGROUNDS) {
              const ratio = contrast(at(token), at(background));
              expect(
                ratio,
                `${token} on ${background} is ${ratio.toFixed(2)}:1, below ${minimum}:1`,
              ).toBeGreaterThanOrEqual(minimum);
            }
          }
        });

        it("keeps the accent legible as a filled control and as a text colour", () => {
          // A filled accent button: its own label must be readable on it.
          expect(contrast(at("on-accent"), at("accent"))).toBeGreaterThanOrEqual(4.5);
          // Accent used as text on the soft accent background (selected chips,
          // counts, inline actions) and on the plain surface.
          expect(contrast(at("accent"), at("accent-soft"))).toBeGreaterThanOrEqual(4.5);
          expect(contrast(at("accent"), at("surface"))).toBeGreaterThanOrEqual(4.5);
          expect(contrast(at("accent-hover"), at("accent-soft-hover"))).toBeGreaterThanOrEqual(4.5);
        });

        it("distinguishes the toggle switch's on state from its off state by more than position", () => {
          // The real 1.4.11 obligation for the switch, and the one Task 023
          // Addendum B4 found broken under forced colours: on and off must not
          // be the same colour.
          expect(contrast(at("accent"), at("control-off"))).toBeGreaterThanOrEqual(3);
        });

        it("keeps decorative separators visible at the shipped baseline", () => {
          // These are separators and card edges, never the sole indication of
          // a control, so 1.4.11's 3:1 does not apply to them - the shipped
          // light design sits at roughly 1.3-1.7:1 and Task 023's contrast
          // audit deliberately left it there. What is asserted is that no
          // theme drops below that baseline into invisibility.
          for (const [token, background] of [
            ["border", "surface"],
            ["border-strong", "surface"],
            ["accent-border", "surface"],
            ["danger-border", "danger-soft"],
            ["warning-border", "warning-soft"],
          ] as const satisfies ReadonlyArray<readonly [ThemeTokenName, ThemeTokenName]>) {
            const ratio = contrast(at(token), at(background));
            expect(ratio, `${token} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.25);
          }
        });

        it("keeps every feedback family readable on its own soft background and on the surface", () => {
          for (const family of ["danger", "warning", "success"] as const) {
            expect(
              contrast(at(family), at(`${family}-soft` as ThemeTokenName)),
              `${family} on ${family}-soft`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(contrast(at(family), at("surface")), `${family} on surface`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(at("on-danger"), at("danger"))).toBeGreaterThanOrEqual(4.5);
          // The page-status control's paused state is a filled control with an
          // icon on it, floating over an arbitrary website.
          expect(contrast(at("on-muted-fill"), at("muted-fill"))).toBeGreaterThanOrEqual(4.5);
        });

        it("keeps the inverse surface (tooltips) readable", () => {
          expect(contrast(at("on-inverse-surface"), at("inverse-surface"))).toBeGreaterThanOrEqual(4.5);
        });
      });
    }
  }
});
