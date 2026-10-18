import { createHash } from "node:crypto";

/**
 * Task 033 Addendum F. The privacy policy exists twice: `docs/privacy-policy.md`
 * here, and the public URL the store listing points at. The repository copy is
 * the source; the public one is derived from it by dropping the two parts that
 * only mean something inside this repository - the revision header, and the
 * section naming the tests and files each claim can be checked against.
 *
 * Deriving it rather than maintaining a second copy is the point: the only way
 * the two can differ is if the public one was not republished, which
 * `policyPublicationProblem` reports.
 */

const INTERNAL_SECTION = "## How To Check These Claims";

/** The policy's text without its title, its revision header or the verification section. */
export function publicPolicyBody(/** @type {string} */ source) {
  const withoutInternal = source.split(INTERNAL_SECTION)[0] ?? source;
  // Everything from the first section heading on: the title and the revision
  // paragraph above it are replaced when the public text is rendered.
  const firstSection = withoutInternal.indexOf("\n## ");
  const body = firstSection === -1 ? withoutInternal : withoutInternal.slice(firstSection + 1);
  return `${body.trimEnd()}\n`;
}

export function publicPolicyBodyHash(/** @type {string} */ source) {
  return createHash("sha256").update(publicPolicyBody(source), "utf8").digest("hex");
}

/**
 * The text to publish, ready to paste.
 *
 * @param {string} source
 * @param {{ effectiveDate: string, version: string }} publication
 */
export function renderPublicPolicy(source, { effectiveDate, version }) {
  return `# FillNest Privacy Policy\n\n**Effective ${effectiveDate}, for FillNest ${version}.**\n\n${publicPolicyBody(source)}`;
}

/**
 * Whether what is published still describes what this repository ships.
 *
 * @param {{ source: string, record: { url: string, effectiveDate: string, version: string, bodySha256: string } | null, version: string }} facts
 * @returns {string | null} the problem, or null when the two agree
 */
export function policyPublicationProblem({ source, record, version }) {
  if (!record) {
    return "the privacy policy is not published at a public URL, which the store listing requires (owner: hosting)";
  }
  if (record.bodySha256 !== publicPolicyBodyHash(source)) {
    return (
      `docs/privacy-policy.md has changed since it was published at ${record.url} - run \`npm run policy:public\`, ` +
      "update that page, then record the new hash in docs/privacy-policy-published.json"
    );
  }
  if (record.version !== version) {
    return (
      `the published privacy policy says it covers ${record.version}, but this build is ${version} - ` +
      `republish it from \`npm run policy:public\` at ${record.url} and record the new version`
    );
  }
  return null;
}
