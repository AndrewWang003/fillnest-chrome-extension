---
status: accepted
---

# Use the Chrome Side Panel as the primary management surface

## Context

Task 001 contains a compact Extension Popup and a placeholder Options Page. The product needs a persistent but lightweight management surface that remains available when the active page has no FillNest Website Access. Maintaining both a complete Options Page and a complete Side Panel would duplicate navigation, state synchronization, accessibility work, and browser tests.

## Decision

The user selected Chrome's Side Panel as FillNest's primary management direction. The Extension Popup remains responsible for Global Activation, current Permission Origin Website Access, current Origin Activation, and opening FillNest. The Side Panel will provide Overview, Templates, Sites, and Settings through one shared shell and will display only destinations with real implemented behaviour.

Task 002 proposes adding the `sidePanel` manifest capability, setting `minimum_chrome_version` to `116` because `chrome.sidePanel.open()` is required, and removing the placeholder Options Page. This ADR records the selected direction but does not authorize implementation and does not yet supersede ADR 0001's implemented baseline.

## Alternatives Considered

- Keep a complete standalone Options Page: rejected as the primary direction because it feels heavier and separates management from the browsing context.
- Maintain complete Side Panel and Options Page interfaces: rejected because duplicated behaviour and state would increase user and engineering complexity.
- Add empty future Side Panel destinations: rejected because placeholder navigation misrepresents available functionality.

## Consequences

- Task 002 must prove Side Panel opening from a user gesture, Chrome 116+ manifest enforcement, multi-interface state consistency, and useful real content without current-page Website Access.
- There is no runtime fallback to an Options Page in the proposed contract.
- Toolbar, page status, and field Picker icons remain independent replaceable local assets; final artwork is outside this decision.
- If implementation evidence fails, Task 002 stops for review instead of upgrading the Approved Technical Baseline.

## Validation Boundary

This ADR may become `accepted` and supersede only ADR 0001's Options Page UI choice after Task 002 is explicitly authorized, implemented, passes its build and browser evidence, and completes Spec and Project Standards review. Until then, ADR 0001 describes the implemented technical baseline.

**Status update (Task 022, 2026-09-01):** all conditions above are met. Task
002 is complete and accepted per `tasks/002-interaction-surfaces-and-navigation.md`,
whose Slice 4 (`sidePanel` manifest capability, Chrome 116 minimum, Options
Page removal) and Slice 6 (Spec and Project Standards review) are both
recorded `Completed`. This ADR now supersedes ADR 0001's Options Page UI
choice; ADR 0001 continues to describe the rest of the implemented baseline.
