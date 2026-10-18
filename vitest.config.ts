import { defineConfig } from "vitest/config";

export default defineConfig({
  // Task 030: the Inline Picker's Shadow Root mode is a build-time constant.
  // Unit tests inspect the Picker's DOM directly, so they run against the same
  // "open" value `npm run build:e2e` uses; the shipped artifact is "closed" and
  // `scripts/verify-build.mjs` enforces that on the real bundle.
  define: {
    __FILLNEST_PICKER_SHADOW_MODE__: JSON.stringify("open"),
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/component/**/*.test.{ts,tsx}"],
    // Task 045: the Picker reads the shared scrollbar sheet as text
    // (`?raw`). Vitest empties CSS it does not process, so this one sheet is
    // processed, or the Picker under test would have no scrollbar rules.
    css: { include: [/src\/ui\/shared\/scrollbars\.css/u] },
  },
});
