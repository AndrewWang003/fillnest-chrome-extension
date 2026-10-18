# Engineering Baseline

Status: Accepted

## Context

FillNest needs a small but real Manifest V3 foundation that can support three interactive surfaces, local business data, optional per-origin permissions, dynamic-page integration, and repeatable browser validation. The first task must reduce uncertainty without adopting a full extension framework or allowing every extension context to own persistence independently.

## Decision

Use npm with a committed lockfile, strict TypeScript, Vite with explicit extension entry points, and Preact for the Inline Picker, Popup, and Options Page. Use `tldts-icann` as an offline ICANN Public Suffix List implementation for registrable-domain Site identity; keep the parser in the service-worker business boundary rather than duplicating its data in the Content Script. Render host-page UI in an extension-owned Shadow Root. Store versioned business data in `chrome.storage.local` behind a Repository owned by the service worker, serialize Repository mutations within that authority, and connect extension contexts with typed internal messages. Use optional host permissions requested for a specific Permission Host Pattern after a user gesture. Register a persistent dynamic content script for each granted exact pattern so authorized reloads and returns activate automatically; use programmatic injection only to activate the already-open page immediately after a new grant. Listen to `permissions.onRemoved`, unregister affected scripts, and broadcast an origin-scoped teardown to already-injected tabs so external revocation stops current-page behaviour immediately. Validate pure and component behaviour with Vitest and built-extension behaviour with Playwright's bundled Chromium.

Repository and message contracts are stable, tested internal boundaries, not public APIs. They may evolve within an approved task when user-observable behaviour, persisted-data compatibility, and stable domain contracts remain intact.

## Consequences

- The extension must tolerate service-worker termination and keep durable state out of worker globals.
- Dynamic content-script registrations must be reconciled with Chrome-granted origins at service-worker startup and removed when access is disabled.
- External permission removal must be handled while injected pages are open; querying tab IDs and messaging existing content scripts does not require the broad `tabs` permission or access to sensitive tab properties.
- Content scripts cannot treat direct storage access as their business-data authority.
- Host-page scripts may inspect an open Shadow Root but cannot activate FillNest operations with untrusted synthetic events.
- Vite's MV3 output, Shadow Root focus and positioning, storage capacity, worker lifecycle, and Playwright extension support remain evidence-gated working hypotheses.
- Changes to this baseline require user approval and current implementation evidence.
- No `unlimitedStorage`, install-time host access, extension framework, IndexedDB, or generalized network capability is approved by this decision.

## Alternatives Considered

- Native DOM UI was rejected because the confirmed Picker and management flows require coordinated state across several interactive surfaces.
- React was rejected as heavier than needed; Preact retains the component model with a smaller runtime.
- WXT or Plasmo was deferred to avoid framework ownership of Manifest and lifecycle decisions before the basic Vite approach is tested.
- IndexedDB was deferred because representative V1 data is expected to fit `chrome.storage.local`; the Repository boundary preserves a migration path.
- Direct storage access from every extension context was rejected because it would duplicate validation, migration, and consistency responsibilities.
- Broad static content-script matches were rejected because they blur the exact-origin activation boundary. Programmatic-only injection was rejected because it would not automatically reactivate on authorized reloads and returns without additional tab orchestration.

## References

- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Chrome extension service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome content-script injection](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Playwright Chrome extension testing](https://playwright.dev/docs/chrome-extensions)
