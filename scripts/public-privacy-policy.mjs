#!/usr/bin/env node
/**
 * Prints the privacy policy as it should be published, ready to paste.
 *
 * Task 033 Addendum F. The public copy is derived from
 * `docs/privacy-policy.md` rather than maintained beside it: the revision
 * header and the verification section go, and one effective line takes their
 * place. Print it, paste it as Markdown - not as rendered text, which loses
 * every heading and list - and record what was published:
 *
 *   npm run --silent policy:public | pbcopy
 *   npm run policy:public -- --record   # after the public page is updated
 *
 * `--silent` matters: without it npm writes its own two banner lines to
 * stdout, and they end up in whatever the output is piped into - as they did
 * on 2026-09-16, straight into the published page.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { publicPolicyBodyHash, renderPublicPolicy } from "./lib/public-privacy-policy.mjs";

const RECORD_PATH = resolve("docs/privacy-policy-published.json");

const source = await readFile(resolve("docs/privacy-policy.md"), "utf8");
const { version } = JSON.parse(await readFile(resolve("public/manifest.json"), "utf8"));
const record = JSON.parse(await readFile(RECORD_PATH, "utf8").catch(() => "null"));

if (process.argv.includes("--record")) {
  if (!record?.url) {
    console.error(`Nothing to record: ${RECORD_PATH} has no url. Publish the policy first, then add its URL there.`);
    process.exit(1);
  }
  const updated = {
    ...record,
    effectiveDate: new Date().toISOString().slice(0, 10),
    version,
    bodySha256: publicPolicyBodyHash(source),
  };
  await writeFile(RECORD_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.error(`Recorded ${record.url} as carrying this policy for ${version}.`);
  console.error("Only do this once the public page actually shows it.");
} else {
  // The text on stdout and nothing else, so `| pbcopy` copies exactly it.
  process.stdout.write(
    renderPublicPolicy(source, {
      effectiveDate: record?.effectiveDate ?? new Date().toISOString().slice(0, 10),
      version,
    }),
  );
  console.error(`\n---\nPaste this as Markdown${record?.url ? ` at ${record.url}` : ""}, then run \`npm run policy:public -- --record\`.`);
}
