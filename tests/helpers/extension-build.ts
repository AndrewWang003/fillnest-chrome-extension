/**
 * Where the headed E2E suite loads the built extension from.
 *
 * Task 030: `npm run build` produces the shipped artifact in `dist/`, whose
 * Shadow Roots are closed - Playwright cannot pierce those, so it cannot drive
 * the Picker through ordinary locators. `npm run build:e2e` produces an
 * otherwise identical build in `dist-e2e/` with the roots open, and the suite
 * uses that.
 *
 * The divergence is deliberate and is kept honest two ways: `verify-build.mjs`
 * fails the build if the production artifact is not closed, and
 * `picker-isolation.spec.ts` loads the real `dist/` artifact to prove both that
 * a host page cannot reach the Picker and that the Picker still works.
 */
export const E2E_EXTENSION_BUILD_DIR = "dist-e2e";

/** The shipped artifact, used only by `picker-isolation.spec.ts`. */
export const PRODUCTION_EXTENSION_BUILD_DIR = "dist";
