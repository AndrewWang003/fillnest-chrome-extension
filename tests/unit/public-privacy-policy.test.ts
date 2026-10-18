import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  policyPublicationProblem,
  publicPolicyBody,
  publicPolicyBodyHash,
  renderPublicPolicy,
} from "../../scripts/lib/public-privacy-policy.mjs";

// Task 033 Addendum F: the policy exists twice - in this repository and at the
// public URL the store listing points at. The repository copy is the source;
// these derive the public text from it and report when the two have drifted.

const SOURCE = `# FillNest Privacy Policy

**Draft, 2026-09-08; corrected 2026-09-11** against the code, and on
2026-09-15 after a further audit. Written from the code rather than from
intent; every claim below is checkable.

## What FillNest Does

It offers templates.

## Contact

fillnest.feedback@gmail.com.

## How To Check These Claims

- No network capability: \`tests/unit/runtime-network-allowlist.test.ts\`.
`;

describe("the public privacy policy", () => {
  it("drops the internal header and the verification section", () => {
    const body = publicPolicyBody(SOURCE);

    expect(body).toContain("## What FillNest Does");
    expect(body).toContain("## Contact");
    expect(body).not.toContain("Draft, 2026-09-08");
    expect(body).not.toContain("How To Check These Claims");
    expect(body).not.toContain("runtime-network-allowlist");
  });

  it("renders the title and one effective line above that body", () => {
    const rendered = renderPublicPolicy(SOURCE, { effectiveDate: "2026-09-16", version: "0.2.0" });

    expect(rendered.startsWith("# FillNest Privacy Policy\n\n**Effective 2026-09-16, for FillNest 0.2.0.**")).toBe(true);
    expect(rendered).toContain("## What FillNest Does");
    expect(rendered).not.toContain("How To Check These Claims");
  });

  it("says nothing when the published record matches the source and the shipped version", () => {
    const record = { url: "https://gist.github.com/x/y", effectiveDate: "2026-09-16", version: "0.2.0", bodySha256: publicPolicyBodyHash(SOURCE) };

    expect(policyPublicationProblem({ source: SOURCE, record, version: "0.2.0" })).toBeNull();
  });

  it("reports a policy edited since it was published", () => {
    const record = { url: "https://gist.github.com/x/y", effectiveDate: "2026-09-16", version: "0.2.0", bodySha256: "0".repeat(64) };
    const problem = policyPublicationProblem({ source: SOURCE, record, version: "0.2.0" });

    expect(problem).toContain("https://gist.github.com/x/y");
    expect(problem).toContain("policy:public");
  });

  it("reports a policy published for an earlier version of the extension", () => {
    const record = { url: "https://gist.github.com/x/y", effectiveDate: "2026-09-16", version: "0.2.0", bodySha256: publicPolicyBodyHash(SOURCE) };

    expect(policyPublicationProblem({ source: SOURCE, record, version: "0.3.0" })).toContain("0.3.0");
  });

  it("reports a policy that was never published", () => {
    expect(policyPublicationProblem({ source: SOURCE, record: null, version: "0.2.0" })).toContain("not published");
  });

  it("derives a public text from the policy this repository actually ships", () => {
    const rendered = renderPublicPolicy(readFileSync("docs/privacy-policy.md", "utf8"), {
      effectiveDate: "2026-09-16",
      version: "0.2.0",
    });

    expect(rendered).toContain("## What FillNest Does Not Read");
    expect(rendered).toContain("fillnest.feedback@gmail.com");
    expect(rendered).not.toContain("How To Check These Claims");
    expect(rendered).not.toContain("Not published anywhere by this repository");
  });
});
