# Task 042 — First-Use Guidance And A Feedback Address

**Version:** `0.2.0`

## Task State And Authorization

- Contract: Accepted by the owner on 2026-09-14, with the shortened copy below
- Execution: Authorized by the owner on 2026-09-14, in the three slices below
- Acceptance: Accepted by the owner on 2026-09-15 after hands-on QA in
  Chinese, including both 2026-09-15 passes below
- Authorized slice or scope: Slices 1-3
- Next gate: None.

## Problem Statement

A first-time user installs FillNest and sees an empty Template Library and "No
Templates are bound to this field yet." Nothing says that FillNest must be
allowed on a site first, that the small button beside a field opens it, what
Binding and sharing mean, or what the Side Panel's pages are for. The owner
wants a short introduction before the Beta, not a tutorial; a video can follow
once there are real users. There is also no way for a user to reach the owner
about a problem.

## Owner Decisions (2026-09-14)

1. **Three start cards**, each shown the first time its surface is used: the
   Popup (the toolbar icon), the Inline Picker and the Side Panel.
2. **A short note the first time each feature page is opened**, in English and
   Chinese.
3. **Feedback is a `Copy email address` button** at the bottom of Overview,
   and nothing more. FillNest has no server, so it cannot send anything; a
   form that looked like it sent feedback, or a button that opened a mail
   program with a drafted message, would suggest otherwise. The owner judged
   both misleading.
4. **Settings offers `Show tips again`.**
5. Emphasis: how to allow a site, Active and Pause, creating and inserting a
   Template, and above all Binding, sharing and the Side Panel's pages.

## Scope

1. **Start cards.** A card with a heading, at most three lines of one short
   sentence each, and a `Got it` button. It is shown until dismissed, then
   never again unless the user chooses `Show tips again`.
   - **Popup**, on first open.
   - **Inline Picker**, on first open in its list view, above Search.
   - **Side Panel**, on first open, on Overview.
2. **Page notes.** One short line with a close button, shown the first
   time a page is opened: Templates' `This tab`, `All templates`,
   `By location` and `Shared Sets`; `Sites`; `Settings`; and in the Picker,
   the `Share with…` Field Finder.
3. **Feedback.** At the bottom of Overview: one line with the address as
   selectable text and `Copy email`, which copies it and says so in the result
   region. The address is one constant, `fillnest.feedback@gmail.com` (owner,
   2026-09-14); `npm run verify:store` checks that it is set.
4. **`Show tips again`** in Settings makes every card and note appear again.
   Reset FillNest does the same.
5. **Storage.** Which cards and notes were dismissed is a small preference in
   `chrome.storage.local`, beside the language and theme: not business data,
   not in a Backup Archive, cleared by Reset. The privacy policy lists it.

## Copy (English source; Chinese in the catalogue)

**The owner's rule (2026-09-14): every line as short as it can be while still
carrying what matters.** One idea per line; a card has at most three lines, a
page note one; nothing a button's own name already says. The first longer draft
was rejected as friction.

The Chinese of each line is in `src/i18n/messages.zh-Hans.ts`; AGENTS.md keeps
non-English prose out of task records.

| Where | English |
| --- | --- |
| Popup card | Choose [Allow access] to let FillNest work on this site. |
| Picker card | Start by creating a Template. / Click a Template to insert it into the field. / Every Template can be edited, searched and shared. |
| This tab | Templates saved on this page, and their fields. |
| All templates | All Templates: search, filter, delete in bulk. |
| By location | Filed by site › page › field. |
| Shared Sets | Fields that share Templates. Create with Share with… in the Picker. |
| Sites | Pause, clear or remove a site. |
| Picker, Share with… | Chosen fields will share Templates. Leave any time. |
| Dismiss | OK |
| Settings button | Show tips again |
| Overview | Problems or ideas (heading) / Ran into a problem, or have an idea? Email us - every message is read. / `fillnest.feedback@gmail.com` [Copy email] -> Copied. |

Dropped deliberately: "Open FillNest to manage…" (the button says it), Keep
open (its pin has its own hint and it is not a first step), and Bind from
Search (its button names itself when a user gets there).

## Non-Goals

- No video, tour overlay, animation, highlight of page elements or step-by-step
  wizard.
- No sending of any kind, no form, no `mailto:` link, no network request.
- No change to what any feature does.
- A card never takes focus, never covers the Search box or a field on the
  page, and never blocks an action.

## Accessibility

- A card or note is a labelled region with a real heading; its dismiss button
  says what it dismisses ("Got it, hide the getting-started tips").
- Showing one moves no focus - the Picker keeps focus in Search.
- `Copy email` reports its result through the existing result region;
  the address is also plain, selectable text for anyone whose clipboard access
  fails.

## Risk And Delivery Profile

- Risk tier: Low to Medium - new UI on every surface and one new local
  preference; no permission, network, business-data or migration change.
- Base: branch `task-042-first-use-guidance`, from `main` at `d5599a7`.
- Isolation: this task branch, because work started on `main` (Task 041).
- Security validation: none triggered beyond the privacy-policy update.
- Delivery: merged to `main` only when the owner asks.

## Demo Decision

- Decision: Not needed. The copy is reviewed as text here; placement is
  checked in real Chromium with screenshots during implementation.

## Tool And Observability Readiness

- Commands: `npm run check`, `npm run test:e2e`, `npm run verify:store`.
- Observation: component tests for each card and note in both languages;
  headed Playwright screenshots of the Popup, the Picker on a page, and the
  Side Panel at a narrow width.
- The agent can execute and observe: Yes, except a real screen reader, which
  stays with the owner's deferred Task 025 session.

## Checkpoint Commit Policy

- Checkpoint commits: One commit per verified slice, when the owner authorizes
  execution; merge to `main` only on the owner's request.

## Slices

1. **The mechanism, and the Popup and Side Panel cards.** The dismissed-tips
   preference, its messages, Reset clearing it, `Show tips again`, and the two
   extension-page cards.
2. **The Picker card and every page note.**
3. **Feedback on Overview**, the `verify:store` check for the address, and the
   privacy-policy line.

## Acceptance

1. Each card appears once, on first use of its surface, and never again after
   `Got it` until `Show tips again` or Reset.
2. Each page note appears on that page's first visit only.
3. Every card and note reads correctly in English and Chinese, and the Chinese
   render test finds no English in them.
4. No card or note takes focus, covers Search or a page field, or blocks an
   action; the Picker opens with focus in Search as before.
5. Overview shows the feedback address and `Copy email`, and nothing that
   sends; `verify:store` names a missing address.
6. The dismissed-tips preference is not in a Backup Archive and is cleared by
   Reset; the privacy policy says so.
7. `npm run check` and the full headed suite pass; the owner's hands-on QA in
   Chinese passes.

## Stop Conditions

- A card cannot be shown in the Picker without covering Search or the field.
- The preference would have to live in business state or the Backup Archive.

## Found During Implementation

- **Inside the Picker, list items became Template rows.** The Picker styles its
  own `li` and `p` elements, which stretched a tip's lines apart. Tip lines are
  paragraphs, styled at a specificity no surface's own rules override, so a
  tip looks the same on every surface.
- **The headed suite assumed no tips.** A fresh profile now shows the Picker's
  card, which changes the Picker's height and Tab order, and seven unrelated
  specs failed on that. The shared launch helper starts as a user who has
  dismissed every tip; `tests/e2e/first-use-tips.spec.ts` asks for a
  first-time user and covers the tips themselves.
- **`PageNote` arrived with slice 2.** `verify:exports` rejected it in slice 1,
  where nothing rendered it yet.

## Implementation Evidence

- Unit: `tests/unit/tips-repository.test.ts` (remember once, nonsense read as
  nothing, clear); `tests/unit/service-worker-runtime.test.ts` (the three
  messages, an unknown tip refused, Show tips again only from FillNest's pages,
  cleared by Reset and absent from a Backup Archive);
  `tests/unit/first-use-tips.test.tsx` (the Popup card once, no tip on
  Overview or Settings,
  in Chinese, and Show tips again); `tests/unit/first-use-notes.test.tsx` (the
  Picker card above a still-focused Search, the Share with… note, and every
  Side Panel page note); `tests/unit/overview-feedback.test.tsx` (the address
  shown and copied, no form or `mailto:`, the clipboard refusing, Chinese);
  `tests/unit/feedback-address.test.ts` (the store check).
- Headed: `tests/e2e/first-use-tips.spec.ts` - a first-time user's Picker card
  covers no field and leaves Search focused, each card goes for good, a page
  note appears once, and Show tips again brings the cards back.
- Checked by screenshot in real Chromium at a 360 px width: the Popup, the Side
  Panel and the Picker, in Chinese.

## Owner QA Of 2026-09-15

The owner's first hands-on pass changed the scope and copy as follows; the
tables above show the result.

1. **Allow access stands out.** The button reads on two centred lines - the
   action, larger, above the site's origin - with one accessible name ("Allow
   access to <origin>"). The owner chose, from five described animations, a
   breathing glow: while the site is not authorized the button's glow swells
   for two seconds and ebbs for two - a resting breath, so the three to five
   seconds someone spends on the Popup hold about one. It pauses under the
   pointer or keyboard focus; with reduced motion it does not move and shows
   the glow at rest. Evidence: `tests/e2e/allow-access-emphasis.spec.ts`.
2. **The Popup card is one line:** "Choose [Allow access] to let FillNest work
   on this site."
3. **No tip on Overview or Settings.** Both work like the Popup's own menu; the
   Side Panel start card and the Settings note are gone, with their tip ids.
4. **Tips are orange**, from the palette's warning tokens, so they stand apart
   from FillNest's own blue.
5. **The Picker card** reads "Start by creating a Template. / Click a Template
   to insert it into the field. / Every Template can be edited, searched and
   shared."
6. **Use field content never loses typed text** (behaviour owned by Task 003's
   compose flow). An empty field changes nothing; replacing typed text shows
   "Replaced with the field's content." with Undo, until the text is edited or
   the panel closes. Evidence: `tests/unit/picker-edit-panel.test.tsx`.
7. **The Share with… search** prompts "Search fields on other pages".

## Owner QA Of 2026-09-15, Second Pass

Discussed and decided with the owner before implementation; the owner accepted
every recommendation.

1. **"Got it" is "OK" (确定)**, a neutral word whose tone the owner can vouch
   for.
2. **The Popup and Overview explain their switches.** The owner found that a
   new user who allowed a site still could not use FillNest: FillNest starts
   paused on install, a newly allowed site starts active, and nothing said the
   first switch was off. Both surfaces now share one block
   (`CurrentWebsiteAccess`):
   - **Enable FillNest** - "When off, FillNest pauses on every site; your
     Templates and settings are kept."
   - **Enable on this site · <host>** - "Affects only this site; other sites
     are unchanged." The site is named here, since the Side Panel follows the
     active tab and the Allow access button, the only other place the site was
     named, goes once it is allowed. The switch appears once the site is
     allowed.
   - **One status line**, the first of: this page cannot use FillNest; not
     ready - choose [Allow access]; not ready - turn on Enable FillNest; not
     ready - turn on Enable on this site; reload this page (a page that did not
     start); ready. A blocking failure such as a failed Restore keeps using the
     surface's own error state, which replaces all of this.
   - The separate "Current website" heading and "Website access: Allowed / Not
     authorized" line are gone; the status line says it.
   - **Not coupled:** allowing a site does not turn FillNest on. The two stay
     independent, as Task 002 decided; the status line gives the next step.
     This changes presentation only, not any activation rule.
3. **This tab's note** reads "Templates saved on this page, and their fields."
   The owner asked whether another word than 输入框 (Field) would do; 文本框 was
   judged technical, 填写框 and 输入区 uncommon, and 字段 is already ruled out,
   so 输入框 stays.
4. **Show tips again asks first**: "Show all tips again? Tips you closed will
   appear again." [Show again] [Cancel].
5. **Feedback sits at the foot of Overview**, just above the result region,
   under a larger "Problems or ideas" heading and one line inviting any problem
   or idea.
6. **Language** reads "Choose a language." and carries a translate glyph; the
   **Settings** tab is a gear alone, named "Settings" for assistive technology
   and on hover. Both glyphs are the owner's (Phosphor, MIT), inlined like the
   other provided icons under `src/ui/icons/assets/`, since the package gate
   admits no loose SVG in `public/`.
7. **A result quoting an unbroken Template** - an address repeated with no
   spaces - pushed Undo out of the Picker. The text now breaks anywhere and the
   actions keep their room (Task 003's Picker).
8. **"N fields before" is a button**, "Show the N fields before", which opens
   only those Fields in the share Finder, leaving "Show all" as it was.

**Evidence.** `tests/unit/activation-status.test.ts` (status precedence),
`tests/unit/popup.test.tsx` and `tests/unit/side-panel.test.tsx` (the shared
block), `tests/unit/first-use-tips.test.tsx` (the confirmation),
`tests/unit/overview-feedback.test.tsx`, `tests/unit/inline-picker.test.tsx`
(the Fields-before button), and `tests/e2e/picker-selection-and-edit.spec.ts`
(Undo stays inside the Picker; it fails without the repair).

