# Residual Restore Failure Probe

Verified current HEAD `4327d88` on 2026-09-12. No production changes.

Result: **1/1 passed**, 312 ms. This probe asserts the observed defect, not
the desired safe behavior. It uses the actual service worker with simulated
Chrome storage failures.

After Restore's target business write succeeds, fail its activation write,
the business rollback write, and the attempt to mark the journal `failed`.
The original `in_progress` journal remains, but `rollbackFailure` was never
set: `src/backup/restore-journal.ts:121` throws before line 122. Clear the
simulated outage. The same worker accepts `CREATE_TEMPLATE`, and a subsequent
Restore overwrites and deletes the journal holding the original user data.

This is the remaining Task 006 Addenda A/B fail-closed gap. The existing
regression simulates activation and rollback failure, but lets the journal
status update succeed. Startup recovery already handles failure to update the
journal; the in-session transaction catch does not.

Run from the repository root, then remove the temporary executable copies:

```sh
cp tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.test.ts.txt tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.test.ts
cp tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.config.mjs.txt tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.config.mjs
npx vitest run --config tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.config.mjs
rm tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.test.ts tasks/evidence/phase-one-audit-2026-09-11/residual-runtime-probe.config.mjs
```
