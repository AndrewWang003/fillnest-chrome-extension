# Task 035 — Whole-Extension Review

**Version:** `0.1.2 Task 16`
**Status:** Review complete — 2026-09-08. Three defects fixed here; six
findings recorded for a decision.

## Goal

The owner asked for a review of the whole extension, not of a change. This is
that pass: manifest and store posture, the message and permission boundary,
the data layer, browser-version compatibility, accessibility, performance,
documentation accuracy, and dead or duplicated code.

## Method

Read against the shipped artifact rather than the diff: the built manifest and
bundles, the service worker's message surface, the storage write path, all four
runtime surfaces, and every authoritative document. Findings are separated into
what was fixed here (small, safe, unambiguous) and what is recorded for a
decision (wide, cosmetic, or needing the owner).

## Fixed Under This Task

**R1. The provided icons paint as solid blocks on Chrome 116-119.** Task 023
Addendum B4 replaced the `<img>` icons with a span masked over `currentColor`,
using unprefixed `mask-image`. Unprefixed CSS masking shipped in **Chrome
120**; the manifest declares `minimum_chrome_version: 116`. On 116 to 119 the
mask is ignored and the span keeps its `background-color: currentColor`, so
every pencil, map-pin, plug and share-network icon renders as a **filled
rectangle** - worse than a missing icon, because it looks like a rendering
fault rather than an absent asset.

Fixed by declaring the `-webkit-` spelling alongside the standard one, which
those versions do support. The icon-seam test now asserts both.

Not fixed by raising `minimum_chrome_version`: the rest of the product works on
116, and narrowing supported browsers to avoid one prefix is the wrong trade.

**R2. The Popup had no forced-colors support at all.** Addendum B4 restated
every background-only distinction in system colours - in `side-panel.css` and
the Picker's stylesheet. `popup.css` was missed. So the exact control B4 exists
for, an activation switch whose on state is carried by track colour alone, was
still undistinguished in Windows High Contrast Mode, on the surface where
Website Access is granted. Fixed with the same block the Side Panel has,
covering the switch, the filled buttons, the warning notice and focus. Still
unverified in a real high-contrast session, exactly as B4 is.

Worth naming the pattern: this is the second defect in two reviews caused by
the Popup being a near-copy of the Side Panel rather than sharing its parts.
The first was the switch's accessible name (Addendum B5, finding 1); Task 034
merged the component, and this merges the last of its styling gap.

**R3. The privacy policy did not list the display preferences it stores.** The
policy enumerates what is kept in `chrome.storage.local` and now omitted the
theme (Task 034) and the pinned Picker position. Neither has privacy weight,
but a policy that says "everything is" and then lists a subset is inaccurate.
It also implied Backup exports all of it; display preferences are specific to
one browser and deliberately are not in the archive. Both corrected.

**R4. `README.md` described V1 and stopped.** A reader had no way to learn the
product now has Logical Page Identity, Shared Template Sets, the Field Finder,
or themes. A short "Since V1" section was added; the V1 scope list is unchanged
because it is still an accurate record of V1.

## Settled By The Owner (2026-09-08)

**R5 - `tabs`: keep it, and justify it precisely.** The listing wording is now
in the Task 033 contract beside the permission, together with the finding that
only one of its four uses actually needs it.

**R8 - a Template holds 1,000 Chinese characters.** The owner set the number
and asked that other writing systems convert at the same weight, so the measure
is **UTF-8 bytes**: a CJK character is three of them, 1,000 of them is 3,000
bytes, and the same budget buys roughly 3,000 Latin letters. Counting
characters instead would have squeezed English to a third of the room and
charged an emoji the price of a word.

Enforced at the service worker's own boundary - every message carrying newly
authored text does so as a top-level `content`, so one check covers all eight
of them and any added later. Deliberately **not** applied to Restore or to any
Undo, whose content arrives nested: that text was already accepted once, and
refusing to give a user their own data back would be the worse failure. Both
editors disable Save past the limit and say why, so nobody meets the refusal by
surprise.

The other half of R8 needed no decision and is done too: a full
`chrome.storage.local` now produces a sentence that says what is full and what
to do about it, instead of Chrome's own "Resource::kQuotaBytes quota exceeded".
Only the wording changes - the write genuinely did not happen and the caller
still sees a rejection - and any other storage failure is re-thrown untouched,
so a transient platform error is never mislabelled as a full store.

**A second limit the owner added: 20 Templates per Field, for V1.** Not a
storage limit - a usability one. The Picker's list is meant to be scanned, and
a Field offering thirty things has stopped being a shortcut. If it proves too
few, raising it is a one-line change that breaks nothing, because the limit is
checked when something is **added** and never when state is read or validated:
a Field already over it keeps working.

It covers the ordinary, repeatable "put this Template on this Field" actions -
the only ones that can grow a list without bound - and deliberately not the
structural Shared Template Set operations (adding a member, joining, merging,
promoting a Field-only slot). Those are one-off actions the user has already
confirmed, usually mid-flow, and refusing one because the result would be
twenty-one is a worse outcome than a Field briefly offering twenty-one. A Field
that arrives over the limit that way still cannot grow further: every add path
checks. Restore and every Undo are exempt for the reason the length limit
exempts them.

That exemption was silent, which was its real problem: a Set merge could take a
Field from twenty to forty while the confirmation said only how many *fields*
were affected. **The Picker's join and merge confirmation now states the
resulting Template count** - "Afterwards each of these fields offers 8 of 20
Templates" - and, when the union goes over, says so plainly and explains the
consequence ("you just will not be able to add more until some are removed").
It still never blocks: the owner's call was that the user should see the cost
and decide, not be stopped mid-flow.

The count is the union both operations produce, computed from ordinary slots
only - a Field-only slot stays visible to its owner alone - plus the Template
being shared, which this flow can reach from a Field-only slot that the same
action promotes and which is therefore not yet ordinary when the confirmation
is drawn.

A slot added to a Shared Template Set lands on every member at once, so the
question there is whether **any** member is full, not whether the Set is.

The Picker counts from the same effective list its rows render from, so what
the user can see and what the limit counts are the same thing: past the limit
the Bind actions are gone and the compose Save is disabled, each with a line
saying why, rather than letting the user reach the worker's refusal through a
control that looked available.

**The editors show how much room is left**, from 80% of the length budget, in
both the Picker and the Side Panel. It says "About 400 characters left" rather
than "2,600 / 3,000", which was the owner's literal request and would have been
actively wrong to read: the budget is UTF-8 bytes, so someone who has typed 867
Chinese characters has not typed 2,600 of anything. Nor can the *limit* be
shown as a character count, because there is no single one - it is 1,000
characters or 3,000 letters depending on what you type. What survives both
problems is the room remaining, measured in the characters the writer is
actually using; it is an estimate only for mixed text, hence "About", and it is
the number a writer wants anyway. The exact budget stays in `title`.

**A running Template count appears from within five of the limit** (`15 / 20`),
and turns to the warning colour at it. Not before: below that it is noise on a list
whose length is visible at a glance, and without it the limit would be met for
the first time as a refusal.

**R9 / Task 034 F5 - one switch size rule.** Three sizes existed across three
surfaces with nothing saying why. There is now one shared stylesheet beside the
one shared component, and one rule: **default** for a switch that is a control
in its own right, **`.compact`** for a switch inside a dense list row (the
Sites page's addresses). The size is three custom properties rather than three
re-declared rules, so a variant states only what differs and the thumb's travel
is computed rather than restated - that hand-written `translateX` per size was
the easiest thing to get wrong. The forced-colors block travels with the
control, which is how the Popup came to have none at all until R2.

**R9 / Task 034 F4 - the part that was a real defect, and the part that stays
deferred.** Reviewing it properly showed F4 was two different things.
`.primary-button`, `.origin`, `.access-line` and `.notice.warning` belong to
`CurrentWebsiteAccess`, a component **both** surfaces render, and each
stylesheet declared them separately and differently - the Allow-access button
had one margin in the Popup and another in Overview, with nothing saying which
was intended. That is drift waiting to become a bug, and it now has one
definition in a stylesheet beside the component.

The rest of F4 - the Popup's `.secondary-button` / `.compact-button` /
`.open-button` against the Side Panel's `.primary` / `.secondary` / `.danger` -
stays as it is. Those are each surface's own buttons, not a shared thing
declared twice; renaming them is wide, purely cosmetic, and touches every call
site for no user-visible gain.

**R7 - lifecycle mutation cost: decided to leave it.** Measuring well means a
representative churny page and a repeatable harness, and there is no complaint
to aim it at. The batching may already absorb the cost. Recorded as: measure
before optimizing, when there is something to measure against.

**R6 - the 140 kB content script: unchanged**, as recorded. It is a consequence
of Task 028's deliberate removal of `web_accessible_resources`.

## The Findings Themselves

Recorded when the review ran; each is now settled above.

**R5. The `tabs` permission is load-bearing for exactly one thing.** Chrome Web
Store review treats `tabs` as broad, and three of its four uses do not need it:
with a granted host permission, `chrome.tabs.query` already returns `url` for
that tab, which is all the broadcast filtering and the permission platform
need. The one use that does need it is reading the **current** tab's origin
*before* it is authorized - the "Allow access to <origin>" offer in the Popup
and Overview, which is the entry point to the whole product.

`activeTab` would cover the Popup (it is granted on the action click) but not
the Side Panel, which is not opened by an action click. Options are: keep
`tabs` and write the justification for the listing; or move the unauthorized-
origin read behind an explicit user gesture. This is a store-review and
product-shape decision, not a defect, and it belongs with Task 033.

**R6. The content script is 140 kB, injected into every authorized page.** It
contains the whole Inline Picker - 3,859 lines - because the Picker must render
inside the page. Code-splitting it would mean a dynamic import from the
extension origin, which needs `web_accessible_resources`, which Task 028
deliberately removed (it was an extension-presence probe available to every
page). So the size is a consequence of an accepted privacy decision. Recorded
so it is a known trade rather than a surprise, not proposed for change.

**R7. Lifecycle mutation cost is unmeasured.** The content script observes
`document.documentElement` with `subtree` + `childList` on every authorized
page. Attribute observation is filtered to a named list and reconciliation is
batched into one microtask, both of which matter; but each mutation record
still runs a `querySelectorAll` over its own subtree, so a churny SPA pays per
DOM insertion. Tasks 017 and 018 cover this path's **correctness** thoroughly
and its **cost** not at all. If this is ever a complaint, measure before
optimizing - the batching may already absorb it.

**R8. There is no storage-quota story.** `chrome.storage.local` gives 10 MB
without `unlimitedStorage`, and nothing caps a single Template's length or
warns as the store fills. A user who pastes something very large gets Chrome's
raw quota error surfaced as a FillNest failure. Low likelihood for plain-text
templates; the fix is a length cap at creation plus a legible message, and it
is small. It is recorded rather than done because picking the cap is a product
decision.

## Checked And Found Sound

Recorded so the next review does not re-derive it.

- **The message boundary.** Web pages cannot reach the service worker: there is
  no `externally_connectable`, so the only senders are FillNest's own extension
  pages and its own isolated-world content scripts. The explicit sender guards
  (`requireExtensionPage`, and the two origin-matching guards) sit on the
  permission, destructive and evidence-bearing messages, which is where they
  earn their keep. Every request is shape-validated by `isRuntimeRequest`
  before dispatch, and three exhaustive `Record<RuntimeRequest["type"], …>`
  maps make an unclassified new message a compile error rather than a silent
  default - which is exactly how Task 034's two new messages were caught.
- **The write path.** One storage key, one validator on every commit, staging
  for atomic composites, and a serialized queue in front. No partial write
  survives a failed validation.
- **Unbounded growth.** Logical Page Observations are pruned to bound Pages;
  Profiles are created only by user action. Nothing accumulates on its own.
- **No unsafe rendering anywhere.** No `innerHTML`, no `dangerouslySetInnerHTML`,
  no `eval`, no `new Function`, no `document.write`.
- **No debug residue.** No `console.*`, no `TODO`/`FIXME`/`HACK` in `src/`.
- **Build hygiene.** `dist/` and `dist-e2e/` are ignored and untracked; the
  built package is checked against a manifest policy that enforces, among other
  things, the absence of `web_accessible_resources`.
- **Store readiness.** `npm run verify:store` reports four blockers, all
  owner-owned and all already tracked by Task 033: icons, the version bump, a
  published policy URL, and screenshots.

## Evidence

`npm run check` passes: typecheck, lint, **60 files / 821 unit tests**, and the
verified build. The complete headed Playwright suite passes **46/46**.

R1's repair is asserted by the icon-seam test. R2's is scoped entirely to
`@media (forced-colors: active)` and, like B4, has not been seen in a real
high-contrast session. R8's limit is asserted against the real service worker
in the headed suite - over the limit refused, exactly at the limit accepted,
and an over-long Restore still accepted - and its quota wording is unit-tested
in both directions, including that an unrelated storage failure is re-thrown
unchanged. The 20-per-Field limit is asserted the same way: a Field filled to
twenty refuses the twenty-first, and a different Field on the same page is
unaffected by it. The Picker's own behaviour is unit-tested at three counts -
no badge below the threshold, the badge at it, and at the limit the badge
flagged with the Bind action withdrawn - and the join confirmation's resulting
count is asserted in the headed suite, as is the editor's remaining-characters
counter - silent on an ordinary draft, "About 400 characters left" at 2,600
letters.

Not covered by a test: the confirmation's **over-limit** wording. Reaching it
needs a fixture with twenty-one Templates across two Sets, which costs more to
build than the branch is worth; the under-limit branch beside it is exercised,
and both read from the same computed number.


## R7 Resolved — Lifecycle Mutation Cost, Measured And Then Reduced

**Status:** Complete 2026-09-09, on the owner's explicit direction to do R7 next.
**Method:** the one R7 itself asked for - measure before optimizing.

### How It Was Measured

`tests/e2e/lifecycle-cost.spec.ts` runs the same page through the same churn
twice: once on an Origin FillNest has no access to, so no content script exists
at all, and once with access granted and the Picker open on a composer - the
most expensive state the product has. Browser, machine, DOM and work are
identical across the two runs, so the gap is FillNest's own cost and nothing
else. Five repeats, median reported.

Two shapes, because they reach different parts of the observer:

- **Structure** - 500 append-and-remove batches over a 2,000-node conversation
  list. This is the path R7 names.
- **Streaming** - 5,000 rewrites of one text node, which is what a chat
  application does while a reply arrives, and the highest-frequency signal the
  observer can receive since it asks for `characterData`.

**The first attempt measured the wrong thing** and is recorded because the
mistake is easy to repeat: it awaited an animation frame per batch, so 200
batches took 3.3 seconds on both sides and the difference vanished into the
frame rate. Mutating in a tight loop and stopping the clock after the next
frame measures the work instead.

### What It Found

| Shape | Without FillNest | With FillNest | Overhead |
| --- | --- | --- | --- |
| 500 structure batches | 14.5ms | 44.1ms | +29.6ms (~59us each) |
| 5,000 streaming updates | 12.2ms | 12.2ms | none measurable |

Streaming costs nothing: a `characterData` record's target is a text node, and
the field search returns immediately for anything that is not an Element.

Structure cost **three times the page's own DOM work**, and the reason was
precise. Every record was answered with a `querySelectorAll` over its target's
whole subtree - and a growing list sends a thousand records whose target is the
*same* container, so that container was scanned a thousand times per batch.

### The Change

Distinct targets are collected into a Set and each is scanned once per flush.
That is the same answer for less work, not a different answer:
`queueLifecycleField` already collected into a Set, so a target seen repeatedly
never contributed anything one scan does not.

| Shape | Overhead before | Overhead after |
| --- | --- | --- |
| 500 structure batches | +29.6ms (~59us each) | **+1.5ms (~3us each)** |
| 5,000 streaming updates | none measurable | none measurable |

Twenty times less, and now a tenth of the page's own cost rather than triple
it. No long tasks were recorded on either side, before or after.

### A Third Shape, Because The First Two Were Too Kind

The fixture above carries two Fields. Asked whether more optimization was
warranted, the honest answer was that one shape had not been measured at all:
a **form-heavy** page under the same churn. It was added - 200 eligible Fields
- and it found something an order of magnitude larger than the original
finding:

| Shape | Without FillNest | With FillNest | Overhead |
| --- | --- | --- | --- |
| 500 batches, 200 Fields | 12.9ms | 686ms | **+673ms (~1.3ms each)** |

Fifty-three times the page's own cost. Two quadratic paths were behind it, both
of the same kind: `readDomRecognitionEvidence` enumerates the whole page and
builds every peer's identity key, which is right once per call and quadratic
when a caller does it per Field.

1. **The replacement check** read full evidence for **every added Field**. Five
   hundred added Fields on a 200-Field page meant five hundred page
   enumerations in one batch - 522ms of the 535ms remaining after the first
   repair.
2. **The reconciliation, the Picker's page-candidate list and the Finder's
   highlight** each did the same per Field.

Both now share one `PageFieldSnapshot` per pass - the page's Fields, their
metadata and their base keys, computed once. The snapshot is built lazily, so a
batch that adds no Field pays nothing for it.

| Shape | Overhead before | After the first repair | After the snapshot |
| --- | --- | --- | --- |
| 500 batches, 200 Fields | +673ms | +522ms | **+35ms** |
| 500 structure batches | +29.6ms | +1.5ms | at the noise floor |
| 5,000 streaming updates | none | none | none |

**Reported honestly: the sparse `structure` number is now noisy.** Across runs
it lands between 4ms and 26ms for 500 batches, which is the measurement's own
scatter rather than a signal - the work left is too small to separate from the
page. The `crowded` number is unambiguous: **673ms to 35ms, nineteen times
less**, and it is the shape that actually mattered.

### Evidence

`npm run check` passes (902 unit tests) and the complete headed suite passes
50/50 - including the Task 018 lifecycle matrix, which is the accepted evidence
for exactly this code path.

The benchmark is deliberately **not** part of `npm run test:e2e`: a timing
measurement that gates a suite becomes a flake. Run it with
`npm run bench:lifecycle`. It carries one loose ceiling assertion so that a
future change making the observer an order of magnitude more expensive fails
there rather than in someone's browser.

## Addendum A — Input Stops At The Content Limit (2026-09-11)

**Status:** Requested by the project owner on 2026-09-11 and implemented the same day; accepted by the owner on 2026-09-11 after hands-on QA. The Chinese input-method case (B4) passed its re-test after its repair.

R8 limited Template content to 3,000 UTF-8 bytes (about 1,000 Chinese
characters) by refusing to save: an editor accepted any length, then disabled
Save and explained why. **Owner decision:** input stops at the limit instead.

- Every Template editor - the Picker's compose and edit, and the Side Panel's
  two edit forms - fits each input through `fitTemplateInput`. Only what the
  input added, the text just before the caret, is cut, from its end and in
  whole characters. A paste keeps the part that fits. Text already in the
  editor, before or after the caret, is never touched.
- An input method's composition, which is how Chinese is typed, is left alone
  until it is committed: cutting text under a composition breaks it. The
  committed result is then fitted.
- A cut input shows the existing notice, "模版字数已达到上限。" or its English
  equivalent, which now also appears in the two edit forms that previously
  showed only the counter.
- A Template saved before the limit existed can still be edited down but not
  lengthened. `Use current field content` can still load a longer text; that
  editor then shows the notice and cannot save, as before. Programmatic text
  is not the user typing.
- The service worker's own limit check (R8) is unchanged, and remains the
  boundary.

**Repaired after the owner's QA (2026-09-11).** With a Chinese input method,
a composition was never cut: text past the limit stayed until the next letter
or digit removed all of it at once. The editors listened through Preact's
`onCompositionEnd` prop, which Preact lower-cases into `compositionend` only
when the element has an `oncompositionend` property. Chromium's textarea has
none, so the listener waited for an event named `CompositionEnd` that never
fires. happy-dom defines the property, so the unit test passed. The hook now
attaches a native `compositionend` listener through a `ref`. During a
composition the text can still briefly exceed the limit, because the input
method owns it; it is cut as soon as the characters are chosen.

**Evidence.** `tests/unit/template-input-fit.test.ts` (the rule),
`tests/unit/inline-picker-chinese-limits.test.tsx` (the Picker editor, with
happy-dom's `oncompositionend` removed so it sees what Chromium sees), and
`tests/e2e/template-limit-ime.spec.ts`, which drives a real composition
through the DevTools protocol and failed before the repair with 1,003
characters.
