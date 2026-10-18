// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInitialFillNestState, type FillNestState } from "../../src/storage/fillnest-repository";
import { InlinePicker } from "../../src/ui/picker/InlinePicker";
import { SidePanel } from "../../src/ui/side-panel/SidePanel";

// Task 042 slice 2: the Picker's start card, and a one-line note on each
// feature page's first visit.

function state(): FillNestState {
  const business = createInitialFillNestState();
  business.sites = [{ id: "example.test" }];
  business.pageProfiles = [{ id: "page", siteId: "example.test", identityKey: "/form" }];
  business.fieldProfiles = [{ id: "field", pageProfileId: "page", identityKey: "field", observedTitle: "Reply" }];
  business.templates = [
    { id: "t1", content: "Thanks", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
  ];
  business.bindings = [
    { id: "b1", templateId: "t1", pageProfileId: "page", fieldProfileId: "field", createdAt: "x", usageCount: 0, revision: 0 },
  ];
  return business;
}

function stubChrome(dismissed: string[] = []) {
  let current = [...dismissed];
  const sendMessage = vi.fn(async (request: { type: string; tip?: string }) => {
    switch (request.type) {
      case "GET_LANGUAGE":
        return { ok: true, value: "en" };
      case "GET_DISMISSED_TIPS":
        return { ok: true, value: current };
      case "DISMISS_TIP":
        current = [...current, request.tip!];
        return { ok: true, value: current };
      case "GET_ACTIVATION_MANAGEMENT":
        return { ok: true, value: { global: "active", origins: [{ origin: "https://example.test:443", originActivation: "active" }] } };
      case "FIND_SIMILAR_FIELD_CANDIDATES":
        return { ok: true, value: { candidates: [], currentFieldLabel: "Reply" } };
      default:
        return { ok: true, value: state() };
    }
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: vi.fn(async () => [{ url: "https://example.test/form" }]) },
  });
  vi.stubGlobal("location", new URL("https://example.test/form"));
  return sendMessage;
}

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 40));
  vi.unstubAllGlobals();
});

function button(name: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name);
}

function drawPicker(): void {
  render(
    <InlinePicker
      targetField={document.createElement("input")}
      siteId="example.test"
      pageProfileId="page"
      fieldProfileId="field"
      pageIdentityKey="/form"
      fieldIdentityKey="field"
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
}

describe("the Picker's first-use tips", () => {
  it("shows a start card above Search without taking Search's focus", async () => {
    const sendMessage = stubChrome();
    drawPicker();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip")).not.toBeNull());
    const card = root.querySelector(".fn-tip")!;
    expect(card.textContent).toContain("Start by creating a Template.");
    expect(card.textContent).toContain("Click a Template to insert it into the field.");
    expect(card.textContent).toContain("Every Template can be edited, searched and shared.");
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(card.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(search);

    card.querySelector<HTMLButtonElement>("button")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip")).toBeNull());
    expect(sendMessage).toHaveBeenCalledWith({ type: "DISMISS_TIP", tip: "picker-start" });
  });

  it("explains sharing the first time Share with… opens", async () => {
    const sendMessage = stubChrome(["picker-start"]);
    drawPicker();
    await vi.waitFor(() => expect(root.querySelector('[aria-label="Share with…"]')).not.toBeNull());
    root.querySelector<HTMLButtonElement>('[aria-label="Share with…"]')!.click();

    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")).not.toBeNull());
    expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Chosen fields will share Templates. Leave any time.");
    root.querySelector<HTMLButtonElement>(".fn-tip-note button")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")).toBeNull());
    expect(sendMessage).toHaveBeenCalledWith({ type: "DISMISS_TIP", tip: "share-with" });
  });
});

describe("the Side Panel's page notes", () => {
  async function open(): Promise<void> {
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.textContent).toContain("Enable FillNest"));
  }

  it("notes each Templates view on its first visit", async () => {
    stubChrome();
    await open();
    button("Templates")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Templates saved on this page, and their fields."));

    button("All templates")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")?.textContent).toContain("All Templates: search, filter, delete in bulk."));
    button("By location")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Filed by site › page › field."));
    button("Shared Sets")!.click();
    await vi.waitFor(() =>
      expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Fields that share Templates. Create with Share with… in the Picker."),
    );
  });

  it("notes Sites once, and puts no note on Settings", async () => {
    const sendMessage = stubChrome();
    await open();
    button("Sites")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Pause, clear or remove a site."));
    root.querySelector<HTMLButtonElement>(".fn-tip-note button")!.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "DISMISS_TIP", tip: "sites" }));

    button("Settings")!.click();
    await vi.waitFor(() => expect(button("Show tips again")).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector(".fn-tip-note")).toBeNull();
  });
});
