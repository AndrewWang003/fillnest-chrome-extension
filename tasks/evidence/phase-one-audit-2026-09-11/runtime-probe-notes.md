# Runtime Boundary Audit Evidence

**Status (2026-09-11): all four defects below are repaired.** Kept, by owner
decision, as the evidence the repairs answer: Task 006 Addenda A and B (1, 4),
Task 037 Addendum D (2, 3). The `.txt` probes assert the behaviour *before*
the repairs, so against the current tree they fail by design; the regressions
that replaced them live in `tests/unit/service-worker-runtime.test.ts`.

Reviewed HEAD: `bd221db3d05db923e76502af8b03a86f696f962a`.

The saved `.txt` files contain executable Vitest evidence outside the normal
test suite. They run the actual service worker with an in-memory Chrome platform;
only storage failures and platform responses are simulated. Assertions describe
observed defects, not correct product behavior. No production source was changed.

## Reproduce

Run from the repository root; remove the temporary executable copies afterwards
so the evidence does not join the production lint/typecheck inventory.

```sh
cp tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.test.ts.txt tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.test.ts
cp tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.config.mjs.txt tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.config.mjs
npx vitest run --config tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.config.mjs
rm tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.test.ts tasks/evidence/phase-one-audit-2026-09-11/runtime-probe.config.mjs
```

Observed run on 2026-09-11: **4/4 passed**, 249 ms.

## Confirmed Results

1. After a valid Restore writes the target business state, injected activation
   failure and failed business rollback leave a failed journal. The same worker
   still accepts `CREATE_TEMPLATE`. A second valid Restore overwrites and deletes
   the journal holding the original data. Task 006's fail-closed promise is only
   enforced at worker startup, not after a transaction fails during operation.
2. Reset clears the language preference to `system` and emits appearance,
   activation and business notifications, but no `LANGUAGE_CHANGED`. Mounted
   `useLanguagePreference` consumers listen only for that language notification.
3. Selecting Chinese and validating malformed JSON returns the English message
   `File content is not valid JSON.` without an error code. Settings displays that
   raw message. Task 037 acceptance criterion 6 is not implemented.
4. A private Template Binding and a Field with `observedTitle` and
   `insertionRejected` export all three properties correctly. The real worker's
   Restore succeeds but drops all three. Archive encoder/parser unit roundtrips
   do not cover the worker's separate field-by-field reconstruction.

The failure injection demonstrates a recovery-boundary defect; it does not
claim ordinary Chrome storage failures occur at a measured frequency. The Reset
probe confirms notification omission, with the stale mounted UI conclusion
supported by inspection of `src/i18n/useMessages.ts`.
