import { describe, expect, it } from "vitest";

import { uploadPackageStatus } from "../../scripts/lib/upload-package.mjs";

// Task 033 Addendum E: verify:store says when the upload package is missing or
// was built before the current dist/, since both carry the same file name.

describe("uploadPackageStatus", () => {
  const archive = "output/fillnest-0.2.0.zip";

  it("accepts a package written after every file in dist/", () => {
    expect(uploadPackageStatus({ archive, archiveModifiedMs: 2_000, buildModifiedMs: 1_000 })).toHaveProperty("ready");
  });

  it("names a package older than dist/", () => {
    const status = uploadPackageStatus({ archive, archiveModifiedMs: 1_000, buildModifiedMs: 2_000 });
    expect(status).toHaveProperty("problem");
    expect("problem" in status && status.problem).toContain("npm run package");
  });

  it("names a missing package", () => {
    expect(uploadPackageStatus({ archive, archiveModifiedMs: null, buildModifiedMs: 1_000 })).toHaveProperty("problem");
  });
});
