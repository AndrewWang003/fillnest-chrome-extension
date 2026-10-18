import type { NeutralTokenName } from "./token-names";

export type ThemeMode = "light" | "dark";

/**
 * The neutral ramp: surfaces, borders, the text ramp, the controls and the
 * feedback families. One per mode, shared by every theme.
 *
 * This is the reason twelve palettes are not twelve contrast problems. A theme
 * changes the accent and, at most, tints three background layers; everything a
 * user has to be able to *read* comes from here, so its contrast is a property
 * of the mode rather than of each palette. `tests/unit/theme-contrast.test.ts`
 * still computes the real ratios for every combination, tints included.
 *
 * Typed as a total record over `NeutralTokenName`, so adding a token name is a
 * compile error in both ramps until both define it.
 */
export const NEUTRAL_RAMP: Record<ThemeMode, Record<NeutralTokenName, string>> = {
  light: {
    canvas: "#f7f8fb",
    surface: "#ffffff",
    "surface-sunken": "#f4f6fa",
    "surface-raised": "#eef0f5",
    border: "#e1e5ed",
    "border-strong": "#d0d6e2",
    text: "#172033",
    "text-secondary": "#344054",
    "text-muted": "#5b6577",
    "text-disabled": "#98a2b3",
    icon: "#516078",
    "inverse-surface": "#172033",
    "on-inverse-surface": "#f7f8fb",
    "control-off": "#d0d5dd",
    "control-thumb": "#ffffff",
    // A filled control in its inactive state - the page-status button when
    // FillNest is paused on a site. It carries an icon, so unlike the switch
    // track it needs a legible foreground of its own; `control-off` is a bare
    // track and far too light to put a glyph on.
    "muted-fill": "#6b7488",
    "on-muted-fill": "#ffffff",
    // Space-separated channels, so stylesheets can write
    // `rgb(var(--fn-shadow) / 20%)` and vary the opacity per shadow.
    shadow: "23 32 51",
    overlay: "rgb(23 32 51 / 34%)",
    danger: "#b42318",
    "danger-hover": "#932018",
    "danger-soft": "#fef3f2",
    "danger-border": "#f2d4d1",
    "on-danger": "#ffffff",
    warning: "#7a2e0e",
    "warning-soft": "#fff4e8",
    "warning-border": "#f0c59c",
    success: "#166534",
    "success-soft": "#edf9f1",
  },
  dark: {
    canvas: "#12151d",
    surface: "#1b1f29",
    "surface-sunken": "#171b24",
    "surface-raised": "#242936",
    border: "#2e3442",
    "border-strong": "#3d4453",
    text: "#eef1f7",
    "text-secondary": "#cdd4e0",
    "text-muted": "#a2abbd",
    "text-disabled": "#6b7383",
    icon: "#aab2c2",
    "inverse-surface": "#eef1f7",
    "on-inverse-surface": "#12151d",
    "control-off": "#3d4453",
    // The switch knob is a fixed light disc in both modes: it reads as the
    // moving part against the track, which `surface` would not in dark mode.
    "control-thumb": "#eef1f7",
    "muted-fill": "#414957",
    "on-muted-fill": "#eef1f7",
    shadow: "0 0 0",
    overlay: "rgb(0 0 0 / 58%)",
    danger: "#ff9d92",
    "danger-hover": "#ffc4bd",
    "danger-soft": "#33191a",
    "danger-border": "#5e2a28",
    "on-danger": "#3a0f0b",
    warning: "#f0be86",
    "warning-soft": "#2f2417",
    "warning-border": "#58432a",
    success: "#7fd7a1",
    "success-soft": "#16281d",
  },
};
