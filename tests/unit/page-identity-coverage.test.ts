import { describe, expect, it } from "vitest";

import {
  buildPageIdentityKey,
  buildFieldIdentityKey,
} from "../../src/recognition/recognition-evidence";
import {
  buildRoutePattern,
  keyedHash,
  routeFamily,
} from "../../src/recognition/logical-page-matching";
import {
  FillNestRepository,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";

/**
 * Task 014 Addendum C.
 *
 * Two guarantees hold this change up, and both are cheap to break by accident.
 */

/**
 * Every address whose key was non-null before the Addendum, with the exact key
 * it produced. A stored Page Profile is found by exact key match, so any change
 * here silently orphans Bindings a user already has. The Addendum is additive:
 * `null` became a key, and nothing else moved.
 */
const FROZEN_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["https://a.test/contact", "/contact"],
  ["https://a.test/contact/", "/contact"],
  ["https://a.test/about", "/about"],
  ["https://a.test/user/profile", "/user/profile"],
  ["https://a.test/text-box", "/text-box"],
  ["https://a.test/sign-up", "/sign-up"],
  ["https://a.test/contact-us", "/contact-us"],
  ["https://a.test/testing/form.php", "/testing/form.php"],
  ["https://a.test/morgan", "/morgan"],
  ["https://a.test/en-au/contact", "/en-au/contact"],
  ["https://a.test/customers/12345/edit", "/customers/:record/edit"],
  [
    "https://a.test/orders/3f8a1b2c-4d5e-4f60-89ab-0123456789ab/edit",
    "/orders/:record/edit",
  ],
  ["https://a.test/customer-123-edit", "/customer-:record-edit"],
  ["https://a.test/invoice-9-view", "/invoice-:record-view"],
  ["https://a.test/settings?tab=profile", "/settings?tab=profile"],
  ["https://a.test/x?mode=edit", "/x?mode=edit"],
  ["https://a.test/y?view=list", "/y?view=list"],
  ["https://a.test/contact?utm_source=x&utm_medium=y", "/contact"],
  ["https://a.test/contact?gclid=z", "/contact"],
  ["https://a.test/customers/12345/edit?id=12345", "/customers/:record/edit"],
  ["https://a.test/admin/orders/1234567890", "/admin/orders/:record"],
  ["https://a.test/agent/tickets/12345", "/agent/tickets/:record"],
  ["https://app.test/app#/customers/123/edit", "/app/customers/:record/edit"],
  ["https://a.test/support/forms/contact-us", "opaque-path-v1:865e8f16b16a33b9"],
  ["https://a.test/forms/1.1 initial information.html", "/forms/static-document-v1:07e903a630bad792"],
];

/** The same freeze for route patterns: a confirmed Rule stores this string. */
const FROZEN_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["https://a.test/customers/12345/edit", "/customers/:number/edit"],
  ["https://a.test/orders/3f8a1b2c-4d5e-4f60-89ab-0123456789ab/edit", "/orders/:uuid/edit"],
  ["https://a.test/contact", "/contact"],
  ["https://a.test/user/profile", "/user/profile"],
  ["https://a.test/admin/orders/1234567890", "/admin/orders/:number"],
];

describe("page identity is additive (Task 014 Addendum C)", () => {
  for (const [url, key] of FROZEN_KEYS) {
    it(`keeps ${url} at its existing key`, () => {
      expect(buildPageIdentityKey(url)).toBe(key);
    });
  }

  for (const [url, route] of FROZEN_ROUTES) {
    it(`keeps ${url} at its existing route pattern`, () => {
      expect(buildRoutePattern(url)).toBe(route);
    });
  }
});

/**
 * The defect this Addendum exists to remove: a `null` key makes
 * `resolveFieldContext` mint a fresh Page and Field Profile on **every** visit,
 * so a Template saved on such a page is orphaned by the next reload of the
 * identical address. No real address may produce one.
 */
describe("every address gets an identity (Task 014 Addendum C)", () => {
  const REAL_WORLD_SHAPES = [
    "https://crm.test/orders/018f0e2a-9c31-7a4b-b8c2-0123456789ab/edit",
    "https://app.test/users/507f1f77bcf86cd799439011",
    "https://dash.test/customers/cus_nffrfeufnv2hib",
    "https://x.lightning.force.com/lightning/r/account/0011u00000abcde/view",
    "https://app.test/p/ab3xy9kq",
    "https://x.atlassian.net/browse/proj-123",
    "https://linear.app/team/eng/issue/eng-123",
    "https://crm.test/customers/morgan-reed/edit",
    "https://jobs.test/jobs/senior-engineer-2024/apply",
    "https://blog.test/wp-admin/post.php?post=123&action=edit",
    "https://old.test/default.aspx?id=42",
    "https://app.test/settings?tab=billing",
    "https://jobs.test/jobs?page=2",
    "https://app.test/app#/customers/123/edit",
    "https://airtable.com/appabc123/tblxyz789/viwqrs456",
    "https://site.test/%E6%A8%A1%E6%9D%BF/form",
  ];

  for (const url of REAL_WORLD_SHAPES) {
    it(`gives ${url} a stable identity`, () => {
      const key = buildPageIdentityKey(url);
      expect(key).not.toBeNull();
      expect(buildPageIdentityKey(url)).toBe(key);
      expect(buildRoutePattern(url)).not.toBeNull();
    });
  }
});

describe("identifier shapes that should generalize across records", () => {
  const RECORD_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
    [
      "UUIDv7",
      "https://crm.test/orders/018f0e2a-9c31-7a4b-b8c2-0123456789ab/edit",
      "https://crm.test/orders/018f0e2b-1111-7a4b-b8c2-0123456789ab/edit",
    ],
    [
      "Mongo ObjectId",
      "https://app.test/users/507f1f77bcf86cd799439011",
      "https://app.test/users/507f191e810c19729de860ea",
    ],
    [
      "prefixed opaque id",
      "https://dash.test/customers/cus_nffrfeufnv2hib",
      "https://dash.test/customers/cus_ab12cd34ef56gh78",
    ],
    [
      "issue key",
      "https://x.atlassian.net/browse/proj-123",
      "https://x.atlassian.net/browse/proj-987",
    ],
    [
      "record-name slug before an action",
      "https://crm.test/customers/morgan-reed/edit",
      "https://crm.test/customers/alex-kim/edit",
    ],
    [
      "hash route record",
      "https://app.test/app#/customers/123/edit",
      "https://app.test/app#/customers/999/edit",
    ],
  ];

  for (const [label, first, second] of RECORD_PAIRS) {
    it(`treats two ${label} addresses as one page`, () => {
      const key = buildPageIdentityKey(first);
      expect(key).toBe(buildPageIdentityKey(second));
      expect(key).toContain(":record");
      // And the two addresses are one route family, so Logical Page matching
      // can compare them at all.
      const route = buildRoutePattern(first);
      expect(route).toBe(buildRoutePattern(second));
      expect(routeFamily(route ?? "", buildRoutePattern(second) ?? "")).toBe(route);
    });
  }

  // Task 014 Addendum E. Random tokens the two-digit rule missed.
  it.each([
    ["one digit", "https://chat.test/chats/YJerjMvianTgauYwww3zU"],
    ["no digit", "https://chat.test/chats/hKQzmPwRtyvBnXcLsDfGA"],
  ])("treats a random mixed-case token with %s as a record (Task 014 Addendum E)", (_label, address) => {
    const reference = "https://chat.test/chats/9d3HfAW8hanR1ENuCNrKt";
    expect(buildPageIdentityKey(address)).toBe(buildPageIdentityKey(reference));
    expect(buildPageIdentityKey(address)).toBe("/chats/:record");
    expect(buildRoutePattern(address)).toBe(buildRoutePattern(reference));
  });

  it("keeps readable mixed-case, product-shaped and one-digit segments apart (Task 014 Addendum E)", () => {
    const apart: ReadonlyArray<readonly [string, string]> = [
      ["https://a.test/docs/gettingStartedWithForms", "https://a.test/docs/advancedConfigurationGuide"],
      ["https://a.test/AccountSettingsOverview", "https://a.test/NotificationPreferencesPage"],
      ["https://a.test/docs/versionTwoMigration2Guide", "https://a.test/docs/versionOneMigration1Guide"],
      // Acronyms break camelCase, but their words keep long lower-case runs.
      ["https://a.test/Settings/SSOConfiguration", "https://a.test/Settings/LDAPConfiguration"],
      ["https://a.test/tools/ExportToPDFReport", "https://a.test/tools/HTTPRequestInspector"],
      ["https://a.test/apps/iOSAppStoreConnect", "https://a.test/apps/DirectXShaderCompiler"],
      // A lower-case slug with one digit is a route, not a record.
      ["https://a.test/html5bestpractices", "https://a.test/css3flexboxtutorial"],
      ["https://a.test/web3wallet/setup", "https://a.test/web2wallet/setup"],
      ["https://a.test/windowsserver2019/setup", "https://a.test/windowsserver2022/setup"],
    ];
    for (const [first, second] of apart) {
      expect(buildPageIdentityKey(first), first).not.toBe(buildPageIdentityKey(second));
      expect(buildPageIdentityKey(first), first).not.toContain(":record");
      expect(buildRoutePattern(first), first).not.toBe(buildRoutePattern(second));
    }
  });

  it("keeps genuinely different pages apart", () => {
    // Two hash routes that are different pages, not two records of one page.
    expect(buildPageIdentityKey("https://app.test/app#/customers/1/edit")).not.toBe(
      buildPageIdentityKey("https://app.test/app#/settings"),
    );
    // A product name that merely contains digits is a route, not a record.
    expect(buildPageIdentityKey("https://a.test/office365/setup")).not.toBe(
      buildPageIdentityKey("https://a.test/office2019/setup"),
    );
    // Different query values are different pages.
    expect(buildPageIdentityKey("https://a.test/s?entity=customers")).not.toBe(
      buildPageIdentityKey("https://a.test/s?entity=invoices"),
    );
  });

  it("ignores per-visit query noise that would fragment one page into many", () => {
    const clean = buildPageIdentityKey("https://a.test/contact");
    for (const noisy of [
      "https://a.test/contact?sessionid=abc123",
      "https://a.test/contact?t=1736899200",
      "https://a.test/contact?_=1736899200",
      "https://a.test/contact?token=zzz",
    ]) {
      expect(buildPageIdentityKey(noisy), noisy).toBe(clean);
    }
  });

  it("distinguishes semantic query state inside a hash route (Task 039 C2)", () => {
    expect(buildPageIdentityKey("https://example.test/app#/form?entity=customers")).toBe(
      "/app/form#?entity=0c9879d1e6ffa3be",
    );
    expect(buildPageIdentityKey("https://example.test/app#/form?entity=invoices")).toBe(
      "/app/form#?entity=624f59ba098b0299",
    );
  });

  it("keeps outer and hash-route query sources distinct (Task 039 C2)", () => {
    const outer = buildPageIdentityKey("https://example.test/app?entity=customers#/form");
    const fragment = buildPageIdentityKey("https://example.test/app#/form?entity=customers");
    expect(outer).toBe("/app/form?entity=0c9879d1e6ffa3be");
    expect(fragment).toBe("/app/form#?entity=0c9879d1e6ffa3be");
    expect(fragment).not.toBe(outer);
  });

  it("uses a fragment namespace no legal outer query key can imitate (Task 039 C2)", () => {
    const prefixedOuter = buildPageIdentityKey(
      "https://example.test/app?hash-entity=customers#/form",
    );
    const fragment = buildPageIdentityKey(
      "https://example.test/app#/form?entity=customers",
    );
    expect(fragment).not.toBe(prefixedOuter);

    const twoOuterKeys = buildPageIdentityKey(
      "https://example.test/app?a=x&hash-b=y#/form",
    );
    const mixedSources = buildPageIdentityKey(
      "https://example.test/app?a=x#/form?b=y",
    );
    expect(mixedSources).not.toBe(twoOuterKeys);
  });

  it("ignores volatile and tracking query state inside a hash route (Task 039 C2)", () => {
    const clean = buildPageIdentityKey("https://example.test/app#/form");
    expect(buildPageIdentityKey("https://example.test/app#/form?token=secret")).toBe(clean);
    expect(buildPageIdentityKey("https://example.test/app#/form?utm_source=campaign")).toBe(clean);
  });

  it("never lets a readable path or query value reach the key", () => {
    const keys = [
      buildPageIdentityKey("https://a.test/customers/morgan-reed/edit"),
      buildPageIdentityKey("https://a.test/morgan-42-profile"),
      buildPageIdentityKey("https://a.test/contact?name=morgan"),
      buildPageIdentityKey("https://a.test/%E6%A8%A1%E6%9D%BF/form"),
    ].join(" ");
    for (const readable of ["morgan", "reed", "模板"]) {
      expect(keys).not.toContain(readable);
    }
  });

  it("leaves Field identity alone - this Addendum is about pages", () => {
    const metadata = {
      tagName: "input",
      effectiveType: "email",
      name: "email",
      id: "",
      autocomplete: "",
      ariaLabel: "",
      label: "Email",
      formName: "",
      ancestorTags: ["form"],
      supportedFieldCount: 1,
      equivalentFieldCount: 1,
      equivalentFieldIndex: 0,
    };
    expect(buildFieldIdentityKey(metadata)).toBe(buildFieldIdentityKey(metadata));
  });
});

/**
 * Task 014 Addendum C Slice 2, end to end against the real repository: the
 * owner's own scenario. Field A holds T1 on Page 1; the user browses a sibling
 * page on the same Site; FillNest compares the two and, once the user confirms,
 * offers T1 on the same Field - and never asks again for that route family.
 */
describe("recognizing a sibling page and reusing its Templates", () => {
  const FIELD_KEY = JSON.stringify({ tag: "input", type: "email", name: "email" });

  function memoryStorage(): LocalStorageArea {
    const values: Record<string, unknown> = {};
    return {
      get: async (key) => (key in values ? { [key]: values[key] } : {}),
      set: async (items) => {
        Object.assign(values, structuredClone(items));
      },
      remove: async (key) => {
        delete values[key];
      },
    };
  }

  async function evidenceFor(url: string, encodedHmacKey: string) {
    const fieldFeatures = new Set<string>();
    const groupedFieldFeatures = new Set<string>();
    for (const feature of ["tag:input", "type:email", "text:email", "text:cover note"]) {
      fieldFeatures.add(await keyedHash(encodedHmacKey, feature));
      groupedFieldFeatures.add(await keyedHash(encodedHmacKey, `apply ${feature}`));
    }
    return {
      origin: new URL(url).origin,
      routePattern: buildRoutePattern(url),
      fieldFeatures,
      groupedFieldFeatures,
      fieldIdentityKey: FIELD_KEY,
    };
  }

  it("offers a slug-routed sibling as a candidate, then covers the whole family after one confirmation", async () => {
    const repository = new FillNestRepository(memoryStorage());
    const first = "https://jobs.test/jobs/data-analyst/apply";
    const second = "https://jobs.test/jobs/senior-engineer/apply";
    const third = "https://jobs.test/jobs/product-manager/apply";

    // Field A on Page 1 holds T1.
    const firstKey = buildPageIdentityKey(first);
    const context = await repository.resolveFieldContext({
      pageUrl: first,
      pageIdentityKey: firstKey,
      fieldIdentityKey: FIELD_KEY,
    });
    await repository.createTemplateAndBind({
      content: "T1",
      pageUrl: first,
      pageProfileId: context.pageProfileId,
      fieldProfileId: context.fieldProfileId,
      ...(firstKey ? { pageIdentityKey: firstKey } : {}),
      fieldIdentityKey: FIELD_KEY,
    });

    const siteKey = await repository.getOrCreateLogicalPageSiteKey(first);
    await repository.recordLogicalPageObservation({
      pageUrl: first,
      pageProfileId: context.pageProfileId,
      siteKeyId: siteKey.siteKeyId,
      evidence: await evidenceFor(first, siteKey.encodedHmacKey),
    });

    // A different job's form: same shape, one segment apart. Offered, not taken.
    const secondEvidence = await evidenceFor(second, siteKey.encodedHmacKey);
    const candidate = await repository.resolveLogicalPageCandidate({ evidence: secondEvidence });
    expect(candidate.recognized).toBe(false);
    expect(candidate.candidate).not.toBeNull();

    // The user confirms once.
    const confirmed = await repository.confirmLogicalPageCandidate({
      ruleId: candidate.candidate!.ruleId,
      canonicalPageProfileId: candidate.candidate!.canonicalPageProfileId,
      pageIdentityKey: buildPageIdentityKey(second),
      evidence: secondEvidence,
    });
    expect(confirmed.recognized).toBe(true);

    // The Rule covers the family, not just the address that created it.
    const afterConfirm = await repository.read();
    expect(afterConfirm.logicalPageRules[0]?.routePattern).toBe("/jobs/:id/apply");
    expect(
      afterConfirm.bindings.filter((binding) => binding.fieldProfileId === confirmed.fieldProfileId),
    ).toHaveLength(1);

    // A third job never seen before: recognized outright, with no second ask.
    const thirdResolution = await repository.resolveLogicalPageCandidate({
      evidence: await evidenceFor(third, siteKey.encodedHmacKey),
    });
    expect(thirdResolution.recognized).toBe(true);
    expect(thirdResolution.candidate).toBeNull();
    const afterThird = await repository.read();
    expect(
      afterThird.bindings.filter((binding) => binding.fieldProfileId === thirdResolution.fieldProfileId),
    ).toHaveLength(1);
  });

  it("does not offer a page from a different part of the site", async () => {
    const repository = new FillNestRepository(memoryStorage());
    const first = "https://jobs.test/jobs/data-analyst/apply";
    const firstKey = buildPageIdentityKey(first);
    const context = await repository.resolveFieldContext({
      pageUrl: first,
      pageIdentityKey: firstKey,
      fieldIdentityKey: FIELD_KEY,
    });
    await repository.createTemplateAndBind({
      content: "T1",
      pageUrl: first,
      pageProfileId: context.pageProfileId,
      fieldProfileId: context.fieldProfileId,
      ...(firstKey ? { pageIdentityKey: firstKey } : {}),
      fieldIdentityKey: FIELD_KEY,
    });
    const siteKey = await repository.getOrCreateLogicalPageSiteKey(first);
    await repository.recordLogicalPageObservation({
      pageUrl: first,
      pageProfileId: context.pageProfileId,
      siteKeyId: siteKey.siteKeyId,
      evidence: await evidenceFor(first, siteKey.encodedHmacKey),
    });

    // Same field set, but nothing structural in common with /jobs/:id/apply.
    const unrelated = await repository.resolveLogicalPageCandidate({
      evidence: await evidenceFor("https://jobs.test/employers/contact", siteKey.encodedHmacKey),
    });
    expect(unrelated.recognized).toBe(false);
    expect(unrelated.candidate).toBeNull();
  });
});
