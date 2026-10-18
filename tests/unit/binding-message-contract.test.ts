import { describe, expect, it } from "vitest";

import { isRuntimeRequest } from "../../src/messages/runtime-messages";
import type { BindingRecord } from "../../src/storage/records";

// Removing `BindingRecord.order` on 2026-09-08 left this guard still requiring
// it, so every Undo that carries a Binding back to the service worker was
// rejected before it reached a command. Nothing caught it: unit tests call the
// Repository directly and never cross the message boundary, and the failure was
// silent - the Undo simply did nothing. Only the headed suite noticed.
//
// This asserts the guard accepts the record shape the product actually
// produces, so the two cannot drift apart again.
describe("Binding-carrying runtime messages", () => {
  const binding: BindingRecord = {
    id: "binding-1",
    templateId: "template-1",
    pageProfileId: "page-1",
    fieldProfileId: "field-1",
    createdAt: "2026-09-08T00:00:00.000Z",
    usageCount: 0,
    revision: 0,
  };

  it("accepts a current BindingRecord", () => {
    expect(isRuntimeRequest({ type: "UNDO_UNBIND", binding })).toBe(true);
    expect(
      isRuntimeRequest({ type: "UNDO_SAVE_COPY_FOR_FIELD", copyTemplateId: "t", originalBinding: binding }),
    ).toBe(true);
  });

  it("accepts a Binding from an older build that still carries order", () => {
    expect(isRuntimeRequest({ type: "UNDO_UNBIND", binding: { ...binding, order: 0 } })).toBe(true);
  });

  it("still rejects a Binding missing a field the product does require", () => {
    const { revision: _revision, ...withoutRevision } = binding;
    expect(isRuntimeRequest({ type: "UNDO_UNBIND", binding: withoutRevision })).toBe(false);
  });
});
