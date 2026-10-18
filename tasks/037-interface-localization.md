# Task 037 — Interface Localization And Simplified Chinese

**Version:** `0.2.0` (planned for `0.2.1`; delivered before the Beta)
**Status:** **Complete and accepted by the owner on 2026-09-11**, after their
hands-on QA in Chinese passed. Implemented 2026-09-10 in five slices, with
Addendum A (2026-09-10), Addendum B (2026-09-11) and Addendum C (2026-09-11).
**Origin:** The project owner, 2026-09-10.
**Grill record:** Six decisions over two rounds, plus one clarification that
changed the contract. Recorded below with the reasoning that settled each.

**Requires a project-level rule change.** `AGENTS.md`'s Language Rules forbid
multilingual behaviour without approval. The exact replacement text is proposed
below and must be accepted separately from this contract.

## Goal

Let FillNest's interface appear in a language the person using it can read,
with Simplified Chinese as the first. No product behaviour changes: this is
presentation.

## The Shell Principle

The owner put it exactly right when asking whether this means Chinese inside
the code: **it does not.** Localization is a shell around an English core, and
the core does not learn a second language.

- Code, identifiers, function names, message keys, comments, filenames, task
  records, internal documentation, logs, commit messages and tests stay
  **English**. That `AGENTS.md` line does not change.
- **The only file in the repository containing Chinese is one catalogue per
  language**, and the Chinese in it is data in a lookup table, not code:

```ts
// messages.ts - keys, types and the English text
export interface Messages {
  savedAndBound(): string;
  optionCount(count: number): string;
}
export const en: Messages = {
  savedAndBound: () => "Saved and bound to this field.",
  optionCount: (count) => `${count} option${count === 1 ? "" : "s"}`,
};

// messages.zh.ts - the one file with Chinese in it
export const zh: Messages = {
  savedAndBound: () => "已保存并绑定到这个输入框。",
  optionCount: (count) => `${count} 个选项`,
};

// a component - no prose of either language, only an English key
<span>{t.savedAndBound()}</span>
```

A third language is one more file and no change to the core.

Entries are **functions, not strings with placeholders**. English inflects for
number and Chinese does not, and a shared format string forces one of the two
to read like a machine.

## Confirmed Contract

### Where The Language Comes From

The manifest's `name` and `description` use `_locales/`, because Chrome
resolves those by the browser's own UI language and offers no alternative.

Everything the extension renders itself follows an explicit **Settings**
choice - `System`, `简体中文`, `English` - defaulting to `System`, which
follows the browser. The same shape as the existing appearance setting, and for
the same reason: a person whose browser is in English may still want the
extension in Chinese, and that is common rather than exotic.

A change applies to all three surfaces immediately, without a reload, over the
broadcast path Task 034 already built - but through its **own**
`LANGUAGE_CHANGED` notification. Task 034's accepted `APPEARANCE_CHANGED`
contract is not widened to mean "preferences" for the convenience of this Task.

### What Is Translated

Visible copy, derived labels, user-visible errors, and accessibility text
(`aria-label`, `title`, `placeholder`) across the Side Panel, the Inline Picker,
the Popup and the page status control. Roughly 300 entries, measured by grep and
to be counted exactly once the mechanism exists.

Accessibility text is not an optional fourth tier. It is what a screen-reader
user reads *instead of* the visible copy, and leaving it English would hand
Chinese-speaking blind users a worse product than Chinese-speaking sighted
ones.

### What Is Never Translated

- **The user's own data**: Template content, and any name they typed.
- **The web page's data**: Site names, page names, and the name a Field derives
  from the page's own markup.

Translating either would be altering what the user or the page said.

### User-Visible Errors Carry A Code

The one place the shell cannot simply wrap the core. Errors are thrown in the
core, in English, and a shell handed a finished English sentence has nothing to
translate it *from*.

So the errors a user can actually see gain an English identifier:

```ts
throw new FillNestError("archive-too-large");
```

The core stays English - `archive-too-large` is an English identifier, not
prose - and the shell looks the code up. This touches only the errors that
reach a surface; most of the 44 `new Error(...)` sites are internal invariants
no user ever sees, and they are left alone.

The alternative - leaving error text English - was considered and rejected by
the owner: an error is the moment a person most needs to understand what
happened.

### Where The Display Label Is Derived

`buildCompatibilityFieldEvidence` computes a `displayLabel` inside the
repository, which runs in the service worker and has no business knowing the
interface language. That derivation moves to the UI, where the other two
callers already do it. It is also the layering `AGENTS.md` asks for; the value
is presentation and its own comment says it is used "only for the final
ordering tiebreak, never for matching".

## Proposed Glossary (`CONTEXT.md`)

The owner's own usage settles two of these, and one carries a decision made the
day before this contract.

| English | 中文 | Why |
| --- | --- | --- |
| Template | 模版 | The owner's own spelling throughout |
| Field | **输入框** | Not 字段 - see below |
| Site | 网站 | |
| Page | 页面 | |
| Binding / Bind | 绑定 | |
| Shared Template Set | 共享模版组 | 集合 reads mathematical |
| Insert | 插入 | |
| Inline Picker | 模版面板 | Not a literal "picker" |
| Side Panel | 侧边栏 | |
| Website Access | 网站授权 | |
| Backup / Restore | 备份 / 还原 | |
| Reset FillNest | 重置 FillNest | |

**`Field → 输入框` is the load-bearing one.** Task 024 Addendum C.1, accepted
the day before, concluded that the word "field" is jargon ordinary people do
not know, and changed the English to say "box". Translating it as 字段 - a
harder technical term than the English it replaces - would rebuild the defect
that was just repaired, in a second language.

## Proposed `AGENTS.md` Replacement

Requires the owner's separate acceptance. The first line is unchanged; only the
second and third are replaced.

```markdown
## Language Rules

- Use English for code, comments, identifiers, filenames, task records, internal docs, logs, commits, tests, and product text.
- User-facing strings live in a typed message catalogue, never inline in a component. English is the source catalogue and defines the keys.
- Simplified Chinese is supported alongside English (Task 037). The only files containing non-English prose are the language catalogues themselves; a new language adds a catalogue and changes nothing else.
- Never translate the user's own data or a web page's data: Template content, user-given names, Site names, page names, and Field names derived from page markup stay exactly as they are.
```

## What Implementation Found

**The docs conformance gate had to follow the labels.** `verify:docs` scans
`src/ui/` for the control names `PROJECT.md` promises, and a component now
holds a key where it used to hold the words. It reads the English catalogue
too, for the same reason it reads the components: that is where the product's
labels are.

**The gate needed a fixture before it was trustworthy.** Its first version
reported TypeScript generics as rendered text - `useState<Foo>(null)` puts
`(null);` between a `>` and a `<` - and reported comment prose. Both are
stripped now, with newlines preserved so the reported line still points at the
file. It also deliberately ignores single words: `Save` between tags is not
reported, because a false positive teaches people to silence the check, and
that costs more than the miss.

**`useMessages` had to survive having no extension around it.** A component
test renders a surface with no `chrome` global; the hook asks for a better
answer and never insists on one.

**The Picker uses the hook directly.** A content script has `chrome.runtime`,
so the Picker hears `LANGUAGE_CHANGED` itself rather than being handed words by
the script that renders it. Only `PageStatusControl` and `FieldAliasEditor`
take messages as a prop, because they are rendered outside a hook context.

## Addendum A — The Gate Was Too Weak, And The Owner Found What It Missed

**Reported 2026-09-10**, on the first look at the Chinese build: the Appearance
section, System/Light/Dark, `Export Backup`, `Restore`, the Sites and Templates
filters and sorts, `Move`, `Insert`, and every outcome message - "Started
sharing Templates with Text field." among them - were all still English.

**The gate had let them through, which is the more important half.** It
required **two words**, so every one-word button escaped it; and it only looked
between JSX tags and at three HTML attributes, so it never saw a sentence built
at runtime - which is what every outcome message is.

Four changes, each with its own fixture:

- **A single capitalised word counts.** `Move` is a button label far more often
  than it is a token. What is excluded instead is the shape of an identifier: a
  lowercase single word (`label="edit"` builds an icon marker nobody reads) and
  SCREAMING_CASE.
- **Template literals count.** Two real words outside the interpolations, so a
  `${a}/${b}` path, a class list or a CSS value is not mistaken for a sentence.
- **`label` and `ariaLabel` props count**, because a `ModalDialog`'s label is
  the dialog's accessible name.
- **`i18n-exempt: <reason>` opts a line out**, and the reason has to be
  written. There is exactly one honest reason, and this product has three
  instances of it: `delete`, `reset` and `restore` are words the user must
  **type**, and translating them would make the instruction wrong.

It found **131** strings on its first strict run. That is the number the loose
version had been reporting as zero.

**One product change came with it.** The owner's judgement on seeing the theme
swatches translated: the name is enough, the sentence under it explains what
the picture already said. The description line is gone.

## Slices

Each is independently reviewable and independently acceptable. Three hundred
entries arriving at once leaves QA nowhere to start.

1. **Mechanism, Settings, `_locales`, Popup and page status.** The smallest
   surface, chosen because it proves the whole path end to end - catalogue,
   setting, broadcast, manifest - with the least copy to review.
2. **Side Panel** visible copy.
3. **Inline Picker** visible copy, including delivery into the content script.
4. **Derived labels, user-visible error codes, and all accessibility text.**
5. **`verify:i18n`**, a gate that fails `npm run check` when a user-visible
   string is written inline in `src/ui/**`. Last on purpose: a gate needs a
   clean baseline to guard, and running it during the translation would produce
   nothing but noise.

## Non-Goals

- Any change to product behaviour, interaction, or data.
- Traditional Chinese, right-to-left layout, or a third language - though the
  mechanism must not assume there are only two.
- A Chinese store listing. Task 033 ships first and its listing copy is likely
  to change under review; translating it before then means translating it
  twice.
- Translating anything thrown as an internal invariant that no surface shows.

## Acceptance

1. Changing the Settings language updates all three surfaces immediately,
   without a reload.
2. `System` yields Chinese in a Chinese browser and English in an English one.
3. A missing entry in any catalogue is a **`npm run typecheck` error**, not
   English text at runtime.
4. `verify:i18n` fails on an inline user-visible string in `src/ui/**`.
5. Template content, user-given names, Site names, page names and derived Field
   names are byte-identical in both languages.
6. Every user-visible error reaches its surface as a code and is shown in the
   chosen language.
7. No Chinese appears in any file other than the language catalogues.
8. `npm run check` and the complete headed suite pass; the owner's hands-on QA
   in Chinese passes.

## Validation

- A unit test asserting the two catalogues have identical key sets - the
  compiler enforces this for missing keys, and this catches an extra one.
- A headed E2E that switches the language in Settings and asserts a known
  string changes in the Side Panel and in the Picker without a reload.
- A test that a Template containing English text, and a Field name derived from
  an English page, are unchanged after switching to Chinese.
- The `verify:i18n` gate, with its own fixture proving it fails on an inline
  string.

## Assumptions To Verify

- The ~300 count is a grep estimate; slice 1 produces the real number, and it
  may move by 20% either way.
- Chinese copy is drafted here and **reviewed line by line by the owner**, who
  is both the native speaker and the product's voice.
- Unverified: whether `_locales` and a `default_locale` conflict with the
  manifest policy gate in `scripts/lib/manifest-policy.mjs`. Slice 1 answers it.

## Stop Conditions

- If any language's prose reaches a file other than its catalogue, stop. That is
  the entanglement this design exists to prevent.
- If the language cannot reach the content script over the existing broadcast
  path, stop rather than adding `web_accessible_resources`: Task 028 removed it
  deliberately, and it is not reopening for a convenience.
- If translating a derived label would require the service worker to know the
  interface language, stop and move the derivation instead.


## Addendum B — Three More Blind Spots, And What Was Behind Them

**Status:** Implemented 2026-09-11; the owner's Chinese QA passed the same day.
**Origin:** The owner's screenshots of the Chinese build: `All`, `Select all
filtered addresses`, `This tab`, `All templates`, `By location`, `Search
Template bodies…`, `Any Site`, `↓ Descending`, `Search Fields` and `Search
Fields across other pages` still in English. The 2026-09-10 handover had named
three shapes the gate could not see; the screenshots were all of them.

### What The Gate Could Not See

Found by extending the gate first and letting it produce the list, as Addendum
A did - not by hand:

- A quoted string anywhere but a literal attribute: in a ternary inside an
  attribute, a `[value, label]` tuple, an object property (`label: "Undo"`),
  an outcome message assigned to a variable, a fallback after `||`, or a
  sentence handed to a state setter (`setError("…")`).
- JSX text beside an expression - `Delete {count}`, `Sites: {list}`, `</strong>
  to Shared Template Set{" "}`.
- Template literals across lines, with a single capitalised word (`Added ${a}
  to ${b}`), in a read-aloud attribute (`Select ${origin}`), carrying `;` or
  `:` as punctuation, and labels chosen inside a `${…}` hole.
- Two directories: `.ts` files under `src/ui` (theme names) and `src/content`
  (the Field Control's accessible name, which a screen reader meets on every
  page).

The strict run reported **192** findings against a clean result from the
previous gate. Code shapes that stay unreported, each with a fixture:
comparisons and `case` labels, thrown internal invariants (this contract's
non-goal), type unions, `as const` identifier lists, a state setter given one
identifier, class lists, selectors and object-literal keys.

### What Changed

- About 140 new catalogue entries in both languages, English source kept word
  for word wherever a test or a user already relies on it.
- **Rich sentences.** A sentence with emphasised parts whose order differs
  between languages - "Share **preview** with the whole Set … in **Set name**" -
  is a `RichMessage`: an entry returning parts, rendered by `RichText`. Each
  language keeps its own word order instead of the English being cut into
  fragments around the `<strong>` elements.
- **The past tense of an Undo** was produced by string surgery on the English
  label (`Undo X` → `Undid X`), which would have printed mixed English and
  Chinese. It is now its own entry.
- **Theme names live only in the catalogue.** The theme definitions' English
  `label` and the dead `description` are gone; `themeLabel` is exhaustive over
  the theme ids, so a theme added without a name in every catalogue does not
  compile - Acceptance 3's rule, applied to themes.
- **The Field Control's accessible name** follows the chosen language.
- **A Picker font defect found in the same screenshots:** the host's inline
  `all:initial` outranks the stylesheet's `:host`, so headings, labels and
  `strong` text fell back to the browser's serif default. The font is declared
  on `.picker` as well.

### Evidence

- `npm run verify:i18n` reports nothing; `tests/unit/i18n-conformance.test.ts`
  carries a fixture for every new shape and every new exclusion.
- `tests/unit/i18n.test.ts` renders every entry, rich ones included, with
  arguments; no Chinese entry says 字段.
- `tests/unit/theme-contrast.test.ts` asserts every theme has a distinct name in
  both catalogues.
- `tests/e2e/language-switch.spec.ts` now also finds the Field Control by its
  Chinese name; `tests/e2e/picker-selection-and-edit.spec.ts` asserts the
  Picker heading's font is sans-serif.
- `npm run check`: 947 unit tests and every gate; headed Playwright: 68 passed,
  the opt-in benchmark skipped.

**Accessibility:** accessible names that were English in a Chinese interface -
the Field Control, row checkboxes, expand/collapse chevrons, site toggles,
the Site filter and the site-affinity badge - are now in the chosen language.
No roles or structure changed.

**Not done:** the Chinese copy is a draft for the owner's line-by-line review,
as this contract's assumptions already say.


## Addendum C — One Registry For Languages

**Status:** Implemented on 2026-09-11 at the owner's request, with the Task's
acceptance.
**Origin:** The owner asked whether a new language is added "like the Chinese
shell". It was - but registering one touched five places, none of which the
compiler checked: the language ids, `system` resolution, the Settings options,
two tests written for exactly two languages, and the `_locales` folder.

### What Changed

- `LANGUAGES` in `src/i18n/language.ts` is the one list: each language's id,
  its `public/_locales/` folder, and which browser languages it claims under
  `system`. `LanguageId`, `LANGUAGE_PREFERENCES` and `resolveLanguage` derive
  from it; English is the fallback.
- `catalogue.ts` maps every id to its catalogue as a `Record<LanguageId, …>`,
  so registering an id without a catalogue does not compile - verified by
  registering a Japanese id with none and reading the `tsc` error.
- Settings lists `LANGUAGE_IDS`, each by its catalogue's new `languageName`
  entry - the language's own name for itself. `languageEnglish` and
  `languageChinese` are gone, and with them the only Chinese in the English
  catalogue.
- The catalogue, theme-name and new `_locales` tests iterate the registry. The
  `_locales` test fails until a registered language has its manifest strings.

Adding a language is now: an entry in `LANGUAGES`, a `messages.<id>.ts`
answering every entry, its line in `catalogue.ts`, and its `_locales` folder.
The recipe is written at the top of `catalogue.ts`. A right-to-left language
needs layout work it does not cover.

## Addendum D — Errors Reach Their Surface As Codes (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

Acceptance criterion 6 was recorded as met at acceptance, and was not:
`FillNestError` did not exist, and a Chinese surface showed every service
worker error in English. Two English sentences, the full-Field and too-long
notices, were also rendered straight from core constants, where
`verify:i18n`, which reads literals, could not see them.

- `src/messages/user-error.ts` names the errors a user can meet. The core
  throws `UserFacingError(code, English sentence)`, or keeps an existing class
  (`StaleUndoError`, `InvalidBackupArchiveError` and others) that maps to a
  code. Internal invariants carry no code, as the contract intended.
- The worker's failure response carries `errorCode` beside the English text.
- Every surface now uses one `sendRequest` (`src/ui/shared/runtime-request.ts`)
  in place of five identical copies. An English surface shows the core's own
  sentence, which can name the exact key or Site; any other language looks the
  code up in its catalogue. The 68 places that show `response.error` needed no
  change.
- The two notices are catalogue entries, and `verify:i18n` now reports any
  `*_MESSAGE` constant rendered in JSX.
- Reset FillNest now broadcasts `LANGUAGE_CHANGED`, as it already did
  `APPEARANCE_CHANGED`, so open surfaces return to System without a reload.

**Evidence.** `tests/unit/runtime-request.test.ts`,
`tests/unit/i18n-conformance.test.ts`, `tests/unit/service-worker-runtime.test.ts`.
The owner reviewed the new Chinese copy on 2026-09-11 and shortened seven
entries: the Field and Set limits, the too-long notice ("模版字数已达到上限。"),
stale Undo, stale page match, inconsistent data and the oversized backup.
After asking what situation each describes, the owner also shortened four
more - the Move that ends a Set, stale Clear Site Data counts, inconsistent
data ("操作未完成，没有任何内容被更改。") and an incomplete Remove site - and
kept the typed-confirmation entry. The Chinese copy is fully reviewed.

## Addendum E — Document Language, And A Fourth Set Of Blind Spots (2026-09-13)

**Status:** Implemented on 2026-09-13 from an independent (Codex) review the
owner shared; accepted by the owner on 2026-09-15 after hands-on QA of every
string. The optional VoiceOver reading was not done; it stays with Task 025's
deferred assistive-technology session.

**1. Every surface said it was English.** The Popup and the Side Panel changed
their words to Chinese while their documents kept `lang="en"`, and the Picker,
its full-text flyout, the field button and the page status control inherited
the host page's language. A screen reader then read the Chinese with the
wrong language's rules. `useDocumentLanguage()` now keeps
`document.documentElement.lang` with the chosen language on the two extension
pages, and each surface inside a page carries its own `lang` (`zh-Hans` or
`en`, both valid BCP 47 tags from the language registry).

**2. Nine strings still reached a Chinese reader in English**, all found by
reading the rendered surfaces rather than the source: a Field card's
`2 options`, All templates' `1 selected` and empty-Search sentence, the Sites
pagination's `of`, the share Finder's `(+N more)` and `N fields before`, the
live region's `Undo is available.`, and the length counter's tooltip (whose
English `TEMPLATE_CONTENT_COUNT_DESCRIPTION` constant is gone). Each is a
catalogue entry in both languages.

**3. Why `verify:i18n` passed.** It skipped lowercase words beside an
expression (`option`, `selected`, `of`, `before`), read only a fixed list of
attribute names (`emptyMessage` was not one), and needed two long words in a
template literal (`more`, `is available.`). It now reports lowercase words
beside an expression unless they are a code keyword, an arrow's return type or
a boolean prop before a spread; any prop whose name ends in `Message`,
`Label`, `Text`, `Title`, `Description`, `Hint` or `Placeholder`; and a short
interpolated phrase once it carries sentence punctuation. Run over the
previous sources it reports all nine, and nothing else in the product.

**Evidence.** `tests/unit/chinese-surfaces.test.tsx` renders the Side Panel,
the Popup and the length counter in Chinese and fails on any English word left
on screen or in an accessible name, besides the product's name and user data;
it also asserts the document language. `tests/unit/page-status-control.test.tsx`
and `tests/unit/inline-picker-chinese-limits.test.tsx` assert the page
surfaces' `lang`. `tests/unit/i18n-conformance.test.ts` covers each new shape
the gate reports and the code shapes it must not.


## Addendum F — A Fifth Blind Spot: `more…` (2026-09-15)

**Status:** Implemented on 2026-09-15 at the owner's request, after it was
noticed while repairing Task 024 Addendum E.

**The string.** In the share Finder's Search results, a Field name longer than
60 characters is clamped with a toggle whose accessible name was already in
the reader's language (`showFullNameOf`) but whose visible word was the
literal `more…`. A Chinese reader saw English. It is now the catalogue entry
`showMore` - "more…" and "更多…".

**Why `verify:i18n` passed.** It took a lowercase single word for an internal
token, the rule that keeps `label="edit"` from being reported. Between tags,
a lowercase word that trails off or ends a sentence (`…`, `.`, `!`, `?`) is
read by someone, so the gate now reports it; a bare lowercase word between
tags and every attribute token are still not reported. Run over the previous
sources it reports `more…` and nothing else in the product.

**Evidence.** `tests/unit/i18n-conformance.test.ts` ("trails off or ends a
sentence") failed before the gate change and covers the unreported shape.
