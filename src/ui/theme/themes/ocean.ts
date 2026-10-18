import type { ThemeDefinition } from "./theme-definition";

export const oceanTheme = {
  id: "ocean",
  light: {
    accent: "#0e6f83",
    "accent-hover": "#0a5364",
    "accent-strong": "#063845",
    "on-accent": "#ffffff",
    "accent-soft": "#e8f2f5",
    "accent-soft-hover": "#d6e8ee",
    "accent-border": "#a9cdd7",
    canvas: "#f5f8fa",
    "surface-sunken": "#eef4f6",
    "surface-raised": "#e6eef1",
  },
  dark: {
    accent: "#69cfe4",
    "accent-hover": "#96e0ee",
    "accent-strong": "#bfecf5",
    "on-accent": "#04262e",
    "accent-soft": "#16303a",
    "accent-soft-hover": "#1d3d49",
    "accent-border": "#2f5561",
    canvas: "#101619",
    "surface-sunken": "#151c20",
    "surface-raised": "#212b30",
  },
} as const satisfies ThemeDefinition;
