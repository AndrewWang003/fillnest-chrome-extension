# Handover — 2026-09-10

Written at the end of a long session, for whoever picks this up next. It covers
what shipped, what the owner has accepted, what is broken, and the two things
that must not be repeated.

`DEVELOPMENT.md` remains the current-status record; this file is the narrative
that does not fit there.

---

## 1. What shipped in this session

| Task | State |
| --- | --- |
| 036 Rich Text Field support | Accepted by the owner. Addenda A (eight QA repairs), B, C, C.1, C.2, D shipped. |
| 036 Addendum D | Shipped. Three eligibility vetoes corrected against six real composers. |
| 036 Addendum E | **Shipped and reverted the same day.** See §3. |
| 035 R7 | Done. Lifecycle mutation cost 673ms → 35ms on a form-heavy page. |
| 037 Interface localization | Implemented. **Not accepted — see §4.** |
| 038 Movable page-status control | **Accepted by the owner.** |
| 033 Chrome Web Store beta readiness | Untouched, owner-blocked. See §5. |

---

## 2. The single most important process lesson

Twice in this session I stated a conclusion the evidence did not support, and
the owner's hands-on testing overturned it both times.

- I declared a Gemini failure to be migration residue from an older build. The
  owner reinstalled cleanly and it reproduced. Addendum A.7 exists because of
  their re-test, not because of my analysis.
- I diagnosed the Copilot fault as a permanently different identity key and
  proposed a storage migration that would have touched every existing Binding.
  One sentence from the owner - "I closed the Picker, waited a few seconds,
  reopened it, and the Templates were there" - proved the stored Binding was
  right the whole time and no migration was needed at all.

**The owner's observations are the strongest evidence available in this
project.** They are running the real extension on the real web, which no fixture
in this repository does. When their report and an analysis disagree, the report
wins until the analysis can explain it.

---

## 3. OPEN AND URGENT — Copilot, and the reverted Addendum E

**Current state: worse than before this session.** The owner reports that on
Copilot, saved Templates are **no longer offered in a conversation at all**.
Before Addendum E it was intermittent.

`ee32b7e` has been reverted in the tree. The full reasoning, the fixture that
proved it, and the places to look first are in
`tasks/036-rich-text-field-support.md`, "Addendum E — Shipped And Reverted The
Same Day". Read that before touching this.

The two facts that any correct explanation must account for, both from the
owner:

1. Templates appear and disappear **only** while switching between the new-chat
   screen (`/`) and a conversation (`/chats/<id>`). Never while the page sits
   still.
2. Closing the Picker, waiting a few seconds and reopening it brings them back.

Fact 2 is the important one. It means the stored Binding matches a key the page
does eventually produce, so nothing is permanently mis-keyed.

**First thing to check after the revert:** whether the owner is now seeing the
pre-session behaviour or something else again. The revert has not been tested by
them yet. Ask before building anything.

**A known unexamined side effect**, and the most likely reason the carve-out
made things worse: `showForField` computes

```ts
const cacheableWithinDocument = freshCandidates.has(field) || evidence.pageIdentityKey === null;
```

so removing an element from `freshCandidates` also stops its context being
cached within the document. Nobody asked for that and nothing tested it.

### Diagnostic limits worth knowing

A page-world console probe **cannot** read FillNest's state: the content script
is in an isolated world and `manifest-policy.mjs` forbids
`web_accessible_resources`. The attribute probes the owner ran describe the page
only. Anything about FillNest's own view has to come from the Side Panel's
by-location view or from a fixture.

---

## 4. OPEN — Task 037, the localization gate has three more blind spots

The owner reports that much of the Side Panel and the Picker is **still
English**, after a round that already closed 131 findings.

The gate in `scripts/lib/i18n-conformance.mjs` was strengthened once this
session (single capitalised words, template literals, `label`/`ariaLabel`
props). It is still missing three shapes, all confirmed present in the source:

1. **A plain quoted string in an object property.** Neither JSX text nor an
   attribute nor a template literal, so no pattern sees it. Confirmed:
   - `src/ui/side-panel/SitesPage.tsx` — every `label: "Undo"` / `label: "Delete"`
     in the undo descriptors (at least eight).
   - `src/ui/picker/InlinePicker.tsx:1749`, `:2887`, `:2919` — outcome messages.
2. **JSX text adjacent to an expression.** `JSX_TEXT_PATTERN` requires
   `>text<`, so prose between `}` and `{` is invisible. Confirmed at
   `src/ui/picker/InlinePicker.tsx:3287`:
   `</strong> to Shared Template Set{" "}`.
3. **`src/ui/theme/themes/*.ts`** still carry English `label` and `description`
   constants. The catalogue gained `themeDefault`/`themeOcean`/… entries and
   `SettingsPage` renders through `themeLabel()`, so the labels are translated
   at the point of display — but the constants are the ones a future surface
   will reach for, and the `description` fields are now dead.

**Do not hand-audit the UI for English.** Extend the gate first, let it produce
the list, then translate what it finds. That is what caught the last 131, and
hand-auditing is exactly what let these three shapes through.

Every gate change needs its own fixture in `tests/unit/i18n-conformance.test.ts`
— there are 11, and the false-positive ones (TS generics, class lists, icon
`label="edit"`) matter as much as the true-positive ones.

### The i18n architecture, in one paragraph

The owner's requirement, stated explicitly: **Chinese must never appear in
code.** The extension gets a language shell, not a bilingual core. A typed
`Messages` interface in `src/i18n/messages.ts` is the contract; entries are
**functions, not format strings**, so interpolation is type-checked.
`messages.zh-Hans.ts` is the only file in the repository containing Chinese.
`_locales/` carries the manifest name and description and nothing else.
`resolveLanguage` maps Simplified locales to `zh-Hans` and Traditional to `en`.
`LANGUAGE_CHANGED` is a separate broadcast from `APPEARANCE_CHANGED`.

Error codes stay English — the owner chose that deliberately (option A) so a
report pasted into an issue is searchable.

---

## 5. Task 033 — blocked on the owner, not on code

Needs from the owner before it can move: icons (16/32/48/128 plus a 128×128
store icon), a 1280×800 screenshot, approval of the drafted store descriptions
and permission justifications, a hosting location for the privacy policy, and
the `0.2.0` version bump.

---

## 6. Standing rules that cost me time to learn

- **No site allowlists.** The owner asked twice for AI-chat sites to be special
  cased, and `AGENTS.md` forbids it. Both times the answer was a generic rule
  derived from what the markup actually declares. Addendum D is what that looks
  like done properly.
- **Contracts before code.** A contract is drafted, the owner accepts it, then
  it is implemented. Acceptance is not execution authorization and execution is
  not acceptance.
- **Grill Mode** (`.agents/skills/grill-mode/SKILL.md`) before drafting a
  contract, every time.
- **Reply to the owner in Chinese. Everything in the repository stays English** —
  code, comments, tests, contracts, commit messages.
- **A check nobody can break is a check nobody will trust.** An invariant with
  no failing fixture was built and removed for exactly this reason this session;
  the reasoning is preserved in Addendum E and the code is not.
- The E2E suite runs **headed**. Chromium cannot complete optional-host
  permission prompts headless.
- Glossary the owner corrected: 输入框, not 字段.

---

## 7. Verification state at handover

`npm run check` — 38 contracts no drift, catalogue clean, no dead exports across
95 source files, **939 unit tests**. `npm run test:e2e` — **52 passed, 1
skipped** (the skip is the `FILLNEST_BENCH` performance benchmark).
