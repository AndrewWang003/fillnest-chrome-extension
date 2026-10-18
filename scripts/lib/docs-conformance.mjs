/**
 * Task 029 Slice 4 - documentation conformance.
 *
 * The 2026-09-06 whole-extension audit found four separate conflicts between
 * the documents an agent is required to read first and the product that
 * exists: a release row naming five themes while the roadmap listed eighteen
 * contracts, a stable rule the code had deliberately removed, control labels
 * that no longer existed, and a roadmap whose own execution order stopped two
 * Tasks short.
 *
 * Task 022 had already tried to fix this class by hand and missed all four.
 * These checks exist so the next drift is a build failure instead of a reading
 * exercise. They only report; nothing here rewrites a document.
 */

/**
 * Control labels named in PROJECT.md that deliberately have no implementation.
 * Every entry needs a reason, so this list stays small enough to be honest and
 * cannot quietly become a way to silence the check.
 */
const UNIMPLEMENTED_LABELS = new Map([
  ["Forget this field", "Deferred from the default V1 UI (PROJECT.md, Edit And Delete Behaviour)."],
  ["Bind and insert", "A Deferred Decision in PROJECT.md; no UI exists by design."],
  [
    "Search all templates",
    "Named only to state that V1 has no such disclosure; its absence is the rule.",
  ],
]);

/**
 * Backticked phrases that look like a user-facing control, not code or prose.
 * @param {string} projectMarkdown
 * @returns {string[]}
 */
function extractControlLabels(projectMarkdown) {
  const labels = new Set();
  for (const match of projectMarkdown.matchAll(/`([^`\n]+)`/gu)) {
    const phrase = (match[1] ?? "").trim();
    // A control label is multi-word and starts with a capital. That excludes
    // identifiers (`schemaVersion`), file names (`AGENTS.md`), typed
    // confirmations (`delete`, `reset`), and single-word jargon.
    if (!/^[A-Z][^`]*\s/u.test(phrase)) continue;
    // Exclude prose fragments: a real control label is short.
    if (phrase.split(/\s+/u).length > 6) continue;
    // Exclude anything carrying punctuation a button would not have.
    if (/[.,;:()/]/u.test(phrase)) continue;
    // Exclude navigation paths such as `Settings > Data`, which name a
    // destination rather than a control.
    if (phrase.includes(">")) continue;
    labels.add(phrase);
  }
  return [...labels];
}

/**
 * @param {{
 *   projectMarkdown: string,
 *   tasksReadme: string,
 *   uiSources: string,
 *   taskFiles: string[],
 * }} input
 * @returns {string[]} human-readable drift descriptions; empty means conformant
 */
export function findDocumentationDrift(input) {
  const errors = [];

  // 1. Every control label PROJECT.md names must exist in the UI.
  for (const label of extractControlLabels(input.projectMarkdown)) {
    if (UNIMPLEMENTED_LABELS.has(label)) continue;
    if (input.uiSources.includes(label)) continue;
    errors.push(
      `PROJECT.md names the control \`${label}\`, which no file under src/ui/ renders. ` +
        `Either the product changed and PROJECT.md did not, or the label is deferred and ` +
        `belongs in UNIMPLEMENTED_LABELS with a reason.`,
    );
  }

  // 2. Every contract the roadmap links must exist, and every contract must be
  //    linked. A contract nobody links is a contract nobody reads.
  const linked = new Set(
    [...input.tasksReadme.matchAll(/\]\((\d{3}-[a-z0-9-]+\.md)\)/gu)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    ),
  );
  for (const file of linked) {
    if (!input.taskFiles.includes(file)) {
      errors.push(`tasks/README.md links ${file}, which does not exist.`);
    }
  }
  for (const file of input.taskFiles) {
    if (!linked.has(file)) {
      errors.push(`tasks/${file} exists but tasks/README.md never links it.`);
    }
  }

  // 3. Every roadmap row must appear in its version's execution order. This is
  //    the check that would have caught Tasks 026 and 027 being absent from the
  //    0.1.2 order while sitting in the table directly above it.
  const orderSection = input.tasksReadme.split(/^## .*Execution Order.*$/mu)[1] ?? "";
  const orderBody = orderSection.split(/^## /mu)[0] ?? "";
  const orderedNumbers = new Set(
    [...orderBody.matchAll(/Task (\d{3})/gu)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    ),
  );
  for (const match of input.tasksReadme.matchAll(/^\|\s*(\d{3})\s*\/\s*0\.1\.2 Task \d+\s*\|/gmu)) {
    const number = match[1];
    if (number === undefined) continue;
    if (!orderedNumbers.has(number)) {
      errors.push(
        `tasks/README.md lists Task ${number} under 0.1.2 but its Execution Order never mentions it.`,
      );
    }
  }

  return errors;
}
