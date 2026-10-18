// Task 029 Slice 4. The check exists because Task 022 tried to fix this class
// of drift by hand and missed every instance of it; these tests prove the
// check actually fails on each shape of drift the audit found, rather than
// passing vacuously.
import { describe, expect, it } from "vitest";

import { findDocumentationDrift } from "../../scripts/lib/docs-conformance.mjs";

const conformantInput = {
  projectMarkdown: "- The row action is `Save everywhere`.\n",
  tasksReadme: [
    "| 001 / 0.1.2 Task 01 | [One](001-one.md) | x | Complete |",
    "## 0.1.2 Execution Order",
    "1. Task 001.",
  ].join("\n"),
  uiSources: 'const label = "Save everywhere";',
  taskFiles: ["001-one.md"],
};

const drift = (overrides: Partial<typeof conformantInput>): string[] =>
  findDocumentationDrift({ ...conformantInput, ...overrides });

describe("documentation conformance", () => {
  it("passes when the documents describe the product that exists", () => {
    expect(drift({})).toEqual([]);
  });

  it("fails when PROJECT.md names a control the UI does not render", () => {
    // The audit's finding D3: PROJECT.md documented `Save a copy for this
    // field` long after Task 026 renamed it, and a stale label of exactly this
    // shape silently disabled an E2E test for weeks.
    const errors = drift({ uiSources: 'const label = "Save a copy here";' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Save everywhere/u);
  });

  it("does not flag identifiers, filenames, typed words, or navigation paths", () => {
    // A check that cries wolf gets switched off, so the heuristic must ignore
    // the many backticked things in PROJECT.md that are not controls.
    const errors = drift({
      projectMarkdown: [
        "Set `schemaVersion` in `AGENTS.md`, type `delete`, and open `Settings > Data`.",
        "Run `npm run check` before `Save everywhere`.",
        "It `Requires a sentence long enough that it is clearly prose, not a button`.",
      ].join("\n"),
    });
    expect(errors).toEqual([]);
  });

  it("allows a deliberately unimplemented label only through the documented list", () => {
    // `Forget this field` is deferred by PROJECT.md itself.
    expect(drift({ projectMarkdown: "- `Forget this field` is deferred.\n" })).toEqual([]);
    expect(drift({ projectMarkdown: "- `Invented Control Name` is not.\n" })).toHaveLength(1);
  });

  it("fails when a contract is linked but missing, or exists but unlinked", () => {
    expect(drift({ taskFiles: [] })[0]).toMatch(/links 001-one\.md, which does not exist/u);
    expect(drift({ taskFiles: ["001-one.md", "002-two.md"] })[0]).toMatch(
      /002-two\.md exists but tasks\/README\.md never links it/u,
    );
  });

  it("fails when a roadmap row is missing from its version's execution order", () => {
    // The audit's finding D1 in miniature, and the exact gap that let Tasks
    // 026 and 027 sit in the roadmap table while the order below it stopped at
    // Task 025.
    const errors = drift({
      tasksReadme: [
        "| 001 / 0.1.2 Task 01 | [One](001-one.md) | x | Complete |",
        "| 002 / 0.1.2 Task 02 | [Two](002-two.md) | x | Complete |",
        "## 0.1.2 Execution Order",
        "1. Task 001.",
      ].join("\n"),
      taskFiles: ["001-one.md", "002-two.md"],
    });
    expect(errors).toEqual([
      "tasks/README.md lists Task 002 under 0.1.2 but its Execution Order never mentions it.",
    ]);
  });

  it("does not treat a later section as part of the execution order", () => {
    // Task 002 is mentioned only after the order section ends, so it must
    // still count as missing.
    const errors = drift({
      tasksReadme: [
        "| 002 / 0.1.2 Task 02 | [Two](002-two.md) | x | Complete |",
        "## 0.1.2 Execution Order",
        "1. Nothing here.",
        "## Deferred Beyond V1",
        "- Task 002 is discussed here.",
      ].join("\n"),
      taskFiles: ["002-two.md"],
    });
    expect(errors).toContain(
      "tasks/README.md lists Task 002 under 0.1.2 but its Execution Order never mentions it.",
    );
  });
});
