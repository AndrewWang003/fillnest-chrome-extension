#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { findDocumentationDrift } from "./lib/docs-conformance.mjs";

const root = resolve(import.meta.dirname, "..");

/**
 * @returns {Promise<string>} every .ts/.tsx source under src/ui, plus the
 * English message catalogue, concatenated.
 *
 * Task 037 moved user-facing labels out of the components and into a typed
 * catalogue, so a component now holds a key where it used to hold the words.
 * The English catalogue is the source of those words, and this check reads it
 * for the same reason it reads the components: it is where the product's
 * labels actually are.
 */
async function readUiSources() {
  const uiRoot = join(root, "src", "ui");
  /** @type {string[]} */
  const chunks = [];
  /** @param {string} dir */
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.tsx?$/u.test(entry.name)) chunks.push(await readFile(path, "utf8"));
    }
  }
  await walk(uiRoot);
  chunks.push(await readFile(join(root, "src", "i18n", "messages.ts"), "utf8"));
  return chunks.join("\n");
}

const [projectMarkdown, tasksReadme, uiSources, taskDirEntries] = await Promise.all([
  readFile(join(root, "PROJECT.md"), "utf8"),
  readFile(join(root, "tasks", "README.md"), "utf8"),
  readUiSources(),
  readdir(join(root, "tasks")),
]);

const taskFiles = taskDirEntries.filter((name) => /^\d{3}-[a-z0-9-]+\.md$/u.test(name)).sort();

const errors = findDocumentationDrift({ projectMarkdown, tasksReadme, uiSources, taskFiles });

if (errors.length > 0) {
  console.error("Documentation conformance failed:\n");
  for (const error of errors) console.error(`  - ${error}\n`);
  console.error(
    "These documents outrank DEVELOPMENT.md in the reading order, and the handoff guide\n" +
      "tells an agent to stop rather than guess when they conflict with the product.\n",
  );
  process.exit(1);
}

console.log(`Documentation conformance: ${taskFiles.length} contracts, no drift.`);
