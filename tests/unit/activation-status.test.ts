import { describe, expect, it } from "vitest";

import { activationStatus, type ActivationPage } from "../../src/ui/shared/CurrentWebsiteAccess";

// Owner QA 2026-09-15: one line saying the next step before FillNest works on
// this tab, in this order of precedence.

const page = (websiteAccess: boolean, originActivation: "active" | "paused"): ActivationPage => ({
  status: "available",
  origin: "https://example.test:443",
  websiteAccess,
  originActivation,
});

describe("activationStatus", () => {
  it("names the first thing still missing", () => {
    expect(activationStatus("active", { status: "unavailable" }, null)).toBe("unavailable");
    expect(activationStatus("paused", page(false, "active"), null)).toBe("needs-access");
    expect(activationStatus("paused", page(true, "active"), null)).toBe("needs-global");
    expect(activationStatus("active", page(true, "paused"), null)).toBe("needs-site");
    expect(activationStatus("active", page(true, "active"), { status: "incomplete", stage: "injection" } as never)).toBe("needs-reload");
    expect(activationStatus("active", page(true, "active"), null)).toBe("ready");
  });
});
