import { describe, expect, it } from "vitest";

import { siteIdentityFromUrl } from "../../src/domain/site";

describe("siteIdentityFromUrl", () => {
  it("ignores scheme, port, and synthetic subdomains for one Site", () => {
    expect(siteIdentityFromUrl("http://records.example.test:4173/customer/1")).toBe(
      "example.test",
    );
    expect(siteIdentityFromUrl("https://forms.example.test:9443/customer/2")).toBe(
      "example.test",
    );
    expect(siteIdentityFromUrl("https://example.test/customer/3")).toBe(
      "example.test",
    );
  });

  it("keeps a second synthetic main domain distinct", () => {
    expect(siteIdentityFromUrl("https://record.other.test:9443/customer/2")).toBe(
      "other.test",
    );
  });

  it("keeps unrelated multi-label public-suffix Sites separate", () => {
    expect(siteIdentityFromUrl("https://portal.alpha.co.uk/form")).toBe("alpha.co.uk");
    expect(siteIdentityFromUrl("https://portal.beta.co.uk/form")).toBe("beta.co.uk");
    expect(siteIdentityFromUrl("https://staff.foo.com.au/form")).toBe("foo.com.au");
    expect(siteIdentityFromUrl("https://staff.bar.com.au/form")).toBe("bar.com.au");
  });

  it("uses localhost and IP hosts as their Site identities", () => {
    expect(siteIdentityFromUrl("http://localhost:4173/form")).toBe("localhost");
    expect(siteIdentityFromUrl("http://127.0.0.1:4173/form")).toBe("127.0.0.1");
    expect(siteIdentityFromUrl("http://[::1]:4173/form")).toBe("[::1]");
  });
});
