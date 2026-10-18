import { isRecord } from "./value-guards";

/** The Inline Picker's one saved floating position (Task 003 Keep Open). */
export interface PickerPosition {
  top: number;
  left: number;
}

/**
 * Task 032 moved this beside its own type so the migration chain and the state
 * validators can both use it without either importing the repository.
 */
export function isPickerPosition(value: unknown): value is PickerPosition {
  return (
    isRecord(value) &&
    typeof value.top === "number" &&
    typeof value.left === "number" &&
    Number.isFinite(value.top) &&
    Number.isFinite(value.left)
  );
}
