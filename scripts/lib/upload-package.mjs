/**
 * Task 033 Addendum E. Whether the upload package was built from the current
 * `dist/`. `npm run package` names the zip by version alone, so one from an
 * earlier build looks exactly like a current one: the 0.2.0 zip of 2026-09-12
 * predated the icons and everything since, and nothing said so.
 *
 * Judged by time, not content: a rebuild of unchanged sources also reads as
 * newer, and the answer - package again - is cheap and right either way.
 *
 * @param {{ archive: string, archiveModifiedMs: number | null, buildModifiedMs: number }} facts
 *   when the zip, and the newest file in `dist/`, were last written; null when there is no zip
 * @returns {{ ready: string } | { problem: string }}
 */
export function uploadPackageStatus({ archive, archiveModifiedMs, buildModifiedMs }) {
  if (archiveModifiedMs === null) return { problem: `no upload package - run \`npm run package\` to build ${archive}` };
  if (archiveModifiedMs < buildModifiedMs) {
    return { problem: `${archive} is older than dist/ - run \`npm run package\` again before uploading it` };
  }
  return { ready: `${archive}, packaged from the current dist/` };
}
