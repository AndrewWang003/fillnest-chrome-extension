/// <reference types="vite/client" />

/**
 * Task 030: the Shadow Root mode the Inline Picker's surfaces are created
 * with, fixed at build time by `vite.content.config.mjs`. "closed" in every
 * production build; "open" only under `npm run build:e2e`.
 */
declare const __FILLNEST_PICKER_SHADOW_MODE__: "open" | "closed";
