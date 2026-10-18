// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidePanel } from "../../src/ui/side-panel/SidePanel";
import type { FillNestState } from "../../src/storage/fillnest-repository";

function defaultBusinessState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      { id: "t1", content: "Orphan template", siteAffinities: ["orphan.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      { id: "t2", content: "Example mapped template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      { id: "t3", content: "Shared template", siteAffinities: ["example.test", "shared-with.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
    ],
    pageProfiles: [{ id: "page-1", siteId: "example.test", identityKey: "/profile", userAlias: "Profile page" }],
    fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
    bindings: [{ id: "b1", templateId: "t2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0}],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
    sharedTemplateFieldStates: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}

function defaultActivationState() {
  return {
    global: "active",
    origins: [
      { origin: "https://app.example.test:443", originActivation: "active" },
      { origin: "https://admin.example.test:443", originActivation: "paused" },
      { origin: "https://other.test:443", originActivation: "active" },
    ],
  };
}

function stubChrome(
  overrides: {
    sendMessage?: (request: { type: string }) => unknown;
    businessState?: unknown;
    activationState?: unknown;
    activeTabUrl?: string | null;
  } = {},
) {
  const state: { business: unknown; activation: unknown } = {
    business: overrides.businessState ?? defaultBusinessState(),
    activation: overrides.activationState ?? defaultActivationState(),
  };
  const messageListeners: Array<(message: unknown) => void> = [];

  const sendMessage = vi.fn(async (request: { type: string }) => {
    if (overrides.sendMessage) {
      const overridden = overrides.sendMessage(request);
      if (overridden !== undefined) return overridden;
    }
    if (request.type === "READ_STATE") return { ok: true, value: state.business };
    if (request.type === "GET_ACTIVATION_MANAGEMENT") return { ok: true, value: state.activation };
    return { ok: true, value: {} };
  });

  const activeTabUrl = overrides.activeTabUrl ?? null;
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: vi.fn((listener: (message: unknown) => void) => messageListeners.push(listener)),
        removeListener: vi.fn(),
      },
    },
    tabs: { query: vi.fn(async () => (activeTabUrl ? [{ url: activeTabUrl }] : [])) },
  });
  return {
    sendMessage,
    // Simulates state landing from elsewhere while this Side Panel stays open -
    // a concurrent edit, or Chrome revoking a permission behind our back - then
    // fires the same broadcast the real service worker sends.
    broadcast(next: { business?: unknown; activation?: unknown }) {
      if (next.business !== undefined) state.business = next.business;
      if (next.activation !== undefined) state.activation = next.activation;
      for (const listener of messageListeners) {
        listener({ type: next.activation !== undefined ? "ACTIVATION_STATE_CHANGED" : "BUSINESS_STATE_CHANGED" });
      }
    },
  };
}

async function renderSites(options: {
  sendMessageOverride?: (request: { type: string }) => unknown;
  businessState?: unknown;
  activationState?: unknown;
  activeTabUrl?: string | null;
  // "By site" is the page's own default view; pass true for tests whose
  // assertions are about the flat address list specifically (pagination,
  // cross-Site batch selection, the dormant section) rather than grouping.
  startInFlatView?: boolean;
} = {}) {
  const { sendMessage, broadcast } = stubChrome({
    sendMessage: options.sendMessageOverride,
    businessState: options.businessState,
    activationState: options.activationState,
    activeTabUrl: options.activeTabUrl,
  });
  const root = document.createElement("div");
  document.body.append(root);
  render(<SidePanel />, root);
  await vi.waitFor(() => expect(root.textContent).toContain("Enable FillNest"));
  click(root, "Sites");
  await vi.waitFor(() => expect(root.textContent).toContain("Select all"));
  if (options.startInFlatView) {
    click(root, "All addresses");
    await vi.waitFor(() => expect(root.querySelector(".address-list")).toBeTruthy());
  }
  return { root, sendMessage, broadcast };
}

describe("SitesPage", () => {
  afterEach(async () => {
    // Preact defers mount effects behind a ~35ms timer; without waiting, a
    // pending effect can fire during a later test after its chrome stub has
    // been swapped, surfacing as a spurious unhandled ReferenceError.
    await new Promise((resolve) => setTimeout(resolve, 40));
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("lists every granted Permission Origin as a top-level row, with no expansion and no repeated Site/status text", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    expect(root.textContent).toContain("https://app.example.test:443");
    expect(root.textContent).toContain("https://admin.example.test:443");
    expect(root.textContent).toContain("https://other.test:443");
    // The switch already states Active/Paused, and the origin already states
    // which Site it belongs to - a row has no other text to repeat either.
    expect(root.querySelector(".address-subline")).toBeNull();
    expect(root.textContent).toContain("Select all");
    // The count in the header is addresses, not Sites.
    expect(root.querySelector(".field-first-count")?.textContent).toBe("3");
    // No expansion controls survive from the old Site-card design.
    expect(root.querySelector('[aria-label="Expand example.test"]')).toBeNull();
    expect(root.textContent).not.toContain("Allowed on");
    expect(root.textContent).not.toContain("Clean up");
  });

  it("opens on By site by default: one collapsed group per Site with a count pill, no address rows until expanded", async () => {
    const { root } = await renderSites();
    expect(root.querySelector(".site-groups")).toBeTruthy();
    const labels = [...root.querySelectorAll(".node-label")].map((node) => node.textContent);
    expect(labels).toEqual(expect.arrayContaining(["example.test", "other.test"]));
    // Nothing auto-expands without a resolvable current tab, so no address is
    // visible yet - selecting anything requires deliberately opening a group.
    expect(root.querySelectorAll(".address-row")).toHaveLength(0);
    const exampleRow = [...root.querySelectorAll(".node-label")].find((node) => node.textContent === "example.test");
    expect(exampleRow?.closest(".tree-node")?.querySelector(".tree-node-count")?.textContent).toBe("2");
  });

  it("auto-expands only the current browser tab's Site group, one-shot", async () => {
    const { root } = await renderSites({ activeTabUrl: "https://other.test/dashboard" });
    await vi.waitFor(() => expect(root.textContent).toContain("https://other.test:443"));
    // example.test's own group stays collapsed - only the current tab's does not.
    expect(root.textContent).not.toContain("https://app.example.test:443");
    expect(root.textContent).not.toContain("https://admin.example.test:443");
  });

  it("expanding a group reveals its addresses (the same address rows the flat page uses) plus a Templates link - Clear site data is reachable only via the toolbar, once something is selected", async () => {
    const { root } = await renderSites();
    clickGroupToggle(root, "example.test");
    await vi.waitFor(() => expect(root.textContent).toContain("https://app.example.test:443"));
    expect(root.textContent).toContain("https://admin.example.test:443");
    // Two Templates carry example.test's affinity (site-only and shared).
    expect(root.textContent).toContain("2 Templates →");
    // No standing Clear site data action on the group itself - only the
    // toolbar's, which needs a selection first.
    const footer = root.querySelector(".group-footer");
    expect(footer?.textContent).not.toContain("Clear site data");
    expect(root.textContent).not.toContain("Clear site data");
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data"));
  });

  it("offers Stop matching for a Site's confirmed Logical Page Matching rules and sends its Rule ID", async () => {
    const business = defaultBusinessState();
    business.logicalPageRules = [{
      id: "rule-1",
      siteId: "example.test",
      siteKeyId: "site-key-1",
      origin: "https://app.example.test:443",
      routePattern: "/customers/:number",
      fieldFeatureHashes: ["a".repeat(64)],
      groupedFieldFeatureHashes: ["b".repeat(64)],
      pageProfileId: "page-1",
    }];
    const { root, sendMessage } = await renderSites({ businessState: business });
    clickGroupToggle(root, "example.test");
    await vi.waitFor(() => expect(root.textContent).toContain("Stop matching"));
    expect(root.textContent).toContain("https://app.example.test:443/customers/:number");

    click(root, "Stop matching");
    await vi.waitFor(() => expect(root.textContent).toContain("Stop matching this page?"));
    expect(root.textContent).toContain("https://app.example.test:443/customers/:number");

    clickInSheet(root, "Stop matching");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "STOP_LOGICAL_PAGE_MATCHING", ruleId: "rule-1" }),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("Stopped matching"));
  });

  it("shows no Logical Page Matching section for a Site with no confirmed rules", async () => {
    const { root } = await renderSites();
    clickGroupToggle(root, "example.test");
    await vi.waitFor(() => expect(root.textContent).toContain("https://app.example.test:443"));
    expect(root.textContent).not.toContain("Stop matching");
  });

  it("does not show a Site with no granted address", async () => {
    const { root } = await renderSites();
    expect(root.textContent).not.toContain("orphan.test");
    expect(root.textContent).not.toContain("No authorized addresses.");
  });

  it("selects every filtered address even when its Site group is collapsed", async () => {
    const { root } = await renderSites();
    clickGroupToggle(root, "example.test");
    await vi.waitFor(() => expect(root.textContent).toContain("https://app.example.test:443"));
    // other.test stays collapsed, but the toolbar's scope is the filtered
    // address result rather than visual disclosure state.
    const selectAll = root.querySelector<HTMLInputElement>('[aria-label="Select all addresses"]');
    if (!selectAll) throw new Error("Select all not found");
    selectAll.click();
    await vi.waitFor(() => expect(root.textContent).toContain("3 of 3 selected"));
    expect(root.textContent).toContain("Clear site data");
  });

  it("a group's Templates link opens Templates filtered to that Site", async () => {
    const { root } = await renderSites();
    clickGroupToggle(root, "example.test");
    await vi.waitFor(() => expect(root.textContent).toContain("2 Templates →"));
    click(root, "2 Templates →");
    await vi.waitFor(() => expect(root.textContent).toContain("Example mapped template"));
    expect(root.textContent).toContain("Shared template");
    expect(root.textContent).not.toContain("Orphan template");
    expect(root.querySelector('[aria-label="Remove Site filter example.test"]')).toBeTruthy();
  });

  it("states its own scope and offers no Template-destructive action anywhere", async () => {
    const { root } = await renderSites();
    expect(root.textContent).toContain("Manage Website Access here. Templates are managed on the Templates page.");
    const labels = [...root.querySelectorAll("button")].map((button) => button.textContent?.trim() ?? "");
    expect(labels).not.toContain("Remove this site");
    expect(labels).not.toContain("Delete related templates everywhere");
    expect(root.textContent).not.toContain("Keep all as Global");
    expect(root.textContent).not.toContain("Type delete to confirm");
  });

  it("pins the current browser tab's Site first while keeping its addresses adjacent", async () => {
    const { root } = await renderSites({ activeTabUrl: "https://other.test/dashboard", startInFlatView: true });
    await vi.waitFor(() => {
      const origins = [...root.querySelectorAll(".address-origin")].map((node) => node.textContent);
      expect(origins[0]).toBe("https://other.test:443");
    });
    const origins = [...root.querySelectorAll(".address-origin")].map((node) => node.textContent);
    expect(origins).toEqual([
      "https://other.test:443",
      "https://admin.example.test:443",
      "https://app.example.test:443",
    ]);
    expect(root.querySelector(".address-row.current")).toBeTruthy();
  });

  it("narrows to addresses by status and by Search across both origin and Site name", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    const status = root.querySelector<HTMLSelectElement>('select[aria-label="Filter addresses by status"]');
    if (!status) throw new Error("Status filter not found");
    status.value = "paused";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll(".address-row")).toHaveLength(1));
    expect(root.textContent).toContain("https://admin.example.test:443");
    expect(root.textContent).not.toContain("https://app.example.test:443");

    status.value = "";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll(".address-row")).toHaveLength(3));

    const search = root.querySelector<HTMLInputElement>('input[aria-label="Search addresses"]');
    if (!search) throw new Error("Search not found");
    search.value = "other.test";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll(".address-row")).toHaveLength(1));
    expect(root.textContent).toContain("https://other.test:443");
  });

  it("selects across Sites and removes each selected Site with its reviewed cleanup", async () => {
    const { root, sendMessage } = await renderSites({ startInFlatView: true });
    clickByLabel(root, "Select https://app.example.test:443");
    clickByLabel(root, "Select https://other.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("2 of 3 selected"));

    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 2 Sites?"));
    expect(root.textContent).toContain("This removes Website Access and clears saved Pages");
    expect(root.textContent).toContain("Open Templates →");

    clickInSheet(root, "Remove site");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "REMOVE_SITE",
        origins: ["https://app.example.test:443", "https://other.test:443"],
        sites: expect.arrayContaining([expect.objectContaining({ siteId: "example.test" }), expect.objectContaining({ siteId: "other.test" })]),
      }),
    );
  });

  it("names the Site and its surviving Template count when the removal covers a single Site", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    clickByLabel(root, "Select https://app.example.test:443");
    clickByLabel(root, "Select https://admin.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("2 of 3 selected"));
    click(root, "Remove site");
    await vi.waitFor(() =>
      expect(root.textContent).toContain("This removes Website Access and clears saved Pages"),
    );
    expect(root.textContent).toContain("View 2 affected Templates →");
    expect(root.textContent).toContain("Templates with no remaining Site become Global.");
  });

  it("hands off to the Templates page with that Site's filter already applied", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    clickByLabel(root, "Select https://app.example.test:443");
    clickByLabel(root, "Select https://admin.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("2 of 3 selected"));
    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("View 2 affected Templates →"));
    click(root, "View 2 affected Templates →");
    await vi.waitFor(() => expect(root.textContent).toContain("Example mapped template"));
    // Landed on the full library, filtered to example.test - not a count in a
    // label, the real list.
    expect(root.textContent).toContain("Shared template");
    expect(root.textContent).not.toContain("Orphan template");
    expect(root.querySelector('[aria-label="Remove Site filter example.test"]')).toBeTruthy();
  });

  it("clears mappings for the distinct Sites of the selection, naming them and warning it covers unselected addresses", async () => {
    const { root, sendMessage } = await renderSites({ startInFlatView: true });
    // One address of a two-address Site: clearing necessarily widens to both.
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Clear site data");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data for 1 Site?"));
    expect(root.textContent).toContain("1 page, 1 field, and 1 binding");
    expect(root.textContent).toContain("FillNest forgets the fields it recognized here");
    expect(root.textContent).toContain("This also removes the selected Site from 2 Templates.");
    expect(root.textContent).toContain("Templates stay in your library and Website Access is not affected.");

    clickInSheet(root, "Confirm");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "RESET_SITE_MAPPINGS_BATCH",
        sites: [
          {
            siteId: "example.test",
            expectedImpact: {
              pageProfileCount: 1,
              fieldProfileCount: 1,
              bindingCount: 1,
              pageAliasCount: 1,
              fieldAliasCount: 0,
              templateAffinityCount: 2,
              logicalPageRuleCount: 0,
              sharedTemplateSetCount: 0,
            },
          },
        ],
      }),
    );
    // Site-scoped, so it fires once for the Site - not once per selected address.
    const resets = sendMessage.mock.calls.filter(
      ([request]) => (request).type === "RESET_SITE_MAPPINGS_BATCH",
    );
    expect(resets).toHaveLength(1);
  });

  it("offers deletion only for the exact Templates newly made Global, then offers Undo", async () => {
    const newlyGlobal = {
      id: "t2",
      content: "Example mapped template",
      siteAffinities: [],
      createdAt: "x",
      updatedAt: "x",
      totalUsageCount: 0,
      revision: 4,
    };
    const { root, sendMessage, broadcast } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) => {
        if (request.type === "RESET_SITE_MAPPINGS_BATCH") return { ok: true, value: { newlyGlobalTemplates: [newlyGlobal] } };
        if (request.type === "DELETE_NEWLY_GLOBAL_TEMPLATES") return { ok: true, value: { deleted: [{ template: newlyGlobal, bindings: [] }] } };
        if (request.type === "RESTORE_TEMPLATES") return { ok: true, value: { restored: [newlyGlobal], failed: [] } };
        return undefined;
      },
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Clear site data");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data for 1 Site?"));
    clickInSheet(root, "Confirm");
    await vi.waitFor(() => expect(root.textContent).toContain("1 Template is now Global. Delete it if you no longer need it."));
    await vi.waitFor(() => expect(root.querySelector(".side-panel-notification-action.danger")?.textContent).toBe("Delete"));
    broadcast({ business: defaultBusinessState() });
    await vi.waitFor(() => expect(root.textContent).not.toContain("1 Template is now Global. Delete it if you no longer need it."));

    // Re-run the clear flow so the exact-result action can be exercised too.
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Clear site data");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data for 1 Site?"));
    clickInSheet(root, "Confirm");
    await vi.waitFor(() => expect(root.querySelector(".side-panel-notification-action.danger")?.textContent).toBe("Delete"));
    click(root, "Delete");
    await vi.waitFor(() => expect(root.textContent).toContain("Undo"));
    expect(sendMessage).toHaveBeenCalledWith({
      type: "DELETE_NEWLY_GLOBAL_TEMPLATES",
      templates: [{ id: "t2", expectedRevision: 4 }],
    });
    click(root, "Undo");
    await vi.waitFor(() => expect(root.textContent).toContain("Restored 1 Template."));
  });

  it("focuses the typed-confirmation input when deleting every newly Global Template", async () => {
    const business = defaultBusinessState();
    const { root } = await renderSites({
      startInFlatView: true,
      businessState: business,
      sendMessageOverride: (request) =>
        request.type === "RESET_SITE_MAPPINGS_BATCH"
          ? { ok: true, value: { newlyGlobalTemplates: business.templates } }
          : undefined,
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Clear site data");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data for 1 Site?"));
    clickInSheet(root, "Confirm");
    await vi.waitFor(() => expect(root.querySelector(".side-panel-notification-action.danger")?.textContent).toBe("Delete"));
    click(root, "Delete");
    await vi.waitFor(() => expect(root.textContent).toContain("Delete all 3 newly Global Templates?"));
    expect(document.activeElement).toBe(root.querySelector('input[aria-label="Type delete to confirm"]'));
  });

  it("hides historical Sites with no granted address", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    expect(root.textContent).not.toContain("Saved data, no access");
    expect(root.textContent).not.toContain("orphan.test");
  });

  it("keeps historical Templates available from Templates, not Sites", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("All templates"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Orphan template"));
  });

  it("survives an external revocation with Templates intact and the Site hidden", async () => {
    const { root, broadcast } = await renderSites({ startInFlatView: true });
    expect(root.textContent).toContain("https://other.test:443");

    // Chrome revoked other.test from outside the extension entirely - the path
    // PermissionLifecycle.onRemoved handles. No Template may be touched.
    broadcast({
      activation: {
        global: "active",
        origins: [
          { origin: "https://app.example.test:443", originActivation: "active" },
          { origin: "https://admin.example.test:443", originActivation: "paused" },
        ],
      },
    });

    await vi.waitFor(() => expect(root.querySelectorAll(".address-row")).toHaveLength(2));
    expect(root.textContent).not.toContain("https://other.test:443");
    // Every Template still exists, and no deletion was ever requested.
    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Fields"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Example mapped template"));
    expect(root.textContent).toContain("Shared template");
    expect(root.textContent).toContain("Orphan template");
  });

  it("keeps the latest operation result visible after Remove site succeeds", async () => {
      const { root } = await renderSites({
        startInFlatView: true,
        sendMessageOverride: (request) => {
          if (request.type === "REMOVE_SITE") {
            return { ok: true, value: { removedOrigins: ["https://app.example.test:443"], newlyGlobalTemplates: [] } };
          }
          return undefined;
        },
      });
      clickByLabel(root, "Select https://app.example.test:443");
      await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
      click(root, "Remove site");
      await vi.waitFor(() => expect(root.textContent).toContain("Remove 1 Site?"));
      clickInSheet(root, "Remove site");

      await vi.waitFor(() => expect(root.querySelector(".side-panel-notification")).not.toBeNull());
      expect(root.textContent).toContain("Removed Website Access and cleared saved data for 1 address.");

      expect(root.querySelector(".side-panel-notification")).not.toBeNull();
  });

  it("returns focus to the logical Sites fallback after confirmed removal removes its trigger", async () => {
    const { root } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) =>
        request.type === "REMOVE_SITE"
          ? { ok: true, value: { removedOrigins: ["https://app.example.test:443"], newlyGlobalTemplates: [] } }
          : undefined,
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    const trigger = [...root.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Remove site");
    if (!(trigger instanceof HTMLButtonElement)) throw new Error("Remove site trigger not found");
    trigger.focus();
    trigger.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 1 Site?"));
    clickInSheet(root, "Remove site");

    await vi.waitFor(() => expect(document.activeElement).toBe(root.querySelector("[aria-label='Select all addresses']")));
  });

  it("does not clear a completed Sites result when its state-change broadcast arrives afterwards", async () => {
    const { root, broadcast } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) => {
        if (request.type === "REMOVE_SITE") {
          return { ok: true, value: { removedOrigins: ["https://app.example.test:443"], newlyGlobalTemplates: [] } };
        }
        return undefined;
      },
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 1 Site?"));
    clickInSheet(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Removed Website Access and cleared saved data for 1 address."));

    broadcast({ activation: defaultActivationState() });
    await vi.waitFor(() => expect(root.textContent).toContain("Removed Website Access and cleared saved data for 1 address."));
  });

  it("never sends a Template mutation from any Sites-page interaction", async () => {
    const { root, sendMessage } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) =>
        request.type === "RESET_SITE_MAPPINGS_BATCH" ? { ok: true, value: { newlyGlobalTemplates: [] } } : undefined,
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Clear site data");
    await vi.waitFor(() => expect(root.textContent).toContain("Clear site data for 1 Site?"));
    clickInSheet(root, "Confirm");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET_SITE_MAPPINGS_BATCH",
          sites: [expect.objectContaining({ siteId: "example.test" })],
        }),
      ),
    );
    // Let the clear finish - its refresh resets the selection - before
    // selecting the next address, as a person would.
    await vi.waitFor(() => expect(root.textContent).not.toContain("1 of 3 selected"));

    clickByLabel(root, "Select https://other.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 1 Site?"));
    clickInSheet(root, "Remove site");
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "REMOVE_SITE" })));

    const forbidden = new Set([
      "BIND_TEMPLATE",
      "CREATE_TEMPLATE",
      "CREATE_TEMPLATE_AND_BIND",
      "DELETE_TEMPLATE",
      "DELETE_TEMPLATES",
      "RESTORE_TEMPLATE",
      "RESTORE_TEMPLATES",
      "SAVE_TEMPLATE_COPY_FOR_FIELD",
      "UNBIND_TEMPLATE",
      "UPDATE_TEMPLATE",
    ]);
    const sent = sendMessage.mock.calls.map(([request]) => (request).type);
    expect(sent.filter((type) => forbidden.has(type))).toEqual([]);
  });

  it("is a single switch per address: clicking it flips Active/Paused, and leaves the sibling address alone", async () => {
    const { root, sendMessage } = await renderSites({ startInFlatView: true });
    // A real toggle, not two separate buttons - one control per address.
    expect(root.querySelector('[aria-label="https://admin.example.test:443 access"]')).toBeTruthy();
    clickByLabel(root, "https://admin.example.test:443 access");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "SET_ORIGIN_ACTIVATION",
        origin: "https://admin.example.test:443",
        mode: "active",
      }),
    );
    // Strictly per-address: the sibling origin on the same Site is untouched.
    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://app.example.test:443", type: "SET_ORIGIN_ACTIVATION" }),
    );

    clickByLabel(root, "https://app.example.test:443 access");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "SET_ORIGIN_ACTIVATION",
        origin: "https://app.example.test:443",
        mode: "paused",
      }),
    );
  });

  it("disables the per-address activation switch while FillNest is globally paused", async () => {
    const { root } = await renderSites({
      startInFlatView: true,
      activationState: {
        global: "paused",
        origins: [{ origin: "https://app.example.test:443", originActivation: "active" }],
      },
    });
    await vi.waitFor(() => expect(root.querySelectorAll(".address-row")).toHaveLength(1));
    const input = root.querySelector<HTMLInputElement>(
      '[aria-label="https://app.example.test:443 access"]',
    );
    expect(input?.disabled).toBe(true);
  });

  it("shows the origin truncated by default and reveals it in full, in place, on click", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    const trigger = root.querySelector<HTMLButtonElement>(
      '[aria-label="Expand https://app.example.test:443"]',
    );
    if (!trigger) throw new Error("Expand control not found");
    expect(trigger.className).not.toContain("expanded");
    trigger.click();
    await vi.waitFor(() =>
      expect(root.querySelector('[aria-label="Collapse https://app.example.test:443"]')).toBeTruthy(),
    );
    expect(
      root.querySelector('[aria-label="Collapse https://app.example.test:443"]')?.className,
    ).toContain("expanded");
    // Only one address is expanded at a time.
    clickByLabel(root, "Expand https://admin.example.test:443");
    await vi.waitFor(() =>
      expect(root.querySelector('[aria-label="Collapse https://admin.example.test:443"]')).toBeTruthy(),
    );
    expect(root.querySelector('[aria-label="Expand https://app.example.test:443"]')).toBeTruthy();
  });

  it("shows no Site name in the address row - the origin and the switch are the whole row", async () => {
    const { root } = await renderSites({ startInFlatView: true });
    expect(root.querySelector(".address-subline")).toBeNull();
  });

  it("surfaces an error and keeps the selection if Remove site fails", async () => {
    const { root } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) => {
        if (request.type === "REMOVE_SITE") return { ok: false, error: "Remove site failed" };
        return undefined;
      },
    });
    clickByLabel(root, "Select https://app.example.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("1 of 3 selected"));
    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 1 Site?"));
    clickInSheet(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove site failed"));
    expect(root.textContent).toContain("1 of 3 selected");
  });

  it("treats a failed Remove site transaction as an error and keeps the selection", async () => {
    const { root } = await renderSites({
      startInFlatView: true,
      sendMessageOverride: (request) => {
        if (request.type === "REMOVE_SITE") {
          return { ok: false, error: "Chrome could not remove every selected Website Access permission. Your saved Site data was restored." };
        }
        return undefined;
      },
    });
    clickByLabel(root, "Select https://app.example.test:443");
    clickByLabel(root, "Select https://other.test:443");
    await vi.waitFor(() => expect(root.textContent).toContain("2 of 3 selected"));

    click(root, "Remove site");
    await vi.waitFor(() => expect(root.textContent).toContain("Remove 2 Sites?"));
    clickInSheet(root, "Remove site");

    await vi.waitFor(() => expect(root.textContent).toContain("Your saved Site data was restored."));
    expect(root.textContent).toContain("2 of 3 selected");
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="Select https://app.example.test:443"]')?.checked,
    ).toBe(true);
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="Select https://other.test:443"]')?.checked,
    ).toBe(true);
  });
});

function click(root: Element, name: string): void {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  found.click();
}

// The toolbar and the open sheet both carry a button with the same label, so
// sheet confirmations must be resolved inside the dialog specifically.
function clickInSheet(root: Element, name: string): void {
  const sheet = root.querySelector(".clean-up-sheet");
  if (!sheet) throw new Error("Sheet not open");
  const found = [...sheet.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Sheet button not found: ${name}`);
  found.click();
}


function clickByLabel(root: Element, label: string): void {
  const found = [...root.querySelectorAll("[aria-label]")].find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLElement)) throw new Error(`Element not found: ${label}`);
  found.click();
}

// TreeNodeRow's chevron (shared with Templates' By location) carries no
// aria-label of its own - it's identified structurally, the same way a
// sighted user finds it: next to the Site name it expands.
function clickGroupToggle(root: Element, siteId: string): void {
  const label = [...root.querySelectorAll(".node-label")].find((node) => node.textContent === siteId);
  if (!label) throw new Error(`Group not found: ${siteId}`);
  const chevron = label.closest(".tree-node")?.querySelector(".tree-chevron");
  if (!(chevron instanceof HTMLButtonElement)) throw new Error(`Chevron not found for: ${siteId}`);
  chevron.click();
}
