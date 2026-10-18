/**
 * The Repository's fail-closed error types.
 *
 * Task 032 Addendum A slice B1. These are thrown by command transitions and
 * caught by callers across the extension, so they cannot live in
 * `fillnest-repository.ts` once command bodies move out of it - the command
 * module and the Repository would import each other. `fillnest-repository.ts`
 * re-exports them, so every existing import site is unchanged.
 */

export class StaleUndoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleUndoError";
  }
}

export class StaleImpactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleImpactError";
  }
}

/** A confirmation whose candidate no longer holds against the current candidate state (Task 014 fail-closed rule). */
export class StaleLogicalPageCandidateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleLogicalPageCandidateError";
  }
}

/** A `Stop matching` separation whose provenance cannot form a valid candidate state (Task 014 fail-closed rule). */
export class LogicalPageSeparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogicalPageSeparationError";
  }
}
