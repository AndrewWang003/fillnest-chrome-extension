import { describe, expect, it } from "vitest";

import {
  clampPickerPosition,
  fieldControlSize,
  PICKER_PREFERRED_WIDTH,
  PICKER_VIEWPORT_MARGIN,
  pickerWidthWithin,
} from "../../src/ui/picker/field-control-geometry";

describe("fieldControlSize", () => {
  it("adapts representative field heights inside the accepted 24-32 pixel range", () => {
    expect(fieldControlSize(18)).toBe(24);
    expect(fieldControlSize(32)).toBe(28);
    expect(fieldControlSize(80)).toBe(32);
  });

  it("fails safely for non-finite geometry", () => {
    expect(fieldControlSize(Number.NaN)).toBe(28);
    expect(fieldControlSize(Number.POSITIVE_INFINITY)).toBe(28);
  });
});

describe("pickerWidthWithin (Task 023 Addendum B5, finding 15)", () => {
  it("keeps its preferred width while the viewport can hold it", () => {
    expect(pickerWidthWithin(1280)).toBe(PICKER_PREFERRED_WIDTH);
    expect(pickerWidthWithin(PICKER_PREFERRED_WIDTH + 2 * PICKER_VIEWPORT_MARGIN)).toBe(
      PICKER_PREFERRED_WIDTH,
    );
  });

  it("shrinks to fit a viewport narrower than itself, which is what browser zoom produces", () => {
    // Roughly a 1440px screen at 400% zoom.
    expect(pickerWidthWithin(360)).toBe(344);
    expect(pickerWidthWithin(200)).toBe(184);
  });

  it("never returns a non-positive or non-finite width", () => {
    expect(pickerWidthWithin(4)).toBe(1);
    expect(pickerWidthWithin(Number.NaN)).toBe(PICKER_PREFERRED_WIDTH);
  });
});

describe("clampPickerPosition (Task 023 Addendum B5, finding 14)", () => {
  const size = { width: 348, height: 400 };

  it("leaves a position that is already fully inside the viewport alone", () => {
    expect(clampPickerPosition({ top: 100, left: 200 }, size, { width: 1280, height: 900 })).toEqual({
      top: 100,
      left: 200,
    });
  });

  it("pulls a stored position back inside a viewport that has since shrunk", () => {
    // The stored position was made at 100% zoom; the viewport is now the size
    // the same screen reports at 250%.
    expect(clampPickerPosition({ top: 700, left: 900 }, size, { width: 576, height: 360 })).toEqual({
      top: 8,
      left: 220,
    });
  });

  it("pins to the top-left margin when the Picker cannot fit at all, leaving its own scrolling to reach the rest", () => {
    expect(clampPickerPosition({ top: 700, left: 900 }, size, { width: 300, height: 300 })).toEqual({
      top: 8,
      left: 8,
    });
  });

  it("never leaves the Picker off the top or left edge", () => {
    expect(clampPickerPosition({ top: -400, left: -400 }, size, { width: 1280, height: 900 })).toEqual({
      top: 8,
      left: 8,
    });
  });
});
