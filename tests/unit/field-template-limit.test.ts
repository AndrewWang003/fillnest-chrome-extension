import { describe, expect, it } from "vitest";

import { createInitialFillNestState } from "../../src/storage/records";
import type { FillNestState } from "../../src/storage/records";
import {
  assertFieldCanTakeAnotherTemplate,
  assertSharedSetCanTakeAnotherTemplate,
  fieldTemplateCount,
  FIELD_TEMPLATE_COUNT_VISIBLE_FROM,
  FIELD_TEMPLATE_LIMIT_MESSAGE,
  MAX_TEMPLATES_PER_FIELD,
} from "../../src/templates/field-template-limit";

function stateWithDirectBindings(count: number): FillNestState {
  const base = createInitialFillNestState();
  return {
    ...base,
    bindings: Array.from({ length: count }, (_unused, index) => ({
      id: `binding-${index}`,
      templateId: `template-${index}`,
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      createdAt: "2026-09-08T00:00:00.000Z",
      usageCount: 0,
      revision: 0,
    })),
  };
}

function stateWithSharedSlots(count: number, members: string[]): FillNestState {
  const base = createInitialFillNestState();
  return {
    ...base,
    sharedTemplateSets: [
      { id: "set-1", siteId: "example.test", name: "Contact", memberFieldProfileIds: members },
    ],
    sharedTemplateBindings: Array.from({ length: count }, (_unused, index) => ({
      id: `slot-${index}`,
      setId: "set-1",
      templateId: `template-${index}`,
      order: index,
      createdAt: "2026-09-08T00:00:00.000Z",
      usageCount: 0,
      revision: 0,
    })),
  };
}

describe("Templates per Field (Task 035, R8 follow-up)", () => {
  it("counts what the Field actually offers, direct or inherited from its Set", () => {
    expect(fieldTemplateCount(stateWithDirectBindings(4), "field-1")).toBe(4);
    expect(fieldTemplateCount(stateWithSharedSlots(6, ["field-1", "field-2"]), "field-2")).toBe(6);
  });

  it("accepts up to the limit and refuses past it, with a sentence the user can act on", () => {
    const nearlyFull = stateWithDirectBindings(MAX_TEMPLATES_PER_FIELD - 1);
    expect(() => assertFieldCanTakeAnotherTemplate(nearlyFull, "field-1")).not.toThrow();

    const full = stateWithDirectBindings(MAX_TEMPLATES_PER_FIELD);
    expect(() => assertFieldCanTakeAnotherTemplate(full, "field-1")).toThrow(FIELD_TEMPLATE_LIMIT_MESSAGE);
    expect(FIELD_TEMPLATE_LIMIT_MESSAGE).toContain("20 Templates");
  });

  it("leaves a different Field alone when this one is full", () => {
    expect(() =>
      assertFieldCanTakeAnotherTemplate(stateWithDirectBindings(MAX_TEMPLATES_PER_FIELD), "field-2"),
    ).not.toThrow();
  });

  it("refuses a Set slot when ANY member is full, because a slot lands on every member at once", () => {
    const full = stateWithSharedSlots(MAX_TEMPLATES_PER_FIELD, ["field-1", "field-2"]);
    expect(() => assertSharedSetCanTakeAnotherTemplate(full, "set-1")).toThrow(/most FillNest keeps on one field/u);

    const roomLeft = stateWithSharedSlots(MAX_TEMPLATES_PER_FIELD - 1, ["field-1", "field-2"]);
    expect(() => assertSharedSetCanTakeAnotherTemplate(roomLeft, "set-1")).not.toThrow();
  });

  it("says nothing about a Set that does not exist, rather than inventing a refusal", () => {
    expect(() =>
      assertSharedSetCanTakeAnotherTemplate(createInitialFillNestState(), "set-missing"),
    ).not.toThrow();
  });

  it("shows the running count only from within five of the limit", () => {
    // Below that it is noise on a list whose length is visible at a glance;
    // above it, meeting the limit for the first time as a refusal would be a
    // surprise.
    expect(FIELD_TEMPLATE_COUNT_VISIBLE_FROM).toBe(MAX_TEMPLATES_PER_FIELD - 5);
  });

  it("holds the number the owner set for V1", () => {
    expect(MAX_TEMPLATES_PER_FIELD).toBe(20);
  });
});
