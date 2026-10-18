// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  renderSyntheticLifecyclePageHtml,
  SYNTHETIC_FIXTURE_CASES,
} from "../fixtures/synthetic-lifecycle-matrix";
import {
  classifyField,
  type SafeFieldMetadata,
} from "../../src/fields/field-eligibility";
import { readDomRecognitionEvidence } from "../../src/recognition/dom-recognition";

describe("Synthetic Lifecycle Fixture Matrix & Harness Self-Checks", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = renderSyntheticLifecyclePageHtml();
    // Run the embedded scripts in happy-dom by dispatching or calling event listeners
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      // Evaluate inline scripts
      if (script.textContent) {
        // The fixture pages under test carry inline scripts; running them is
        // the point of this harness. `no-implied-eval` is right in product
        // code and wrong here.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
        new Function(script.textContent)();
      }
    }
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders all initial declared sections and fields in the synthetic matrix", () => {
    expect(document.getElementById("sec-dynamic-insertion")).not.toBeNull();
    expect(document.getElementById("sec-repeated-groups")).not.toBeNull();
    expect(document.getElementById("sec-dom-replacement")).not.toBeNull();
    expect(document.getElementById("sec-hidden-lifecycle")).not.toBeNull();
    expect(document.getElementById("sec-low-confidence")).not.toBeNull();
    expect(document.getElementById("sec-excluded-zero-touch")).not.toBeNull();

    // Initial repeated contact row 0
    expect(document.getElementById("repeat-contact-0-name")).not.toBeNull();
    expect(document.getElementById("repeat-contact-0-phone")).not.toBeNull();

    // Initial replace target
    expect(document.getElementById("replace-target")).not.toBeNull();

    // Initial hidden lifecycle controls
    expect(document.getElementById("toggle-hidden-field")).not.toBeNull();
    expect(document.getElementById("display-none-field")).not.toBeNull();
    expect(document.getElementById("toggle-disabled-field")).not.toBeNull();
    expect(document.getElementById("toggle-readonly-field")).not.toBeNull();

    // Low confidence bare inputs
    expect(document.getElementById("unlabelled-input-0")).not.toBeNull();
    expect(document.getElementById("unlabelled-input-1")).not.toBeNull();

    // Excluded zero-touch fields
    expect(document.getElementById("excluded-password")).not.toBeNull();
    expect(document.getElementById("excluded-otp")).not.toBeNull();
    expect(document.getElementById("excluded-section-otp")).not.toBeNull();
    expect(document.getElementById("excluded-payment-cc")).not.toBeNull();
    expect(document.getElementById("excluded-payment-cvv")).not.toBeNull();
    expect(document.getElementById("excluded-label-card")).not.toBeNull();
    expect(document.getElementById("excluded-number")).not.toBeNull();
    expect(document.getElementById("excluded-date")).not.toBeNull();
    expect(document.getElementById("excluded-script-date-picker")).not.toBeNull();
    expect(document.getElementById("excluded-controlled-date")).not.toBeNull();
    expect(document.getElementById("excluded-combobox-country")).not.toBeNull();
    expect(document.getElementById("excluded-spinbutton")).not.toBeNull();
    expect(document.getElementById("excluded-hidden-input")).not.toBeNull();
    expect(document.getElementById("excluded-static-readonly")).not.toBeNull();
    expect(document.getElementById("excluded-static-disabled")).not.toBeNull();
    expect(document.getElementById("excluded-contenteditable")).not.toBeNull();
  });

  it("proves dynamic insertion harness creates declared fields with instrumentation", () => {
    expect(document.getElementById("dyn-text-field")).toBeNull();
    expect(document.getElementById("dyn-note-textarea")).toBeNull();

    const btnText = document.getElementById("btn-add-dynamic-text") as HTMLButtonElement;
    btnText.click();

    const dynText = document.getElementById("dyn-text-field") as HTMLInputElement;
    expect(dynText).not.toBeNull();
    expect(dynText.value).toBe("Dynamic text content");

    const btnNote = document.getElementById("btn-add-conditional-note") as HTMLButtonElement;
    btnNote.click();

    const dynNote = document.getElementById("dyn-note-textarea") as HTMLTextAreaElement;
    expect(dynNote).not.toBeNull();
    expect(dynNote.value).toBe("Conditional note content");

    // Verify event logging works on dynamically created field
    dynText.dispatchEvent(new Event("input", { bubbles: true }));
    expect((window as unknown as { syntheticEventLogs: Record<string, unknown[]> }).syntheticEventLogs["dyn-text-field"]).toHaveLength(1);
  });

  it("proves repeated groups harness dynamically adds rows and reorders them without replacing nodes", () => {
    expect(document.getElementById("repeat-contact-1-name")).toBeNull();
    expect(document.getElementById("ambiguous-item-1")).toBeNull();

    const btnAddContact = document.getElementById("btn-add-repeat-contact-row") as HTMLButtonElement;
    btnAddContact.click();

    const contact1Name = document.getElementById("repeat-contact-1-name") as HTMLInputElement;
    const contact1Phone = document.getElementById("repeat-contact-1-phone") as HTMLInputElement;
    expect(contact1Name).not.toBeNull();
    expect(contact1Phone).not.toBeNull();
    expect(contact1Name.name).toBe("contacts[1].name");

    const row0 = document.querySelector('[data-repeat-row="0"]');
    const row1 = document.querySelector('[data-repeat-row="1"]');
    expect(row0).not.toBeNull();
    expect(row1).not.toBeNull();
    (document.getElementById("btn-reorder-repeat-contact-rows") as HTMLButtonElement).click();
    expect(document.querySelector('#repeat-contacts-container > :first-child')).toBe(row1);
    expect(document.getElementById("repeat-contact-0-name")).not.toBeNull();
    expect(document.getElementById("repeat-contact-1-name")).toBe(contact1Name);

    const btnAddAmbiguous = document.getElementById("btn-add-ambiguous-item") as HTMLButtonElement;
    btnAddAmbiguous.click();

    const ambiguousItem1 = document.getElementById("ambiguous-item-1") as HTMLInputElement;
    expect(ambiguousItem1).not.toBeNull();
    expect(ambiguousItem1.name).toBe("item_note");
  });

  it("proves DOM replacement harness removes old node and injects fresh node", () => {
    const oldNode = document.getElementById("replace-target") as HTMLInputElement;
    expect(oldNode).not.toBeNull();
    expect(oldNode.value).toBe("Initial replaceable value");

    const btnReplace = document.getElementById("btn-replace-field") as HTMLButtonElement;
    btnReplace.click();

    const newNode = document.getElementById("replace-target") as HTMLInputElement;
    expect(newNode).not.toBeNull();
    expect(newNode).not.toBe(oldNode);
    expect(newNode.name).toBe(oldNode.name);
    expect(newNode.type).toBe(oldNode.type);
    expect(newNode.value).toBe(oldNode.value);
  });

  it("proves hidden-state lifecycle harness toggles hidden, display:none, disabled, and readonly", () => {
    const hiddenField = document.getElementById("toggle-hidden-field") as HTMLInputElement;
    const btnToggleHidden = document.getElementById("btn-toggle-hidden-attr") as HTMLButtonElement;
    expect(hiddenField.hidden).toBe(false);
    btnToggleHidden.click();
    expect(hiddenField.hidden).toBe(true);
    btnToggleHidden.click();
    expect(hiddenField.hidden).toBe(false);

    const displayContainer = document.getElementById("display-none-container") as HTMLElement;
    const btnToggleDisplay = document.getElementById("btn-toggle-display-none") as HTMLButtonElement;
    expect(displayContainer.style.display).toBe("");
    btnToggleDisplay.click();
    expect(displayContainer.style.display).toBe("none");
    btnToggleDisplay.click();
    expect(displayContainer.style.display).toBe("");

    const disabledField = document.getElementById("toggle-disabled-field") as HTMLInputElement;
    const btnToggleDisabled = document.getElementById("btn-toggle-disabled") as HTMLButtonElement;
    expect(disabledField.disabled).toBe(false);
    btnToggleDisabled.click();
    expect(disabledField.disabled).toBe(true);
    btnToggleDisabled.click();
    expect(disabledField.disabled).toBe(false);

    const readonlyField = document.getElementById("toggle-readonly-field") as HTMLInputElement;
    const btnToggleReadonly = document.getElementById("btn-toggle-readonly") as HTMLButtonElement;
    expect(readonlyField.readOnly).toBe(false);
    btnToggleReadonly.click();
    expect(readonlyField.readOnly).toBe(true);
    btnToggleReadonly.click();
    expect(readonlyField.readOnly).toBe(false);
  });

  it("proves single-field event isolation between repeated rows", () => {
    const contact0Name = document.getElementById("repeat-contact-0-name") as HTMLInputElement;
    (document.getElementById("btn-add-repeat-contact-row") as HTMLButtonElement).click();
    const contact1Name = document.getElementById("repeat-contact-1-name") as HTMLInputElement;

    contact0Name.dispatchEvent(new Event("input", { bubbles: true }));
    contact0Name.dispatchEvent(new Event("change", { bubbles: true }));

    const logs = (window as unknown as { syntheticEventLogs: Record<string, unknown[]> }).syntheticEventLogs;
    expect(logs["repeat-contact-0-name"]).toHaveLength(2);
    expect(logs["repeat-contact-1-name"]).toEqual([]);
    expect(contact1Name.value).toBe("Bob");
  });

  it("proves form submit interception works deterministically", () => {
    const form = document.getElementById("synthetic-main-form") as HTMLFormElement;
    const submitBtn = document.getElementById("synthetic-submit-button") as HTMLButtonElement;

    submitBtn.click();
    expect((window as unknown as { syntheticSubmitCount: number }).syntheticSubmitCount).toBe(1);

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect((window as unknown as { syntheticSubmitCount: number }).syntheticSubmitCount).toBe(2);
  });

  it("classifies every synthetic case descriptor according to fail-closed eligibility rules", () => {
    for (const descriptor of SYNTHETIC_FIXTURE_CASES) {
      if (!document.getElementById(descriptor.fieldId) && descriptor.actionTriggerId) {
        const trigger = document.getElementById(descriptor.actionTriggerId) as HTMLButtonElement | null;
        trigger?.click();
      }
      const metadata = extractFieldMetadata(descriptor.fieldId);
      const classification = classifyField(metadata);

      if (descriptor.isEligible) {
        expect(
          classification,
          `Expected ${descriptor.id} (${descriptor.name}) to be eligible`,
        ).toEqual({ supported: true, reason: "supported" });
      } else {
        expect(
          classification.supported,
          `Expected ${descriptor.id} (${descriptor.name}) to be vetoed`,
        ).toBe(false);
        if (descriptor.expectedVetoReason) {
          expect(
            classification.reason,
            `Expected ${descriptor.id} to have veto reason ${descriptor.expectedVetoReason}`,
          ).toBe(descriptor.expectedVetoReason);
        }
      }
    }
  });

  it("assigns distinct structural recognition keys across repeated and unlabelled fields", () => {
    const bare0 = document.getElementById("unlabelled-input-0") as HTMLInputElement;
    const bare1 = document.getElementById("unlabelled-input-1") as HTMLInputElement;

    const evidence0 = readDomRecognitionEvidence(bare0);
    const evidence1 = readDomRecognitionEvidence(bare1);

    expect(evidence0.fieldIdentityKey).not.toBeNull();
    expect(evidence1.fieldIdentityKey).not.toBeNull();
    expect(evidence0.fieldIdentityKey).not.toBe(evidence1.fieldIdentityKey);
    expect(evidence0.fieldIdentityKey).toContain('"ordinal":0');
    expect(evidence1.fieldIdentityKey).toContain('"ordinal":1');
  });
});

function extractFieldMetadata(fieldId: string): SafeFieldMetadata {
  const element = document.getElementById(fieldId);
  if (!element) {
    throw new Error(`Field element with id "${fieldId}" not found in synthetic matrix DOM`);
  }

  const tagName = element.tagName.toUpperCase();
  const effectiveType =
    tagName === "TEXTAREA"
      ? "textarea"
      : element.getAttribute("contenteditable") === "true"
        ? "contenteditable"
        : (element.getAttribute("type") ?? "text").toLowerCase();

  const labelElement = element.closest("label") ?? document.querySelector(`label[for="${fieldId}"]`);
  const label = labelElement?.textContent?.trim() ?? "";

  return {
    tagName,
    effectiveType,
    disabled: (element as HTMLInputElement).disabled ?? false,
    readOnly: (element as HTMLInputElement).readOnly ?? false,
    autocomplete: element.getAttribute("autocomplete") ?? "",
    name: element.getAttribute("name") ?? "",
    id: element.id ?? "",
    ariaLabel: element.getAttribute("aria-label") ?? "",
    label,
    role: element.getAttribute("role") ?? "",
    ariaControls: element.getAttribute("aria-controls") ?? "",
    dataProvide: element.getAttribute("data-provide") ?? "",
    placeholder: element.getAttribute("placeholder") ?? "",
    accessibleName:
      effectiveType === "contenteditable" ? (element.getAttribute("aria-label") ?? "").trim() : "",
    languageAffordances: {
      spellcheck: element.getAttribute("spellcheck") ?? "",
      autocorrect: element.getAttribute("autocorrect") ?? "",
      autocapitalize: element.getAttribute("autocapitalize") ?? "",
    },
    ancestorRoles: ancestorRoles(element),
  };
}

function ancestorRoles(element: Element): string[] {
  const roles: string[] = [];
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const role = ancestor.getAttribute("role")?.trim().toLowerCase();
    if (role) roles.push(role);
  }
  return roles;
}
