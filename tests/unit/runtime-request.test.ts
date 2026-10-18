import { describe, expect, it } from "vitest";
import { localizeFailure } from "../../src/ui/shared/runtime-request";

// Task 037 acceptance 6: a coded error is shown in the chosen language; an
// uncoded one is shown as the core wrote it.
describe("localizeFailure", () => {
  const zh = "zh-Hans" as const;
  const en = "en" as const;

  it("says a coded error in Chinese", () => {
    expect(localizeFailure({ ok: false, error: "This removal can no longer be undone.", errorCode: "stale-undo" }, zh)).toEqual({
      ok: false,
      error: "撤销失效：内容已发生变化。",
      errorCode: "stale-undo",
    });
  });

  it("keeps the core's own, more specific English", () => {
    const failure = { ok: false, error: "File content is not valid JSON.", errorCode: "backup-invalid" } as const;
    expect(localizeFailure(failure, en)).toEqual(failure);
  });

  it("gives the Field limit its number, from the core's constant", () => {
    const limit = localizeFailure({ ok: false, error: "This field already offers 20 Templates…", errorCode: "field-template-limit" }, zh);
    expect(limit).toEqual(expect.objectContaining({ error: "这个输入框已达到 20 个模版上限，请先从这个输入框移除一个，再添加新的。" }));
    const tooLong = localizeFailure({ ok: false, error: "This Template is too long…", errorCode: "template-too-long" }, zh);
    expect(tooLong).toEqual(expect.objectContaining({ error: "模版字数已达到上限。" }));
  });

  it("leaves an uncoded error, and a success, exactly as they came", () => {
    expect(localizeFailure({ ok: false, error: "Template not found: x" }, zh)).toEqual({ ok: false, error: "Template not found: x" });
    expect(localizeFailure({ ok: true, value: true }, zh)).toEqual({ ok: true, value: true });
  });
});
