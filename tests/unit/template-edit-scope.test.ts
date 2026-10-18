import { describe, expect, it } from "vitest";

import { resolveGlobalTemplateEditScope, resolveTemplateEditScope } from "../../src/templates/template-edit-scope";
import type { FillNestState } from "../../src/storage/fillnest-repository";

const baseState: FillNestState = {
  schemaVersion: 13,
  sites: [{ id: "example.test" }],
  templates: [
    { id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
  ],
  pageProfiles: [{ id: "page-1", siteId: "example.test" }],
  fieldProfiles: [
    { id: "field-a", pageProfileId: "page-1" },
    { id: "field-b", pageProfileId: "page-1" },
  ],
  bindings: [],
  logicalPageSiteKeys: [],
  logicalPageRules: [],
  logicalPageProvenance: [],
  logicalPageObservations: [],
  sharedTemplateSets: [
    { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
  ],
  sharedTemplateBindings: [
    { id: "slot-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
  ],
  sharedTemplateFieldStates: [],
  compatibilityPairDecisions: [],
  pickerPosition: null,
  pageStatusPosition: null,
};

describe("resolveTemplateEditScope (Task 026)", () => {
  it("offers both shared scopes for a Field that plainly inherits a shared Template", () => {
    expect(resolveTemplateEditScope(baseState, baseState.templates[0]!, "field-a")).toBe("shared-inherited");
  });

  it("offers only 'single' for a Field editing its own Override used nowhere else", () => {
    const overrideTemplate = { id: "override-1", content: "A only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, overrideTemplate],
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "override", templateId: overrideTemplate.id, usageCount: 0, revision: 0 },
      ],
    };
    expect(resolveTemplateEditScope(state, overrideTemplate, "field-a")).toBe("single");
    // B still inherits the base slot untouched.
    expect(resolveTemplateEditScope(state, baseState.templates[0]!, "field-b")).toBe("shared-inherited");
  });

  it("switches an Override to 'everywhere-only' once it is also bound elsewhere", () => {
    const overrideTemplate = { id: "override-1", content: "A only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, overrideTemplate],
      fieldProfiles: [...baseState.fieldProfiles, { id: "field-c", pageProfileId: "page-1" }],
      bindings: [
        { id: "binding-c", templateId: overrideTemplate.id, pageProfileId: "page-1", fieldProfileId: "field-c", createdAt: "x", usageCount: 0, revision: 0},
      ],
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "override", templateId: overrideTemplate.id, usageCount: 0, revision: 0 },
      ],
    };
    expect(resolveTemplateEditScope(state, overrideTemplate, "field-a")).toBe("everywhere-only");
  });

  it("offers 'everywhere-only' for a Field that has excluded the slot (no current relationship)", () => {
    const state: FillNestState = {
      ...baseState,
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "exclude" },
      ],
    };
    expect(resolveTemplateEditScope(state, baseState.templates[0]!, "field-a")).toBe("everywhere-only");
  });

  it("a Template with one actual effective use scope shows one Save action even with multiple Site Affinities (acceptance 4)", () => {
    const template = { id: "template-2", content: "Solo", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, template],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      bindings: [
        { id: "binding-a", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0},
      ],
    };
    expect(resolveTemplateEditScope(state, template, "field-a")).toBe("single");
  });

  it("still offers plain 'single'/'field-copy' behavior for a Field outside any Shared Template Set", () => {
    const template = { id: "template-2", content: "Solo", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, template],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      bindings: [
        { id: "binding-a", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0},
        { id: "binding-c", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-c", createdAt: "x", usageCount: 0, revision: 0},
      ],
    };
    expect(resolveTemplateEditScope(state, template, "field-a")).toBe("field-copy");
    expect(resolveTemplateEditScope(state, template, "field-z-not-a-user")).toBe("everywhere-only");
  });
});

describe("resolveGlobalTemplateEditScope (Task 026: context-free Side Panel edits)", () => {
  it("is 'single' for a Template with exactly one effective direct Binding", () => {
    const template = { id: "template-2", content: "Solo", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, template],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      bindings: [
        { id: "binding-a", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0},
      ],
    };
    expect(resolveGlobalTemplateEditScope(state, template)).toBe("single");
  });

  it("is 'everywhere-only' for a Template with more than one effective consumer, ignoring Site Affinity count (acceptance 4)", () => {
    const template = {
      id: "template-2",
      content: "Solo",
      siteAffinities: ["example.test", "other.test"],
      createdAt: "x",
      updatedAt: "x",
      totalUsageCount: 0,
      revision: 0,
    };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, template],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      bindings: [
        { id: "binding-a", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0},
        { id: "binding-b", templateId: template.id, pageProfileId: "page-1", fieldProfileId: "field-b", createdAt: "x", usageCount: 0, revision: 0},
      ],
    };
    expect(resolveGlobalTemplateEditScope(state, template)).toBe("everywhere-only");
  });

  it("counts a Shared Template Set slot's base Template as one effective consumer, not per-member", () => {
    expect(resolveGlobalTemplateEditScope(baseState, baseState.templates[0]!)).toBe("single");
  });

  it("counts an Override as its own effective consumer in addition to the base slot", () => {
    const overrideTemplate = { id: "override-1", content: "A only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const state: FillNestState = {
      ...baseState,
      templates: [...baseState.templates, overrideTemplate],
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "override", templateId: overrideTemplate.id, usageCount: 0, revision: 0 },
      ],
    };
    expect(resolveGlobalTemplateEditScope(state, overrideTemplate)).toBe("single");
    expect(resolveGlobalTemplateEditScope(state, baseState.templates[0]!)).toBe("single");
  });
});
