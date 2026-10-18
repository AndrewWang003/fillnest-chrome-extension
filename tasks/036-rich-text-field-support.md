# Task 036 — Rich Text Field Support

**Version:** `0.1.2`
**Status:** **Complete and accepted by the project owner on 2026-09-09**, after
seven hands-on QA passes ending in a clean-install verification on ChatGPT,
Claude and Gemini. The owner accepted with the two uncovered repairs (A.6, A.7)
and the three known boundaries stated below explicitly on the record.
**Origin:** The owner's hands-on testing on 2026-09-09, and the
`Required Before Launch` entry it produced in `tasks/README.md`.
**Grill record:** Eleven decisions, three rounds, 2026-09-09. Each is recorded
in `Confirmed Contract` below with the reasoning that settled it.

**Depends on two addenda, both accepted on 2026-09-09 alongside this
contract:**

- Task 016 Addendum E - accessible-name evidence for DOM-replacement recovery.
- Task 024 Addendum B - a structural compatibility kind for rich-text hosts.

`If An Addendum Is Declined` is retained below as the record of what each one
buys, and of what this contract would still deliver without it.

## Goal

Make a `contenteditable` editing host a first-class FillNest Field: it offers
Templates, accepts a deliberate single insertion, and - when it can be
identified reliably - remembers a Binding. Without any per-site or per-editor
knowledge.

## User Value

People ask the same questions in the same shape repeatedly. A reusable Template
is exactly what that wants, including a prompt fragment appended to whatever
they are already typing. Today FillNest attaches only to `<input>` and
`<textarea>`, so the Markdown and JSON editors on `vue-typescript-admin-template`
work - both are textarea-backed - while every `contenteditable` composer gets
nothing at all.

## Confirmed Evidence

Read from the implementation on 2026-09-09, before any decision was taken.

- `asSupportedField` (`src/fields/dom-field.ts`) accepts only
  `HTMLInputElement` and `HTMLTextAreaElement`. A `contenteditable` host does
  not fail eligibility; it never enters the pipeline.
- `applyTextInsertion` (`src/insertion/apply-text-insertion.ts`) has two
  branches and both are `<input>`/`<textarea>` interfaces: `setRangeText` with
  a hand-dispatched `InputEvent`, or `document.execCommand("insertText")`. A
  hand-dispatched `input` event is untrusted; a document-model editor
  (ProseMirror, Lexical, Quill) is entitled to ignore it, which puts the text
  in the DOM while the editor's own document stays unchanged - so the next
  render erases it.
- `buildFieldIdentityKey` (`src/recognition/recognition-evidence.ts`) keys on
  `name`, `id`, `autocomplete` and semantic kind, falling back to a structural
  key (ancestor tags, ordinal, supported-field count) when all are absent.
- `isSensitive` and `isSpecialPurpose` (`src/fields/field-eligibility.ts`) read
  `type`, `autocomplete`, `name`, `id`, `label`, `role`, `placeholder` and
  `data-provide`. A bare `<div contenteditable>` has none of them, so the
  exclusions do not weaken on rich text - **they do not run at all**.
- `classifyCompatibilityKind` (`src/compatibility/compatibility-kind.ts`)
  reads only `autocomplete` and effective input `type`. A rich-text host has
  neither, so it classifies as `unclassified`, which `compatibilityKindsMatch`
  rejects outright - no automatic Task 024 suggestion is possible today.

Verified against the real modules the same day, for the owner's own scenario:

| Address | Page identity key | Route pattern |
| --- | --- | --- |
| `chatgpt.com/` | `/` | `/` |
| `chatgpt.com/c/<uuid A>` | `/c/:record` | `/c/:id` |
| `chatgpt.com/c/<uuid B>` | `/c/:record` | `/c/:id` |

Two consequences, both load-bearing for this contract:

1. **Every conversation is already one Page Profile.** Two different
   conversation URLs produce byte-identical page identity keys. Reuse across
   conversations needs no Logical Page Rule, no confirmation, and no work here.
2. **The new-conversation page is a different Page Profile, and not
   comparable.** `routeFamily("/", "/c/:id")` is `null` because the segment
   counts differ, so not even a Review candidate can be offered. The same holds
   for `/new` vs `/chat/:id` and `/app` vs `/app/:id`. See `Known Boundary: The
   New-Conversation Page`.

## Confirmed Contract

### Eligibility

An element is a **Rich Text Field** when all of the following hold.

1. It is an editing host: `contenteditable` resolves to `true` on the element
   itself, and it is not inside another editing host that already qualifies -
   the outermost host is the Field.
2. It declares itself, by **either** `role="textbox"` **or** a non-empty
   accessible name (`aria-label`, `aria-labelledby`, or an associated
   `<label>`).
3. None of these disqualifying structures apply:
   - the element's own `role` is `code`, `grid`, `gridcell`, `row`, `cell`,
     `columnheader`, `rowheader`, `listitem`, `option` or `treeitem`;
   - an ancestor within the editing context has `role` `grid`, `table`,
     `treegrid`, `listbox`, `tree` or `menu`;
   - ~~`aria-multiline="false"`~~ - withdrawn by Addendum D.
4. The existing sensitive and special-purpose vetoes pass, evaluated against
   the accessible name in the slot `label`/`ariaLabel` occupy today, so that
   every word-based exclusion FillNest already enforces continues to apply.

Rule 2 is deliberately an `or`. Requiring both was considered and rejected: it
would have staked the whole feature on an unverified assumption about how three
specific editors mark up their hosts, and a rule that ships too narrow can be
widened later, while a rule that ships too wide cannot be narrowed without
destroying Bindings users have already made.

An element failing any of the above receives **no marker, no listener, no Field
Profile, no UI and no value read**, per `AGENTS.md`.

### Named Verification Targets Are Evidence, Not Code

Mainstream AI chat composers - ChatGPT, Claude, Gemini, and any other the owner
names - are **named acceptance targets**. This contract is not complete until
they are verified by hand.

No site name, domain, class name, DOM shape or editor identity appears in the
source. When a named target does not work under the generic rule, the two
permitted responses are to **widen the generic rule** - re-evaluating the false
positives that widening admits - or to **record it as unsupported**. Adding a
special case for it is forbidden by `AGENTS.md` and by this contract.

The distinction has teeth: a named site in the QA matrix obliges us to re-run
it after every related change; a named site in the code fails silently at that
site's next redesign.

### Binding Is Tiered

- A Rich Text Field with a **non-empty accessible name** behaves exactly like
  any other Field: Field Control, Picker, insertion, Bind, Create-and-Bind,
  Unbind, Undo.
- A Rich Text Field qualifying **only** through `role="textbox"` offers the
  Field Control, the Picker and insertion, but **Bind and Create-and-Bind are
  disabled**, with the reason stated in the Picker: this editor exposes no
  stable identity, so a Template can be inserted but not remembered.

The reason is `buildFieldIdentityKey`. Without an accessible name there is no
key but the structural fallback - ancestor tags plus ordinal - and on the SPAs
this feature exists for, expanding a sidebar or switching conversations can
change the ancestor chain. That yields a Binding that disappears periodically,
which costs more trust than the missing feature does. FillNest already has this
habit: a Pinned Picker whose Target is gone stays visible as a safe no-target
surface with every action disabled and the reason shown.

### Reading Field Content

Identical to every other Field, so that the user's experience does not fork:

- `Use current field content` and the non-empty-selection preview both work.
- What is read is **plain text only** - `Selection.toString()` for a selection,
  the host's rendered text for whole content. Formatting, code blocks, mentions
  and attachment placeholders are flattened or dropped.
- The Picker states plainly that FillNest keeps plain text only.
- Reading remains what it is today: only on an explicit user action, never
  persisted, never inferred from.

### Insertion

- Insertion goes through `Selection`/`Range` and `beforeinput`/`insertText`,
  never `setRangeText`, and never `execCommand` on a rich-text host.
- **No synthetic `Enter`, `keydown` or `keypress` is ever dispatched.** A
  multi-line Template must not submit a chat message. This is the direct
  consequence of `AGENTS.md`'s prohibition on submitting forms, and it is a
  stop condition, not a preference.
- Insertion replaces the selection or lands at the caret. It never replaces the
  whole host content unless the whole host content is the selection the user
  made.
- **After inserting, verify.** On the next animation frame, check that the
  inserted text is present in the host's text content. If it is not, the
  editor rejected or reverted the insertion.

### Insertion Rejection

- On a verified rejection, the Picker reports it through the existing result
  region: this editor did not accept the insertion.
- A **`Copy to clipboard`** action appears alongside that message. **The
  clipboard is written only when the user activates it.** FillNest never writes
  the clipboard on its own - not "and we copied it for you", not on success,
  not on failure. The user's clipboard may hold something they care about, and
  silently replacing it is not ours to do.
- The rejection is remembered as **one boolean on that Field Profile**. On a
  later visit the `Copy to clipboard` action is shown up front, before the user
  spends a click discovering the failure again.
- The flag records only that a rejection happened. Not the Template, not page
  content, not a reason string, not a timestamp.
- **Any subsequent successful insertion clears it**, so an editor that fixes
  itself stops carrying a warning.
- It is Field-scoped rather than Page- or Origin-scoped so that one editor's
  behaviour never mislabels an unrelated editor. In the AI-chat case this is
  also the widest useful scope anyway, because every conversation page shares
  one Page Profile and one Field.
- Being a Field Profile attribute, it is removed by Clear Site Data, Remove
  Site and Reset, and travels in a Backup Archive, with no new storage
  structure and no archive version change.

### Site-Local, Like Everything Else

This contract introduces no cross-Origin field identity and no shared
"conversation composer" concept. A user who wants one Template list across
several AI sites uses the Task 024 `Link templates` flow and confirms it
explicitly, which is the mechanism that already exists for exactly this.

A cross-site composer identity was considered and rejected: deciding that a
control on site A and a control on site B are "the same field" cannot be done
generically, so it would necessarily become a site allowlist.

## Known Boundary: The New-Conversation Page

`chatgpt.com/` and `chatgpt.com/c/:record` are two Page Profiles and are not
comparable, so a Template bound in a conversation is not offered on the
new-conversation page. `claude.ai/new` vs `/chat/:record` and
`gemini.google.com/app` vs `/app/:record` have the same shape.

**This is not repaired by inference here, and the reason is the same one that
produced the comparability floor in Task 014 Addendum C.** Loosening
`routeFamily` to bridge these was evaluated and rejected: a "differs by one
trailing segment" rule reaches Gemini only, and it makes `/products` and
`/products/:id` one family - a list page and a detail page that can easily both
reduce to one search box, which is precisely the high-similarity false offer
the floor exists to prevent.

**The mitigation is the mechanism that already exists.** With Task 024 Addendum
B, the new-conversation composer and the conversation composer are a same-Site
pair with exactly one candidate, so Task 024 offers the link automatically and
the user confirms once. Without that addendum, the user reaches the same result
through `Find similar field` manually.

A general **manual page pairing** capability - the user declaring two Page
Profiles equivalent, with no inference at all - is the honest general fix. It
is recorded in `docs/next-version-discussion.md` as a separate future contract,
because it is a whole capability of its own and belongs to no site.

## Non-Goals

- Any per-site or per-editor branch, selector, domain, class name or DOM
  assumption.
- Cross-Origin composer identity or a shared conversation-prompt field.
- Manual page pairing (recorded for a future contract).
- Automatic retry with a second insertion strategy after a rejection. Guessing
  an editor's implementation is the forbidden direction, and a wrong guess
  inserts the Template twice, which is worse than not inserting it.
- A new setting to enable rich-text support. Per-Origin authorization is
  already the safety valve; a second switch is a duplicate control surface.
- Preserving, producing or inserting formatting, HTML or Markdown structure.
  Templates are plain text and are inserted as plain text.
- Changing `<input>`/`<textarea>` behaviour in any way.

## Acceptance

1. A Rich Text Field with an accessible name offers the Field Control and the
   Picker, inserts at the caret, and Binds; the Binding is still offered after
   a reload of the same address.
2. A host qualifying only through `role="textbox"` offers insertion, disables
   Bind and Create-and-Bind, and states why.
3. Every disqualifying structure in `Eligibility` receives no marker, no
   listener, no Field Profile and no value read, asserted directly in the DOM.
4. A rejected insertion is reported, offers `Copy to clipboard`, and the
   clipboard is **not** written until that action is activated - asserted, not
   assumed.
5. The rejection flag is remembered for that Field, presented up front on the
   next visit, and cleared by the next successful insertion.
6. No synthetic key event is dispatched during insertion, asserted by a fixture
   that fails the test if a `keydown` reaches the host.
7. `Use current field content` and the selection preview return plain text and
   persist nothing beyond the Template the user creates.
8. `npm run check` and the complete headed Playwright suite pass.
9. The owner's hands-on QA on the named AI chat targets passes.

## Validation

**Automated - fixtures owned by FillNest, in `demo/`.** Four editor families,
because the contract is about editor families rather than sites:

| Fixture | Proves |
| --- | --- |
| ProseMirror-shaped host | Insertion accepted by a document-model editor |
| Lexical-shaped host | The same for a second document model |
| Quill-shaped host | The same for a third |
| A host that calls `preventDefault` on `beforeinput` | Rejection is detected, reported, and the clipboard stays untouched until the user acts |
| A host that overwrites its DOM on the next frame | Post-insertion verification catches the revert, not just the refusal |
| CodeMirror-shaped editor | Excluded: no marker, no listener, no read |
| A grid cell | Excluded for structural reasons |
| A `role="textbox"` host with no accessible name | Insert allowed, Bind disabled, reason shown |

These run headed, alongside the existing suite.

**Manual - the owner.** ChatGPT, Claude and Gemini: the Field Control appears
in the composer; a Template inserts and survives; a Binding made in one
conversation is offered in another; the new-conversation page produces the Task
024 link offer; nothing appears where it should not. Estimated 20-30 minutes.

## If An Addendum Is Declined

- **Without Task 016 Addendum E**, a Rich Text Field whose host element is
  replaced by the SPA loses its Binding until the user re-binds. Everything
  else in this contract still works. On the sites this feature targets, host
  replacement is routine, so the practical cost is high.
- **Without Task 024 Addendum B**, the new-conversation page produces no
  automatic link offer and the user must use `Find similar field` manually.
  Nothing breaks; a discovery step becomes the user's job.

## What Implementation Found

Recorded here rather than only in Git, because three of these changed a
decision or a boundary.

### `execCommand` from a content script never fires `beforeinput` in the page

Measured in a real headed Chrome. `document.execCommand("insertText")` called
from a content script fires `input` in the page's world but **not**
`beforeinput`. The obvious implementation - "use `execCommand`, because it is
the path editors recognize" - is therefore wrong in exactly the case it was
chosen for: a document-model editor routes typing through `beforeinput`, so it
would have received a DOM mutation it did not author and no event explaining
it, which is the condition under which it reverts the text.

The insertion now **asks first**: a cancelable `beforeinput` is dispatched, and
only if the editor does not cancel it does `execCommand` do the work. A
cancelling editor is taken at its word - inserting anyway would insert twice.
This also makes refusal reachable at all, which the contract's whole rejection
path depends on.

The synthetic event does cross into the page's world; that was measured too,
by a fixture that cancels it and stays empty.

### Post-insertion verification is confined to Rich Text Fields

Verification reads the Field's text. On a native control that would be a
`field.value` read outside the two cases `AGENTS.md` permits, and the Task 007
privacy fixture caught it immediately - correctly.

Native controls are no longer verified, and lose nothing by it: `setRangeText`
has a defined result and no document model to fight. For a Rich Text Field the
read stands, and is bounded on purpose: it happens only as a direct
consequence of the user's own insertion, it computes one boolean, and nothing
else survives it. **This is a narrow new read the owner should confirm.**

### `role="code"` does not catch real code editors

CodeMirror 6 - the `contenteditable` code editor most likely to be met - marks
its host `role="textbox"` with `aria-multiline="true"`, which is exactly what a
chat composer declares. Meeting this contract's own acceptance item ("a
CodeMirror-shaped editor is excluded") on `role="code"` alone would have been
a technicality.

The generic separation used instead is the natural-language affordances:
a host that has switched off **all three** of `spellcheck`, `autocorrect` and
`autocapitalize` is not editing prose. CodeMirror 6 sets all three off; of the
three named targets, ChatGPT's composer sets them all *on* and the other two
set none. Requiring all three keeps a prose editor that merely disables
spellcheck admitted.

### One Task 017 fixture descriptor changed meaning

`excluded-contenteditable` - a bare `<div contenteditable="true">` - is still
excluded and still zero-touch; its veto reason moved from `element` ("not an
input") to `type` ("declares nothing"). The behaviour the case exists to
protect is unchanged.

### The three named targets, as captured by the owner

All three declare `role="textbox"`, `aria-multiline="true"` and a non-empty
`aria-label`. So all three are bindable, and the tiered branch does not apply
to any of them. It is kept rather than removed: the owner chose tiering over a
stricter gate deliberately (Q4), and the branch is what admits an editor that
labels itself less carefully.

ChatGPT's composer also carries `autocomplete="off"`, which is why Task 024
Addendum B's structural token is computed **before** the autocomplete map -
otherwise the composer would have matched every unrelated control on the site
that also opts out of autofill.

## Assumptions To Verify Before Implementation

- The actual attributes on the three named composers' host elements. They are
  behind a login this agent cannot pass; the owner supplies the opening tags.
  If all three carry an accessible name, rule 2 can be tightened to require one
  and the tiered-Binding branch becomes dead code worth removing.
- Whether ProseMirror and Lexical accept a `beforeinput`-driven insertion at
  all. The fixtures answer this, and `Insertion Rejection` exists because the
  answer may be no.
- That a composer's accessible name is unique and stable within its Site. If it
  is not, more hosts fall to the tiered "insert but do not bind" branch than
  expected.

## Stop Conditions

- If eligibility cannot be expressed without naming a site or an editor, stop.
  That is the boundary the whole contract is built on.
- If insertion cannot be made to avoid synthetic key events, stop. Sending a
  chat message the user did not send is not a defect to be fixed later.
- If the clipboard cannot be guaranteed untouched without an explicit user
  action, stop and ship without the copy fallback.

## Addendum A — Hands-On QA Repairs

**Status:** Implemented 2026-09-09, the same day as the parent contract.
**Origin:** The owner's hands-on QA on ChatGPT, Claude and Gemini, 2026-09-09.

Gemini passed end to end, including creating a Template, sharing it across
pages through `Share with…`, and using it from another page. ChatGPT and Claude
failed, and the position of the Field Control was wrong on all three. Three
defects, all of them in the parent contract's own scope.

### A.1 The Field Control landed inside the composer, on the page's own buttons

**Reported:** the control sat inside the rounded composer box, overlapping the
content and the site's own dictate/send controls.

**Cause:** the control is placed beside the Field's bounding box. For a native
control that is right. For a Rich Text Field it is not: the editing host is the
inner text node of a composer, and the attach, dictate and send buttons live in
the visual box *around* that node. Anchoring to the host therefore aims at a
point inside the composer.

**Repair:** a Rich Text Field is anchored to its **visual box**, found
generically - walk up while each ancestor still hugs the host (no more than
160px wider or 140px taller) and take the last one that draws itself with a
border, a radius, or a background of its own. That is what a composer is: the
box the user sees. Nothing qualifying means the host's own box, which is every
other Field's behaviour unchanged.

### A.2 Typing into the Picker was captured by the page

**Reported:** on ChatGPT and Claude, opening `New template` and typing sent the
text to the chat box and closed the Picker - making the extension unusable
there. On Claude even a mouse-driven paste was swallowed.

**Cause:** a chat composer listens on `document` for "type anywhere and I will
focus the composer for you". FillNest's Picker is a Shadow Root inside that same
document, so every keystroke reached the page, the page pulled focus to its own
composer, and the Picker closed behind it.

**Repair, in three parts, because one is not enough:**

1. **Containment.** Text-input and clipboard events (`keydown`, `keypress`,
   `keyup`, `beforeinput`, `input`, `paste`, `cut`, `copy`) stop propagating as
   they leave FillNest's own host. That defeats an ordinary bubble-phase page
   listener outright - the page never learns the user typed. Pointer and focus
   events still reach the page, which needs them to behave normally.
2. **Focus restoration.** A capture-phase page listener runs on the way *down*
   and cannot be contained. So focus that leaves FillNest's interface **while a
   printable keystroke or a paste is being delivered** is given back.

   The discriminator took three attempts, and the two that failed are worth
   keeping: a time window since the last pointer was wrong in both directions
   (a page steals focus within milliseconds of a keystroke, and a user may
   pause as long as they like before typing), and "the last interaction was
   inside our interface" wrongly caught a *programmatic* focus - it broke the
   Keep Open contract, where focusing a password field must leave the Picker in
   its safe no-target state.

   What is left is narrow and matches only the behaviour being defended:
   nothing else moves focus during a printable keystroke. Tab and modifier
   combinations are excluded explicitly - trapping Tab would be a keyboard
   trap, which Task 023 exists to prevent.

   The flag is set from a listener on `window`, which the capture path reaches
   before any listener a page can install on `document`, and it is cleared on
   the next **task** rather than the next microtask: the microtask queue is
   drained after each listener callback, which would clear it before the page's
   own listener ever ran.

A click into the page, a Tab, and a programmatic focus are all honoured exactly
as before: the Picker closes, or fails closed, as its own contract says.

A fourth part was implemented and **reverted**: keeping an open Picker open
when the Field it is attached to is re-focused. It read well and broke five
accepted behaviours - Keep Open's no-target state, Undo persistence across
Fields, live context invalidation, the static-field loop and the typeahead
addendum. Focus restoration already covers what it was for.

### A.3 A Binding was lost when the SPA rebuilt the view around the composer

**Reported:** a Template created in ChatGPT's new-conversation composer was
gone after visiting a conversation and returning. Still findable by Search -
so the Template survived - but no longer this Field's.

**Cause:** the address is the same Page Profile, so the only thing that can
have moved is the Field key, and on an SPA the ancestor chain is exactly what
moves. The composer is re-parented as the view rebuilds around it, the ancestor
tags shift, and the key changes.

**Repair:** a Rich Text Field **with an accessible name** is keyed without its
ancestor chain and without its form. The accessible name is the identity of a
composer; where in the tree the page currently hangs it is not. Two hosts
sharing a name on one page are still separated by `ordinal`, which is counted
among hosts carrying that same base key. An unnamed host keeps the structural
key it cannot do better than - the same reason it cannot be bound at all.

This also repairs the Task 016 Addendum E recovery path for composers, which
required an exactly equal fingerprint and so could never fire while the
fingerprint carried a chain the SPA rewrites.

### Evidence

`tests/e2e/rich-text-composer-hostility.spec.ts` reproduces all three from the
behaviours that caused them: a composer that steals focus on any keystroke from
both a bubble-phase and a capture-phase `document` listener, a rounded composer
box with its own toolbar, and a view rebuilt around the same editor. It asserts
that the control clears the send button and sits outside the composer's visual
box, that the page counts **zero** keystrokes while a Template is typed and the
chat box stays empty, and that the Binding is still offered after the composer
is re-parented.

### A.4 The second QA pass: Templates present, then absent, then present

**Reported (all three sites):** a Template bound to a composer is offered on
some visits to the same page and not on others, with no evident trigger. On
Claude, renaming a Field in Cowork/Project mode was lost across a reload while
the same rename in Chat mode persisted - which says plainly that the Field key
itself is moving between visits, because an alias is written against a Field
Profile and read back by key.

**Cause:** the ordinal. A named Rich Text Field's key still carried its
position among peers sharing its base key, and a chat application keeps editors
mounted that are not on screen - the conversation being animated out, an
edit-message box, the next view pre-mounting. Every time that set changed, the
ordinal moved and the key with it.

**Repair, two parts.** A named Rich Text Field is keyed **without its ordinal**:
two hosts sharing an accessible name on one page are equivalent by the only
measure this key has, so one identity is the honest answer rather than a
collision. And the enumeration that produces an ordinal now skips editing hosts
that are not rendered at all - applied to Rich Text Fields only, because a
native control's enumeration must stay byte-identical or every stored
structural key moves with it.

This is also the most likely cure for the intermittency's other half. When a
mutation batch removes and re-adds a Field, the replacement may only inherit an
existing relationship if its key exactly equals the detached one's; otherwise
it is treated as brand new and offers nothing. An ordinal that moved during the
same batch made that comparison fail, which is exactly "present, then absent".

### A.7 The Picker's context must belong to the address on screen

**Reported on a clean install (sixth pass), and this repository was wrong about
the previous one.** The pass before had been called migration residue; it was
not. The screenshot shows both surfaces at once on Gemini's new-conversation
page: the Picker says `HISTORY` and offers `T-hist`, the Side Panel's `This
tab` says `NEWCHAT` and offers `T-new`. Same page, same moment, two answers.
The Side Panel recomputes from the tab's address, so the Side Panel is right
and the Picker is holding a context resolved for the page it came from.

**The change.** A.5 re-resolved *at the moment* the address changed - one
attempt. That attempt can be lost: the composer is momentarily ineligible while
the application swaps it, or `removeOverlay` bumps the focus revision and
discards the resolution already in flight. Because the address marker had
already advanced, nothing ever tried again, and the Picker kept the previous
page's Templates for the rest of the visit.

The check is now an invariant rather than an event: the address the live context
was resolved *for* is remembered, compared against the current address on every
frame the Picker is tracking a Field, and repaired until the two agree.
Throttled to one attempt per 300ms so a repair that cannot yet succeed does not
become sixty resolutions a second.

**Verified by the owner on a clean install, 2026-09-09 (seventh pass): the
defect is gone.**

**Stated plainly: this is not reproduced by a fixture.** Three attempts at one
failed - the ordering that would isolate it leaves the extension with no
overlay at all, because a page that removes a focused Field tears the interface
down and discards the resolution that focus had started. That is existing,
correct behaviour, and it means the fixture cannot reach the state the invariant
guards. The already-passing navigation cases stay; this repair rests on the
argument above and on the owner's re-test, and is recorded as such rather than
claimed as covered.

### Resolved So Far

**All three named targets passed a clean-install pass on 2026-09-09**, before
the defect above was found on the sixth pass. The owner's fifth pass
(2026-09-09) named the two Gemini Fields differently and read the Picker's own
header: on the new-conversation page it says `NEWCHAT` and offers `T-new`, and
the Side Panel's `This tab` agrees. The failure reported the pass before was
data written under an earlier build's identity - the diagnosis this repository
argued for from the code, rather than a fifth speculative repair.

**A method note worth keeping.** Three of the defects reported across these
passes were real and are fixed; one was migration residue. The rich-text
identity and the page identity both changed during the same day's work, and
every such change orphans what was stored under the old one. QA of an
identity-affecting change starts from a clean install, or it reports the
previous build's ghosts. The repair is verified against a
fixture that mounts an off-screen composer with the same accessible name; the
owner's next QA pass decides whether anything else remains.

### A.5 The control was still inside ChatGPT's composer

The visual-box search used absolute pixel margins - an ancestor could be at
most 160px wider than the host - and ChatGPT's composer is wider than that
relative to its text node, so the box was rejected and the control fell back
inside it, over the model picker. The caps are now viewport-relative and a
multiple of the host, which describes "a composer" without pretending to know
its padding. The fixture's host is now materially narrower than its box, the
way ChatGPT's is.

### A.6 One composer, two Field Profiles - the label is not an identity

**Reported (third QA pass):** on ChatGPT's new-conversation page the owner
renamed the Field twice, with two different names, and afterwards saw *both*
renames appear on different visits, each carrying its own Templates - and
sometimes neither. Claude's Chat mode was stable while its Cowork/Project mode
was not; Gemini regressed to losing everything.

**What that proves:** the composer is resolving to more than one Field Profile,
alternating. Two names cannot coexist on one Profile, so the key is taking more
than one value.

**Cause:** the accessible name. These applications rewrite their composer's
label with the state of the interface, and during hydration it is briefly not
there at all - which is also why a visit could show nothing: an unnamed host is
a different Field, and not a bindable one.

**Repair:** for a Rich Text Field, the key is built from stable attributes when
the page provides any - `name`, `id`, `autocomplete`. ChatGPT's composer
carries `id="prompt-textarea"`, so its identity is that, and the label is left
out of the key entirely rather than allowed to move it. Only a host with no
such attribute falls back to the accessible name, which is the same evidence
that grants it a Binding at all. The ancestor chain and the ordinal stay out,
per Addendum A and A.2.

**Gemini's regression is expected and is a warning about QA method.** Every
change to the key orphans Field Profiles stored under the previous one: the
Templates survive and remain findable by Search, but they are no longer *that
Field's*. The key changed three times over 2026-09-09. Any QA pass that
carries data across builds will see losses that are migration, not defect.
Reset FillNest, or expect the first visit after an update to start empty.

**Still unconfirmed:** Claude and Gemini expose no stable attribute, so their
identity is still the accessible name. Whether that name holds still on those
two sites is not something this repository can observe - see the diagnostic
handed to the owner.

### A.3 An unsaved rename outlived the action that abandoned it

**Reported:** starting a rename in the Picker and then doing something else
left the edit pending instead of discarding it.

**Repair:** an unsaved rename is discarded when the user starts a new Template,
types in Search, inserts, or moves to another Field. It was never saved, so
there is nothing to carry - and carrying it risks writing a name against a
Field the user has since left.

### A.4 A navigation was being treated as a Field replacement

**The evidence that settled it.** The owner recorded the key's inputs on
ChatGPT across eighteen samples, in both states. Every input was
byte-identical: one rendered host, `id="prompt-textarea"`,
`autocomplete="off"`, the same label, every time. The identity was never the
variable - which ruled out A.3's whole line of reasoning as the remaining
cause.

What correlated, exactly and without exception, was the **previous** address:

| arrived from | arrived at | Templates |
| --- | --- | --- |
| `/` | `/c/<id>` | none |
| `/c/<id>` | `/c/<other>` | all |
| `/` | `/c/<id>` (the same one that worked a minute earlier) | none |

**Cause.** An SPA route change removes the old page's composer and adds the new
page's in one mutation batch. `handleLifecycleMutations` then compared the new
Field against the detached evidence - which carries the **previous page's**
identity, so it could never match - and marked the new composer a *fresh
candidate*. A fresh candidate has its identity deliberately nulled, so a Field
with a perfectly stable key resolves as brand new and offers nothing. The mark
then stayed for that element's whole life, which is why the same conversation
could show Templates on one visit and none on the next.

**Repair.** Only a removal from *this* page can be a replacement. Detached
evidence carrying a different page identity is discarded rather than counted as
a failure to match, and the fresh-candidate marks are dropped wholesale when
the address changes. The fail-closed boundary Task 016 draws is about a Field
being swapped underneath the user **on one page**; a navigation is not that,
and treating it as one made the boundary fire on every route change.

**Evidence.** The hostility fixture now performs a route change the way a chat
application does one - `pushState` plus a replaced composer in the same batch -
binds a Template on a conversation path, leaves to another path, returns, and
requires the Template to be offered. Reverting the repair makes it fail on
exactly that assertion.

### A.5 The Picker kept the previous page's Templates

**Reported (Gemini):** a Template created on the new-conversation page, another
created in a conversation; returning to the new-conversation page, the Picker
offered the conversation's Template while the Side Panel's `This tab` offered
the right one.

**Cause:** a Field's context is resolved when it receives focus. Gemini changes
page while the composer keeps both the element and the focus, so no focus event
ever arrives and the context stays the previous page's. The Side Panel fetches
for itself, which is why the two surfaces disagreed - and the Side Panel was
right.

**Repair:** the content script notices the address changing and re-resolves the
focused Field's context. Checked both from the lifecycle reconciliation and
from the per-frame position loop, because a route change need not produce a DOM
mutation FillNest is watching and `pushState` fires no event of its own. The
same moment clears the per-page caches - the fresh-candidate marks and the
Field-context cache both belong to the page they were made on.

**Evidence.** The hostility fixture navigates while keeping the composer
element and its focus, and requires the Picker to offer the destination page's
Template and not the one it came from. Reverting the repair makes it fail.

### A.6 History navigation, and a poll that was removed again

A.5 hung the address check on the lifecycle reconciliation and the per-frame
position loop. Neither sees a `popstate` that changes nothing else, so
`popstate` and `hashchange` now call the same check. They cost nothing when
nothing happens.

A 250ms poll stood here too, as insurance against Gemini's remaining defect.
That defect turned out to be stale data from an earlier build - the owner's
clean re-test passes - so the poll was removed. It guarded no case the
lifecycle reconciliation, the position loop and the next focus did not already
cover, its own fixture could not distinguish it, and a recurring timer on every
authorized page is not something to carry on a hunch.

### Closed

Every defect these seven QA passes found is repaired and re-verified on a clean
install: the Field Control's placement, keyboard capture by the page, the three
identity faults, the navigation-as-replacement fault, advertising parameters in
the Page identity, the stale Picker context, and the unsaved rename that
outlived its own action.

Two of the eight repairs rest on argument and the owner's re-test rather than
on a fixture - A.6's history listeners and A.7's invariant - and each says so
where it is recorded. Everything else has a fixture that fails when the repair
is reverted.


## Addendum D — Three Vetoes, Measured Against Six Real Composers

**2026-09-10.** The owner ran the attribute probe across the AI chat products
this Task did not target, and brought back six captures. Three composers were
getting no control at all, and each was refused by a different rule in
`classifyRichTextField` / `isSpecialPurpose`. One of the three was FillNest
contradicting itself; the other two were rules that had never refused the thing
they were written to refuse.

Two captures were **not** defects and are recorded so nobody re-opens them:

- A product whose composer's placeholder differs between its new-chat screen
  (`/`) and a conversation (`/chat/:record`) shows Templates on one and not the
  other. Those are two Pages, Templates are bound per Page, and the samples are
  consistent with that. The placeholder is irrelevant to it either way: a native
  control's identity key has never read one.
- One product's composer was eligible in every sample and worked every time.

One capture remains open and is **not** addressed here: a composer that shows
Templates and then does not, on the same address, with a byte-identical
`<textarea id="userInput">` in all three samples. Nothing in the DOM separates
the passing sample from the failing one, and a page-world probe cannot help -
the content script is in an isolated world and `manifest-policy.mjs` forbids
`web_accessible_resources`, so page script cannot read FillNest's state. It
needs the owner's own observation of whether the Templates vanish on navigation
or while the page sits still, and those are two different faults.

### D.1 A placeholder is a declaration

A composer declared no `role` and no accessible name, and carried only
`data-placeholder`.

Task 024 Addendum C.1 had **already decided** that a Rich Text Field's
placeholder is the best name it has - better than its accessible name - and
`fieldObservedTitle` has read `data-placeholder` since. Reading a string as the
Field's title and then refusing to accept it as evidence that a Field exists was
an inconsistency in this repository, not a property of the page.

The declaration test becomes `role="textbox"` **or** an accessible name **or** a
placeholder, and `readRichTextMetadata` reads `data-placeholder` ahead of
`placeholder`, because the attribute is meaningless on a non-input element and
editors invent their own.

The placeholder also reaches `buildFieldIdentityKey`, otherwise this Addendum
would admit a Field it could not remember - `isBindableField` would say yes and
the key would fall through to the ancestor chain that Addendum A established an
SPA re-parents. **The accessible name keeps precedence there**, and only there:
one shared helper, `richTextFieldName`, is `accessibleName || placeholder` for
eligibility, the word-based vetoes, bindability and identity alike. C.1's
placeholder-first order stays a display rule and says so in as many words. The
consequence that matters is that every Binding made before this Addendum keeps
the key it was made under; the placeholder speaks only for a host that had
nothing else to say.

The sensitive and special-purpose word vetoes see the placeholder too. A host
whose placeholder is "One-time code" is still refused.

### D.2 `combobox` is a rule about single-value controls

A composer declared `<textarea role="combobox">` and was refused by the Task 017
veto.

That veto is sound and stays. Its reason is that a combobox commits a
**choice**, so what the person typed may never be submitted at all - the
argument written down in `docs/next-version-discussion.md`. But that argument is
about a control that holds one value, and every fixture protecting the rule is
an `<input>`: `excluded-controlled-date`, `excluded-combobox-country`, the
implicit-listbox variant, and the spinbutton.

A `<textarea>` cannot be committing one choice. Multi-line and
pick-exactly-one are contradictory claims, and when a page makes both, the shape
of the element is the honest half. The veto now requires `tagName === "INPUT"`.
No existing fixture changes.

### D.3 `aria-multiline="false"` is withdrawn

A composer 734 CSS pixels wide and 60 tall, holding block-level paragraphs,
declares `role="textbox" aria-multiline="false"`.

The veto was written against an imagined single-line rich editor - "a control
wearing a text box" - and in the whole of this Task's hands-on QA it never
refused one. What it did refuse, the first time it met the open web, was a
mainstream chat composer.

**Owner's decision: remove it, rather than narrow it.** The narrowing available
was "veto only when the host has no block-level child", and that trades one
guess for another. The cost of being wrong in the new direction is bounded and
small: a Template offered inside a one-line rich title box, which is still a box
a person is typing prose into. The cost of being wrong in the old direction was
a top-tier composer with no FillNest at all.

`SafeFieldMetadata.ariaMultiline` is deleted with it. Metadata that nothing
reads is a claim that something does.

### Fixtures

| Fixture | Asserts |
| --- | --- |
| `<div contenteditable data-placeholder="…">` | A Field, and bindable (D.1) |
| `<div contenteditable data-placeholder="One-time code">` | Still refused (D.1) |
| `<textarea role="combobox">` | Supported (D.2) |
| The four `<input role="combobox"/"spinbutton">` fixtures | Unchanged (D.2) |
| `<div role="textbox" aria-multiline="false"><p></p></div>` | A Field (D.3) |
| `#placeholder-host`, `#lying-single-line-host` (E2E) | Both get a control |
| `#bare-host` - `contenteditable` and nothing else | Still gets nothing |


## Addendum E — Shipped And Reverted The Same Day

**2026-09-10.** An Addendum E was written, implemented, verified against a
fixture, committed as `ee32b7e`, and reverted within the hour on the owner's
report. It is recorded here because the reasoning is worth keeping and the
revert is worth not repeating blindly.

**What it claimed.** A native control's identity key carries its ancestor chain
and its form. An application rebuilding the view around its composer moves both,
and the move reaches the mutation observer as one removal and one addition of
the **identical element**. Task 016's fail-closed boundary then marks that
element a fresh candidate with its identity deliberately nulled, and only an
address change clears the mark - so a Field re-parented without navigating would
stay identity-less for the rest of that element's life. The fix was an
object-identity carve-out: an element cannot be swapped for itself.

**Why it was reverted.** The owner reported afterwards that on the product this
was built for, the saved Templates were no longer offered in a conversation
**at all** - a worse state than the intermittent one it was meant to cure. The
carve-out should only ever have restored Templates, never withheld them, so the
mechanism by which it made things worse is **not understood**, and that is
exactly the reason not to keep it in the tree while it is guessed at.

**What the next agent should know before trying again.**

- The fixture that proved the carve-out - `native-composer-reparent.spec.ts` in
  `ee32b7e`, recoverable from that commit - genuinely failed without it. So the
  described mechanism is real; it is just not the whole story on the live site.
- The carve-out has a second effect that was not examined and is the first place
  to look: `showForField` computes
  `cacheableWithinDocument = freshCandidates.has(field) || pageIdentityKey === null`.
  Removing an element from `freshCandidates` therefore also stops its context
  being cached within the document. That is a behaviour change nobody asked for
  and nobody tested.
- The owner's two observations still stand and still need explaining: the flips
  happen only while switching between the new-chat screen and a conversation,
  never at rest; and closing the Picker, waiting a few seconds and reopening it
  brought the Templates back. The second one means the stored Binding is right
  and the computed key is momentarily wrong.
- An invariant extending A.7 from the address to the Field was also built and
  removed **before** the commit, because no fixture failed without it. Every
  change that moves a native control's key is a DOM mutation the lifecycle
  reconciliation already answers.


## Addendum F — A Live Context Belongs To A Page And A Field

**Status:** Implemented with automated acceptance evidence on 2026-09-10;
the project owner's Copilot re-test is pending.
**Origin:** The owner's Copilot re-test after reverting Addendum E: Templates
appear most of the time and occasionally disappear; closing the Picker,
waiting, and reopening restores them.

### Confirmed Cause

A native Field's identity includes its ancestor chain and form. During an SPA
transition the application can move the Field through a temporary wrapper,
change the URL, and only then settle the DOM. FillNest may resolve the focused
Field while that temporary structure is present.

Addendum A.7 records which Page identity produced the live context and repairs
it until that Page matches the address on screen. It does not record which
Field identity produced the context. Once the Page identity is current, a
context resolved for the temporary Field identity is therefore treated as
settled. Closing the Picker and focusing the Field again resolves its stable
identity and restores the stored Binding, which accounts for both parts of the
owner's report without a storage migration or a permanent identity change.

The failure is reproduced in real Chromium by the same ordering: move one
stable `<textarea>` through a temporary wrapper, update the URL, settle the DOM
without another focus change, then open the Picker. The first open loses the
bound Template; closing and reopening restores it.

### Contract

- A live Field context belongs to the pair of Page identity and Field identity
  it was resolved from. Both must converge on the identities currently
  observed for the Target Field.
- Field-identity convergence is driven by the existing mutation lifecycle.
  A structural identity change necessarily produces a DOM mutation, so this
  Addendum adds no timer or recurring page scan.
- A transition may cause more than one resolution. The latest lifecycle state
  wins; a temporary state must not prevent the settled state from being
  resolved.
- Task 016's fresh-candidate fail-closed boundary remains intact. This
  Addendum does not restore the reverted object-identity carve-out from
  Addendum E.
- No Field identity key changes shape, no stored record is migrated, and no
  Site, editor or product is named in production code.

### Acceptance

1. A real-Chromium fixture performs the confirmed DOM-first/URL-second native
   Field transition and the bound Template is visible the first time the
   Picker opens after the DOM settles.
2. The test fails against `2cac46e` because that first Picker has no bound
   Template, not because of setup or timing failure.
3. A native Field also converges when its own `form` association changes, when
   an externally associated Form's name changes, and when a Form id change
   or Form removal severs that association. The Field Control remains live;
   the test must not pass because the interaction surface was torn down.
4. Existing rich-text navigation, DOM replacement, fresh-candidate recovery,
   static-field, and lifecycle fixtures remain green.
5. No polling, storage migration, identity-key change, Site special case, or
   new field-value read is introduced.
6. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/e2e/native-composer-transition.spec.ts` uses the built extension in real
Chromium. Its DOM-first/URL-second transition test failed against `2cac46e`
because the first Picker had no bound Template, while closing and reopening
restored it. The final fixture also covers a native Field's `form` attribute,
an external Form's name, and an external Form id change or removal that severs
the association; those four context-convergence cases pass without a focus
change and assert that the Field Control remains live.

The implementation records the Field identity that produced the live context
and compares it with the current identity during the existing mutation
lifecycle reconciliation. It reuses that reconciliation's single Page-field
snapshot. Form associations are part of native Field identity, so the same
observer now watches `form`; a Form identity mutation or Form insertion/removal
queues externally associated native controls once for that observer batch. No
recurring scan, new identity shape, migration, Site rule, or field-value read
was added.

Final verification on 2026-09-10: `npm run check` passed 65 test files and 939
unit tests, plus typecheck, lint, documentation, localization, dead-export and
production-build gates. The complete headed Playwright suite passed 57 tests
with its existing opt-in lifecycle benchmark skipped. Independent Spec and
Project Standards reviews reported no actionable P0-P2 findings after their
first-round form-lifecycle and assertion-quality findings were repaired.

No control markup, focus path or visual presentation changed. The regression
tests additionally prove that the existing Field Control remains available
while the live context converges. Automated evidence is complete; the owner
still needs to reload this build and confirm the original Copilot intermittency
no longer occurs.


## Addendum G — A Removed Peer Moves A Native Key Too

**Status:** Implemented with automated evidence on 2026-09-10; the project
owner's Copilot re-test is pending.
**Origin:** The owner's re-test of Addendum F: in a Copilot conversation opened
from history, Templates still occasionally disappear.

### Confirmed Gap

Addendum F re-checks the Target Field's identity only when the lifecycle
reconciliation already holds a Page snapshot, and it holds one only when some
Field was queued. A native key carries its ordinal among Fields with the same
base key. When an application mounts the next view's composer while the
previous view's identical composer is still in the document ahead of it, the
new composer is resolved at ordinal 1. Emptying the previous view - a
container that does not hold the Target Field - moves it back to ordinal 0,
but a removal queues nothing, so no snapshot exists and the check is skipped.
The Picker keeps the ordinal-1 context until the Field is focused again, which
is exactly what closing and reopening the Picker does.

**Not Copilot's mechanism.** The owner's recording of Copilot (Addendum I)
shows one composer at a time, never two, so no ordinal moves there. This
remains a proven gap with its own failing fixture, repaired because it is one;
Copilot's actual cause is Addendum I.

**Examined and not changed:** a resolution still in flight when the DOM
settles. A fixture for it passed on the unrepaired code, because an
unrecognized context is re-resolved from the live DOM by the Logical Page
candidate path. Without a failing fixture it is not repaired here.

### Contract

- A removal of any Field is a reason to re-check the Target Field's live
  identity, with one Page snapshot, in the same reconciliation Addendum F uses.
- No polling, identity-key change, storage migration, Site rule or field-value
  read.

### Acceptance

1. A real-Chromium fixture mounts a second identical native composer in a
   sibling view, focuses it, and empties the first view later; the bound
   Template is offered the first time the Picker opens.
2. The fixture fails against `e19ffc7` on exactly that assertion.
3. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/e2e/native-composer-transition.spec.ts`, "a Field converges when a
duplicate peer outside its subtree is removed, and an open Picker stays open".
It fails against `e19ffc7` and passes with the change.

**Review repair:** a re-resolution FillNest starts on its own - Addenda A.7, F
and this one - no longer closes an open Picker; the user did nothing, so only
a focus closes it. The fixture now opens the Picker before the removal.


## Addendum H — Tab Inside The Picker Belongs To The Picker

**Status:** Implemented with automated evidence on 2026-09-10. The first two
versions failed the owner's Copilot re-tests and were revised the same day on
the evidence below; owner QA of the third is pending.
**Origin:** The owner, on Copilot: with the Picker open, Tab sends the focus
straight back to the page instead of to the Picker's next control. The owner
expects the same on the sites where typing into the Picker was once captured.

### Confirmed Cause

The Picker lives in a Shadow Root, so from the page's side the focused element
is FillNest's host - a plain element the page does not know. Pages answer Tab
from it in two ways:

- A composer that focuses itself on a key pressed while nothing editable is
  focused, listening on `document`.
- A focus-management library that runs its own Tab order, listening on
  `window` in the capture phase. **Measured on Copilot** with a page-world
  recorder the owner ran: on every Tab from the Picker, a `window` capture
  listener's `_onKeyDown` called `focus()` on the page's first sidebar control,
  and FillNest tore the Picker down one millisecond later. That listener is
  registered by the page before a `document_idle` content script can register
  anything, so it always runs first.

Addendum A.2's focus restoration is deliberately limited to printable keys: the
browser's own Tab navigation runs after the listeners, so restoring focus on
every Tab would also undo the navigation out of the Picker, which is a keyboard
trap.

The first version of this Addendum stopped Tab on `window` and so defeated only
the first shape. The second added the reclaim below and still failed on
Copilot. Reading the library's open-source code (Microsoft's `tabster`, fed by
`keyborg`) explained why: it records the focused element from `focusin` on
`document`, and on Tab while it holds one it moves the focus itself, cancels
the key and calls `stopImmediatePropagation` - so no later listener, FillNest's
included, sees the keystroke at all. On `focusout` it forgets the element.

### Contract

- A plain Tab or Shift+Tab whose target is inside FillNest's interface stops
  propagating on `window` in the capture phase. Its default action is not
  cancelled, so the browser still moves through the Picker and out of it at
  either end.
- Focus leaving FillNest's interface is answered one task later rather than
  immediately, and a later focus change supersedes the pending answer. If the
  focus left during the Tab being handled - a page listener that ran first
  moved it - FillNest moves it to the control that Tab was heading for inside
  the Picker and cancels the navigation. Past the Picker's last control in that
  direction, the page's choice stands.
- `focusin` and `focusout` whose path passes through FillNest's host stop
  propagating on `window` in the capture phase, after FillNest has handled
  them. The page is told its own elements lost or regained focus, never that
  focus entered or moved within FillNest's interface, so a library that tracks
  focus from those events holds nothing while the Picker has it and leaves Tab
  alone. Nothing inside the Picker listens for either event.
- The Field Control's own Tab and Shift+Tab behaviour moves into the same
  listener unchanged.
- Printable keys, modifier combinations and every event outside FillNest's
  interface are untouched. No Site, library or product is named in code.

### Acceptance

1. A real-Chromium fixture whose page takes Tab away - on `document` and on
   `window` registered before the content script, each both letting the
   navigation run and cancelling it, and a library-shaped page that tracks
   focus from `focusin` and stops the key - moves Tab and Shift+Tab through the
   Picker's own controls, and the Picker stays open.
2. All variants fail against `e19ffc7`; the two `window` variants also fail
   when only the reclaim is removed, and the library variant when only the
   focus containment is removed.
3. `field-control-keyboard-tab.spec.ts` stays green.
4. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/e2e/picker-tab-containment.spec.ts`, five variants, meeting 1 and 2.

**Behaviour change for pages:** a page no longer receives `focusin` or
`focusout` for FillNest's own host. A page menu that closes when focus lands
"outside" it therefore stays open when the user moves into the Picker.
**Accepted by the owner on 2026-09-10.**

**Known limits:**
- A pending exit is recognised as belonging to a Tab by comparing event
  timestamps, so a Tab pressed within the same task as an unrelated focus
  change could in principle claim it. Not observed.
- A page that moves focus away asynchronously - in a timer or an animation
  frame after the Tab - still closes the Picker; only a move made while the Tab
  is being delivered is reclaimed.
- Because `focusin` and `focusout` of FillNest's interface stop on `window`, a
  future `onFocusIn`/`onFocusOut` handler inside the Picker would never fire.
  Use `focus`/`blur` there.

**Review repairs (independent review, 2026-09-10):** the control a reclaimed Tab
starts from is now recorded from the Shadow Root's own `focus` events - the
value `handleFocus` kept could be stale and sent the Tab from the wrong
control; teardown cancels a pending exit; and the fixture now also proves Tab
from the Picker's last control leaves it in every variant.

**Accessibility:** no control, name or visual state changed. Tab order inside
the Picker is the browser's own; the Picker still does not trap focus.


## Addendum I — A Field Present Across A Navigation Came From The Page Before

**Status:** Implemented with automated evidence on 2026-09-10; owner QA pending.
**Origin:** The owner's Copilot re-test, recorded with a page-world script that
logs focus calls, address changes and composer insertions and removals.

### Confirmed Cause

The recording shows Copilot opening a conversation from the new-conversation
page as: address change, the old composer still mounted and focused, then the
composer subtree replaced by new elements of identical structure, in one
batch. Moving between two conversations keeps the same element.

FillNest re-records a Field's evidence whenever the lifecycle observer touches
it. When the view around the old composer changed after the address had
already moved, the old composer was re-recorded under the new address. Its
removal then passed Addendum A.4's filter as a replacement *on this page*, and
a native `textarea` has no generic semantic kind, so Task 016's fail-closed
boundary marked the new composer a fresh candidate: no identity, no Templates.

The mark is cleared only when the Page identity changes, and every
record-shaped conversation address is one Page identity. So the mark followed
the user into every later conversation, and closing and reopening the Picker
could not clear it. The recording matches this exactly: in one run, each
conversation visited straight after a failing one failed too, and each visited
after a succeeding one succeeded.

### Contract

- A Field's replacement evidence records which address it was taken under. A
  Field recorded under the current address belongs to this Page. A Field last
  recorded before the latest address change was on screen when it changed, so
  it belongs to the Page before that change - and re-recording it afterwards
  does not move it.
- The mutation observer brings the address up to date before judging a batch,
  so a navigation the per-frame check has not seen yet is still recognised.
- Task 016's boundary is unchanged for a Field that was on this Page when no
  navigation intervened. A Field that arrived from another Page and is then
  removed is treated as part of that navigation, which is what A.4 already
  says.
- No identity-key change, storage migration, polling, Site rule or field-value
  read.

**The trade-off, stated plainly:** a Field that survives a navigation and is
later replaced on the new page, with nothing else changing, is now treated as a
navigation rather than failing closed. It still recovers a relationship only by
an exactly equal Field identity on an equal Page identity. The independent
review flagged this for multi-step forms whose address changes while the form
stays; it is recorded as Task 016 Addendum F, accepted by the owner on
2026-09-10.

**A first version was withdrawn before commit.** It kept the Page a Field was
*first* observed on. That made Codex's Addendum F fixture flaky - two of six
runs - because a Field first seen on a Page, taken away and brought back,
counted its return as a same-page replacement. The rule above keys on the
latest navigation instead; the full transition spec then passed 35 of 35 runs.

### Acceptance

1. A real-Chromium fixture opens a conversation in the recorded order - address,
   a touch to the view around the old composer, replacement - and the bound
   Template is offered, then again in the next conversation, which keeps the
   element.
2. It fails against the tree before this Addendum on the first of those
   assertions.
3. Task 016's lifecycle fixtures stay green.
4. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/e2e/native-composer-transition.spec.ts`, "a composer replaced while
opening a conversation keeps its Binding, here and on the next conversation".

### Also Found, Not Changed Here

**One Copilot conversation in the recording is a different Page.** Its id,
`YJerjMvianTgauYwww3zU`, has one digit; `isRecordIdentifierShape` needs two, so
the segment is hashed as its own route instead of becoming `:record`. Templates
bound in other conversations are therefore never offered there. Copilot ids are
21 base62 characters, so roughly one conversation in eight has fewer than two
digits. Changing the rule changes Page identity on every Site and needs the
owner's decision; it is recorded under "Awaiting A Decision" in
`DEVELOPMENT.md`.

**The Field Control can disappear once after the replacement.** The recording
shows FillNest's control removed when the old, focused composer was detached,
which also discards the resolution the new composer's focus had started. The
next click restores it. Not repaired here; it loses no Template.


## Addendum J — One Selected Template At Most, And Editing Like Composing

**Status:** Implemented with automated evidence on 2026-09-10; owner QA pending.
**Origin:** The owner, on a Field with several Templates: opening the Picker
showed the second Template as selected while Search had the focus; one
ArrowDown then showed the first and second both selected. And while a
Template was being edited, Search was still usable.

### Confirmed Cause

- The list reconciliation selected the first row by default. Task 003's
  accepted contract says the opposite - "the first `ArrowDown` from Search
  selects the first visible Template row" - and the default is also why that
  first ArrowDown landed on the second row.
- Three routes painted a row as selected: the highlight, `:hover` and
  `:focus-within`, all in one style by design. The Picker opens where the user
  just clicked, so a row appears under a pointer that has not moved; it took
  the hover style and fired `mouseenter`, which also set the highlight.
- Editing is inline in the list, and nothing hid Search or New template.

### Contract

- No Template is selected until the user selects one. The first ArrowDown from
  Search selects the first row; ArrowUp from the first row returns to Search
  and selects nothing.
- A Template row shows the selected style only through its highlight. The
  highlight follows focus - a row is highlighted while focus is inside it,
  nothing while focus is on Search or any other control - and a pointer that
  actually moves over a row. A row appearing under a resting pointer does not
  select it.
- While a Template is being edited, Search and New template are not shown and
  the editor has the focus. When the edit ends, both return and Search has the
  focus.
- Enter in Search inserts the selected Template, or the first visible one when
  none is selected - the owner's decision on 2026-09-10.
- Arrow keys count from the row that has focus. When the pointer leaves the
  list, the highlight returns to wherever focus is.
- Search takes the focus back only when the edit ended by removing the focused
  control (Save, Cancel). An edit ended by the user moving elsewhere - another
  Field with a pinned Picker, a rename - leaves the focus where they put it.
- Other Picker lists keep their hover styling.

### Acceptance

1. A real-Chromium fixture with three Templates reopens the Picker from the
   keyboard with the pointer resting where the second row appears: no row is
   highlighted and none is painted as selected; one ArrowDown highlights the
   first row only.
2. The same fixture opens an edit: Search and New template are gone and the
   editor is focused; Cancel brings both back with Search focused.
3. Both fail against the tree before this Addendum.
4. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/e2e/picker-selection-and-edit.spec.ts`, meeting 1 to 3, plus the review
repairs: arrow keys from focus with the pointer on another row, and an edit
ended by clicking another Field with a pinned Picker. Three unit tests and
`picker-ux-fixes.spec.ts` encoded the old default highlight and the second-row
ArrowDown; they now assert Task 003's contract, and a unit test covers Enter
with nothing selected. Task 003 carries the matching addendum.

**Accessibility:** the highlight follows focus, and only a pointer that moves
can take it elsewhere. When the pointer does move to another row while focus
stays in the first, the highlight shows the pointer's row and the focused
control keeps only the browser's own focus outline - rows no longer carry a
separate focus-within cue, because that was the second cue the owner reported.
The editor receives focus on entry and Search on exit. No names or roles
changed.
