import type { ThemeDefinition } from "./theme-definition";

export const forestTheme = {
  id: "forest",
  light: {
    accent: "#2f6b46",
    "accent-hover": "#235034",
    "accent-strong": "#173523",
    "on-accent": "#ffffff",
    "accent-soft": "#ebf3ee",
    "accent-soft-hover": "#dbeae1",
    "accent-border": "#aecfbc",
    canvas: "#f6f9f6",
    "surface-sunken": "#eff4f0",
    "surface-raised": "#e7eee9",
  },
  dark: {
    accent: "#7fce9c",
    "accent-hover": "#a5dfba",
    "accent-strong": "#c7ecd4",
    "on-accent": "#08290f",
    "accent-soft": "#182c20",
    "accent-soft-hover": "#20392a",
    "accent-border": "#33513e",
    canvas: "#111611",
    "surface-sunken": "#161c17",
    "surface-raised": "#222a23",
  },
} as const satisfies ThemeDefinition;
