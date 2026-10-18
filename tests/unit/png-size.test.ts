import { describe, expect, it } from "vitest";

import { isPromoTileSize, isStoreScreenshotSize, pngSize } from "../../scripts/lib/png-size.mjs";

// Task 033 Addendum H: verify:store reads the images in output/ rather than
// asserting they are missing, so it can go green when they are made.

/** A real 1x1 PNG, so the header this reads is a header something wrote. */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("pngSize", () => {
  it("reads the size out of a PNG header", () => {
    expect(pngSize(ONE_PIXEL_PNG)).toEqual({ width: 1, height: 1 });
  });

  it("says nothing about what is not a PNG", () => {
    expect(pngSize(Buffer.from("not an image at all, but long enough to read"))).toBeNull();
    expect(pngSize(Buffer.alloc(4))).toBeNull();
  });

  it("knows the sizes the store takes", () => {
    expect(isStoreScreenshotSize({ width: 1280, height: 800 })).toBe(true);
    expect(isStoreScreenshotSize({ width: 640, height: 400 })).toBe(true);
    expect(isStoreScreenshotSize({ width: 1281, height: 800 })).toBe(false);
    expect(isPromoTileSize({ width: 440, height: 280 })).toBe(true);
    expect(isPromoTileSize({ width: 440, height: 281 })).toBe(false);
  });
});
