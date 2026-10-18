import { describe, expect, it } from "vitest";

import {
  classifyCompatibilityKind,
  compatibilityKindsMatch,
  isReliableCrossSiteKind,
} from "../../src/compatibility/compatibility-kind";

describe("classifyCompatibilityKind", () => {
  it("classifies every reliable autocomplete token, case- and whitespace-insensitively", () => {
    const cases: Array<[string, string]> = [
      ["email", "email"],
      ["Given-Name", "name-given"],
      ["  family-name ", "name-family"],
      ["name", "name-full"],
      ["address-line1", "address-line1"],
      ["address-line2", "address-line2"],
      ["address-level1", "address-level1"],
      ["address-level2", "address-level2"],
      ["postal-code", "postal-code"],
      ["country", "country"],
      ["country-name", "country"],
    ];
    for (const [autocomplete, expectedKind] of cases) {
      expect(classifyCompatibilityKind({ effectiveType: "text", autocomplete }).kind).toBe(expectedKind);
    }
  });

  it("classifies phone from either a tel-prefixed autocomplete token or the input type, never from a label", () => {
    expect(classifyCompatibilityKind({ effectiveType: "tel", autocomplete: "" }).kind).toBe("tel");
    expect(classifyCompatibilityKind({ effectiveType: "text", autocomplete: "tel-national" }).kind).toBe("tel");
    expect(classifyCompatibilityKind({ effectiveType: "text", autocomplete: "tel" }).kind).toBe("tel");
  });

  it("classifies email from the input type even with no autocomplete token", () => {
    expect(classifyCompatibilityKind({ effectiveType: "email", autocomplete: "" }).kind).toBe("email");
  });

  it("falls back to an 'other' structural signature keyed on a non-reliable autocomplete token", () => {
    const kind = classifyCompatibilityKind({ effectiveType: "text", autocomplete: "organization" });
    expect(kind).toEqual({ kind: "other", token: "organization" });
  });

  it("classifies as unclassified when there is no generic evidence at all", () => {
    expect(classifyCompatibilityKind({ effectiveType: "text", autocomplete: "" }).kind).toBe("unclassified");
  });

  it("never uses field label, name, or id evidence - only effectiveType and autocomplete are accepted parameters", () => {
    // Type-level guarantee: GenericFieldTypeEvidence has exactly two fields.
    // A field named "wildly-different-label" would need to be passed through
    // `autocomplete`/`effectiveType` to have any effect, proving the function
    // has no other channel for label-derived evidence to enter through.
    const withoutLabel = classifyCompatibilityKind({ effectiveType: "email", autocomplete: "" });
    expect(withoutLabel.kind).toBe("email");
  });
});

describe("compatibilityKindsMatch", () => {
  it("matches identical reliable kinds", () => {
    expect(
      compatibilityKindsMatch({ kind: "email" }, { kind: "email" }),
    ).toBe(true);
  });

  it("does not match distinct Name variants, even though both are 'Name'", () => {
    expect(
      compatibilityKindsMatch({ kind: "name-given" }, { kind: "name-family" }),
    ).toBe(false);
  });

  it("does not match distinct Address components", () => {
    expect(
      compatibilityKindsMatch({ kind: "address-line1" }, { kind: "address-level2" }),
    ).toBe(false);
  });

  it("matches two 'other' kinds only when their structural token is identical", () => {
    expect(
      compatibilityKindsMatch({ kind: "other", token: "organization" }, { kind: "other", token: "organization" }),
    ).toBe(true);
    expect(
      compatibilityKindsMatch({ kind: "other", token: "organization" }, { kind: "other", token: "username" }),
    ).toBe(false);
  });

  it("never matches unclassified, even against itself", () => {
    expect(
      compatibilityKindsMatch({ kind: "unclassified" }, { kind: "unclassified" }),
    ).toBe(false);
  });
});

describe("isReliableCrossSiteKind", () => {
  it("marks every Name/Email/Phone/Address kind reliable for cross-Site suggestion", () => {
    const reliableKinds = [
      "email",
      "tel",
      "name-given",
      "name-family",
      "name-full",
      "address-line1",
      "address-line2",
      "address-level1",
      "address-level2",
      "postal-code",
      "country",
    ] as const;
    for (const kind of reliableKinds) {
      expect(isReliableCrossSiteKind({ kind })).toBe(true);
    }
  });

  it("marks 'other' and 'unclassified' unreliable across Sites", () => {
    expect(isReliableCrossSiteKind({ kind: "other", token: "organization" })).toBe(false);
    expect(isReliableCrossSiteKind({ kind: "unclassified" })).toBe(false);
  });
});
