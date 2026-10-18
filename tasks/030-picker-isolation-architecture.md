# Task 030 — Picker Isolation Architecture

**Version:** `0.1.2 Task 21`
**Status:** Complete on 2026-09-07. Option A, refined - the shipped Shadow
Roots are closed, enforced by a build gate and proved by a production-build
E2E test. See `DEVELOPMENT.md`.
**Prerequisites:** None. Runs in parallel with Tasks 028 and 029.
**Source:** `tasks/evidence/whole-extension-audit-2026-09-06.md`, finding S1.

## Goal

Decide how the Inline Picker is isolated from the host page, and how FillNest
tests that isolation without weakening it. Today the Picker's Shadow Root is
`{ mode: "open" }`, and a host page can read Template content out of it.

## The Confirmed Problem

Reproduced in a real Chromium extension context on 2026-09-06. With two
Templates seeded on different Sites and a Picker opened with a Search query,
this ran in the **page's own main world**:

```js
document.querySelector("[data-fillnest-overlay]").shadowRoot
```

and returned the user's live Search query, the focused field's label, a
Template affiliated with the current Site, **a Template belonging to a
different Site, and that Site's domain**.

Task 005 made Search deliberately full-library and cross-Site. `PROJECT.md`
accepts that Site Affinity "does not provide security isolation", but that
sentence is about discovery *by the user*, not about the host page reading the
result. The trusted-event guards stop the page acting on the Picker; nothing
stops it reading.

## Why This Cannot Be A Bug Fix

`{ mode: "closed" }` is one line, and it would work — the content script runs
in an isolated world, so a page cannot patch `Element.prototype.attachShadow`
to defeat it, and the root is already held in a closure rather than read back
off the host.

But **Playwright pierces open Shadow Roots only**. Closing the root breaks
essentially the entire headed E2E suite, which drives the Picker through
ordinary locators — and that suite is FillNest's only built-extension
integration evidence. The one-line fix trades a confirmed privacy hole for a
confirmed evidence hole. That trade needs a decision, not a patch.

## Candidate Options To Evaluate

Each must be assessed against: does the shipped artifact resist a hostile
page; does the E2E suite still test the shipped artifact; what does it cost in
positioning, focus, and selection semantics; and what does it cost to
maintain.

### Option A — Build-time open in test, closed in production

The project owner's proposal (2026-09-06). Evaluate specifically:

- The switch **must** be build-time (a Vite `define`), so the production
  bundle physically contains `mode: "closed"` with no code path to open. A
  runtime flag is reachable and moves the hole rather than closing it.
- It conflicts in spirit with an existing rule: `AGENTS.md` says *"Do not
  change production optional-host policy merely to simplify automation. Record
  a skipped check and its reason rather than silently omitting it."* This
  option is the same shape of trade — production behaviour differing from
  tested behaviour — so it needs an explicit, recorded exception rather than
  silent adoption.
- Mitigation to evaluate: at least one E2E test that runs against the **real
  closed production build** and proves both that the page cannot reach the
  root and that the Picker still functions. Without it, the suite stops being
  evidence about what ships. This is precisely how a stale
  `find-similar-field.spec.ts` assertion survived undetected for weeks.

### Option B — Render the Picker in an extension-origin iframe

The Picker moves into an `iframe` served from `chrome-extension://`. The host
page cannot reach its document at all — cross-origin, not merely encapsulated
— regardless of Shadow Root mode. Playwright drives it with `frameLocator`,
so there is **no test/production divergence**.

Evaluate:

- Whether `PROJECT.md`'s "`iframe`, page Shadow DOM, or `contenteditable`
  support" non-goal refers to *host-page* iframes as fill targets. The audit
  reads it that way, but this must be confirmed, not assumed, before the
  option is viable.
- Cost to positioning (the Picker anchors to a field and repositions on
  scroll), focus handoff (`PROJECT.md` requires focus to return to the Target
  Field after insertion), the selection-preview overlay, and Keep Open
  dragging.
- Whether the content-script bundle size discipline survives the split.

### Option C — Closed root plus a behavioural test seam

Close the root and drive E2E through FillNest's own typed messages and
observable effects — field value, `eventLogs`, repository state — rather than
Picker DOM.

Evaluate: how much of the current suite's assertions are genuinely about
Picker DOM versus about outcomes, and whether the remainder can be covered by
existing component tests in `tests/unit/inline-picker.test.tsx`, which render
the Picker directly and are unaffected by shadow mode.

## Also In Scope

- The Page Status Control and selection-preview shadow roots
  (`content-script.tsx:124`, `:582`). Neither renders Template content, so
  they may keep `open`; the decision should be explicit rather than incidental.
- Whether `data-fillnest-extension-active` on `<html>` must remain readable
  from the page. It is an idempotency marker and an extension-presence signal.

## Explicit Non-Goals

- Implementing the chosen option. That requires its own contract.
- Any change to what Search returns. Full-library cross-Site Search is Task
  005's accepted behaviour and is not reopened here.
- The `tabs` permission or `web_accessible_resources` fingerprinting surface.

## Acceptance Criteria

1. A written comparison of Options A, B, and C against all four criteria
   above, with a recommendation and the reasoning for rejecting the others.
2. A decision on whether `PROJECT.md`'s `iframe` non-goal excludes Option B,
   resolved by the project owner rather than inferred.
3. A stated **isolation rule** for `PROJECT.md`: what the Picker must resist,
   what it deliberately does not resist, and why. The current documents
   describe the Shadow Root as *style* isolation only; whatever is chosen, the
   security expectation must be written down.
4. If the recommendation is Option A, an accompanying recorded exception to
   `AGENTS.md`'s production-parity rule, plus the specific production-build
   test that keeps the suite honest.
5. A follow-up implementation contract, scoped and slice-planned, ready for
   separate authorization.

## Stop Conditions

- If evaluation shows no option preserves both isolation and built-extension
  evidence at acceptable cost, stop and report rather than choosing the
  cheaper half.
- If Option B is blocked by the `iframe` non-goal, say so plainly rather than
  reinterpreting an accepted product decision.

---

## The Decision (2026-09-07)

Option A, with the switch moved out of anyone's hands and two gates added. The
owner proposed two manual variants: (a) develop with `open` and set `closed`
before publishing, or (b) develop with `closed` and let an agent flip to `open`
around each automated test run.

(b) is the better of the two, because its default state is the safe one. But
both share two flaws:

- **The switch is a source edit.** A crashed test run leaves the repository in
  the wrong state, and that state can be committed. In (a) the flip also has to
  happen at release time - the busiest, most forgettable moment - and
  "remind me" is a control that fails silently.
- **The suite would never exercise the shipped artifact.** Every E2E test would
  run against `open` while `closed` ships. That is the same class of gap that
  let a stale `find-similar-field` assertion hide for weeks, and the headed
  suite is this project's only built-extension evidence.

### What is implemented instead

1. **A build-time flag, not a source edit.** The Shadow Root mode comes from a
   Vite `define`. The production bundle physically contains `mode: "closed"`
   and has no code path that can open it. Nobody has to remember anything, and
   there is no wrong state to commit.
2. **`npm run build` produces the shipped artifact in `dist/`, always
   `closed`** - so the build the owner loads for hands-on QA is the build that
   ships. `npm run build:e2e` produces an `open` build in `dist-e2e/` for the
   Playwright suite, which drives the Picker through ordinary locators.
3. **A build gate.** `verify-build.mjs` asserts the production content script
   contains `mode:"closed"` and does not contain `mode:"open"`. Forgetting, or
   a future refactor that reintroduces the open mode, becomes a build failure
   rather than a silent regression.
4. **One production-build E2E test.** `picker-isolation.spec.ts` loads the real
   `dist/` artifact and asserts both halves: the host page cannot reach the
   Picker's Shadow Root, and the Picker still opens, searches and inserts. This
   is the evidence neither (a) nor (b) would have produced.

All three Shadow Roots move together - the Picker overlay, the Page Status
Control, and the selection preview. The latter two render no Template content,
but the Playwright suite drives them through the same locators, so one flag
keeps the artifact coherent and leaves no partially-open surface to reason
about.

The extension-origin iframe (Option B) remains the only option with no
test/production divergence at all. It is not taken now because of its cost to
positioning, focus handoff and selection semantics; the build gate and the
production-build test are what make this divergence honest in the meantime.

---

## Bounded Test Repair (2026-09-07)

**Owning Task:** Task 030. This repair changes only the production-build
isolation evidence; it does not change Picker behaviour or the isolation rule.
**Contract:** Accepted by the project owner as part of the Task 032 Phase A
reconciliation on 2026-09-07.
**Execution:** The test repair in commit `416376e` is in scope. No production
source change is authorized by this addendum.
**Acceptance:** Automated evidence complete on 2026-09-07; owner acceptance is
pending with the Task 032 Phase A checkpoint.

The production-build test previously clicked the closed-root control and typed
immediately. If the Picker had not taken focus yet, the Search text could enter
the page field and make the test timing-dependent. The repair waits until focus
inside the closed Shadow Root is observable from the page as the overlay host,
then continues to assert the user-visible result through the page field value.
The test still cannot inspect or pierce the closed root.

Evidence: `npm run check` (54 files, 673 unit tests, documentation conformance,
dead-export check, typecheck and production build) and the complete headed E2E
suite (44/44 passing, no skips).
