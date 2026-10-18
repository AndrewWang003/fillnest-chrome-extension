// Task 032 interim check (the ESLint item is blocked by the TypeScript 7
// baseline). These tests prove the check fails on the class the audit actually
// found, and stays quiet on the two shapes that are not dead code - otherwise
// a check that currently reports zero would be indistinguishable from one that
// never reports anything.
import { describe, expect, it } from "vitest";

import { findDeadExports } from "../../scripts/lib/unused-exports.mjs";

const file = (path: string, source: string) => ({ path, source });

describe("dead export detection", () => {
  it("reports an export that nobody imports and its own file never uses", () => {
    // The exact shape of `UndoIcon` and `StaticSurface`, which the audit found
    // and Task 028 removed.
    const findings = findDeadExports(
      [file("src/a.ts", "export function orphan() {\n  return 1;\n}\n")],
      [],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/`orphan`/u);
  });

  it("stays quiet when another file imports it", () => {
    expect(
      findDeadExports(
        [
          file("src/a.ts", "export function used() {\n  return 1;\n}\n"),
          file("src/b.ts", 'import { used } from "./a";\nused();\n'),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("stays quiet for an over-exported symbol its own file still uses", () => {
    // Not dead code - it should just drop `export`. There are ~47 of these
    // today; failing the build on them would need an allow-list that defeats
    // the check.
    expect(
      findDeadExports(
        [
          // LIMIT is over-exported: only this file uses it. `used` is a real
          // export with a real importer, so the fixture isolates one shape.
          file("src/a.ts", "export const LIMIT = 3;\nexport function used() {\n  return LIMIT;\n}\n"),
          file("src/b.ts", 'import { used } from "./a";\nused();\n'),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("follows a renamed import and a type-only import", () => {
    expect(
      findDeadExports(
        [
          file("src/a.ts", "export function used() {\n  return 1;\n}\n"),
          file("src/b.ts", 'import { used as renamed } from "./a";\nrenamed();\n'),
        ],
        [],
      ),
    ).toEqual([]);
    expect(
      findDeadExports(
        [
          file("src/a.ts", "export const shape = 1;\n"),
          file("src/b.ts", 'import type { shape } from "./a";\n'),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("exempts a declared entry point, whose exports the bundler reaches", () => {
    expect(
      findDeadExports([file("src/main.tsx", "export function boot() {\n  return 1;\n}\n")], [
        "src/main.tsx",
      ]),
    ).toEqual([]);
  });

  it("refuses to answer rather than guess when a wildcard re-export exists", () => {
    // `export * from` makes "who imports this name" unanswerable by reading
    // import clauses. Reporting confident false positives would be worse than
    // saying the check no longer applies.
    const findings = findDeadExports(
      [
        file("src/a.ts", "export function orphan() {\n  return 1;\n}\n"),
        file("src/index.ts", 'export * from "./a";\n'),
      ],
      [],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/export \* from/u);
  });
});
