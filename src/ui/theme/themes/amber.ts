import type { ThemeDefinition } from "./theme-definition";

export const amberTheme = {
  id: "amber",
  light: {
    accent: "#8a5410",
    "accent-hover": "#6b400a",
    "accent-strong": "#4a2c06",
    "on-accent": "#ffffff",
    "accent-soft": "#f8f1e6",
    "accent-soft-hover": "#f0e3cf",
    "accent-border": "#dcc39a",
    canvas: "#faf8f4",
    "surface-sunken": "#f5f1ea",
    "surface-raised": "#ede8df",
  },
  dark: {
    accent: "#e8b877",
    "accent-hover": "#f2d1a2",
    "accent-strong": "#f8e5c8",
    "on-accent": "#2e1c05",
    "accent-soft": "#2c2418",
    "accent-soft-hover": "#382e20",
    "accent-border": "#4e4130",
    canvas: "#17140f",
    "surface-sunken": "#1c1813",
    "surface-raised": "#28231b",
  },
} as const satisfies ThemeDefinition;
