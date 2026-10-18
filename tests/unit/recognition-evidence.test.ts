import { describe, expect, it } from "vitest";

import {
  buildFieldIdentityKey,
  buildPageIdentityKey,
  type FieldRecognitionMetadata,
} from "../../src/recognition/recognition-evidence";

describe("recognition evidence", () => {
  it("maps independently randomized records to one logical page without retaining record data", () => {
    const firstRecordId = crypto.randomUUID();
    const thirdRecordId = crypto.randomUUID();
    const firstCustomerName = `Morgan-${crypto.randomUUID()}`;
    const thirdCustomerName = `Taylor-${crypto.randomUUID()}`;

    const first = buildPageIdentityKey(
      `https://app.example.test/customers/${firstRecordId}/edit?record=${firstRecordId}&tab=profile&name=${encodeURIComponent(firstCustomerName)}`,
    );
    const third = buildPageIdentityKey(
      `https://app.example.test/customers/${thirdRecordId}/edit?record=${thirdRecordId}&tab=profile&name=${encodeURIComponent(thirdCustomerName)}`,
    );

    expect(first).toBe(third);
    expect(first).toBe("/customers/:record/edit?tab=profile");
    expect(first).not.toContain(firstRecordId);
    expect(first).not.toContain(thirdRecordId);
    expect(first).not.toContain(firstCustomerName);
    expect(first).not.toContain(thirdCustomerName);
    expect(
      buildPageIdentityKey(
        `https://app.example.test/customers/${thirdRecordId}/edit?record=${thirdRecordId}&tab=notes&name=${encodeURIComponent(thirdCustomerName)}`,
      ),
    ).not.toBe(first);
    expect(
      buildPageIdentityKey(`https://app.example.test/vendors/${crypto.randomUUID()}/edit`),
    ).not.toBe(first);
  });

  it("collapses record-name slugs to :record and fingerprints deep paths, retaining neither", () => {
    // Task 014 Addendum C. These used to be rejected outright, which meant the
    // page had no identity and FillNest forgot everything saved on it - even
    // on an identical URL. A record-name slug next to an action word is what
    // the product exists to generalize over, and `:record` retains strictly
    // less than the rejection did: no readable text at all.
    const morgan = buildPageIdentityKey("https://app.example.test/customers/morgan-reed/edit");
    expect(morgan).toBe("/customers/:record/edit");
    expect(
      buildPageIdentityKey("https://app.example.test/customers/taylor-quinn/edit"),
    ).toBe(morgan);
    expect(
      buildPageIdentityKey("https://app.example.test/customers/morgan/edit"),
    ).toBe(morgan);
    expect(morgan).not.toContain("morgan");
    expect(morgan).not.toContain("reed");
    expect(morgan).not.toContain("taylor");
    const deepPath = buildPageIdentityKey("https://app.example.test/accounts/acme/orders");
    expect(deepPath).toMatch(/^opaque-path-v1:[0-9a-f]{16}$/u);
    expect(
      buildPageIdentityKey("https://app.example.test/accounts/acme/orders?utm_source=chatgpt.com"),
    ).toBe(deepPath);
    // A readable name embedded in a segment is hashed rather than rejected:
    // stable enough to remember the page, and it stores nothing readable.
    for (const url of [
      "https://app.example.test/customer-42-morgan-reed",
      "https://app.example.test/morgan-42-profile",
      "https://app.example.test/acme-17-settings",
    ]) {
      const key = buildPageIdentityKey(url);
      expect(key).toMatch(/^\/seg-v1:[0-9a-f]{16}$/u);
      expect(key).toBe(buildPageIdentityKey(url));
      for (const readable of ["morgan", "reed", "acme", "42", "17"]) {
        expect(key).not.toContain(readable);
      }
    }
    expect(
      buildPageIdentityKey("https://app.example.test/customer-42-settings"),
    ).toBe("/customer-:record-settings");
    expect(
      buildPageIdentityKey("https://app.example.test/invoice-17-overview"),
    ).toBe("/invoice-:record-overview");
    expect(
      buildPageIdentityKey("https://app.example.test/customers/42/edit?customer=morgan-reed"),
    ).toBe("/customers/:record/edit");
    // A readable query value never reaches the key; it is hashed, and two
    // different values stay two different pages.
    const tabMorgan = buildPageIdentityKey("https://app.example.test/customers/42/edit?tab=morgan");
    expect(tabMorgan).toMatch(/^\/customers\/:record\/edit\?tab=[0-9a-f]{16}$/u);
    expect(tabMorgan).not.toContain("morgan");
    const entityCustomers = buildPageIdentityKey("https://app.example.test/edit?entity=customers");
    const entityInvoices = buildPageIdentityKey("https://app.example.test/edit?entity=invoices");
    expect(entityCustomers).toMatch(/^\/edit\?entity=[0-9a-f]{16}$/u);
    expect(entityCustomers).not.toBe(entityInvoices);
    expect(entityCustomers).not.toContain("customers");
    expect(buildPageIdentityKey("https://app.example.test/morgan")).toBe("/morgan");
    expect(buildPageIdentityKey("https://app.example.test/acme")).toBe("/acme");
    expect(buildPageIdentityKey("https://app.example.test/contact")).toBe("/contact");
    expect(buildPageIdentityKey("https://app.example.test/about")).toBe("/about");
    expect(buildPageIdentityKey("https://app.example.test/user/profile")).toBe("/user/profile");
    expect(buildPageIdentityKey("https://app.example.test/contact")).toBe("/contact");
    expect(buildPageIdentityKey("https://app.example.test/about")).toBe("/about");
    expect(buildPageIdentityKey("https://app.example.test/user/profile")).toBe("/user/profile");
    const recordEntityCustomers = buildPageIdentityKey(
      "https://app.example.test/customers/42/edit?entity=customers",
    );
    const recordEntityInvoices = buildPageIdentityKey(
      "https://app.example.test/customers/42/edit?entity=invoices",
    );
    expect(recordEntityCustomers).toMatch(/^\/customers\/:record\/edit\?entity=[0-9a-f]{16}$/u);
    expect(recordEntityCustomers).not.toBe(recordEntityInvoices);
  });

  // Regression: a saved Template silently stopped being recognized on
  // real-world sites (demoqa.com/text-box, qaautomationlabs.com/testing/form.php)
  // as soon as the user focused a different field and came back - Search still
  // found the Template by content, but "This field" showed nothing. Root cause:
  // buildPageIdentityKey returned null for these URLs (a digit-free kebab-case
  // segment like "text-box", or a static dotted segment like "form.php"), which
  // made every field on the page always resolve as unrecognized, discarding the
  // real fieldProfileId's binding on every subsequent focus.
  it("recognizes real-world kebab-case and dotted static path segments, not just single words", () => {
    expect(buildPageIdentityKey("https://demoqa.com/text-box")).toBe("/text-box");
    expect(buildPageIdentityKey("https://qaautomationlabs.com/testing/form.php")).toBe(
      "/testing/form.php",
    );
    expect(buildPageIdentityKey("https://app.example.test/sign-up")).toBe("/sign-up");
    expect(buildPageIdentityKey("https://app.example.test/contact-us")).toBe("/contact-us");
    // A record-name slug immediately before edit/view/details/profile is the
    // record, not the route - see the :record test above.
    expect(
      buildPageIdentityKey("https://app.example.test/customers/morgan-reed/edit"),
    ).toBe("/customers/:record/edit");
  });

  it("recognizes numbered static document filenames without retaining their readable title", () => {
    const first = buildPageIdentityKey(
      "https://app.example.test/static/1.1%20Initial%20Information.html",
    );
    const afterReload = buildPageIdentityKey(
      "https://app.example.test/static/1.1%20Initial%20Information.html",
    );

    expect(first).not.toBeNull();
    expect(afterReload).toBe(first);
    expect(first).not.toContain("Initial");
    expect(first).not.toContain("Information");
  });

  it("ignores standard tracking parameters without accepting unknown query state", () => {
    expect(
      buildPageIdentityKey("https://practice.expandtesting.com/contact?utm_source=chatgpt.com"),
    ).toBe("/contact");
    expect(
      buildPageIdentityKey("https://app.example.test/profile?utm_campaign=summer&tab=view&gclid=abc"),
    ).toBe("/profile?tab=view");
    // Task 014 Addendum C: an unknown query parameter is part of which page
    // this is, so it is hashed rather than costing the address its identity.
    // The key stays readable - a query key is chosen by whoever built the
    // site - while the value, where a person's own data would appear, is not.
    const draft = buildPageIdentityKey("https://app.example.test/contact?draft=123");
    expect(draft).toMatch(/^\/contact\?draft=[0-9a-f]{16}$/u);
    expect(draft).toBe(buildPageIdentityKey("https://app.example.test/contact?draft=123"));
    expect(draft).not.toBe(buildPageIdentityKey("https://app.example.test/contact?draft=456"));
    expect(draft).not.toContain("123");
  });

  it("uses only stable field semantics and fails closed for ambiguous fields", () => {
    const metadata: FieldRecognitionMetadata = {
      tagName: "INPUT",
      effectiveType: "email",
      name: "contact_email",
      id: "contact-email",
      autocomplete: "email",
      ariaLabel: "Email for Morgan Reed",
      label: "Email for Morgan Reed",
      formName: "customer-editor",
      ancestorTags: ["main", "form", "section"],
      supportedFieldCount: 1,
      equivalentFieldCount: 1,
      equivalentFieldIndex: 0,
    };

    const recognized = buildFieldIdentityKey(metadata);
    const unseenRecord = buildFieldIdentityKey({
      ...metadata,
      ariaLabel: "Email for Taylor Quinn",
      label: "Email for Taylor Quinn",
    });

    expect(recognized).toBe(unseenRecord);
    expect(recognized).not.toContain("Morgan Reed");
    expect(recognized).not.toContain("Taylor Quinn");
    expect(recognized).toContain("email");
    expect(buildFieldIdentityKey({ ...metadata, equivalentFieldCount: 2, equivalentFieldIndex: 0 })).not.toBeNull();
    expect(buildFieldIdentityKey({ ...metadata, equivalentFieldCount: 2, equivalentFieldIndex: 0 })).not.toBe(
      buildFieldIdentityKey({ ...metadata, equivalentFieldCount: 2, equivalentFieldIndex: 1 }),
    );
    expect(buildFieldIdentityKey({ ...metadata, equivalentFieldCount: 2, equivalentFieldIndex: 0 })).toContain('"ordinal":0');
    expect(buildFieldIdentityKey({ ...metadata, equivalentFieldCount: 2, equivalentFieldIndex: 1 })).toContain('"ordinal":1');
  });

  it("uses an exact privacy-safe structure key for static unlabelled fields", () => {
    const field = {
      tagName: "INPUT",
      effectiveType: "text",
      name: "",
      id: "",
      autocomplete: "",
      ariaLabel: "Prompt for Morgan Reed",
      label: "Prompt for Morgan Reed",
      formName: "",
      ancestorTags: ["main", "form"],
      supportedFieldCount: 3,
      equivalentFieldCount: 2,
      equivalentFieldIndex: 0,
    } satisfies FieldRecognitionMetadata;

    const first = buildFieldIdentityKey(field);
    const second = buildFieldIdentityKey({ ...field, equivalentFieldIndex: 1 });
    const changedPageStructure = buildFieldIdentityKey({ ...field, supportedFieldCount: 4 });

    expect(first).not.toBeNull();
    expect(first).not.toContain("Morgan Reed");
    expect(first).not.toContain("Prompt for");
    expect(first).not.toBe(second);
    expect(first).not.toBe(changedPageStructure);
  });
});
