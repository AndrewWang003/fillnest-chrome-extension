import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { findInlineUserFacingStrings } from "./lib/i18n-conformance.mjs";

/**
 * Task 037, slice 5. A gate that fails when a user-visible string is written
 * inline in a component instead of coming from the catalogue.
 *
 * Last of the slices on purpose: a gate needs a clean baseline to guard, and
 * running it during the translation would have produced nothing but noise. The
 * risk it exists for is not this translation - it is the next component
 * somebody writes.
 */
const root = resolve(import.meta.dirname, "..");
// Task 037 Addendum B: every surface a reader sees. The content script renders
// the Field Control and hosts the Picker; theme definitions carry names.
const scannedRoots = [join(root, "src", "ui"), join(root, "src", "content")];

/** @type {string[]} */
const errors = [];

/** @param {string} dir */
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!/\.tsx?$/u.test(entry.name) || /\.d\.ts$/u.test(entry.name)) continue;
    const source = await readFile(path, "utf8");
    const relativePath = relative(root, path).split("\\").join("/");
    for (const finding of findInlineUserFacingStrings(source)) {
      errors.push(`${relativePath}:${finding.line} renders ${finding.kind} "${finding.text}" inline`);
    }
  }
}

for (const scannedRoot of scannedRoots) await walk(scannedRoot);

if (errors.length > 0) {
  console.error("User-facing strings must come from the message catalogue:\n");
  for (const error of errors) console.error(`  - ${error}\n`);
  console.error(
    "Add the words to src/i18n/messages.ts and every language beside it, then render\n" +
      "the key. AGENTS.md: user-facing strings live in a typed message catalogue,\n" +
      "never inline in a component.\n",
  );
  process.exit(1);
}

console.log("Interface strings: every user-facing string comes from the catalogue.");
