// @vitest-environment happy-dom
//
// Task 027 Addendum F (2026-09-11 audit). A confirmation the Picker is
// waiting on belongs to the Field it was opened for. A pinned Picker follows
// focus to another Field, and a "Bind to Shared Set" confirmation opened for a
// Set member used to survive that move - still worded for the Set, but
// binding the Template directly to the new Field when confirmed.

import { render } from "preact";
import { afterEach, expect, it, vi } from "vitest";
import { createInitialFillNestState, FillNestRepository } from "../../src/storage/fillnest-repository";
import { InlinePicker } from "../../src/ui/picker/InlinePicker";
import type { RuntimeRequest } from "../../src/messages/runtime-messages";

const root = document.createElement("div");

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 50));
  vi.unstubAllGlobals();
});

it("drops a pending Bind to Shared Set when the Picker moves to another Field", async () => {
  let stored = createInitialFillNestState();
  const repository = new FillNestRepository({
    get: async () => ({ fillnestState: structuredClone(stored) }),
    set: async (items) => {
      stored = structuredClone(items.fillnestState as typeof stored);
    },
    remove: async () => undefined,
  });
  await repository.replaceState({
    ...stored,
    sites: [{ id: "example.test" }],
    pageProfiles: [{ id: "page", siteId: "example.test", identityKey: "/form" }],
    fieldProfiles: ["a", "b", "c"].map((id) => ({ id, pageProfileId: "page", identityKey: id })),
    templates: [
      {
        id: "found",
        content: "Found via search",
        siteAffinities: [],
        createdAt: "2026-09-11T00:00:00.000Z",
        updatedAt: "2026-09-11T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
    ],
    sharedTemplateSets: [{ id: "set", siteId: "example.test", name: "Pair", memberFieldProfileIds: ["a", "b"] }],
  });
  const sendMessage = vi.fn(async (request: RuntimeRequest) => {
    if (request.type === "GET_LANGUAGE") return { ok: true, value: "en" };
    return { ok: true, value: await repository.read() };
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  vi.stubGlobal("location", new URL("https://example.test/form"));

  const draw = (fieldProfileId: string) =>
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        siteId="example.test"
        pageProfileId="page"
        fieldProfileId={fieldProfileId}
        pageIdentityKey="/form"
        fieldIdentityKey={fieldProfileId}
        onInsert={() => undefined}
        onClose={() => undefined}
        pinned={true}
        onPinnedChange={() => undefined}
        pickerPosition={null}
        onPickerPositionChange={() => undefined}
        lastAction={null}
        onLastActionChange={() => undefined}
        targetFieldActionable={true}
        insertionRejected={false}
        insertionRejectionNotice={null}
        onCopyToClipboard={async () => true}
        bindingSupported={true}
      />,
      root,
    );

  draw("a");
  const search = await vi.waitFor(() => {
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!input) throw new Error("Picker not rendered yet");
    return input;
  });
  search.value = "Found";
  search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  const bindShared = await vi.waitFor(() => {
    const button = root.querySelector<HTMLButtonElement>('[aria-label="Bind to Shared Set"]');
    if (!button) throw new Error("Search result not rendered yet");
    return button;
  });
  bindShared.click();
  const confirmFor = () =>
    [...root.querySelectorAll("button")].find((button) => button.textContent === "Bind to Shared Set");
  await vi.waitFor(() => expect(confirmFor()).toBeDefined());

  draw("c");
  await new Promise((resolve) => setTimeout(resolve, 80));

  expect(confirmFor()).toBeUndefined();
  expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "BIND_TEMPLATE" }));
  expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "BIND_TEMPLATE_SHARED" }));
});

// Task 021 Addendum C: the header's sharing actions are icons whose name says
// what they do and whose explanation shows at once.
it("shows Leave sharing and Share with as named icon buttons with an explanation", async () => {
  let stored = createInitialFillNestState();
  const repository = new FillNestRepository({
    get: async () => ({ fillnestState: structuredClone(stored) }),
    set: async (items) => {
      stored = structuredClone(items.fillnestState as typeof stored);
    },
    remove: async () => undefined,
  });
  await repository.replaceState({
    ...stored,
    sites: [{ id: "example.test" }],
    pageProfiles: [{ id: "page", siteId: "example.test", identityKey: "/form" }],
    fieldProfiles: ["a", "b"].map((id) => ({ id, pageProfileId: "page", identityKey: id })),
    sharedTemplateSets: [{ id: "set", siteId: "example.test", name: "Pair", memberFieldProfileIds: ["a", "b"] }],
  });
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async (request: RuntimeRequest) =>
        request.type === "GET_LANGUAGE" ? { ok: true, value: "en" } : { ok: true, value: await repository.read() },
      ),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.stubGlobal("location", new URL("https://example.test/form"));
  render(
    <InlinePicker
      targetField={document.createElement("input")}
      siteId="example.test"
      pageProfileId="page"
      fieldProfileId="a"
      pageIdentityKey="/form"
      fieldIdentityKey="a"
      onInsert={() => undefined}
      onClose={() => undefined}
      pinned={false}
      onPinnedChange={() => undefined}
      pickerPosition={null}
      onPickerPositionChange={() => undefined}
      lastAction={null}
      onLastActionChange={() => undefined}
      targetFieldActionable={true}
      insertionRejected={false}
      insertionRejectionNotice={null}
      onCopyToClipboard={async () => true}
      bindingSupported={true}
    />,
    root,
  );

  const leave = await vi.waitFor(() => {
    const button = root.querySelector<HTMLButtonElement>('button[aria-label="Leave sharing"]');
    if (!button) throw new Error("Picker header not rendered yet");
    return button;
  });
  const shareWith = root.querySelector<HTMLButtonElement>('button[aria-label="Share with…"]')!;
  for (const [button, asset] of [[leave, "sign-out.svg"], [shareWith, "share.svg"]] as const) {
    expect(button.querySelector("[data-fillnest-asset]")?.getAttribute("data-fillnest-asset")).toBe(asset);
    const hint = root.querySelector(`#${button.getAttribute("aria-describedby")}`);
    expect(hint?.textContent).toBe(button.dataset.tooltip);
    expect(button.dataset.tooltip?.length).toBeGreaterThan(20);
  }
  expect(leave.dataset.tooltip).toContain("keeps every Template it offers now");
});
