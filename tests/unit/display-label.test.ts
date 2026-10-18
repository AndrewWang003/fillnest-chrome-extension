import { en } from "../../src/i18n/messages";
import { describe, expect, it } from "vitest";

import {
  deriveFieldDisplayLabel,
  derivePageDisplayLabel,
} from "../../src/labels/display-label";

describe("derivePageDisplayLabel", () => {
  it("renders the contract's own example route", () => {
    expect(derivePageDisplayLabel("/customers/:record/edit", en)).toBe("Customers / Edit");
  });

  it("ignores the query suffix", () => {
    expect(derivePageDisplayLabel("/customers/:record/edit?tab=profile", en)).toBe(
      "Customers / Edit",
    );
  });

  it("title-cases hyphenated and underscored static segments", () => {
    expect(derivePageDisplayLabel("/user-profile/account_settings", en)).toBe(
      "User Profile / Account Settings",
    );
  });

  it("cleans up an embedded record placeholder within one segment", () => {
    expect(derivePageDisplayLabel("/customer-:record-settings", en)).toBe("Customer Settings");
  });

  it("returns Home for the empty or root path", () => {
    expect(derivePageDisplayLabel("", en)).toBe("Home");
    expect(derivePageDisplayLabel("/", en)).toBe("Home");
  });

  it("returns Page when every segment is a placeholder", () => {
    expect(derivePageDisplayLabel("/:record", en)).toBe("Page");
    expect(derivePageDisplayLabel("/:record/:record", en)).toBe("Page");
  });

  it("returns Page when there is no identityKey at all (unrecognized page)", () => {
    expect(derivePageDisplayLabel(undefined, en)).toBe("Page");
  });

  it("privacy counterexample: never surfaces a residual numeric or UUID-like segment", () => {
    expect(derivePageDisplayLabel("/customers/12345/edit", en)).toBe("Customers / Edit");
    expect(
      derivePageDisplayLabel("/customers/3fa85f64-5717-4562-b3fc-2c963f66afa6/edit", en),
    ).toBe("Customers / Edit");
  });

  it("privacy counterexample: never surfaces a raw customer-like slug", () => {
    expect(derivePageDisplayLabel("/customers/morgan-reed-42/edit", en)).toBe("Customers / Edit");
  });
});

describe("deriveFieldDisplayLabel", () => {
  it("maps every known semantic kind to a stable label", () => {
    const cases: Array<[string, string]> = [
      ["email", "Email"],
      ["phone", "Phone"],
      ["website", "Website"],
      ["postal-code", "Postal code"],
      ["address", "Address"],
      ["first-name", "First name"],
      ["last-name", "Last name"],
      ["name", "Name"],
    ];
    for (const [semanticKind, label] of cases) {
      expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind }), undefined, en)).toBe(label);
    }
  });

  it("falls back to Text field when semanticKind is empty or absent", () => {
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "" }), undefined, en)).toBe("Text field");
    expect(deriveFieldDisplayLabel(JSON.stringify({ name: "notes" }), undefined, en)).toBe("Text field");
  });

  it("falls back to Text field when there is no identityKey at all", () => {
    expect(deriveFieldDisplayLabel(undefined, undefined, en)).toBe("Text field");
  });

  it("falls back to Text field for malformed identityKey text", () => {
    expect(deriveFieldDisplayLabel("not json", undefined, en)).toBe("Text field");
  });

  it("falls back to Text field for an unrecognized semanticKind rather than surfacing it", () => {
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "customer-notes" }), undefined, en)).toBe(
      "Text field",
    );
  });

  it("privacy counterexample: never surfaces raw name/id attributes even when present", () => {
    expect(
      deriveFieldDisplayLabel(JSON.stringify({ name: "morgan_reed_ssn", id: "field-42", semanticKind: "" }), undefined, en),
    ).toBe("Text field");
  });

  it("numbers unclassified Fields by their ordinal among equivalent siblings, so identical-looking Fields on one Page can be told apart", () => {
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: 0 }), undefined, en)).toBe("Text field");
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: 1 }), undefined, en)).toBe("Text field 2");
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: 2 }), undefined, en)).toBe("Text field 3");
  });

  it("ignores ordinal once a semantic kind is known - a real classification always wins", () => {
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "email", ordinal: 3 }), undefined, en)).toBe("Email");
  });

  it("ignores a malformed or missing ordinal and falls back to the plain generic label", () => {
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: -1 }), undefined, en)).toBe("Text field");
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: 1.5 }), undefined, en)).toBe("Text field");
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "", ordinal: "1" }), undefined, en)).toBe("Text field");
    expect(deriveFieldDisplayLabel(JSON.stringify({ semanticKind: "" }), undefined, en)).toBe("Text field");
  });
});
