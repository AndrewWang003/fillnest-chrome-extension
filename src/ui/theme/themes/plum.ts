import type { ThemeDefinition } from "./theme-definition";

export const plumTheme = {
  id: "plum",
  light: {
    accent: "#7a3c8f",
    "accent-hover": "#5d2c6d",
    "accent-strong": "#3f1d4b",
    "on-accent": "#ffffff",
    "accent-soft": "#f3edf6",
    "accent-soft-hover": "#e8dcee",
    "accent-border": "#cfb4da",
    canvas: "#f9f7fb",
    "surface-sunken": "#f3f0f6",
    "surface-raised": "#ebe6ef",
  },
  dark: {
    accent: "#d6a4e6",
    "accent-hover": "#e5c2f0",
    "accent-strong": "#f0dcf7",
    "on-accent": "#2b1233",
    "accent-soft": "#2a1e31",
    "accent-soft-hover": "#36283e",
    "accent-border": "#4d3a58",
    canvas: "#15121a",
    "surface-sunken": "#1a1620",
    "surface-raised": "#26202c",
  },
} as const satisfies ThemeDefinition;
