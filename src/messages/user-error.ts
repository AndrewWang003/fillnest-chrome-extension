/**
 * Task 037 acceptance 6 (Addendum D). An error a person will read reaches its
 * surface as a code, and the surface says it in the chosen language.
 *
 * The core stays English: it throws with an English sentence, which is what a
 * log, a test and the English catalogue read. The code is what lets a surface
 * speaking another language say the same thing in its own words. Only the
 * errors a user can actually meet carry one; an internal invariant no surface
 * shows keeps its plain `Error`, and a surface shows its English text as is.
 */
export type UserErrorCode =
  | "field-template-limit"
  | "set-template-limit"
  | "template-too-long"
  | "stale-undo"
  | "stale-impact"
  | "stale-page-match"
  | "inconsistent-data"
  | "backup-invalid"
  | "backup-too-large"
  | "restore-preview-stale"
  | "restore-recovery-blocked"
  | "reset-preview-stale"
  | "reset-incomplete"
  | "remove-site-incomplete"
  | "confirmation-mismatch";

/** Thrown where no error class of its own already names the failure. */
export class UserFacingError extends Error {
  constructor(
    readonly code: UserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * The error classes whose every instance is something a user can meet, by the
 * `name` each sets. Matched by name because they live in the storage and
 * backup layers, which this module - shared with every surface - must not
 * import.
 */
const CODE_BY_ERROR_NAME: Readonly<Record<string, UserErrorCode>> = {
  StaleUndoError: "stale-undo",
  StaleImpactError: "stale-impact",
  StaleLogicalPageCandidateError: "stale-page-match",
  LogicalPageSeparationError: "stale-page-match",
  InvalidStoredDataError: "inconsistent-data",
  InvalidBackupArchiveError: "backup-invalid",
  OversizedBackupArchiveError: "backup-too-large",
};

export function userErrorCodeOf(error: unknown): UserErrorCode | undefined {
  if (error instanceof UserFacingError) return error.code;
  if (error instanceof Error) return CODE_BY_ERROR_NAME[error.name];
  return undefined;
}
