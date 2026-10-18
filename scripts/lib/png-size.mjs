/**
 * A PNG's pixel size, read from the file itself.
 *
 * Task 033 Addendum H. `verify:store` used to state "no store screenshots" as
 * a fact about the world; it is now a fact about `output/`, which means it can
 * stop being true. A PNG's width and height are the two big-endian 32-bit
 * numbers at the start of its IHDR chunk, always the first chunk - eight bytes
 * of signature, four of length, four of type, then the pair. No dependency
 * needed, and none wanted in a check that only reads its own build output.
 *
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number } | null} null when it is not a PNG
 */
export function pngSize(buffer) {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(SIGNATURE)) return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Whether a size is one the Chrome Web Store accepts for a screenshot. */
export function isStoreScreenshotSize(/** @type {{width: number, height: number}} */ size) {
  return (size.width === 1280 && size.height === 800) || (size.width === 640 && size.height === 400);
}

/** Whether a size is the store's small promo tile. */
export function isPromoTileSize(/** @type {{width: number, height: number}} */ size) {
  return size.width === 440 && size.height === 280;
}
