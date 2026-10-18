# Task 033 — Chrome Web Store Beta Readiness

**Status:** Contract recorded 2026-09-08. Partially executed - the items that
need no product or design decision are done; the rest are listed below as
owner-blocked with what each needs.
**Owner:** This Task. It owns packaging, store metadata and the submission
gate. It changes no product behaviour and adds no feature.
**Version gate:** `0.2.0`. Per `tasks/README.md` this is "store readiness and
private test distribution only; it is not a feature-expansion release."

## Goal

Get the extension into a state where it can be submitted to the Chrome Web
Store for private/unlisted Beta distribution, without changing what it does.

## What The Store Actually Requires

| Requirement | State | Blocked on |
| --- | --- | --- |
| Manifest V3 | Met | - |
| `icons` 16/32/48/128 in the manifest | Met (Addendum D) | - |
| 128×128 store icon | Met (Addendum D) | - |
| At least one screenshot, 1280×800 or 640×400 | **Missing** | Owner: which screens to show |
| Small promo tile, 440×280 | **Missing** (added by Addendum C) | Owner: artwork |
| Short description ≤132 chars | Draft below | Owner: approval |
| Detailed description | Draft below | Owner: approval |
| Privacy policy URL | Draft text in `docs/privacy-policy.md` | Owner: where to host it |
| Single purpose statement | Draft below | Owner: approval |
| Permission justifications | Draft below | Owner: approval |
| Packaged `.zip` | `npm run package`; `verify:store` names one older than `dist/` (Addendum E) | Run it just before uploading |
| Version number | `0.2.0` in the manifest (bumped 2026-09-11, Addendum B) | - |

## Done Under This Task

- `npm run package` builds and writes `output/fillnest-<version>.zip` from
  `dist/`, and refuses to package a build that fails `verify-build.mjs`.
- `scripts/verify-store-readiness.mjs` reports exactly which of the above are
  still missing. It is not in `npm run check`: the project is not trying to be
  submittable yet, and a permanently red gate teaches people to ignore gates.
  Run it deliberately with `npm run verify:store`.
- `docs/privacy-policy.md` states what the extension does and does not do with
  user data, written from the code rather than from intent.

## Draft Store Metadata

These are drafts for the owner to approve, edit or discard. They are not
published by anything in this repository.

**Single purpose.** FillNest stores short plain-text templates and offers them
next to a web form field the user has explicitly authorized, so the user can
insert one deliberately.

**Short description (119 chars).** Superseded by the shipped manifest text;
see Addendum G.
> Field-aware plain-text templates, offered next to the field you choose. Local
> only, nothing leaves your browser.

**Permission justifications.**

- `storage` - the Template Library, Field relationships and settings are kept
  in `chrome.storage.local`. Nothing is sent anywhere.
- `tabs` - **owner decision, 2026-09-08: keep it, and say precisely what it is
  for.** Task 035 (R5) established that three of the four uses do not actually
  need it: with a host permission granted, `chrome.tabs.query` already returns
  `url` for that tab, which is all the state broadcast and the permission
  platform read. The one use that genuinely needs `tabs` is reading the
  **current tab's Origin before it is authorized** - without it FillNest cannot
  say "Allow access to example.com", which is the entry point to the whole
  product. `activeTab` would cover the Popup, which opens from an action click,
  but not the Side Panel, which does not.

  Listing wording: "FillNest reads only the address of the tab you are looking
  at, and only so it can offer to enable itself for that site. It does not read
  page content, and it never reads any other tab."
- `scripting` - the content script is registered per authorized Origin at
  runtime, never for `<all_urls>` at install.
- `sidePanel` - the management surface.
- `optional_host_permissions` for `http://*/*` and `https://*/*` - requested
  one Origin at a time when the user authorizes that Site, never at install.
  This is the entry that most often draws review questions; the justification
  is that the user grants each Origin individually and can revoke it.

## Evidence Available For Review

- No network capability at all: no backend, no telemetry, no remote code.
  `tests/unit/runtime-network-allowlist.test.ts` and the E2E harness assert
  that the only requests during a run are to the test fixture Origin.
- No `web_accessible_resources`, enforced by `scripts/lib/manifest-policy.mjs`.
  UI icons are inlined as `data:` URIs, so the extension exposes no probe for
  its own presence.
- The Inline Picker's Shadow Roots ship closed, enforced by
  `scripts/verify-build.mjs` and exercised against the real `dist` build by
  `tests/e2e/picker-isolation.spec.ts`.
- Excluded sensitive fields receive no value read, fingerprint, Field Profile,
  marker, listener, UI or fill (Task 028).

## Not Done, And Why

- **Icons and screenshots.** Artwork and the choice of what to show are the
  owner's. A placeholder icon would be worse than none, because it would ship.
- **Version bump.** Recorded as not done on 2026-09-08, when the manifest said
  `0.1.1`; the owner bumped it to `0.2.0` on 2026-09-11 (Addendum B).
- **Submission itself.** Requires the owner's developer account, the $5
  registration fee, and acceptance of the store terms. Not an agent action.

## Acceptance Criteria

1. `npm run package` produces a store-uploadable zip from a verified build.
2. `npm run verify:store` names every missing store requirement and exits
   non-zero while any remain.
3. The privacy policy describes the extension that exists, checkable against
   the manifest and the network evidence above.
4. No product behaviour changes under this Task.

## Addendum A — Pre-Submission Audit (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

- **The package gate would have rejected the icons.** `verify-build.mjs`
  allowed no `.png`, and `manifest-policy.mjs` had no place for icons, so
  adding the owner's artwork would have made `npm run package` refuse. The
  gate now admits `icons/icon-<16|32|48|128>.png` and nothing else, and only
  the icons the manifest declares (in `icons` or `action.default_icon`); every
  declared icon must ship. Put the artwork in `public/icons/` under those
  names.
- **The `tabs` listing wording did not match the code.** State broadcasts
  called `chrome.tabs.query({})`, reading every open tab's address in order
  to discard most of them. They now ask only for tabs matching the granted
  host patterns, and ask for none when no Site is authorized. Proposed
  listing wording, replacing the draft above: *"FillNest reads the address of
  the tab you are looking at, so it can offer to enable itself there, and the
  addresses of tabs on sites you have already authorized, so an open page stays
  up to date. It reads no page content, and no other tab's address."*
- **The privacy policy under-described the product.** It omitted the one
  rich-text read after an insertion (Task 036), the clipboard write, the
  stored field label and page path, the rejected-insertion fact, the language
  preference, and tab addresses. `docs/privacy-policy.md` now states each one
  and names the code that proves it.
- **`output/fillnest-0.1.1.zip` is stale.** It was built on 2026-09-08,
  before Task 037 added `_locales`, and the manifest's `__MSG_` name cannot
  resolve without them. Never upload it; run `npm run package` after the
  version bump.

The remaining blockers are unchanged and belong to the owner: artwork,
screenshots, approval of the listing text, a public URL for the privacy
policy, and the `0.2.0` version bump.

## Addendum B — The Owner's Submission Decisions (2026-09-11)

**Status:** Recorded from the owner's answers on 2026-09-11.

| Item | Decision | Who |
| --- | --- | --- |
| Icons | Designed by a designer; blocks submission until delivered. The package gate expects `public/icons/icon-16.png`, `-32`, `-48`, `-128`, declared in `icons` and `action.default_icon` | Owner |
| Screenshots | Taken by the owner, 1280x800 | Owner |
| Privacy policy URL | A public GitHub Gist of `docs/privacy-policy.md` without its internal header and verification section | Owner |
| Version | `0.2.0`, bumped in `public/manifest.json` and `package.json` on 2026-09-11 | Done |
| Visibility | **Unlisted**: installable from its link only, the private Beta this contract set out | Owner, at submission |
| Listing text | Approved: the short description, single purpose and permission justifications above, with Addendum A's `tabs` wording. A Chinese listing is written outside the repository, since AGENTS.md keeps non-English prose to the language catalogues | Owner, at submission |

**Detailed description (draft).** The table at the top of this contract listed
this as "Draft below", but no draft was ever written. This one was written on
2026-09-11 for the owner to read before submission:

> FillNest keeps the short texts you type again and again - replies, notes,
> addresses, sign-offs - and offers them next to the web form field where you
> need them.
>
> - **You choose where it works.** FillNest asks for no website access when
>   you install it. You allow it one site at a time, and can pause or remove
>   each one.
> - **You choose what goes in.** Nothing is filled automatically. Click the
>   small FillNest button beside a field, pick a template, and it is inserted
>   at your cursor, or over the text you selected. FillNest never fills a whole
>   page and never submits a form.
> - **It remembers the right templates for each field.** Bind a template to
>   a field and it is offered there first next time. Share a list of templates
>   between similar fields, or keep one private to a single field.
> - **Everything stays on your device.** No account, no server, no tracking.
>   Your templates live in your browser; export a backup file whenever you
>   like.
> - **Sensitive fields are left alone.** Password, payment and one-time-code
>   fields get no FillNest button and are never read.
>
> Available in English and Simplified Chinese.

**Remaining before submission, all the owner's:** the icons, the screenshots,
the promo tile (Addendum C), the Gist URL, reading the detailed description,
then `npm run package` after the icons land, and uploading
`output/fillnest-0.2.0.zip` with Unlisted visibility.

## Addendum C — What The Store Check And Policy Missed (2026-09-12)

**Status:** Implemented on 2026-09-12 from an independent (Codex) review the
owner shared; documentation and the store check only, no product behaviour.

- **The store check omitted a required image.** The Chrome Web Store requires
  a 440×280 small promo tile besides the icon and screenshots.
  `npm run verify:store` now lists it, and the table above has a row for it.
  It is owner artwork, like the icons.
- **The description gate measured the placeholder.** The manifest description
  is `__MSG_extensionDescription__`, and the check measured those 28
  characters, which always passed. It now resolves the message in every
  `public/_locales/*/messages.json` and measures each language's text in
  characters (`scripts/lib/store-description.mjs`, tested by
  `tests/unit/store-description.test.ts`). Today: English 60, Chinese 27, of
  132.
- **The privacy policy read as handling no data.** Its heading "What FillNest
  Collects - Nothing" sat above a list of what it stores. The store treats data
  handled only on the device as data that must be disclosed, so the heading is
  now "What Leaves Your Device - Nothing", followed by a plain statement that
  FillNest does handle user data locally. A new "How This Data Is Used" section
  states the single purpose, no sale, transfer or unrelated use, and
  compliance with the Chrome Web Store User Data Policy's Limited Use
  requirements. The stored-data list now names text saved with `Use current
  field content`. The Developer Dashboard's Privacy Practices answers must say
  the same when the owner submits.
- **Stale records.** This contract's version row and "Not Done" entry, the
  README (which still called `contenteditable` and store readiness out of
  scope and the release `0.1.2`), and a DEVELOPMENT.md paragraph that still
  named Task 039's owner QA as the next gate after recording its acceptance.

## Addendum D — The Owner's Icon Set (2026-09-15)

**Status:** Implemented on 2026-09-15 at the owner's request, from the set the
owner placed in `Icon/` ("2C Block", a 96-unit grid: ink `#201e1d` or white,
accent `#ec3013`). The owner asked for light and dark modes both.

- **Manifest.** `icons` names the set at 16, 32, 48 and 128, and
  `action.default_icon` names 16 and 32. The files are in `public/icons/`,
  with the C2PA provenance chunk (`caBX`, about 5.7 KB in each) removed.
  `npm run verify:store` no longer lists icons.
- **Toolbar: a white ground in every theme (owner decision, 2026-09-15).** No
  Chrome API tells an extension the toolbar's colour; `prefers-color-scheme`
  reports only Chrome's light/dark mode, not a dark theme or custom colour.
  A first version swapped to the white-ink set by that signal; the owner
  still found the dark-ink icon hard to see on a dark toolbar. So 16 and 32 are the
  light set composited onto opaque white - dark ink and the red bar on a
  white square, legible on any toolbar - and nothing switches at runtime.
  They double as the extension's page icon. The owner then found the
  transparent 48 and 128 as hard to see on Chrome's dark extensions page, so
  all four sizes are the light set on opaque white. The 128 is full-bleed
  rather than the store's recommended 96-pixel artwork inside 16 pixels of
  transparent padding, so it matches the other sizes; the listing may want a
  padded variant later. The manifest names nothing
  outside `icons/icon-<16|32|48|128>.png`, so the package gate is unchanged.
- **In the UI.** The placeholder toolbar glyph in the Popup header and the
  "F" tile in the Side Panel's navigation are both the owner's mark,
  `BrandIcon`, drawn inline: its ink is the surface's text colour, so it is
  dark in light mode and white in dark mode, and its insert bar is the brand
  red in every theme - these follow the theme; only the toolbar does not. The
  Field control and the page-status button keep their own state glyphs.
- **Not in this addendum.** The dark PNGs, 512 and tile PNGs are unused; the
  440×280 promo tile and the screenshots are still owner work.

## Addendum E — Tab Addresses, A Stale Package, And The Clipboard (2026-09-15)

**Status:** Implemented on 2026-09-15 at the owner's request, after an audit
of everything since `4327d88`; accepted by the owner the same day after
hands-on QA (revoking access in Chrome's settings clears an open page at once,
allowing it again restores the page, and `verify:store` names a stale package
until `npm run package` runs).

- **Tab addresses, the rest of Addendum A.** Addendum A narrowed state
  broadcasts to tabs on authorized Sites, but the permission lifecycle still
  asked Chrome for every open tab: `ChromePermissionPlatform.listTabIds()`
  ran `chrome.tabs.query({})`. Reconciling Website Access - on every start of
  the service worker, after Reset and after a removal - read each open tab's
  address that way and then tried to inject the content script into all of
  them; revoking access did the same to deliver the revocation. The privacy
  policy and the listing wording both say FillNest reads no other tab's
  address. `listTabIds` now takes the patterns concerned and queries only
  those: reconciliation asks for the exact granted patterns it registers, and
  revocation for the removed patterns, since a page FillNest ran on is still
  on the revoked address. No pattern means no query at all. Evidence, each
  failing before the change: `tests/unit/service-worker-runtime.test.ts`
  (the worker's start asks only for authorized Sites' tabs, and for none with
  no Site authorized) and `tests/unit/permission-lifecycle.test.ts`
  (reconciliation and revocation pass their patterns; a broad grant made in
  Chrome's settings is not queried; nothing is injected with no Site
  authorized).
- **A stale upload package.** `npm run package` names the zip by version
  alone. `output/fillnest-0.2.0.zip`, packaged on 2026-09-12, had no icons
  and none of the work since, under the same name a current package would
  have. `npm run verify:store` now lists a missing package, or one older than
  `dist/`, as a blocker until `npm run package` runs again
  (`scripts/lib/upload-package.mjs`, `tests/unit/upload-package.test.ts`). It
  judges by time: a rebuild of unchanged sources also asks for a new package,
  which costs seconds.
- **The clipboard sentence.** The privacy policy said FillNest writes to the
  clipboard only to copy a Template. Task 042's `Copy email` writes the
  feedback address too, on its own click; the policy now says both.

## Addendum F — The Published Policy Cannot Drift From This One (2026-09-16)

**Status:** Implemented on 2026-09-16, when the owner published the policy and
asked to be reminded whenever the repository copy changes.

The privacy policy now exists twice: `docs/privacy-policy.md` here, and the
public page the store listing points at. Two copies drift, and a store listing
whose policy no longer describes the extension is a submission risk, not a
documentation untidiness.

- **The public copy is derived, not maintained.** `npm run policy:public`
  prints `docs/privacy-policy.md` without its revision header and without
  `How To Check These Claims`, under one `Effective <date>, for FillNest
  <version>.` line. Copy it with `npm run --silent policy:public | pbcopy` and
  paste it **as Markdown**. Two ways that went wrong on 2026-09-16, both now
  documented at the command: pasting rendered text instead of the source loses
  every heading, list and code span, and `npm run` without `--silent` puts its
  own two banner lines at the top of the output.
- **What was published is recorded** in `docs/privacy-policy-published.json`:
  the URL, the effective date, the version it covers, and a SHA-256 of the
  derived body. `npm run policy:public -- --record` stamps it, and only after
  the public page really shows the new text.
- **`npm run verify:store` reports the drift**: the policy edited since it was
  published, or published for an earlier version than the manifest ships. The
  hash covers the body alone, so editing the repository copy's own revision
  header never reports a false drift.
- **Not checked automatically:** that the public page still exists and still
  carries that text. Nothing here reaches the network. It is checked by hand at
  packaging time, and the first check found the lost formatting.

**Evidence.** `tests/unit/public-privacy-policy.test.ts`: the derivation drops
both internal parts and keeps the rest; a matching record is silent; an edited
policy, a version bump and a missing record are each reported.

**Published 2026-09-16:** https://gist.github.com/yayamossmemory-dot/afcd9e4bd6233defe18f78d305dd987a

## Addendum G — The Owner's Listing Decisions (2026-09-16)

**Status:** Recorded from the owner's answers on 2026-09-16, when the listing
text was read for submission.

| Item | Decision |
| --- | --- |
| Short description | **The shipped manifest text stands**, in both languages: "Field-aware plain-text templates with explicit user control." and "为每个输入框准备好的纯文本模版，插入与否始终由你决定。" The 119-character draft under "Draft Store Metadata" above was never applied to the manifest and is superseded; what the store shows is the manifest's `description`, so that is the one that matters. Its "local only, nothing leaves your browser" point is already made in the detailed description |
| Detailed description | Approved unchanged, as drafted in Addendum B |
| Chinese detailed description | **Written**, and kept outside this repository with the rest of the Chinese listing text, as Addendum B set out. The store's detailed description is per-language and is not translated for you |
| Category | `Productivity` |
| Languages | English and Simplified Chinese |
| Privacy policy URL | The Gist published on 2026-09-16 (Addendum F) |

The single purpose statement and the permission justifications are unchanged,
and are not per-language: one English set covers the listing.

**Still the owner's, and all that now blocks submission:** the screenshots
(1280x800) and the 440x280 promo tile. `npm run verify:store` lists them.

## Addendum H — The Listing's Pictures (2026-09-16)

**Status:** Implemented on 2026-09-16 at the owner's request, after two rounds
of the owner's own manual shots showed what the page was doing wrong. The
owner accepted the five images the same day.

- **A page of FillNest's own**, `demo/screenshot-form.html`: the mark, the
  tagline from the catalogue, three claims from the approved listing text, and
  two Fields to open the Picker on. It does two jobs - it is the site the
  product would have, and it is the form in the pictures - and the templates
  put in it describe the extension, so a picture of the Picker also reads as a
  sentence about it. Warm paper against FillNest's cool blue-grey, the brand
  red in the mark and nowhere else, and the column held left of centre: the
  page is in the shot without competing for it.
- **`npm run shots:store`** (`tests/e2e/store-screenshots.spec.ts`, opt-in,
  skipped in the ordinary suite) writes five 1280x800 PNGs: the Picker on a
  Field, the same panel a click later with the text inserted, the library and
  Settings composed into the side panel's real dock, and the Popup over the
  page. It drives `dist-e2e` for the reason Task 030 records - Playwright
  cannot click inside a closed Shadow Root - and the two builds differ in that
  flag alone.
- **Three things the pictures needed that the product decides**, not the
  camera: the Picker sorts templates alphabetically, so the three lines are
  written to be read in that order; a fourth line makes the panel taller than
  its own maximum and cuts `New template` in half; and the Picker is kept open
  at a set position (Task 038's own feature) because, left against a Field low
  on the page, it opens hard against the top edge.
- **A reserved hostname.** The fixture is served as `fillnest.test` through
  Chrome's host resolver, so the Popup names a site instead of a loopback
  port, without the listing implying a domain FillNest does not own. `.test`
  is reserved by the IANA and can belong to nobody.
  `launchWithPermissionHistory` grew an `extraArgs` option for this; every
  other spec launches exactly as before.
- **`npm run verify:store` now reads `output/`** for screenshots at an
  accepted size and for the 440x280 promo tile, instead of stating that they
  are missing (`scripts/lib/png-size.mjs`, `tests/unit/png-size.test.ts`).
- **The small promo tile** is drawn by the same script. A tile is a card in a
  category or a collection, seen small and glanced at, so it carries the mark,
  the name, the tagline, and a diagram - a field, and a panel of lines beside
  it - simplified until it still reads at half the size. A screenshot shrunk
  to 440x280 is mud, which is why the store asks for artwork here and
  screenshots on the listing page. The owner chose the diagram on ink
  (2026-09-16); the two it beat - the mark alone, and the same diagram in the
  page's warm light - are kept in `output/promo/alternates`, where
  `verify:store` does not read, so the directory it does read holds exactly
  the tile to upload.

**Nothing of the listing's artwork is outstanding.** What remains before
submission is the package (`npm run package`), the upload, and the forms.

## Addendum I — The Submission Consistency Check (2026-09-16)

**Status:** Run at `v0.2.0` (merge commit `51e0ecf`, pushed), against the
package that would be uploaded rather than against the sources it came from.
A listing is refused when three things disagree - what the published policy
says, what the manifest asks for, and what the console's forms declare - so
they are checked against each other once, here, before anything is uploaded.

**The package.** `output/fillnest-0.2.0.zip`, 25 files, 254 KB, SHA-256
`8150dde948a694f3b5abfc839ce9055827479572778a8fefd333e31693afdcd5`.
Rebuild and this changes; the checksum is recorded so the artefact uploaded
can be identified, not to freeze it.

| Manifest (read from inside the zip) | What the published policy says | What the console is told |
| --- | --- | --- |
| `storage` | "Everything is kept in `chrome.storage.local` on your own device" | The library, Field relationships and settings are local; nothing is sent |
| `tabs` | "It reads the address of the tab you are looking at... It reads no other tab's address" | Only the current tab's address, to offer to enable itself there |
| `scripting` | "You authorize one Origin at a time" | Registered at runtime per authorized origin, never `<all_urls>` at install |
| `sidePanel` | not named: it carries no data claim | The management surface |
| `optional_host_permissions` `http://*/*`, `https://*/*` | "It requests no site access at install... and can revoke each one" | Granted one exact origin at a time, revocable |

**What the package itself shows**, each one a claim the policy makes:

- No `host_permissions`: nothing is granted at install.
- No `web_accessible_resources`: the extension exposes no probe for itself.
- The only URLs inside the built files are `http://www.w3.org/2000/svg` and
  `.../1999/xhtml` - namespace strings in Preact's own code, not requests.
- The only address is `fillnest.feedback@gmail.com`, the one the policy names.
- The published Gist, read back through the GitHub API, is byte-identical to
  what `npm run policy:public` derives from `docs/privacy-policy.md`.
- `npm run verify:store`: nothing blocking.

**The one asymmetry, stated rather than smoothed over:** the policy describes
behaviour, not Chrome's permission names, so `sidePanel` and `scripting` do
not appear in it by name. That is what a policy is for - it is read by people,
while the justifications are read by a reviewer - but if the review asks, the
table above is the answer.

**Not checked here:** that the listing's forms were filled in with this text.
Nobody but the owner can see the console.
