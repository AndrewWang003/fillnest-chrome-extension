#!/usr/bin/env node
/**
 * Packages `dist/` as a store-uploadable zip.
 *
 * Task 033. Refuses to package a build that has not passed
 * `verify-build.mjs`, so a zip can never contain the open-Shadow-Root test
 * build or a stray unexpected file.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const verify = spawnSync(process.execPath, [resolve("scripts/verify-build.mjs")], { stdio: "inherit" });
if (verify.status !== 0) {
  console.error("\nRefusing to package: the built extension did not pass verification.");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(resolve("dist/manifest.json"), "utf8"));
const outputDir = resolve("output");
const archive = resolve(outputDir, `fillnest-${manifest.version}.zip`);

await mkdir(outputDir, { recursive: true });
await rm(archive, { force: true });

// `zip` from the working directory of dist/, so the archive has the manifest at
// its root - the store rejects an archive with a wrapping folder.
const zip = spawnSync("zip", ["-r", "-X", "-q", archive, "."], { cwd: resolve("dist"), stdio: "inherit" });
if (zip.status !== 0) {
  console.error("Packaging failed. Is `zip` available on this system?");
  process.exit(1);
}

console.log(`Packaged ${archive}`);
console.log("This is an upload artifact only - nothing here submits it.");
