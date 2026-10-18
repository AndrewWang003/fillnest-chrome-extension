#!/usr/bin/env node
/**
 * Reports what still stands between `dist/` and a Chrome Web Store submission.
 *
 * Task 033. Deliberately NOT part of `npm run check`: the project is not trying
 * to be submittable yet, and a gate that is permanently red teaches people to
 * ignore gates. Run it when you want the list.
 */
import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { feedbackAddressFrom } from "./lib/feedback-address.mjs";
import { isPromoTileSize, isStoreScreenshotSize, pngSize } from "./lib/png-size.mjs";
import { policyPublicationProblem } from "./lib/public-privacy-policy.mjs";
import { storeDescriptionProblems } from "./lib/store-description.mjs";
import { uploadPackageStatus } from "./lib/upload-package.mjs";

const REQUIRED_ICON_SIZES = ["16", "32", "48", "128"];

/** @param {string} path */
async function exists(path) {
  try {
    await access(resolve(path));
    return true;
  } catch {
    return false;
  }
}

/**
 * The PNGs in a directory whose pixel size the store accepts for this slot.
 *
 * @param {string} dir
 * @param {(size: { width: number, height: number }) => boolean} accepts
 * @returns {Promise<string[]>}
 */
async function imagesIn(dir, accepts) {
  const names = await readdir(resolve(dir)).catch(() => []);
  /** @type {string[]} */
  const found = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    const size = pngSize(await readFile(resolve(dir, name)));
    if (size && accepts(size)) found.push(name);
  }
  return found.sort();
}

/** @param {string} dir @returns {Promise<number>} the newest modification time of any file below it */
async function newestModification(dir) {
  let newest = 0;
  for (const entry of await readdir(resolve(dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const modified = entry.isDirectory() ? await newestModification(path) : (await stat(resolve(path))).mtimeMs;
    newest = Math.max(newest, modified);
  }
  return newest;
}

/** @type {string[]} */
const blockers = [];
/** @type {string[]} */
const ready = [];

const manifest = JSON.parse(await readFile(resolve("public/manifest.json"), "utf8"));

if (manifest.manifest_version === 3) ready.push("Manifest V3");
else blockers.push("manifest_version must be 3");

const icons = manifest.icons ?? {};
const missingIcons = REQUIRED_ICON_SIZES.filter((size) => !icons[size]);
if (missingIcons.length === 0) ready.push(`manifest icons (${REQUIRED_ICON_SIZES.join(", ")})`);
else {
  blockers.push(
    `manifest declares no icons for ${missingIcons.join(", ")} - the store requires all of ` +
      `${REQUIRED_ICON_SIZES.join(", ")} plus a 128x128 listing icon (owner: artwork)`,
  );
}

for (const [size, path] of Object.entries(icons)) {
  if (!(await exists(`public/${path}`))) {
    blockers.push(`manifest icon ${size} points at public/${path}, which does not exist`);
  }
}

// The manifest names a message; what the store shows is that message in each
// language, so that is what is measured.
/** @type {Record<string, Record<string, { message?: unknown }>>} */
const catalogues = {};
for (const locale of await readdir(resolve("public/_locales")).catch(() => [])) {
  catalogues[locale] = JSON.parse(await readFile(resolve(`public/_locales/${locale}/messages.json`), "utf8"));
}
const descriptionProblems = storeDescriptionProblems(manifest.description, catalogues);
if (descriptionProblems.length === 0) ready.push(`short description (${Object.keys(catalogues).join(", ") || "literal"})`);
else blockers.push(...descriptionProblems);

const [major = 0, minor = 0] = String(manifest.version).split(".").map(Number);
if (major === 0 && minor < 2) {
  blockers.push(`manifest version is ${manifest.version} - the 0.2.0 gate expects a release bump (owner: release decision)`);
} else {
  ready.push(`version ${manifest.version}`);
}

if (await exists("docs/privacy-policy.md")) {
  ready.push("privacy policy text (docs/privacy-policy.md)");
  // Task 033 Addendum F: the published copy is derived from that text, so the
  // two can only differ if the public page was not updated with it.
  const record = JSON.parse(await readFile(resolve("docs/privacy-policy-published.json"), "utf8").catch(() => "null"));
  const problem = policyPublicationProblem({
    source: await readFile(resolve("docs/privacy-policy.md"), "utf8"),
    record,
    version: manifest.version,
  });
  if (problem) blockers.push(problem);
  else ready.push(`privacy policy published at ${record.url}`);
} else {
  blockers.push("no privacy policy document");
}

const feedback = feedbackAddressFrom(await readFile(resolve("src/support/feedback.ts"), "utf8").catch(() => ""));
if ("address" in feedback) ready.push(`feedback address (${feedback.address})`);
else blockers.push(feedback.problem);

if (await exists("dist/manifest.json")) {
  ready.push("a built dist/");
  const archive = `output/fillnest-${manifest.version}.zip`;
  const packaged = uploadPackageStatus({
    archive,
    archiveModifiedMs: (await exists(archive)) ? (await stat(resolve(archive))).mtimeMs : null,
    buildModifiedMs: await newestModification("dist"),
  });
  if ("ready" in packaged) ready.push(packaged.ready);
  else blockers.push(packaged.problem);
} else {
  blockers.push("no dist/ - run `npm run build`");
}

// Task 033 Addendum H: read the images rather than assert they are missing.
const screenshots = await imagesIn("output/store-screenshots", isStoreScreenshotSize);
if (screenshots.length > 0) ready.push(`${screenshots.length} store screenshot(s) in output/store-screenshots`);
else blockers.push("no store screenshots (1280x800 or 640x400) in output/store-screenshots - run `npm run shots:store`");

const promoTiles = await imagesIn("output/promo", isPromoTileSize);
if (promoTiles.length > 0) ready.push(`small promo tile (440x280) in output/promo`);
else blockers.push("no small promo tile (440x280) in output/promo, which the store requires (owner: artwork)");

console.log("Ready:");
for (const item of ready) console.log(`  - ${item}`);
console.log("\nBlocking submission:");
for (const item of blockers) console.log(`  - ${item}`);
console.log(`\n${blockers.length} item(s) remain. See tasks/033-chrome-web-store-beta-readiness.md.`);
process.exitCode = blockers.length === 0 ? 0 : 1;
