import { describe, expect, it } from "vitest";

import { isExpectedActivationBootstrapState } from "../../src/activation/activation-bootstrap";

describe("activation bootstrap state", () => {
  it("recognizes the absent state that an install or update will initialize", () => {
    expect(isExpectedActivationBootstrapState(new Error("Activation state uninitialized"))).toBe(true);
    expect(isExpectedActivationBootstrapState(new Error("Invalid FillNest activation state"))).toBe(true);
  });

  it("does not hide genuine activation or recovery failures", () => {
    expect(isExpectedActivationBootstrapState(new Error("Chrome storage is unavailable"))).toBe(false);
    expect(isExpectedActivationBootstrapState("Activation state uninitialized")).toBe(false);
  });
});
