#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { findDeadExports } from "./lib/unused-exports.mjs";

const root = resolve(import.meta.dirname, "..");

// Reached by the bundler or by an HTML entry rather than by an import, so
// their exports can legitimately have no importer. Kept explicit and short:
// this list is the one place a file can opt out of the check.
const ENTRY_POINTS = [
  "src/background/service-worker.ts",
  "src/content/content-script.tsx",
  "src/ui/popup/main.tsx",
  "src/ui/side-panel/main.tsx",
];

/** @param {string} dir @returns {Promise<{path: string, source: string}[]>} */
async function readSources(dir) {
  /** @type {{path: string, source: string}[]} */
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await readSources(full)));
    else if (/\.tsx?$/u.test(entry.name) && !/\.d\.ts$/u.test(entry.name)) {
      files.push({ path: relative(root, full), source: await readFile(full, "utf8") });
    }
  }
  return files;
}

// Tests are read so that a helper exported solely for a test still counts as
// used, but tests are never themselves reported.
const [srcFiles, testFiles] = await Promise.all([
  readSources(join(root, "src")),
  readSources(join(root, "tests")),
]);

const findings = findDeadExports([...srcFiles, ...testFiles], [
  ...ENTRY_POINTS,
  ...testFiles.map((file) => file.path),
]);

if (findings.length > 0) {
  console.error("Dead exports found:\n");
  for (const finding of findings) console.error(`  - ${finding}\n`);
  console.error(
    "AGENTS.md forbids unused interfaces and placeholder models. If a file is reached\n" +
      "by the bundler rather than by an import, add it to ENTRY_POINTS with that reason.\n",
  );
  process.exit(1);
}

console.log(`Dead exports: none across ${srcFiles.length} source files.`);
