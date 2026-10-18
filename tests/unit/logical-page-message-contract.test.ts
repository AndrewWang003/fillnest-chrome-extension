import { describe, expect, it } from "vitest";

import { isRuntimeRequest } from "../../src/messages/runtime-messages";

describe("Logical Page Matching message contract", () => {
  it("accepts only a page URL when requesting its Site HMAC key", () => {
    expect(isRuntimeRequest({
      type: "GET_LOGICAL_PAGE_SITE_KEY",
      pageUrl: "https://forms.example.test/customers/123",
    })).toBe(true);
    expect(isRuntimeRequest({ type: "GET_LOGICAL_PAGE_SITE_KEY", pageUrl: 123 })).toBe(false);
    expect(isRuntimeRequest({ type: "GET_LOGICAL_PAGE_SITE_KEY" })).toBe(false);
  });

  it("accepts only opaque hashes when recording a Page Observation", () => {
    const request = {
      type: "RECORD_LOGICAL_PAGE_OBSERVATION",
      pageUrl: "https://forms.example.test/customers/123",
      pageProfileId: "page-1",
      siteKeyId: "site-key-1",
      evidence: {
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
      },
    };

    expect(isRuntimeRequest(request)).toBe(true);
    expect(isRuntimeRequest({ ...request, evidence: { ...request.evidence, fieldFeatureHashes: ["Applicant email"] } })).toBe(false);
    expect(isRuntimeRequest({ ...request, evidence: { ...request.evidence, fieldIdentityKey: '{"name":"email"}' } })).toBe(false);
    expect(isRuntimeRequest({ ...request, evidence: { ...request.evidence, routePattern: null } })).toBe(false);
  });

  const candidateEvidence = {
    origin: "https://forms.example.test",
    routePattern: "/customers/:number",
    fieldFeatureHashes: ["a".repeat(64)],
    groupedFieldFeatureHashes: ["b".repeat(64)],
    fieldIdentityKey: '{"name":"email"}',
  };

  it("accepts only opaque hashes plus a field identity key when resolving a Logical Page candidate", () => {
    const request = { type: "RESOLVE_LOGICAL_PAGE_CANDIDATE", evidence: candidateEvidence };

    expect(isRuntimeRequest(request)).toBe(true);
    expect(isRuntimeRequest({ type: "RESOLVE_LOGICAL_PAGE_CANDIDATE", evidence: { ...candidateEvidence, fieldIdentityKey: null } })).toBe(true);
    expect(isRuntimeRequest({ ...request, evidence: { ...candidateEvidence, fieldFeatureHashes: ["Applicant email"] } })).toBe(false);
    expect(isRuntimeRequest({ ...request, evidence: { ...candidateEvidence, routePattern: null } })).toBe(false);
    expect(isRuntimeRequest({ ...request, evidence: { ...candidateEvidence, fieldIdentityKey: 42 } })).toBe(false);
    expect(isRuntimeRequest({ type: "RESOLVE_LOGICAL_PAGE_CANDIDATE" })).toBe(false);
  });

  it("accepts a full confirmation payload and rejects a malformed one", () => {
    const request = {
      type: "CONFIRM_LOGICAL_PAGE_CANDIDATE",
      ruleId: "rule-1",
      canonicalPageProfileId: "page-1",
      pageIdentityKey: "/customers/123",
      evidence: candidateEvidence,
    };

    expect(isRuntimeRequest(request)).toBe(true);
    expect(isRuntimeRequest({ ...request, pageIdentityKey: null })).toBe(true);
    expect(isRuntimeRequest({ ...request, ruleId: 1 })).toBe(false);
    expect(isRuntimeRequest({ ...request, canonicalPageProfileId: undefined })).toBe(false);
    expect(isRuntimeRequest({ ...request, evidence: { ...candidateEvidence, groupedFieldFeatureHashes: [] } })).toBe(false);
  });

  it("accepts only a Rule ID when stopping Logical Page Matching", () => {
    expect(isRuntimeRequest({ type: "STOP_LOGICAL_PAGE_MATCHING", ruleId: "rule-1" })).toBe(true);
    expect(isRuntimeRequest({ type: "STOP_LOGICAL_PAGE_MATCHING", ruleId: 1 })).toBe(false);
    expect(isRuntimeRequest({ type: "STOP_LOGICAL_PAGE_MATCHING" })).toBe(false);
  });
});
