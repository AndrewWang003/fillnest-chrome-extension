import { describe, expect, it } from "vitest";

import {
  buildLogicalPageEvidence,
  buildRoutePattern,
  routeFamily,
  routePatternMatches,
  createSiteKey,
  jaccardSimilarity,
  keyedHash,
  LOGICAL_PAGE_SIMILARITY_THRESHOLD,
} from "../../src/recognition/logical-page-matching";
import type { FieldRecognitionMetadata } from "../../src/recognition/recognition-evidence";

type ExpectFalse<T extends false> = T;
type BuilderTarget = Parameters<typeof buildLogicalPageEvidence>[1];
type DirectDomAccepted = HTMLInputElement extends BuilderTarget ? true : false;
type _BuilderRejectsDirectDom = ExpectFalse<DirectDomAccepted>;

const emailMetadata: FieldRecognitionMetadata = {
  tagName: "INPUT",
  effectiveType: "email",
  name: "applicant_email",
  id: "applicant-email",
  autocomplete: "email",
  ariaLabel: "Applicant email",
  label: "Applicant email",
  formName: "application",
  ancestorTags: ["main", "form"],
  supportedFieldCount: 2,
  equivalentFieldCount: 1,
  equivalentFieldIndex: 0,
};

describe("logical page matching evidence", () => {
  it("normalizes numeric and UUID route segments without retaining record values", () => {
    expect(buildRoutePattern("https://forms.test/main/123/form")).toBe("/main/:number/form");
    expect(buildRoutePattern("https://forms.test/main/456/form")).toBe("/main/:number/form");
    expect(buildRoutePattern("https://forms.test/main/550e8400-e29b-41d4-a716-446655440000/form"))
      .toBe("/main/:uuid/form");
  });

  it("accepts only dynamic Route Patterns for persistent Logical Page evidence", () => {
    // Task 014 Addendum C Slice 2 removed the "is this route dynamic" gate:
    // comparability is now a route *family*, and a page with no record
    // position at all is still comparable to a sibling that differs in one
    // segment. What replaced those predicates is asserted below.
    expect(routeFamily("/customers/:number", "/customers/:number")).toBe("/customers/:number");
    expect(routeFamily("/jobs/data-analyst/apply", "/jobs/senior-engineer/apply")).toBe("/jobs/:id/apply");
    // Not a family: nothing literal in common.
    expect(routeFamily("/orders/:number", "/customers/:number")).toBeNull();
    expect(routeFamily("/contact", "/about")).toBeNull();
    // Not a family: different shapes, or more than one position differing.
    expect(routeFamily("/a/b", "/a/b/c")).toBeNull();
    expect(routeFamily("/a/b/c", "/a/x/y")).toBeNull();
    // A stored Rule's wildcards stand for any value; identical patterns still
    // match, so Rules confirmed before this keep working.
    expect(routePatternMatches("/customers/:number/edit", "/customers/:number/edit")).toBe(true);
    expect(routePatternMatches("/jobs/:id/apply", "/jobs/data-analyst/apply")).toBe(true);
    expect(routePatternMatches("/jobs/:id/apply", "/jobs/data-analyst/view")).toBe(false);
    expect(routePatternMatches("/jobs/:id", "/jobs/a/b")).toBe(false);
  });

  it("recognizes identifier shapes beyond integers and UUIDs, and preserves the exact origin", async () => {
    // Task 014 Addendum C: "applicant-123" is a record, and used to make the
    // whole route unclassifiable - so Logical Page matching could not run on
    // that site at all. New shapes get their own `:id` token; `:number` and
    // `:uuid` are frozen because confirmed Rules are stored and matched by
    // exact route-pattern equality.
    expect(buildRoutePattern("https://forms.test/main/applicant-123/form")).toBe("/main/:id/form");
    await expect(buildLogicalPageEvidence("https://forms.test/main/123/form", emailMetadata, [emailMetadata], "site-key"))
      .resolves.toMatchObject({ origin: "https://forms.test", routePattern: "/main/:number/form" });
  });

  it("computes Jaccard similarity with the empty-set identity", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "c"]))).toBe(1 / 3);
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  it("creates a site key and hashes normalized text opaquely", async () => {
    const siteKey = await createSiteKey();
    expect(siteKey).toBeDefined();
    await expect(keyedHash("site-key", "Applicant email")).resolves.not.toContain("Applicant");
    await expect(keyedHash(siteKey, "Applicant email")).resolves.toMatch(/^[0-9a-f]{64}$/u);
  });

  it("derives field and group-qualified features from metadata without raw text", async () => {
    const evidence = await buildLogicalPageEvidence(
      "https://forms.test/main/123/form",
      { ...emailMetadata, groupText: "Applicant details" },
      [{ ...emailMetadata, groupText: "Applicant details" }],
      "site-key",
    );
    const typedEvidence = evidence;
    expect(typedEvidence.fieldFeatures.size).toBeGreaterThan(0);
    expect(typedEvidence.groupedFieldFeatures.size).toBeGreaterThan(0);
    expect([...typedEvidence.fieldFeatures].join(" ")).not.toContain("Applicant");
    expect(LOGICAL_PAGE_SIMILARITY_THRESHOLD).toBe(0.85);
  });

  it("isolates opaque evidence by required site key", async () => {
    const first = await buildLogicalPageEvidence("https://forms.test/main/123/form", emailMetadata, [emailMetadata], "site-a");
    const second = await buildLogicalPageEvidence("https://forms.test/main/123/form", emailMetadata, [emailMetadata], "site-b");
    expect([...first.fieldFeatures].some((feature) => second.fieldFeatures.has(feature))).toBe(false);
  });

  it("uses per-field group metadata and derives strict field identity", async () => {
    const same = await buildLogicalPageEvidence("https://forms.test/main/123/form", { ...emailMetadata, groupText: "Applicant" }, [{ ...emailMetadata, groupText: "Applicant" }], "site-key");
    const mismatch = await buildLogicalPageEvidence("https://forms.test/main/123/form", { ...emailMetadata, groupText: "Billing" }, [{ ...emailMetadata, groupText: "Billing" }], "site-key");
    expect(jaccardSimilarity(same.fieldFeatures, mismatch.fieldFeatures)).toBe(1);
    expect(jaccardSimilarity(same.groupedFieldFeatures, mismatch.groupedFieldFeatures)).toBeLessThan(0.85);
    expect(same.fieldIdentityKey).not.toBeNull();
    expect(same.fieldIdentityKey).toContain('"tag":"input"');
  });

  it("keeps targeted identity stable when page fields are reordered", async () => {
    const nameMetadata = { ...emailMetadata, effectiveType: "text", name: "applicant_name", id: "applicant-name", label: "Applicant name" };
    const first = await buildLogicalPageEvidence("https://forms.test/main/123/form", emailMetadata, [emailMetadata, nameMetadata], "site-key");
    const reordered = await buildLogicalPageEvidence("https://forms.test/main/123/form", emailMetadata, [nameMetadata, emailMetadata], "site-key");
    expect(reordered).toEqual(first);
  });
});
