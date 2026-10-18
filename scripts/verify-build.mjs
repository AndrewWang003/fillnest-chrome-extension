import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

import { validateBuiltPackage } from "./lib/manifest-policy.mjs";
import { findForbiddenNetworkCapabilities } from "./lib/network-capability-policy.mjs";

const outputDirectory = resolve("dist");
const files = await listFiles(outputDirectory);
const relativeFiles = new Set(
  files.map((file) => relative(outputDirectory, file).split("\\").join("/")),
);
const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.json"), "utf8"));
const errors = validateBuiltPackage(manifest, relativeFiles);

// `.png` is for the store icons alone; manifest-policy admits only the ones the
// manifest declares (Task 033 Addendum A).
const allowedExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".png"]);
for (const file of files) {
  const relativeFile = relative(outputDirectory, file).split("\\").join("/");
  const extension = extname(file);

  if (!allowedExtensions.has(extension)) {
    errors.push(`built package contains unexpected file ${relativeFile}`);
    continue;
  }

  if (extension !== ".json" && extension !== ".png") {
    const content = await readFile(file, "utf8");
    const networkRelevantContent = removeStandardNamespaceUris(content);
    if (/https?:\/\//u.test(networkRelevantContent)) {
      errors.push(`built package contains a remote URL in ${relativeFile}`);
    }
    for (const capability of findForbiddenNetworkCapabilities(content)) {
      errors.push(
        `built package contains forbidden network capability ${capability} in ${relativeFile}`,
      );
    }
  }
}

// Task 030: the shipped artifact's Shadow Roots must be closed. A host page
// can read an open Shadow Root from its own main world, and the Picker renders
// Template content including full-library, cross-Site Search results. The mode
// is fixed by a Vite `define`, so this asserts the actual shipped bytes rather
// than trusting that nobody ran the wrong build - forgetting, or a refactor
// that reintroduces the open mode, fails the build instead of shipping quietly.
//
// Read through the minifier rather than around it: it renames the constant and
// rewrites string literals as template literals, so match the identifier used
// at the call site and then resolve what it was assigned.
const contentScript = await readFile(resolve(outputDirectory, "assets/content-script.js"), "utf8");
for (const mode of shadowRootModes(contentScript)) {
  if (mode !== "closed") {
    errors.push(
      `built content script creates a Shadow Root with mode "${mode}" - ` +
        "did this run `npm run build:e2e` instead of `npm run build`?",
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log(`Verified ${relativeFiles.size} built extension files.`);
}

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );

  return nestedFiles.flat().sort();
}

/** @param {string} content */
function removeStandardNamespaceUris(content) {
  return content
    .replaceAll("http://www.w3.org/1998/Math/MathML", "")
    .replaceAll("http://www.w3.org/1999/xhtml", "")
    .replaceAll("http://www.w3.org/2000/svg", "");
}

/**
 * Every Shadow Root mode the built content script actually uses.
 *
 * Throws rather than returning nothing when no `attachShadow` call is found:
 * a check that silently passes on an unrecognised bundle is worse than no
 * check, since this one guards a confirmed privacy hole.
 *
 * @param {string} content
 * @returns {string[]}
 */
function shadowRootModes(content) {
  const calls = [...content.matchAll(/attachShadow\(\{\s*mode:\s*([^}]+?)\s*\}\)/gu)];
  if (calls.length === 0) {
    throw new Error("verify-build could not find any attachShadow call in the built content script");
  }
  return calls.map((call) => {
    const argument = (call[1] ?? "").trim();
    const literal = argument.match(/^["'`](open|closed)["'`]$/u);
    if (literal?.[1]) return literal[1];
    // Minified to an identifier: resolve its assignment.
    const assignment = content.match(
      new RegExp(`\\b${argument.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*=\\s*["'\`](open|closed)["'\`]`, "u"),
    );
    if (assignment?.[1]) return assignment[1];
    throw new Error(
      `verify-build could not resolve the Shadow Root mode from ${JSON.stringify(argument)}`,
    );
  });
}
