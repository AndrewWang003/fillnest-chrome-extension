# FillNest Privacy Policy

**Draft, 2026-09-08; corrected 2026-09-11** against the code after the
pre-submission audit (Task 033 Addendum A), on 2026-09-12 so it no longer
reads as handling no data (Task 033 Addendum C), and on 2026-09-15 after a
further audit (Task 033 Addendum E, Task 039 Addendum A). Written from the
code rather than from intent; every claim below is checkable against the
sources named at the end.

This file is the source. The copy readers and the Chrome Web Store listing see
is derived from it by `npm run policy:public`, which drops this header and the
closing verification section; where it is published, for which version, is
recorded in `docs/privacy-policy-published.json`, and `npm run verify:store`
reports it when the two have drifted (Task 033 Addendum F).

## What FillNest Does

FillNest stores short plain-text templates and offers them next to a web form
field you have explicitly authorized, so you can insert one deliberately.

## What Leaves Your Device

Nothing. There is no server, no account, no analytics, and no telemetry. The
extension has no network capability of any kind: it makes no outbound requests,
loads no remote code, and contacts no service - including none operated by its
authors.

That is not the same as handling no data. FillNest does handle user data - the
templates you write, which fields and sites you use them on, and, only when you
choose, text from a field - and it handles it entirely on your device. The
sections below list each piece.

## What FillNest Stores, And Where

Everything is kept in `chrome.storage.local` on your own device:

- the text of the templates you write, including text you chose to save from a
  field with `Use current field content`;
- which fields you have bound a template to. A field is identified by a key
  derived from the page's own markup - its name, label or accessible name -
  and the address path of its page, with record numbers and advertising or
  analytics parameters removed. To list your fields by a name you recognize,
  FillNest also keeps the label or placeholder the page shows for that field -
  the label's own words, never the text of a field inside it. It never stores
  what you typed into a field;
- which sites you have authorized, and whether the extension is active there;
- your own labels for pages and fields, if you set any;
- for a rich text box whose editor refused an insertion, one yes/no fact, so
  FillNest can offer to copy the template instead next time;
- your preferences: the interface language, the theme and light/dark mode you
  chose, where you dragged the Picker and the page status control, and which
  getting-started tips you have dismissed.

This data never leaves your browser. Uninstalling the extension removes it, and
`Settings → Reset FillNest` removes it on demand. Backup exports your
templates, sites, labels, settings and the Picker and page status positions as
a file you control; the language, the theme and the dismissed tips are specific
to this browser and are not included.

## How This Data Is Used

Only to provide FillNest's single purpose: offering your templates next to the
fields you authorized, and inserting the one you choose. FillNest does not
sell this data, does not transfer it to anyone, does not use it for
advertising, creditworthiness or any purpose unrelated to that one, and no
person reads it. Its use of this data complies with the Chrome Web Store User
Data Policy, including the Limited Use requirements.

## What FillNest Does Not Read

- It requests no site access at install. You authorize one Origin at a time,
  and can revoke each one.
- It does not read the value of a form field unless you explicitly choose
  `Use current field content`, or open the Picker with a non-empty selection.
  In the second case the value is read only to show you what you selected and
  is never stored.
- One exception, narrow and stated: right after you insert a template into a
  rich text box (a `contenteditable` editor, such as a chat composer), FillNest
  reads that box's text once to check that the editor kept the insertion. Only
  the answer - kept or not - is used; the text is not stored or sent anywhere.
  Ordinary form fields are never read this way.
- It reads the address of the tab you are looking at, so it can offer to
  enable itself there, and the addresses of tabs on sites you have already
  authorized, so an open page stays up to date when you change something. It
  reads no other tab's address and no page content beyond the field you use.
- Fields it classifies as sensitive - passwords, payment fields, one-time
  codes, and fields whose surrounding text indicates a national identity
  number - receive no value read, no fingerprint, no stored profile, no marker,
  no listener, no interface and no fill. The extension does not attach to them
  at all.
- It never fills a whole page, never replaces a field's contents on its own,
  and never submits a form.
- Template text is inserted as plain text. It is never treated as HTML and
  never executed.
- It writes to your clipboard only when you click one of its two copy
  buttons: the offer to copy a template, which copies only that template's
  text, and `Copy email` on Overview, which copies the feedback address. It
  never reads your clipboard.

## Contact

Questions about this policy, problems or ideas: fillnest.feedback@gmail.com.
The extension shows this address on its Overview page and can copy it; it never
sends anything itself.

## Changes

This policy describes the extension at the version it ships with. A version
that changes any of the above must change this document in the same release.

## How To Check These Claims

- No network capability: `tests/unit/runtime-network-allowlist.test.ts`, and
  the headed end-to-end suite, which fails on any request outside its own test
  fixture.
- No install-time site access: `public/manifest.json` declares
  `optional_host_permissions`, never `host_permissions`.
- No extension-presence probe: `scripts/lib/manifest-policy.mjs` fails a build
  that declares `web_accessible_resources`.
- Sensitive-field exclusion: `src/fields/field-eligibility.ts` and its tests.
- The one rich-text read after an insertion: `verifyInsertion` in
  `src/content/content-script.tsx`.
- Tab addresses: `broadcastToExtensionAndTabs` in
  `src/background/service-worker.ts`, and `listTabIds` in
  `src/platform/chrome-permission-platform.ts`, which activating and revoking
  access use, query only authorized sites' tabs;
  `tests/unit/service-worker-runtime.test.ts` and
  `tests/unit/permission-lifecycle.test.ts` assert it.
- Field labels never take in a field's content: `readLabelMetadataText` in
  `src/fields/dom-field.ts`, tested in `tests/unit/dom-recognition.test.ts`
  and `tests/unit/rich-text-field.test.ts`.
- The Picker's interface is isolated in a closed Shadow Root, enforced by
  `scripts/verify-build.mjs` and exercised against the shipped build by
  `tests/e2e/picker-isolation.spec.ts`.
