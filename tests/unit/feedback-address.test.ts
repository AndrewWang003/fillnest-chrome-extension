import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { feedbackAddressFrom } from "../../scripts/lib/feedback-address.mjs";

// Task 042: verify:store names a missing or malformed feedback address.

describe("feedbackAddressFrom", () => {
  it("reads the address the product ships", () => {
    expect(feedbackAddressFrom(readFileSync("src/support/feedback.ts", "utf8"))).toEqual({
      address: "fillnest.feedback@gmail.com",
    });
  });

  it("names an empty or malformed address", () => {
    expect(feedbackAddressFrom('export const FEEDBACK_EMAIL_ADDRESS = "";')).toHaveProperty("problem");
    expect(feedbackAddressFrom('export const FEEDBACK_EMAIL_ADDRESS = "not an address";')).toHaveProperty("problem");
    expect(feedbackAddressFrom("export {};")).toHaveProperty("problem");
  });
});
