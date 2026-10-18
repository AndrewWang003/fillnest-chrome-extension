import { describe, expect, it } from "vitest";

import { exactOriginFromPattern, permissionOriginFromUrl } from "../../src/permissions/permission-origin";

describe("permissionOriginFromUrl", () => {
  it("keeps an explicit effective port in the exact host pattern", () => {
    expect(permissionOriginFromUrl("http://127.0.0.1:4173/customer/42")).toEqual({
      origin: "http://127.0.0.1:4173",
      pattern: "http://127.0.0.1:4173/*",
    });

    expect(permissionOriginFromUrl("http://127.0.0.1:4174/customer/42")).toEqual({
      origin: "http://127.0.0.1:4174",
      pattern: "http://127.0.0.1:4174/*",
    });
  });

  it("materializes default HTTP and HTTPS ports instead of wildcarding them", () => {
    expect(permissionOriginFromUrl("http://example.test/form").pattern).toBe(
      "http://example.test:80/*",
    );
    expect(permissionOriginFromUrl("https://example.test/form").pattern).toBe(
      "https://example.test:443/*",
    );
  });

  it("parses only exact-origin patterns, including IPv6, through the shared canonical rule", () => {
    expect(exactOriginFromPattern("https://app.example.test:443/*")).toBe("https://app.example.test:443");
    expect(exactOriginFromPattern("http://[::1]:4173/*")).toBe("http://[::1]:4173");
    expect(exactOriginFromPattern("https://*/*")).toBeNull();
    expect(exactOriginFromPattern("https://app.example.test/*")).toBeNull();
  });
});
