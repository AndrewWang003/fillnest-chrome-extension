# Whole-Extension Audit — 2026-09-06

Scope: the complete FillNest extension, not one Task. Product-goal alignment,
security and privacy, correctness and resilience, cross-document conflicts,
and design decisions worth revisiting.

Method: read the governing documents in the mandated order (`AGENTS.md`,
`PROJECT.md`, `CONTEXT.md`, `docs/agent-handoff.md`, ADRs, `tasks/README.md`,
`DEVELOPMENT.md`), then audited the 23,330 lines of `src/` against them. Every
finding marked **confirmed** was reproduced by an executable probe, not
inferred from reading. Probes were removed afterwards; the worktree is
unchanged by this audit.

Baseline at time of audit: `npm run check` green (49 files, 616 unit tests,
typecheck, build), headed Playwright suite 41/41.

---

## 1. Verdict On The Product Goal

FillNest's stated goal is a **local-first, quiet, field-aware plain-text
template tool where the user explicitly authorizes every origin, every
binding, and every insertion**. On the evidence, the implementation honours
that goal, and does so unusually well in the places that matter most:

- **Local-only is real, not aspirational.** `src/` contains zero occurrences
  of `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, or
  dynamic `import()`. Two runtime dependencies total (`preact`,
  `tldts-icann`). The E2E suite asserts network silence at runtime.
- **No code execution or HTML injection anywhere.** Zero `eval`,
  `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, or `dangerouslySetInnerHTML` in the entire source tree.
  Template content reaches the DOM only through `textContent` and
  `setRangeText`.
- **Permission minimalism at install.** No `host_permissions`, no static
  `content_scripts`, optional origins only — and `scripts/lib/manifest-policy.mjs`
  enforces all of it as a build gate rather than a convention.
- **Insertion is genuinely bounded.** `applyTextInsertion` writes only at the
  cursor or over the user's own selection, never the whole field, and never
  submits. The E2E fixture asserts `submitCount === 0`.
- **Untrusted events are refused.** The Picker's shadow root blocks
  non-`isTrusted` clicks at capture, and the suite exercises a hostile-page
  click path.

The gap between the stated product and the built product is small. Where the
audit found problems, they cluster in three places: **one real privacy hole
the contract never anticipated**, **recovery paths that fail closed with no
way out**, and **governing documents that no longer describe the product**.

---

## 2. Security And Privacy

### S1 — The host page can read Templates out of the Inline Picker (P1, confirmed)

All three shadow roots are created with `{ mode: "open" }`
(`src/content/content-script.tsx:124,337,582`). The Picker — including
full-library Search results — renders into the one on `[data-fillnest-overlay]`.
An open shadow root is reachable from the page's own main world.

Reproduced in a real Chromium extension context. With two Templates seeded on
different Sites, a Picker opened on the fixture origin, and the word
`candidate` typed into Search, this ran **in the page's main world**:

```js
document.querySelector("[data-fillnest-overlay]").shadowRoot
```

and returned, among other text:

```
FillNest | create-field | Search templates | VALUE=candidate |
All matching Templates | Bound candidate | 127.0.0.1 |
Bound candidate wrong site | other.test | New template
```

The page read: the user's live search query, the focused field's label, a
Template affiliated with this Site, **a Template belonging to a different
Site, and that other Site's domain**.

Why this matters more than it first looks. Task 005 made Search deliberately
full-library and cross-Site. `PROJECT.md` accepts that Site Affinity "does not
provide security isolation" — but that sentence is about *discovery by the
user*, not about *the host page reading the results*. The product's own
principle that "local-first storage does not imply that FillNest knows or
guarantees the sensitivity of user-authored template content" is exactly the
reason this matters: a user searching on site A can disclose the existence and
full text of templates written for site B to site A's scripts.

The trusted-event guards prevent the page from *acting* on the Picker. Nothing
prevents it from *reading*.

**Trade-off the fix carries, stated honestly.** `{ mode: "closed" }` would be
effective here — the content script runs in an isolated world, so a page
cannot patch `Element.prototype.attachShadow` to defeat it, and the root is
already held in a closure variable rather than read back off the host.
However, **Playwright pierces open shadow roots only**; closing the Picker's
root would break essentially the entire headed E2E suite, which drives the
Picker through ordinary locators. This is a genuine architectural decision,
not a one-line fix: closing the root means either a test-only escape hatch
(which partly reopens the hole) or a different E2E driving strategy. It should
be decided deliberately, not patched.

### S2 — The `tabs` permission is broader than the code needs (P3)

`chrome.tabs.query({})` is called at `src/background/service-worker.ts:558`
and `src/platform/chrome-permission-platform.ts:70`. With the `tabs`
permission, the returned objects carry `url` and `title` for **every open tab**,
including origins the user never authorized.

The code is careful in *use* — the broadcast path filters to granted origins
before addressing anything — but the *capability* is granted regardless, and
it contradicts the product's central promise of explicit origin-by-origin
access. It is also a "sensitive" permission that will need written
justification at the `0.2.0` Store gate.

It also looks avoidable:

- `listTabIds()` never reads a URL, so it needs no `tabs` permission at all.
- The broadcast path could use `chrome.tabs.query({ url: grantedPatterns })`,
  which is satisfied by the host permissions FillNest already holds for those
  exact patterns, and never exposes any other tab's URL.

Worth an explicit re-derivation of whether `tabs` is still required. If it is,
the reason belongs in `PROJECT.md` next to the constraint that forbids adding
it casually.

### S3 — Trivial extension fingerprinting (P3)

Two independent signals let any authorized page detect FillNest:
`data-fillnest-extension-active` on `<html>` (an intentional idempotency
marker), and four `web_accessible_resources` SVGs exposed to `http://*/*` and
`https://*/*` without `use_dynamic_url`.

The marker is load-bearing and the pages in question are ones the user already
authorized, so impact is limited. Still: the icons could be inlined as
`data:` URIs and the `web_accessible_resources` block deleted entirely, which
removes one signal at no functional cost.

### S4 — Field Eligibility has no government-ID vetoes (P2)

`src/fields/field-eligibility.ts` vetoes an impressively thorough list —
passwords, OTP/2FA, card numbers, CVV, IBAN/SWIFT/BSB/sort code, API keys,
private keys, bearer tokens. It has **no** rule for national identity numbers:
`ssn`, `social security`, `sin`, `nino`, `national insurance`, `tax id`,
`tin`, `passport`.

So `<input type="text" name="ssn">` classifies as **supported**: it receives a
Field Profile, an extension marker, a focus listener, and Picker UI. FillNest
never reads its value, so the exposure is bounded — but `AGENTS.md` requires
that "excluded sensitive or unsupported fields must receive no value read,
fingerprint, Field Profile, extension marker, per-field listener, UI, or
fill", and `PROJECT.md` says to exclude "other sensitive" fields. A national ID
field is squarely within the spirit of that rule and outside the current
implementation of it.

Adding these terms is low-risk: it extends an existing regex in one function,
and Task 017's fixture matrix exists to guard against overfitting.

---

## 3. Correctness And Resilience

### C1 — Factory Reset is unavailable exactly when it is needed (P2, confirmed)

`FillNestRepository.read()` fails closed on unrecognized data — correct. But
`ResetTransactionCoordinator.preview()` calls `businessRepo.read()`
(`src/reset/reset-transaction.ts:83`), and `execute()` re-previews before
acting. So when the store is unreadable, **Reset itself throws**.

Confirmed with a store bearing `schemaVersion: 11` — the shape a user would
have after installing a newer build and downgrading:

```
InvalidStoredDataError: FillNest local data does not match schema version 10
  at FillNestRepository.read (src/storage/fillnest-repository.ts:1182)
  at ResetTransactionCoordinator.preview (src/reset/reset-transaction.ts:83)
```

Task 009's entire purpose is "verified return to fresh-install local and
Website Access state". It is the designated escape hatch, and it is
unreachable in the one situation that most needs an escape hatch. The user's
only remaining recovery is manually clearing extension storage through
devtools — which is not a product affordance.

The fix is small in principle: Reset does not need to *understand* the stored
data to destroy it. A recovery path that reports "existing data is unreadable"
in the impact preview, rather than propagating the error, would restore the
guarantee. (The confirmation token is derived from the preview, so that path
needs a defined token for the unreadable case.)

### C2 — The whole-library `delete` gate is enforced only in the UI (P2)

`PROJECT.md` states, twice, that any operation whose final outcome removes the
entire Template Library requires exact typed `delete`, "regardless of entry
point."

Its two peers enforce their gates at the service-worker boundary:

```ts
case "RESET_FILLNEST":   if (message.typedConfirmation !== "reset")   throw …
case "RESTORE_BACKUP_ARCHIVE": if (message.typedConfirmation !== "restore") throw …
```

`DELETE_TEMPLATES` has neither. Its message shape is
`{ type: "DELETE_TEMPLATES"; templateIds: string[] }` — no typed
confirmation — and unlike Reset, Restore, and every permission operation, it
carries **no `requireExtensionPage(sender)` guard**, so it is callable from a
content-script context.

This is not currently exploitable by a web page: `externally_connectable` is
not declared, so pages cannot message the extension, and content scripts run
in an isolated world. It is a defense-in-depth and consistency gap rather than
a live vulnerability — but it is the single most destructive operation in the
product, and it is the least guarded of the three.

### C3 — Dead exports (P3)

`AGENTS.md` forbids "unused future-facing interfaces or placeholder data
models", and Task 008 was chartered to remove superseded paths. Three
survivors, each referenced nowhere but its own definition:

- `UndoIcon` — `src/ui/icons/FillNestIcons.tsx:89`
- `StaticSurface` — `src/ui/shared/StaticSurface.tsx` (the whole file)
- `isRemoveWebsiteAccessResultShape` — `src/ui/side-panel/SidePanelShared.tsx:374`

Separately, roughly forty component-level symbols in `SitesPage.tsx` and
`TemplatesPage.tsx` are exported but used only within their own file. Not
dead, but a wider public surface than intended.

---

## 4. Document And Contract Conflicts

This is the largest cluster, and the one most likely to cause the next agent
to build the wrong thing. `docs/agent-handoff.md` instructs an agent to **stop
rather than guess** when these sources conflict, and ranks `PROJECT.md` above
`DEVELOPMENT.md`. Each conflict below is therefore a live tripwire.

### D1 — `PROJECT.md`'s `0.1.2` scope omits most of what `0.1.2` actually built (P1)

`tasks/README.md` labels **eighteen** contracts `0.1.2 Task 01` … `Task 18`
(Tasks 010–027). `PROJECT.md:200` — the authoritative release path — describes
`0.1.2` as:

> Interaction feedback consistency; Side Panel header and notification-region
> redesign; Sites/Templates information-architecture improvements; generic form
> compatibility learning; and evaluation/implementation of complex control support.

That covers Tasks 010, 011, 012, 013 and one unstarted item. It does **not**
mention Logical Page Identity (014, 020), Share Templates / Shared Template
Sets (015, 021), the eligibility lifecycle quartet (016–019), accessibility
hardening (023), Compatibility Candidate Suggestions (024), modal
accessibility (025), per-field Overrides (026), or Explicit Template Audience
Scope (027).

Thirteen of eighteen tasks — including the entire sharing subsystem that now
accounts for a large share of the repository and three consecutive audits —
are invisible in the document that outranks `DEVELOPMENT.md`.

Note that Task 022 was *specifically* "Current-State Documentation Alignment"
and concluded "No other inconsistency found." It corrected `README.md`'s task
count and an ADR status field, and missed this, D2, D3, and D4.

### D2 — `PROJECT.md` still mandates behaviour Task 026 removed as a defect (P2)

`PROJECT.md:153`:

> Editing a Template with multiple Bindings **or Site Affinities** offers
> `Save everywhere` and `Save a copy for this field`.

Task 026 changed `resolveTemplateEditScope` to stop counting Site Affinities,
and `DEVELOPMENT.md` records that change as fixing "a real contract violation
of acceptance 4, caught by a regression test." The code now computes
`effectiveUseCount` from direct Bindings, shared slots, and Overrides only.

So the stable product document currently prescribes, as a rule, the exact
behaviour an accepted Task removed as a bug — and there is a regression test
pinning the opposite.

### D3 — Documented save labels do not exist in the product (P2)

`PROJECT.md:153–154` documents `Save a copy for this field`. The product
ships `Save a copy here`, `Save for this field`, `Save for shared fields`,
`Save everywhere`, and (as of Task 027 Addendum A) `Share with the Set`.

This is not cosmetic: a stale label in this exact area silently broke
`tests/e2e/find-similar-field.spec.ts`, which spent an unknown period being
recorded in `DEVELOPMENT.md` as a "known pre-existing, unrelated failure" when
it was in fact a stale assertion clicking a button that no longer exists.

### D4 — `CONTEXT.md`'s domain language predates two Tasks that changed it (P2)

`CONTEXT.md` is the authority on domain language, and `docs/agent-handoff.md`
says not to introduce a competing meaning for an established term. Two of its
definitions are now false:

- **Shared Template Set** — "a named group of Field Profiles that share
  **one ordered effective Template list**." Since Task 026 (per-Field
  Overrides and Exclusions) and Task 027 (owner-only slots), members of one
  Set demonstrably resolve *different* lists.
- **Shared scope** — "Its effective Template list is **the set's shared list
  only**." It is now the Set's slots resolved per-slot against that Field's own
  Override/Exclusion state, with owner-only slots visible to exactly one
  member.

And the vocabulary those Tasks depend on is unregistered: **Shared Template
Slot**, **Override**, **Exclusion**, **Field-only relationship**, **audience**,
**promotion**, **collapse**. Seven load-bearing terms, all defined only inside
Task contracts.

### D5 / D6 — Smaller staleness (P3)

- `README.md:70–72` states Task 020 "is the most recently accepted." Tasks
  021, 022 and 024 have been accepted since. This is the same failure mode
  Task 022 was created to correct, recurring within weeks.
- `package.json` and `public/manifest.json` both declare version `0.1.1`,
  the MVP-closure release, while the tree carries eighteen tasks of `0.1.2`
  work. The manifest policy validates that the version is well-formed but not
  that it matches the release train.

---

## 5. Design Decisions Worth Revisiting

These are not defects. They are choices whose consequences look under-examined.

**A `change` event fires on every insertion.** `applyTextInsertion` dispatches
`input` and then `change` immediately. For text inputs, native `change` fires
on *blur*, not on edit. The behaviour is deliberate and pinned by E2E
assertions, but host pages commonly treat `change` as a commit signal —
triggering validation, dirty-state tracking, or autosave. For a product whose
first constraint is "never submit a form", dispatching the browser's own
commit-shaped event on every insertion deserves a recorded rationale.

**Using a Template destroys your Undo.** `RECORD_INSERTION: true` in the
broadcast table means every successful insertion invalidates every pending
Undo. That follows Task 010's rule ("any later successful mutation invalidates
a pending Undo") and insertion *is* a mutation. But the user-visible effect —
create a Template, insert it once, and the Undo for the creation is gone — is
surprising in a way the rule's authors may not have intended.

**No linter.** `npm run check` is typecheck + tests + build. There is no
ESLint config and no `lint` script in a 23k-line TypeScript codebase. The code
is remarkably clean by hand (zero `any`, zero `@ts-ignore`, zero `TODO`, zero
stray `console.log`), so this has cost little so far — but the three dead
exports in C3 and the over-export surface are exactly what a linter catches for
free.

**`fillnest-repository.ts` is 6,068 lines.** It holds the schema, every
validator, the full migration chain, every business command, every Undo, and
the resolver. `AGENTS.md` asks to "separate UI, business logic, validation,
data access, and browser integrations where practical." This file is the
single largest structural risk in the codebase, and it is not a coincidence
that three consecutive audits of Task 027 kept finding new defects in it: the
membership commands, the resolver, and the Undo staleness checks all live in
one place and all had to agree about a data shape that changed twice.

---

## 6. What Is Genuinely Strong

Worth stating plainly, because it is unusual:

- **The broadcast table** (`src/background/business-state-broadcast.ts`) is a
  total mapping over `RuntimeRequest["type"]`, so adding a message without
  deciding its Undo-invalidation semantics is a **compile error**. That is the
  right way to make a policy unforgettable.
- **The manifest policy gate** turns the product's most important safety
  constraints (no `<all_urls>`, no static content scripts, no options page)
  into a build failure rather than a review checklist.
- **Validate-before-commit plus serialized mutations.** Every write runs
  through `validateCandidateState`, so a bug produces a rejected operation
  rather than a corrupted store — which is why three audits' worth of defects
  in the sharing subsystem never actually damaged user data.
- **Migrations validate before persisting**, so a malformed legacy record
  cannot be upgraded into a valid-looking but wrong state.
- **Test discipline.** 616 unit tests plus 41 headed built-extension E2E
  tests, all green, including adversarial cases (hostile synthetic clicks,
  runtime network allowlisting, zero-touch assertions on excluded fields).

---

## 7. Recommended Order Of Work

1. **Decide S1.** It is the only finding where a real user on a real site can
   lose data confidentiality today. It needs a decision about the Picker's
   isolation model and the E2E strategy that depends on it — not a quick patch.
2. **Fix C1 and C2.** Both are small, both restore guarantees the product
   documents already promise, and C1 removes a state a user cannot get out of.
3. **Reconcile the documents (D1–D4).** This is cheap in effort and high in
   leverage: every future agent reads these first, and the handoff guide tells
   them to stop when they conflict. D1 in particular should be an explicit
   decision — either `0.1.2`'s scope genuinely expanded and `PROJECT.md` should
   say so, or several accepted tasks were built outside the authorized release
   scope and that needs acknowledging.
4. **Add S4's vetoes**, with fixtures.
5. **Consider splitting `fillnest-repository.ts`** before the next feature
   lands in it, and adding ESLint. Both are prophylactic rather than urgent,
   and both address the conditions that produced the last three audits.

## Not Covered

Honest limits of this pass:

- No hands-on QA in a real browser profile beyond the automated E2E suite.
- No accessibility audit (Tasks 023/025 own that; the new Task 027 Addendum A
  confirmation dialog has no dedicated accessibility test).
- No performance or storage-quota analysis under large libraries.
- The Task 024 compatibility-ranking heuristics were read but not
  adversarially probed.
- `docs/next-version-discussion.md` and the `.agents/skills/` sources were not
  reviewed.
