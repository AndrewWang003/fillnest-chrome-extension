import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * FillNest lint configuration.
 *
 * Task 032 follow-up (2026-09-08). ESLint was blocked while the project used
 * TypeScript 7's native port, which `typescript-eslint` does not support. The
 * project moved to TypeScript 5.9 for this; `tsconfig.json` gained
 * `DOM.Iterable`, which 7 supplied implicitly.
 *
 * The rule set is deliberately narrow. `npm run check` already runs the
 * typechecker, a documentation conformance gate, a dead-export gate, 689 unit
 * tests and a production build, so lint is here for what those cannot see:
 * unused code, unsafe escapes from the type system, and floating promises in a
 * codebase whose correctness depends on serialized async mutations.
 */
export default tseslint.config(
  { ignores: ["dist/**", "dist-e2e/**", "output/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    // The Picker and Side Panel are Preact hooks; several `eslint-disable`
    // comments in them name this rule, so the plugin has to be loaded for
    // those comments to mean anything.
    plugins: { "react-hooks": reactHooks },
    // An error. Every finding it reported was resolved on 2026-09-08 without
    // changing behaviour: stale closures moved to latest-value refs so their
    // listeners stay registered once, per-render allocations that were
    // defeating downstream memos were hoisted, and one reconciliation now
    // reads its own state through the setter instead of the closure. Keeping
    // it at "error" is what stops the next stale closure from being added.
    rules: { "react-hooks/exhaustive-deps": "error" },
  },
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The typechecker already reports genuinely unused locals. What matters
      // here is the `_`-prefixed convention for deliberate discards.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Every repository mutation is serialized through `runMutation`. A
      // promise dropped on the floor would run outside that ordering.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // `any` re-opens the holes the strict typechecker exists to close.
      "@typescript-eslint/no-explicit-any": "error",
      // Chrome APIs and stored records are checked at their boundaries by
      // hand-written guards; these two would fire on that guarded code
      // constantly without finding anything the guards do not already handle.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      // Off with reasons, not because they were inconvenient:
      //
      // `unbound-method` fires 118 times, almost all on passing a method of a
      // single-instance collaborator as a callback. That is a real hazard in
      // general and is not one here - these classes are constructed once and
      // the bindings are covered by tests - so the rule would report only
      // noise and train readers to ignore it.
      "@typescript-eslint/unbound-method": "off",
      // `require-await` fires 108 times, almost all on in-memory test doubles
      // implementing an async interface: `async get()` that returns a value
      // synchronously is the correct way to satisfy `Promise<T>`. The rule
      // asks them to be less faithful to the interface they stand in for.
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.mjs", "*.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node } },
  },
);
