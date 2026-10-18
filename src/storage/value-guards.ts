/**
 * Narrow runtime guards shared by the storage validators.
 *
 * Task 031 moved these out of `fillnest-repository.ts` so the extracted
 * sharing subsystem can validate its own records without importing the
 * repository back. They are deliberately trivial: anything with real logic
 * belongs to the module that owns the record it validates.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0)
  );
}
