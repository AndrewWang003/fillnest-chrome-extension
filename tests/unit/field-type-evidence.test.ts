import { describe, expect, it } from "vitest";

import { parseGenericFieldTypeEvidence } from "../../src/compatibility/field-type-evidence";
import { buildFieldIdentityKey, type FieldRecognitionMetadata } from "../../src/recognition/recognition-evidence";
import { classifyCompatibilityKind } from "../../src/compatibility/compatibility-kind";

function metadata(overrides: Partial<FieldRecognitionMetadata> = {}): FieldRecognitionMetadata {
  return {
    tagName: "input",
    effectiveType: "email",
    name: "",
    id: "",
    autocomplete: "email",
    ariaLabel: "",
    label: "",
    formName: "",
    ancestorTags: [],
    supportedFieldCount: 1,
    equivalentFieldCount: 1,
    equivalentFieldIndex: 0,
    ...overrides,
  };
}

describe("parseGenericFieldTypeEvidence", () => {
  it("recovers type and autocomplete from a real, non-hashed identityKey", () => {
    const identityKey = buildFieldIdentityKey(metadata());
    const evidence = parseGenericFieldTypeEvidence(identityKey ?? undefined);
    expect(evidence).toEqual({ effectiveType: "email", autocomplete: "email" });
    expect(classifyCompatibilityKind(evidence).kind).toBe("email");
  });

  it("falls through to empty evidence for a missing identityKey", () => {
    expect(parseGenericFieldTypeEvidence(undefined)).toEqual({ effectiveType: "", autocomplete: "" });
  });

  it("falls through to empty evidence for malformed identityKey text", () => {
    expect(parseGenericFieldTypeEvidence("not json")).toEqual({ effectiveType: "", autocomplete: "" });
  });

  it("falls through to empty evidence for JSON that isn't an object", () => {
    expect(parseGenericFieldTypeEvidence("42")).toEqual({ effectiveType: "", autocomplete: "" });
  });
});
