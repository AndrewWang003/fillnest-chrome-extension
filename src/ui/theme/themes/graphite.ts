import type { ThemeDefinition } from "./theme-definition";

/** No colour cast at all: the accent is the same neutral family as the text. */
export const graphiteTheme = {
  id: "graphite",
  light: {
    accent: "#4a5567",
    "accent-hover": "#333d4c",
    "accent-strong": "#1f2733",
    "on-accent": "#ffffff",
    "accent-soft": "#eef0f4",
    "accent-soft-hover": "#e1e5ec",
    "accent-border": "#c4cad5",
  },
  dark: {
    accent: "#c3cbd9",
    "accent-hover": "#dde2ea",
    "accent-strong": "#eef1f7",
    "on-accent": "#1a1f28",
    "accent-soft": "#242935",
    "accent-soft-hover": "#2e3441",
    "accent-border": "#454c5c",
  },
} as const satisfies ThemeDefinition;
