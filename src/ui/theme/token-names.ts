/**
 * The token vocabulary, as data.
 *
 * Every `--fn-` custom property the stylesheets can read is named here once.
 * Types are derived from these lists, so:
 *
 * - a token added here is a **compile error** in both neutral ramps until both
 *   define it, and
 * - `tests/unit/theme-system.test.tsx` fails if a stylesheet reads a
 *   `var(--fn-…)` that is not on this list, or if a token here is read by no
 *   stylesheet at all.
 *
 * That is the whole point of keeping them as data rather than as free-form
 * object literals: adding a colour cannot be half-done.
 */

/** Chosen by each theme. Everything else comes from the mode's neutral ramp. */
export const ACCENT_TOKEN_NAMES = [
  "accent",
  "accent-hover",
  "accent-strong",
  "on-accent",
  "accent-soft",
  "accent-soft-hover",
  "accent-border",
] as const;

/**
 * A theme may also tint these three background layers. They are neutrals with
 * defaults, so a theme that says nothing about them inherits the shared ramp.
 */
export const TINTABLE_TOKEN_NAMES = ["canvas", "surface-sunken", "surface-raised"] as const;

/** Shared by every theme in a given mode. */
export const NEUTRAL_TOKEN_NAMES = [
  // Surfaces
  "canvas",
  "surface",
  "surface-sunken",
  "surface-raised",
  // Structure
  "border",
  "border-strong",
  // Text
  "text",
  "text-secondary",
  "text-muted",
  "text-disabled",
  "icon",
  // Inverted surface, used by tooltips
  "inverse-surface",
  "on-inverse-surface",
  // Controls
  "control-off",
  "control-thumb",
  "muted-fill",
  "on-muted-fill",
  // Depth
  "shadow",
  "overlay",
  // Feedback
  "danger",
  "danger-hover",
  "danger-soft",
  "danger-border",
  "on-danger",
  "warning",
  "warning-soft",
  "warning-border",
  "success",
  "success-soft",
] as const;

/** Derived from the accent rather than declared, so it can never disagree with it. */
export const DERIVED_TOKEN_NAMES = ["focus-ring"] as const;

export type AccentTokenName = (typeof ACCENT_TOKEN_NAMES)[number];
export type TintableTokenName = (typeof TINTABLE_TOKEN_NAMES)[number];
export type NeutralTokenName = (typeof NEUTRAL_TOKEN_NAMES)[number];
export type DerivedTokenName = (typeof DERIVED_TOKEN_NAMES)[number];

export type ThemeTokenName = AccentTokenName | NeutralTokenName | DerivedTokenName;

export const THEME_TOKEN_NAMES: readonly ThemeTokenName[] = [
  ...NEUTRAL_TOKEN_NAMES,
  ...ACCENT_TOKEN_NAMES,
  ...DERIVED_TOKEN_NAMES,
];

/** The complete resolved palette for one theme in one mode. */
export type ThemeTokens = Record<ThemeTokenName, string>;
