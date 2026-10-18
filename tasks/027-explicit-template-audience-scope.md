# Task 027 — Explicit Template Audience Scope

**Version:** `0.1.2 Task 18`  
**Status:** **Complete and accepted by the project owner on 2026-09-07**, after
hands-on QA of the repaired build covering audience icons, the
`Share this version` promotion path and its confirmation, and cross-tab
convergence. See `DEVELOPMENT.md`'s 2026-09-06 Task 027 entry for the
implementation evidence and the 2026-09-07 entries for Addenda C, D, E and E.1.  
**Prerequisites:** Tasks 021 and 026 are accepted. Task 024's explicit
cross-Site Shared Template Set linking and merge behaviour remains a required
compatibility boundary.

## Goal

Make the audience of every new Template relationship explicit. A Template
created, saved, or bound for one Field must never become visible to additional
Fields merely because Shared Set membership changes. Users may deliberately
broaden that relationship with a clearly scoped action.

## User Value

Users can safely keep a Field-specific version while continuing to use Shared
Template Sets. They can later share the exact version they chose without
copying content or accidentally exposing it through a Set join, merge, move,
restore, or cross-Site operation.

## Confirmed Product Decisions

- A Template is reusable content, not a globally `field-only` or `shared`
  object. Audience and visibility belong to the specific Binding or Shared
  Template Slot relationship that supplies that Template to a Field.
- A **Field-only relationship** has one owner Field. Its audience is permanent
  in the following sense: environment or membership changes must never expand
  it. It may be expanded only by an explicit action by its owner.
- Creating a new Template with `Save for this field`, and choosing `Bind to
  this field` from a Shared Set member, creates a Field-only relationship for
  the Current Field. It does not create a template-wide restriction on other
  independently established relationships for the same Template.
- A Field-only relationship is invisible to all non-owner Fields: it does not
  appear in their Picker or Side Panel effective lists, Search, Finder,
  recommendations, or Bind actions. Its owner continues to see, edit, use,
  and explicitly share it normally.
- `Share this version` is the sole action that broadens a Field-only
  relationship. It promotes the relationship, not the Template entity, to a
  normal Shared Template Slot.
- A normal shared Template is shared within exactly one Shared Template Set.
  `Share this version` may promote into its owner's current Set or create a
  new Set from explicitly selected unshared Fields. It must not create a
  cross-Set, Template-specific sharing relationship.
- When a requested target belongs to a different existing Set, the UI may
  offer one explicit composite action: `Join Set & Share` or `Merge Sets &
  Share`. Before confirmation it states both the Set membership change and
  that all ordinary shared Templates from the Sets will become available in
  the resulting Set. It must never join or merge Sets silently.
- When its owner stops sharing, moves to another Set, or its source Set ends,
  a Field-only relationship becomes a direct Binding for that owner only. It
  never becomes visible to former, destination, or newly joined members.
- Existing pre-Task-027 data is not inferred or migrated into Field-only
  relationships. It keeps its existing exclusion semantics. This is an
  intentional testing-period compatibility decision, not a permanent archive
  migration policy.
- In a Shared Set member's Search results, the ambiguous `Bind` action is
  replaced by `Bind to this field` and `Bind to Shared Set`. A Field outside a
  Set presents only `Bind to this field`.

## Scope And Data Semantics

### Field-only Slot Policy

- A Shared Template Slot or equivalent Field relationship stores an explicit
  owner-only visibility policy and owner Field identity. It is validated as a
  relationship property; no Template record gains a global audience field.
- The effective-template resolver must apply that policy before inherited,
  Override, and Exclusion resolution. Only the owner can receive the
  owner-only slot. An owner Override or Exclusion remains separately scoped
  to its slot as defined by Task 026.
- Add-member, move-member, merge, cross-Site merge, split, unlink, restore,
  and undo operations must preserve the policy and must not broaden its
  audience. Any operation that cannot preserve it must reject atomically.
- Promotion through `Share this version` converts (or atomically replaces) the
  owner-only relationship with a normal shared Slot and preserves the selected
  Template content. The owner and the explicitly confirmed Set members then
  receive that normal slot under ordinary Set rules.

### Explicit Scope UI

- Scope-changing actions state the affected Field or Set and member count
  before mutation. No scope-broadening choice is selected by default.
- `Bind to this field` and `Bind to Shared Set` use the same terms and scope
  model as `Save for this field` and `Save for shared fields`.
- `Share this version` is written as an audience action, never as “make this a
  normal Template.” The UI may lightly explain, after a Field joins a Set,
  that its Field-only Templates remain exclusive; it must not block the join.
- Composite Join/Merge-and-share confirmation is one atomic user operation
  with one coherent outcome and one Undo entry. It is not a hidden side effect
  of selecting a Field.

### Recovery, Archive, And Compatibility

- Schema and backup archives add the owner-only relationship policy
  additively. New data is fully validated for owner membership, Slot and
  Template references, contradictory states, and duplicate relationships.
- Backup/Restore, deletion impact, usage accounting, stale Undo invalidation,
  and Set cleanup retain or reject the policy deterministically. A Restore or
  membership operation may not broaden an owner-only audience.
- No best-effort conversion of old all-excluded-but-one slots is performed in
  this Task. New policy data round-trips through Backup/Restore; old archives
  retain their prior behaviour.

## Explicit Non-Goals

- A global Template `field-only` flag or a globally restricted Template type.
- Cross-Set sharing for one Template without an explicit Set join or merge.
- Silent scope expansion, silent Set join, silent Set merge, or automatic
  semantic matching.
- Git-style history, branches, diffs, conflict resolution, accounts, sync,
  remote services, or multi-Field filling.
- Retrospective interpretation or migration of test-period legacy exclusions.

## Acceptance Criteria

1. Given owner A has a Field-only relationship for Template T, adding,
   moving, merging, splitting, unlinking, restoring, or cross-Site merging
   Sets never makes T visible to B, C, or any later member without A's
   explicit scope-broadening action.
2. Given A owns T and leaves or moves from a Set, A retains T as a direct
   Binding and no other Field receives T through that transition.
3. Given A explicitly chooses `Share this version` for a current Set, the
   confirmed Set members receive T as a normal shared Slot; no unrelated Set
   is affected.
4. Given a selected target is in a different Set, no change occurs until the
   user explicitly confirms the described Join/Merge-and-share operation.
   Confirmation atomically performs exactly the stated Set change and
   promotion; Undo restores every pre-operation relationship.
5. A Shared Set member's Search presents unambiguous `Bind to this field` and
   `Bind to Shared Set` choices. The former never affects peers; the latter
   affects only the named Set after its explicit scope disclosure.
6. A Field-only relationship is not discoverable or bindable by non-owners,
   while an owner can use `Share this version` to widen its relationship.
7. Unit tests cover policy resolution, every membership mutation, direct and
   cross-Site merge, promotion, composite-operation Undo/staleness, backup
   validation/restore, Override/Exclusion coexistence, many-to-many Template
   reuse, and usage/deletion impact. Headed E2E covers both Bind scopes,
   owner-only persistence across membership changes, explicit promotion, and
   composite confirmation.
8. `npm run check`, the complete headed E2E suite, Task/Project Standards
   review, and hands-on QA pass before completion.

## Expected Implementation Slices

1. Schema/archive policy, validation, resolver, and unit coverage.
2. Atomic repository commands, existing membership operations, Undo, cleanup,
   usage/deletion, and recovery coverage.
3. Picker and Side Panel scope UI, Search Bind choices, Share-this-version,
   and accessible confirmations.
4. Cross-Site and composite-operation evidence, full E2E, review, and
   hands-on QA.

---

# Addendum A — Relationship-Targeted Remediation

**Status:** Complete and accepted with its parent Task on 2026-09-07, across
all four slices. Written after a second external audit of the
Task 027 implementation confirmed 10 further defects (A-J below), each
reproduced by an executable test. This addendum is a bounded repair of Task
027's own accepted scope; it adds no new product surface and no schema
field. One item in the Slice 4 table (the archive owner-membership check) was
found already correct against current code before any change - see the
2026-09-06 Addendum A entry in `DEVELOPMENT.md` for the full evidence and
this one deviation.

**Authorization note:** this is a plan, not permission to implement. The
implementing agent must confirm with the project owner that Addendum A is
accepted before editing, per the handoff guide's authorization stop rule.

## A.1 New Confirmed Product Decisions

The second audit surfaced one genuinely open question: may one Shared
Template Set hold both an ordinary slot and an owner-only slot for the same
Template? The project owner decided on 2026-09-06:

- **Coexistence is allowed.** A Set may hold any number of relationships to
  the same Template, at most one ordinary (ownerless) slot plus at most one
  owner-only slot per owner Field. The stored uniqueness invariant stays
  `setId:templateId:owner`.
- **The Resolver and every UI surface must collapse the relationships a
  single Field can see for one Template into a single visible item, while
  preserving relation provenance.** A Field never sees the same Template
  twice.
- **Every mutation command must target a specific relation, never a
  Template id.** Addressing a relationship by `templateId` alone is a defect
  class, not an implementation detail: it is the direct cause of findings A,
  B, F and J.
- **Only an explicit `Share this version` promotion may collapse an
  owner-only relationship into an existing ordinary slot.** Structural
  operations - Join, Merge, cross-Site Merge, Move, Add member, Restore -
  must never collapse, dedupe, or fold one relationship into another.

## A.2 Canonical Model The Repair Introduces

### Relation Reference

Every command that reads, edits, removes, or re-scopes one Template
relationship takes an explicit reference instead of a `templateId`:

```ts
type TemplateRelationRef =
  | { kind: "binding"; bindingId: string }
  | { kind: "slot"; setId: string; slotId: string }
  | { kind: "override"; setId: string; slotId: string; fieldProfileId: string };
```

A `templateId` remains a legitimate argument only where the operation
genuinely is Template-wide (delete, Site Affinity, library Search).

### Collapsed Effective Entry

`effectiveTemplateListForField` returns at most one entry per distinct
visible Template. Each entry carries its provenance:

```ts
interface EffectiveTemplateListEntry {
  templateId: string;
  usageCount: number;        // sum across contributing relations
  relations: TemplateRelationRef[];  // ordered, lowest slot `order` first
  slotId: string | null;     // retained: the primary relation's slot, for
                             // existing Task 026 callers
  isOverride: boolean;       // the primary relation is this Field's Override
  isFieldOnly: boolean;      // EVERY contributing relation is owner-only
}
```

Collapse rules, deterministic and order-independent:

- Contributing relations are those the Field may resolve after the owner-only
  policy and its own Override/Exclusion resolution - i.e. exactly today's
  per-slot output, grouped by resulting `templateId`.
- The **primary relation** is the contributing relation with the lowest slot
  `order`; it is what `slotId` and `isOverride` describe, and what a
  relation-unaware legacy caller acts on.
- `isFieldOnly` is `true` only when every contributing relation is an
  owner-only slot with no Override. If an ordinary slot also contributes, the
  Template is already visible to peers, so the item is not presented as
  Field-only and `Share this version` still applies (it collapses - see A.3).
- `usageCount` is the sum over contributing relations. Usage recording
  increments the primary relation only, so a collapse never double-counts.

## A.3 `Share this version` With Collapse

`promoteFieldOnlySlot` gains a second, explicitly-disclosed mode:

1. **No ordinary slot for that Template in the Set** - unchanged: clear
   `ownerFieldProfileId` on the slot in place. `previousOwnerFieldProfileId`
   drives Undo exactly as today.
2. **An ordinary slot for that Template already exists in the Set** - the
   promotion *consumes* the owner-only slot into it: add the owner-only
   slot's `usageCount` to the ordinary slot, delete the owner-only slot, and
   delete the owner's own Override/Exclusion rows keyed to the deleted slot.
   If the owner also held an Exclusion on the surviving ordinary slot, that
   Exclusion is removed too - the owner just asked for this Template to be
   shared, so it must be visible to the owner as well.

The result of both modes is a single ordinary slot and no duplicate pair, so
findings C and G cannot recur. The result shape gains `consumedSlot` and
`removedFieldStates` so `undoPromoteFieldOnlySlot` can restore the pre-
promotion state exactly, with a staleness check that rejects if the surviving
ordinary slot's `id/templateId/usageCount/revision/order/ownerFieldProfileId`
no longer matches what the promotion produced.

The confirmation copy must state which mode will run: mode 2 additionally
discloses that the Field's separate private version is being merged into the
Set's existing shared entry.

## A.4 Defect-By-Defect Fix Specification

Ordered by the slice that owns them. Every item is reproduced in
`tests/unit/task-027-remediation.test.ts` (see A.6) before it is fixed.

### Slice 1 - Resolver, relation references, and the Set-level edit path

| ID | Defect | Fix |
| --- | --- | --- |
| D | Merge leaves the owner resolving one Template twice; `slotIdForTemplateId` collapses them arbitrarily | Implement A.2 collapse in `effectiveTemplateListForField` and in `InlinePicker`'s local mirror (`effectiveEntries`). Replace `slotIdForTemplateId` and `fieldOnlyTemplateIds` with one relation-carrying entry list; every row action reads its own entry, never a Template-keyed map. |
| F | `Save for shared fields` on a Field-only relationship silently promotes it to the whole Set | Two changes. (a) `saveTemplateCopyForSharedSet` takes `{ setId, slotId, content }`, resolves the slot by id, and preserves `ownerFieldProfileId` by spreading the existing record instead of rebuilding it literal-by-literal. (b) `resolveTemplateEditScope` gains scope `"shared-field-only"`, returned when the Field's primary relation for that Template is an owner-only slot it owns and no ordinary slot also contributes. That scope offers a single `Save for this field` button, wired to the same command against the owner-only slot - never a Set-wide label. Both the Picker and `TemplatesPage` render it. |
| - | `resolveTemplateEditScope` counts owner-only slots the current Field cannot see as effective consumers | Exclude slots whose `ownerFieldProfileId` is neither undefined nor the current Field from `effectiveUseCount`. `resolveGlobalTemplateEditScope` keeps counting all relations - it is a Template-wide question. |

### Slice 2 - Membership and structural operations

| ID | Defect | Fix |
| --- | --- | --- |
| J | A joining Field's own Template is folded into another member's owner-only slot, so the joiner loses it | In `addSharedTemplateSetMember`, the snapshot dedupe must match ordinary slots only (`candidate.ownerFieldProfileId === undefined`). An owner-only slot for the same Template is a different relationship and must be left untouched; the joiner gets a new ordinary slot. |
| B | `Bind to Shared Set` silently no-ops when a peer owns a Field-only slot for that Template | In `bindTemplateShared`, the `existing` short-circuit must match ordinary slots only. If only owner-only slots exist, create the ordinary slot. |
| A | `unbindTemplateShared` deletes every slot for a Template, including a peer's owner-only slot | Take `{ setId, slotId }`. Update `UNBIND_TEMPLATE_SHARED` / `UNDO_UNBIND_TEMPLATE_SHARED` in `runtime-messages.ts` and the service-worker handler accordingly. Currently no UI dispatches it; the handler is still live, so it is fixed, not deleted. |
| E | End Set discards an owner-only slot whose owner had overridden it | `endSharedTemplateSet` must iterate the Set's owner-only **slots** and resolve each against its owner's own field state: Override -> convert the Override's Template, Exclusion -> convert nothing, otherwise convert the slot's base Template. It must not filter on `entry.isFieldOnly`, which the resolver deliberately sets to `false` for an Override. |
| - | `saveTemplateOverrideForField` has no owner-only guard | Permitted and unchanged - an owner may override its own private slot. Slice 1's `"shared-field-only"` scope means the Picker no longer routes there for a private relationship, but the command stays valid for Restore/Undo replay. Add an explicit unit test pinning the resolved behaviour. |

### Slice 3 - Site data operations

| ID | Defect | Fix |
| --- | --- | --- |
| H | Clear Site Data / Remove Site hands a departing owner's private Template to the sole survivor | In `resetSiteMappingsBatchUnlocked`, the survivor snapshot must skip every slot whose `ownerFieldProfileId` is set to a Field other than the survivor. A surviving owner's own owner-only slot still converts to its own direct Binding, matching `removeSharedTemplateSetMember`. |
| I | The `>= 2 members survive` branch leaves an orphaned owner-only slot and the whole operation throws `InvalidStoredDataError` | The same branch must drop every slot whose owner is among the removed members, mirroring `removeSharedTemplateSetMember`'s `removedOwnedSlots`. |
| - | `resetSiteMappingsBatchUnlocked` never prunes `sharedTemplateFieldStates` | Prune rows whose Set was removed or whose `fieldProfileId` was cleared. This is a pre-existing Task 026 gap surfaced by I; fix it here and record it as a Task 026 bounded repair in `DEVELOPMENT.md` rather than silently widening Task 027. |
| - | Merge grants owner-only Templates Site Affinity for every merged Site | Restrict the merge's affinity update to Templates reachable through an ordinary slot; an owner-only slot's Template gains only its owner's own Site. Organizational only, but it surfaces a private Template in an unrelated Site's library. |

### Slice 4 - Promotion, composites, and archive

| ID | Defect | Fix |
| --- | --- | --- |
| C | `Share this version` throws `InvalidStoredDataError` when the Set already shares that Template | Implement A.3 mode 2. |
| G | `Merge Sets & Share` throws outright when the other Set already shares that Template | Falls out of C: `mergeSetsAndShare` keeps its merge-then-promote order, the merge never collapses (per A.1), and the promotion collapses. `undoMergeSetsAndShare` reverses promotion first, then merge - unchanged order, but the promotion Undo now restores a consumed slot. |
| - | The archive validator checks `ownerFieldProfileId`'s shape but not owner membership | Add an owner-membership and slot-reference check to `archive-contract.ts` so a malformed archive fails with a descriptive `InvalidBackupArchiveError` at parse time, not a generic `InvalidStoredDataError` at restore commit. The contract's "New data is fully validated for owner membership" requires this. |

## A.5 Invariants The Repair Must Not Break

- No schema change. `schemaVersion` stays `10`; no migration, no new stored
  field. Every fix is behavioural.
- No pre-Task-027 data is reinterpreted (the contract's compatibility
  decision stands).
- Structural operations never collapse relationships (A.1).
- Every fix keeps its operation atomic: a rejected state must throw before
  any `commit()`, leaving no partial write.
- The content-script bundle must not gain a repository value import. The
  Picker keeps its local mirror of the resolver and imports types only; the
  build-inspection step in `npm run check` guards the size.

## A.6 Required Coverage

Add `tests/unit/task-027-remediation.test.ts` containing one failing-first
regression per lettered defect. The second audit's reproductions are
available and should be adopted as the starting point:

- A: an ordinary unbind leaves a peer's owner-only slot intact.
- B: `Bind to Shared Set` makes the Template effective for a peer even when
  another member owns a Field-only slot for it.
- C: promotion into a Set that already shares the Template succeeds and
  yields exactly one ordinary slot with the summed usage count.
- D: after a merge, the owner's effective list contains the Template once,
  with both relations recorded in `relations`.
- E: End Set converts an overridden owner-only slot to the Override's
  Template as a direct Binding for the owner alone.
- F: `Save for shared fields` is not offered for a private relationship, and
  the Set-level copy command preserves `ownerFieldProfileId`.
- G: `Merge Sets & Share` succeeds against a Set that already shares the
  Template, and its Undo restores both pre-merge Sets and the consumed slot.
- H: clearing the owner's Site leaves the survivor without the private
  Template.
- I: clearing the owner's Site with 2+ survivors succeeds and leaves no
  orphaned slot or field state.
- J: a joining Field keeps its own Template as a new ordinary slot.

Plus: a collapse-provenance test (one ordinary + one owner-only relation for
one Template resolves to one entry with two `relations`, `isFieldOnly`
false), and a promotion-Undo-after-collapse staleness test.

Extend `tests/e2e/explicit-template-audience-scope.spec.ts` with headed
coverage for the two `Share this version` modes and their confirmation copy.

## A.7 Slice Exit Evidence

Per the handoff guide, each slice records its own evidence before the next
begins:

```sh
npm run typecheck
npm test
npm run check
npm run test:e2e
```

Slices 1-3 require `npm run check`. Slice 4 requires the full headed
Playwright suite in addition, and a `DEVELOPMENT.md` entry naming every fixed
defect, the Task 026 bounded repair in Slice 3, and the remaining hands-on QA
gate. The known pre-existing, unrelated `find-similar-field.spec.ts` failure
stays recorded as such; it must not be repaired inside this addendum.

## A.8 Third-Audit Follow-Ups (2026-09-06)

A third audit, focused on the Bind and Share commands, ran after Addendum A
landed. Its five findings are fixed; they are recorded here because two of
them settle product questions A.1-A.3 left open.

- **K** `Bind to this field` is idempotent for the same relationship, matching
  `Bind to Shared Set`. A different owner's own Field-only relationship to the
  same Template is still a distinct relationship (A.1) and creates its own
  slot.
- **L** Undo-staleness comparisons over a Set's slots are order-insensitive
  (`sameSharedBindings`). An A.3 mode 2 promotion Undo reinstates the consumed
  slot by appending it, so an order-sensitive check made `Join Set & Share`
  permanently un-undoable whenever the joiner brought the same Template
  (acceptance 4). A genuine change - including a bare promotion - is still
  rejected.
- **Owner assertion.** `promoteFieldOnlySlot`, `joinSetAndShare` and
  `mergeSetsAndShare` take the acting `fieldProfileId` and assert it owns the
  named slot. "Expanded only by an explicit action by its owner" is a
  repository invariant, not a UI convention.
- **Dangling private slot (new product decision).** When a Set holds both an
  ordinary slot and a Field's own private slot for one Template, the collapsed
  entry is not private (`isFieldOnly: false`) but the Field still holds a
  private relation underneath it. The resolver exposes that relation as
  `fieldOnlySlotId`, and `Share this version` is offered - and targeted - for
  exactly those, running the A.3 mode 2 cleanup collapse. The resolver never
  auto-collapses: A.1's "only `Share this version` may collapse" stays
  literally true, and the owner keeps a way to reach an otherwise unreachable
  relationship.
- **Pre-mutation scope disclosure (new product decision).** `Share this
  version` confirms before mutating on both surfaces, naming the Set and its
  member count, and in mode 2 stating that the Field's separate private
  version will be merged into the Set's existing shared entry. This applies
  the contract's Explicit Scope UI rule to the same-Set share, not only to the
  composite Join/Merge actions. The confirm control is `Share with the Set`,
  distinct from the row's `Share this version` trigger.

Evidence: `npm run check` (49 files, 616 unit tests, typecheck, build) and the
complete headed Playwright suite, 41/41 passing, no skips. A stale
`Save a copy for shared fields` assertion in
`tests/e2e/find-similar-field.spec.ts` - the button Task 026 renamed to
`Save for shared fields` - was the previously recorded "known pre-existing
failure"; corrected here, it was a test defect, not a product one.

---

# Addendum B — Bind/Share Integrity Remediation

**Contract:** Accepted by the project owner on 2026-09-06.
**Execution:** Authorized by the project owner on 2026-09-06.
**Acceptance:** Pending implementation evidence, independent review, and the
project owner's hands-on QA.

This addendum is a bounded repair of Task 027 following the owner-requested
Bind/Share audit. It adds no new product capability and changes no approved
technical baseline.

## B.1 Required Repairs

- Search and Finder must not disclose a Template to a non-owner when its only
  live provenance is another Field's owner-only relationship. Independently
  public provenance for the same reusable Template remains discoverable.
- `Bind to Shared Set` must disclose the named Set and member count before
  mutation. Rebinding an existing ordinary slot must never manufacture an Undo
  that can delete the pre-existing shared relationship; when the current Field
  excluded that slot, the explicit Bind restores that Field's access and Undo
  restores the Exclusion.
- Join/Merge-and-share must be reachable from the approved Picker flow, use one
  explicit confirmation, commit once, and expose one exact stale-safe Undo.
- Repository composites and their Undo operations must calculate complete next
  state before one validated persistence write. No failure may leave a member
  added, Sets merged, or a promotion half-undone.
- Insertion usage must increment exactly the collapsed entry's primary
  relation. It must never increment an invisible peer-owned relation or more
  than one relation.
- A visible Override of an owner-only slot remains explicitly shareable. The
  promoted relationship uses the visible Override Template and removes only
  state rows the confirmed promotion semantically consumes.
- Every relation-scoped mutation and Undo must carry or validate exact relation
  identity and expected state. Mode-specific Undo payloads use a discriminated
  shape; stale cross-surface operations fail closed.
- Owner-only Set-level edits and structural membership operations must not add
  unrelated member Site Affinity. Promotion to an ordinary shared slot adds the
  ordinary Set-wide Site Affinity at that explicit boundary.
- Unbinding a shared slot removes and restores its dependent Field States as
  part of the same exact Undo unit.

## B.2 Required Evidence

- Failing-first unit regressions for every B.1 item, including Exclusion rebind,
  cross-surface stale Undo, private Override promotion, usage provenance,
  composite second-step failure, and owner-only discovery/affinity isolation.
- Component coverage for Picker and Side Panel confirmation copy, busy state,
  relation targeting, Search/Finder privacy, and composite dispatch.
- Headed E2E for private non-owner discovery denial, Bind-to-Set confirmation,
  private Override promotion, and Join/Merge-and-share confirmation plus Undo.
- `npm run check`, the complete headed E2E suite, Task/Project Standards review,
  and hands-on QA before final acceptance.

## B.3 Current Implementation Boundary

As of 2026-09-06, the repository-side repairs in B.1 are implemented and
covered by focused regressions, `npm run check`, and the existing headed Task
027 E2E flows. The cross-Set/unshared `Join Set & Share` and `Merge Sets &
Share` commands are atomic and Undoable at the repository/message layer, but
the Picker has no user-facing entry point that selects a target Field and
dispatches those composite commands. This is an explicit remaining item, not
an accepted omission. Addendum B remains **Acceptance: pending** until the
Picker confirmation/busy flow and headed E2E coverage for those composites are
implemented.

---

# Addendum C — Hands-On QA Remediation

**Status:** Complete on 2026-09-07. C.1, C.2, C.3 and C.5 implemented with
evidence; C.4 answered with no change needed. See `DEVELOPMENT.md`.
**Source:** The owner's QA run against a real profile on
`localhost:8000/static/123/…`, plus verification of each report against the
code.

## QA Findings And Their Disposition

| # | Report | Verified | Disposition |
| --- | --- | --- | --- |
| 2 | `Field Profile not found in this Site` when sharing from a Set that already spans two Sites; `Share` does nothing, `Cancel` surfaces the error | Confirmed, root cause found | Fix - C.1 |
| 6 | A's private Template reaches B after Stop sharing and then sharing again | Confirmed by probe | Fix - C.2 |
| 5 | A Field on the current page cannot be found through `Share with a different field…` | Confirmed, root cause found | Fix - C.3 |
| 3 | Clearing Site data appeared to delete Templates | **Not a defect.** Probe confirms Template records survive with empty Site Affinity, i.e. they become Global. A Site filter cannot show them; the Global view does. | No change |
| 1 | An unshared Field may need its own `Save this field only` choice | See C.4 | Answer, no change expected |
| 7 | Confirmation copy | Owner found it acceptable; re-reviewed under C.5 | Review |

## C.1 — Cross-Site check uses the Set's anchor, not its actual Sites

`addSharedTemplateSetMember` rejects with `Field Profile not found in this
Site` when `resolved.page.siteId !== set.siteId`. That compares the joining
Field's Site against the Set's **anchor** `siteId`, which never changes. The
Picker meanwhile computes `crossSite` as `candidate.siteId !== currentSiteId`,
relative to the **current Field's** Site. Two different reference points.

Once a Set spans two Sites (Task 024 linking or a cross-Site merge), acting
from a Field that is not on the anchor Site makes every same-Site candidate
look cross-Site to the repository while the Picker sends no opt-in, so the
operation throws.

`allowCrossSite` exists to require an explicit opt-in when an operation
**expands** a Set to a new Site. Joining a Site the Set already covers expands
nothing. The check therefore compares against the Set's actual member Sites
(`memberSiteIdsForSharedSet`), not its anchor.

## C.2 — A Field-only relationship loses its privacy at the Set boundary

Confirmed by probe: with A holding a Field-only Template T, Stop sharing
converts T into a plain direct Binding for A (correct, and required by this
contract). But that Binding is then indistinguishable from any other, so the
next `createSharedTemplateSet` or `addSharedTemplateSetMember` unions it into
the new Set's shared list and B receives T.

This contradicts this contract's own rule that a Field-only relationship's
audience "is permanent in the following sense: environment or membership
changes must never expand it". Leaving a Set and later sharing again is exactly
such a sequence, and the user never chose to widen T.

The privacy has to survive the conversion, so `BindingRecord` gains an optional
`privateToField` marker, set when a Field-only Slot converts to a Binding
(departure, Move, End Set, Site cleanup). Schema `10 → 11`, additive: an
existing Binding simply has no marker and behaves exactly as today.

- `createSharedTemplateSet` and `addSharedTemplateSetMember` convert a marked
  Binding into an **owner-only Slot** for that Field, never an ordinary one.
- `Share this version` clears the marker, since that is the one action allowed
  to widen the audience.
- Backup/Restore round-trips the marker; deletion, Undo, and usage accounting
  ignore it.

## C.3 — The current page's Fields vanish from the Finder when searching

`In this page` is the only surface that lists the current page's own Fields,
and it is rendered only while the Search box is empty. Search results come from
`findSimilarFieldCandidates`, which by Task 024's accepted rule skips any Field
with an empty effective Template list. A Field on the current page that has no
Templates yet is therefore reachable only by browsing, and typing its name
hides it.

`In this page` stays visible while a query is present, filtered by that query.
Task 024's discovery rule is untouched: Search still does not discover an empty
Field on another page.

## C.4 — An unshared Field's `Save` is already field-only

No change expected. For a Field that belongs to no Set, `Save` creates a
Template bound to that Field alone; there is no second audience to choose
between, so a `Save this field only` option would name the only behaviour that
exists. The Set-member case is the one that needs two labels, and it has them.
To be confirmed against the Picker during implementation and reported either
way.

## C.5 — Confirmation copy review

Re-read every confirmation that changes an audience or a Set's membership,
against one test: can the reader state who will see what, before clicking?
Report findings; change copy only where that test fails.

## Explicit Non-Goals

- Task 024's discovery rule, ranking, or the `No` pair decision.
- Any Template-level audience flag (this contract's existing Non-Goal).
- The Inline Picker isolation model (Task 030).

## Acceptance Criteria

1. Sharing from a Field on any Site of a multi-Site Set succeeds without an
   opt-in, and expanding a Set to a genuinely new Site still requires one.
2. After Stop sharing and then sharing again, B does not receive A's private
   Template. A still has it.
3. `Share this version` on a converted private Binding clears its marker, and
   the Template then behaves as an ordinary shared Template.
4. Schema 11 migrates additively; an existing Binding without the marker keeps
   today's behaviour, and Backup/Restore round-trips the marker.
5. A Field on the current page is reachable in the Finder while a Search query
   is present.
6. `npm run check` and the complete headed E2E suite pass.

---

# Addendum D — Field-Only Save Before A Field Is Shared

**Status:** Accepted and authorized on 2026-09-07 by the project owner.
**Owner:** Task 027. This is an audience decision, and the mechanism is the
`privateToField` marker Addendum C introduced.

## The Gap, And A Correction

Addendum C.4 concluded that an unshared Field needs no `Save this field only`
option, on the grounds that `Save` already binds to that Field alone and there
is no second audience to choose between.

**That reasoning was wrong.** It judged only the audience that exists at the
moment of saving. The audience that matters is the one that exists *later*: the
instant the Field joins a Shared Template Set, every ordinary Binding it holds
is unioned into the shared list. A user who saved something meant for this Field
alone has no way to say so beforehand, and discovers it was shared only after
sharing the Field.

That is the same boundary Addendum C.2 fixed for a Template that had *already*
been private inside a Set. This closes the other half: a Template that is
private from the start, before the Field has ever been shared.

## Confirmed Product Decisions

- A Field that belongs to no Shared Template Set may save a Template as
  private to itself. It is stored as an ordinary Binding carrying
  `privateToField`, so Addendum C.2's existing rules already keep it private
  through any Set the Field later joins.
- `Save` stays the default and stays unmarked. Most Templates on an unshared
  Field are ordinary, and Task 021/024's `Link templates` flow exists precisely
  to share them; making everything private by default would invert that.
- The private choice is the deliberate exception, so its label must state the
  *future* consequence, not the present one - at the moment of saving both
  choices look identical, because both are visible only to this Field.
- `Share this version` remains the only action that widens such a Template's
  audience, exactly as for a Field-only Slot inside a Set.

## Scope

- `CREATE_TEMPLATE_AND_BIND` gains an optional `privateToField` flag, set on
  the created Binding. No new command: the marker and every rule that respects
  it already exist.
- The Inline Picker's create form, for a Field in no Set, offers `Save` and
  `Save for this field only`. The Set-member case is unchanged - it already has
  `Save for shared fields` and `Save for this field`.
- The Undo for a private create is the ordinary create Undo; nothing about
  reversal changes.

## Explicit Non-Goals

- Changing what `Save` does for any existing Template or Binding.
- Marking anything retroactively. A Binding saved before this Addendum has no
  marker and behaves exactly as it does today.
- Extending the same choice to `Bind` for an existing Template found through
  Search on an unshared Field. That is the symmetric case and is worth doing,
  but it is a separate decision about a different action; recorded here as a
  follow-up rather than assumed.

## Acceptance Criteria

1. On a Field in no Set, `Save for this field only` creates a Binding carrying
   `privateToField`; `Save` creates one without it.
2. When that Field later joins or creates a Shared Template Set, the marked
   Template becomes that Field's own owner-only Slot and no other member
   resolves it, while the unmarked one is shared normally.
3. The labels distinguish the future consequence, since at save time both are
   visible only to this Field.
4. `npm run check` and the complete headed E2E suite pass.

---

# Addendum E — Distinct Bind Audience Icons (2026-09-07)

**Status:** Complete on 2026-09-07 under this addendum; final evidence is
recorded in `DEVELOPMENT.md`.
**Owner:** Task 027. The two actions and their distinct audience effects are
defined by this Task; this addendum changes presentation only.

## Reported Defect And Decision

In a Shared Template Set member's Search results, `Bind to this field` and
`Bind to Shared Set` have different explanations but currently render the same
Bind icon. The owner supplied `share-network.svg` for the one-to-many action.

- `Bind to this field` keeps the existing one-to-one Bind icon.
- `Bind to Shared Set` uses the supplied one-to-many network icon.
- The supplied SVG is stored with the existing source icon assets and inlined
  at build time. It must not add a public extension resource or
  `web_accessible_resources` entry.
- Both controls remain native buttons with their existing distinct accessible
  names and titles. The decorative SVG stays hidden from assistive technology;
  neither color nor the glyph alone carries the action's meaning.
- No command, confirmation, audience, search or binding behavior changes.

## Acceptance Criteria

1. The two simultaneous Bind actions use different icon components/assets,
   with `Bind to Shared Set` using the owner-supplied network glyph.
2. Tests assert the distinct accessible names and distinct icon asset markers.
3. The production build still declares no web-accessible resources.
4. Existing Task 027 behavior tests, `npm run check` and the complete headed
   E2E suite pass.

## Addendum E Evidence

`Bind to Shared Set` now uses the supplied inlined `share-network.svg`, while
`Bind to this field` retains the one-to-one plug icon. The focused Picker test
asserts distinct asset markers and the production build still exposes no
web-accessible resources. Final complete E2E: 45/45.

## Addendum E.1 — Promotion Must Not Reuse The Network Glyph (2026-09-07)

**Status:** Complete on 2026-09-07 under Addendum E; presentation only.

Addendum E's acceptance criteria were satisfied while a second icon collision
remained. `share-network.svg` is a three-node graph, and `ShareIcon` -
`Share this version` - was already drawing that same three-node graph as an
inline stroked SVG. The Picker renders the Shared Template Set list and the
Search results together, so a Set member that owns a Field-only relation and
then searches shows `Share this version` and `Bind to Shared Set` at the same
time, in different lists, under the same picture.

This is the defect Addendum E exists to remove, so criterion 1 was too narrow:
comparing asset identifiers proves two icons are different files, not that they
look different. `Bind to Shared Set` keeps the owner-supplied network glyph,
because it is the one-to-many action the owner described. Promotion moved to
its own metaphor - an arrow lifting this version up out of the Field - which is
also the only one of the three that is not a connection metaphor.

- `Bind to this field` - one-to-one - `plugs-connected.svg`.
- `Bind to Shared Set` - one-to-many - `share-network.svg`.
- `Share this version` - promotion - inline upward-arrow glyph.

The same `ShareIcon` renders the Side Panel's `Share this version`, so the two
surfaces stay consistent.

### Acceptance Criteria

1. No two audience commands that can appear in one Picker draw the same shape.
2. A test pins each of the three metaphors, including the shape rule that a
   purely textual asset comparison cannot express.
3. No command, confirmation, audience, search or binding behavior changes.

## Addendum F — Private Bindings Through A Second Set, And Confirmations That Follow Focus (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

- **Ending a second Set failed.** A Field holding a private Binding that joins
  a new Set brings it in as its own Field-only slot, and the dormant Binding
  stays. Ending that Set converted the slot again, gave the Field the same
  Template twice, and was refused by the integrity check. The conversion now
  skips a Template the owner already holds directly.
- **`Save for this field` made a private Template shareable.** The copy
  replaces the Field's Binding, and now takes over its `privateToField`.
- **A pending confirmation followed a pinned Picker.** A `Bind to Shared Set`
  confirmation opened for a Set member survived focus moving to another Field.
  It was still worded for the Set but bound the Template directly to the new
  Field. The per-Field reset now also clears `Share this version`, `Bind to
  Shared Set` and the share-target Finder.

The Restore that dropped `privateToField` is repaired under Task 006 Addendum
A; Clear Site Data's survivor under Task 026 Addendum A.

**Evidence.** `tests/unit/shared-set-audit-repairs.test.ts`,
`tests/unit/inline-picker-field-change.test.tsx`.
