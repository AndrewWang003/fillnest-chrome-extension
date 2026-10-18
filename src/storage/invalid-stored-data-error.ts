import { CURRENT_SCHEMA_VERSION } from "./schema-version";

/**
 * Stored local data does not match the current schema.
 *
 * Task 031 moved this out of `fillnest-repository.ts` so that modules the
 * repository depends on - the sharing subsystem first - can throw it without
 * importing the repository back and creating a cycle. `fillnest-repository`
 * re-exports it, so every existing importer is unaffected.
 */
export class InvalidStoredDataError extends Error {
  constructor() {
    super(`FillNest local data does not match schema version ${CURRENT_SCHEMA_VERSION}`);
    this.name = "InvalidStoredDataError";
  }
}
