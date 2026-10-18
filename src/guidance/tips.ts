/**
 * Task 042. The first-use tips: a start card for each surface, and a one-line
 * note for each feature page's first visit. Their ids are stored once
 * dismissed, so each appears once.
 */
export const TIP_IDS = [
  "popup-start",
  "picker-start",
  "this-tab",
  "all-templates",
  "by-location",
  "shared-sets",
  "sites",
  "share-with",
] as const;

export type TipId = (typeof TIP_IDS)[number];

export function isTipId(value: unknown): value is TipId {
  return typeof value === "string" && (TIP_IDS as readonly string[]).includes(value);
}

export function isTipIdArray(value: unknown): value is TipId[] {
  return Array.isArray(value) && value.every(isTipId);
}
