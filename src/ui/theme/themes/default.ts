import type { ThemeDefinition } from "./theme-definition";

/** What FillNest shipped before themes existed. Light mode is pixel-identical. */
export const defaultTheme = {
  id: "default",
  light: {
    accent: "#3157d5",
    "accent-hover": "#2347af",
    "accent-strong": "#17307a",
    "on-accent": "#ffffff",
    "accent-soft": "#eef1f8",
    "accent-soft-hover": "#dfe6f7",
    "accent-border": "#bcc8e8",
  },
  dark: {
    accent: "#8ba7ff",
    "accent-hover": "#adc1ff",
    "accent-strong": "#cdd9ff",
    "on-accent": "#101a3d",
    "accent-soft": "#1e2740",
    "accent-soft-hover": "#27324f",
    "accent-border": "#39456b",
  },
} as const satisfies ThemeDefinition;
