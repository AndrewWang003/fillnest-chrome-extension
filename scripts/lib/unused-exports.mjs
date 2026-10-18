/**
 * Task 032 - dead-export detection, as the interim for the blocked ESLint item.
 *
 * `AGENTS.md` forbids "unused future-facing interfaces or placeholder data
 * models", and Task 008 was chartered to remove superseded paths. The
 * 2026-09-06 whole-extension audit still found three exports referenced
 * nowhere but their own definition (`UndoIcon`, `StaticSurface`,
 * `isRemoveWebsiteAccessResultShape`), which Task 028 removed.
 *
 * A linter would report this class for free, but no released or canary
 * `typescript-eslint` supports the project's TypeScript 7 baseline. This is the
 * narrow substitute the project owner chose on 2026-09-07: it closes the one
 * finding the audit actually made, and nothing more.
 *
 * Two different things look alike here, and only one is dead code:
 *
 * - **Dead**: nobody imports it AND its own file never uses it. That is the
 *   class the audit found, and the class this check fails the build on.
 * - **Over-exported**: nobody imports it, but its own file does use it - so it
 *   should simply drop the `export` keyword. Not dead code, and there are ~47
 *   of them today. Failing the build on those would mean either a large
 *   allow-list, which defeats the purpose, or a churn commit unrelated to any
 *   accepted Task. They stay recorded as open work in Task 032.
 */

/** Value exports only. A type or interface is routinely imported with `import type`. */
const EXPORT_PATTERN = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gmu;

/**
 * Names imported anywhere, from any module, including `import type { … }`.
 * @param {string} source
 * @returns {string[]}
 */
function importedNames(source) {
  /** @type {string[]} */
  const names = [];
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from/gu)) {
    for (const clause of (match[1] ?? "").split(",")) {
      // `foo as bar` imports `foo`; the local alias is irrelevant here.
      const name = clause.trim().split(/\s+as\s+/u)[0]?.trim();
      if (name) names.push(name);
    }
  }
  // A namespace or re-export consumes every name in the module, so treat the
  // module as fully used rather than guessing which names it reaches.
  return names;
}

/**
 * Whether a file refers to a name anywhere beyond the single export
 * declaration that introduces it. Comments count as a reference, which biases
 * toward silence - the right direction for something that fails a build.
 * @param {string} source
 * @param {string} name
 */
function usedWithinOwnFile(source, name) {
  const occurrences = source.match(new RegExp(`\\b${name}\\b`, "gu"))?.length ?? 0;
  return occurrences > 1;
}

/**
 * @param {{ path: string, source: string }[]} files every .ts/.tsx file in the project
 * @param {string[]} entryPoints paths whose exports are reached by the bundler or HTML
 * @returns {string[]} human-readable findings; empty means no dead exports
 */
export function findDeadExports(files, entryPoints) {
  const entries = new Set(entryPoints);

  const consumed = new Set();
  let hasWildcardReexport = false;
  for (const file of files) {
    for (const name of importedNames(file.source)) consumed.add(name);
    // Anchored to the start of a line so the same text quoted inside a string
    // - a test fixture, for instance - does not disable the check.
    if (/^export\s+\*\s+from/mu.test(file.source)) hasWildcardReexport = true;
  }

  // A wildcard re-export makes "who imports this name" unanswerable by reading
  // import clauses, so the check reports that it cannot be trusted rather than
  // producing confident false positives.
  if (hasWildcardReexport) {
    return [
      "A file uses `export * from`, which this check cannot follow. Either replace it " +
        "with named re-exports or extend this check before relying on it.",
    ];
  }

  const findings = [];
  for (const file of files) {
    if (entries.has(file.path)) continue;
    for (const match of file.source.matchAll(EXPORT_PATTERN)) {
      const name = match[1];
      if (name === undefined || consumed.has(name)) continue;
      // Used inside its own file: over-exported, not dead. See the header.
      if (usedWithinOwnFile(file.source, name)) continue;
      findings.push(
        `${file.path} exports \`${name}\`, which no file imports and its own file never uses.`,
      );
    }
  }
  return findings.sort();
}
