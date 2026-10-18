import { resolve } from "node:path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

// Task 030: the Inline Picker's Shadow Root mode is fixed at build time, never
// by editing a source file. The production bundle physically contains
// `mode: "closed"` and has no code path that can open it, so nobody has to
// remember to flip anything and no wrong state can be committed. Only
// `npm run build:e2e` sets this to "open", so the Playwright suite can drive
// the Picker through ordinary locators; `scripts/verify-build.mjs` fails the
// build if a production artifact is not closed.
const pickerShadowMode = process.env.FILLNEST_PICKER_SHADOW_MODE === "open" ? "open" : "closed";

export default defineConfig({
  plugins: [preact()],
  publicDir: false,
  define: {
    __FILLNEST_PICKER_SHADOW_MODE__: JSON.stringify(pickerShadowMode),
  },
  build: {
    emptyOutDir: false,
    target: "es2022",
    lib: {
      entry: resolve("src/content/content-script.tsx"),
      formats: ["iife"],
      name: "FillNestContent",
      fileName: () => "assets/content-script.js",
    },
  },
});
