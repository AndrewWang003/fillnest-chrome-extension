import { describe, expect, it } from "vitest";

import {
  classifyField,
  type SafeFieldMetadata,
} from "../../src/fields/field-eligibility";

const baseInput: SafeFieldMetadata = {
  tagName: "INPUT",
  effectiveType: "text",
  disabled: false,
  readOnly: false,
  autocomplete: "",
  name: "notes",
  id: "notes",
  ariaLabel: "Notes",
  label: "Notes",
  role: "",
  ariaControls: "",
  dataProvide: "",
  accessibleName: "",
  ancestorRoles: [],
  languageAffordances: { spellcheck: "", autocorrect: "", autocapitalize: "" },
  placeholder: "",
};

describe("classifyField", () => {
  it("allows only the approved text-like input types and textarea", () => {
    const approved = ["text", "search", "email", "tel", "url"];

    for (const effectiveType of approved) {
      expect(classifyField({ ...baseInput, effectiveType })).toEqual({
        supported: true,
        reason: "supported",
      });
    }
    expect(
      classifyField({
        ...baseInput,
        tagName: "TEXTAREA",
        effectiveType: "textarea",
      }),
    ).toEqual({ supported: true, reason: "supported" });
  });

  it("rejects state-based, unsupported, password, payment, and one-time-code fields", () => {
    const rejected: SafeFieldMetadata[] = [
      { ...baseInput, disabled: true },
      { ...baseInput, readOnly: true },
      { ...baseInput, effectiveType: "hidden" },
      { ...baseInput, effectiveType: "number" },
      { ...baseInput, effectiveType: "date" },
      { ...baseInput, effectiveType: "password" },
      { ...baseInput, autocomplete: "cc-number", name: "cardNumber" },
      { ...baseInput, autocomplete: "one-time-code", name: "otp" },
      { ...baseInput, autocomplete: "section-login one-time-code", name: "code" },
      { ...baseInput, autocomplete: "section-checkout transaction-amount" },
      { ...baseInput, autocomplete: "transaction-currency" },
      { ...baseInput, name: "securityCode", ariaLabel: "CVV" },
      { ...baseInput, name: "entry", label: "Credit card number" },
      { ...baseInput, name: "entry", label: "Cardholder name" },
      { ...baseInput, name: "entry", label: "Debit card" },
      { ...baseInput, name: "entry", label: "Bank account number" },
      { ...baseInput, name: "entry", label: "Expiration date" },
      { ...baseInput, name: "entry", label: "Authentication code" },
      { ...baseInput, name: "entry", label: "2FA code" },
      { ...baseInput, name: "entry", label: "SMS passcode" },
      { ...baseInput, name: "entry", label: "Name on card" },
      { ...baseInput, name: "entry", label: "Card holder name" },
      { ...baseInput, name: "entry", label: "Routing number" },
      { ...baseInput, name: "entry", label: "IBAN" },
      { ...baseInput, name: "entry", label: "BSB" },
      { ...baseInput, name: "entry", label: "Sort code" },
      { ...baseInput, name: "entry", label: "Valid thru" },
      { ...baseInput, name: "entry", label: "MFA code" },
      { ...baseInput, name: "entry", label: "Authenticator passcode" },
      { ...baseInput, name: "entry", label: "PIN" },
      { ...baseInput, name: "entry", label: "Access code" },
      { ...baseInput, name: "entry", label: "Passcode" },
      { ...baseInput, name: "entry", label: "Card expiration" },
      { ...baseInput, name: "entry", label: "Expiration month" },
      { ...baseInput, name: "entry", label: "Expiration year" },
      { ...baseInput, name: "entry", ariaLabel: "Password" },
      { ...baseInput, name: "entry", label: "Current password" },
      { ...baseInput, name: "entry", label: "Passphrase" },
      { ...baseInput, name: "entry", label: "TOTP" },
      { ...baseInput, name: "entry", label: "MFA token" },
      { ...baseInput, name: "entry", label: "Authentication token" },
      { ...baseInput, name: "entry", label: "SWIFT code" },
      { ...baseInput, name: "entry", label: "BIC" },
      { ...baseInput, name: "entry", label: "Access token" },
      { ...baseInput, name: "entry", label: "API token" },
      { ...baseInput, name: "entry", label: "API key" },
      { ...baseInput, name: "entry", label: "Secret key" },
      { ...baseInput, name: "entry", label: "Recovery code" },
      { ...baseInput, name: "entry", label: "Backup code" },
      { ...baseInput, name: "entry", label: "Card verification value" },
      { ...baseInput, name: "entry", label: "Bank routing transit number" },
      { ...baseInput, name: "entry", label: "Private key" },
      { ...baseInput, name: "entry", label: "SSH private key" },
      { ...baseInput, name: "entry", label: "Client secret" },
      { ...baseInput, name: "entry", label: "Auth token" },
      { ...baseInput, name: "entry", label: "Bearer token" },
      { ...baseInput, name: "entry", label: "Authorization token" },
      { ...baseInput, tagName: "DIV", effectiveType: "contenteditable" },
    ];

    for (const metadata of rejected) {
      expect(classifyField(metadata).supported).toBe(false);
    }
  });

  it("vetoes generic text-backed date controls without overfitting date-like words", () => {
    const datePicker = {
      ...baseInput,
      name: "my-date",
      id: "appointment-date",
      ariaLabel: "",
      label: "Date picker",
      role: "",
      ariaControls: "",
      placeholder: "",
    };
    const controlledDateEntry = {
      ...baseInput,
      name: "appointment",
      id: "appointment",
      ariaLabel: "Choose date",
      label: "Appointment",
      role: "combobox",
      ariaControls: "calendar-dialog",
      placeholder: "YYYY-MM-DD",
    };
    const controlledCountryPicker = {
      ...baseInput,
      name: "country",
      id: "country",
      ariaLabel: "Country",
      label: "Country",
      role: "combobox",
      ariaControls: "country-options",
      placeholder: "Choose a country",
    };
    const implicitCountryPicker = { ...controlledCountryPicker };
    // Task 036 Addendum D. The veto exists because a combobox commits a
    // *choice*, so the typed text may never be submitted at all. That argument
    // is about a single-value control, and every fixture protecting it is an
    // `<input>`. A `<textarea>` cannot be committing one choice: multi-line and
    // pick-exactly-one are contradictory claims, and the element's shape is the
    // honest half. Met in the field as a chat composer whose typed text is
    // unambiguously the message.
    const multiLineCombobox = {
      ...baseInput,
      tagName: "TEXTAREA",
      effectiveType: "textarea",
      role: "combobox",
      placeholder: "Ask anything",
      name: "",
      id: "",
      ariaLabel: "",
      label: "",
    };
    const quantitySpinbutton = {
      ...baseInput,
      name: "quantity",
      id: "quantity",
      ariaLabel: "Quantity",
      label: "Quantity",
      role: "spinbutton",
    };
    const ambiguousDateText = {
      ...baseInput,
      name: "start-date",
      id: "start-date",
      ariaLabel: "Start",
      label: "Start",
    };
    const birthDateWidgetWithoutAria = {
      ...baseInput,
      name: "",
      id: "dateOfBirthInput",
      ariaLabel: "",
      label: "",
    };
    const declaredDateWidget = {
      ...baseInput,
      name: "",
      id: "datepicker",
      ariaLabel: "",
      label: "",
      placeholder: "mm/dd/yyyy",
      dataProvide: "datepicker",
    };

    expect(classifyField(datePicker)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(controlledDateEntry)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(controlledCountryPicker)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(implicitCountryPicker)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(quantitySpinbutton)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(multiLineCombobox)).toEqual({
      supported: true,
      reason: "supported",
    });
    expect(classifyField(ambiguousDateText)).toEqual({
      supported: true,
      reason: "supported",
    });
    expect(classifyField(birthDateWidgetWithoutAria)).toEqual({
      supported: false,
      reason: "special-purpose",
    });
    expect(classifyField(declaredDateWidget)).toEqual({
      supported: false,
      reason: "special-purpose",
    });

    for (const ordinaryText of [
      { ...baseInput, name: "candidate", id: "candidate", label: "Candidate name" },
      { ...baseInput, name: "update-notes", id: "update-notes", label: "Update notes" },
      { ...baseInput, name: "date-notes", id: "date-notes", label: "Date notes" },
    ]) {
      expect(classifyField(ordinaryText)).toEqual({
        supported: true,
        reason: "supported",
      });
    }
  });
  // Task 028 Slice 3 (audit finding S4). PROJECT.md requires excluding
  // "password, payment, one-time-code, hidden, disabled, read-only, and other
  // sensitive or unsupported fields", and AGENTS.md requires that an excluded
  // field receive "no value read, fingerprint, Field Profile, extension
  // marker, per-field listener, UI, or fill". A national identity number is
  // squarely inside that rule and was outside the implementation of it:
  // <input type="text" name="ssn"> classified as supported.
  it("vetoes national identity numbers", () => {
    const rejected: SafeFieldMetadata[] = [
      { ...baseInput, name: "ssn", id: "ssn", ariaLabel: "SSN", label: "SSN" },
      { ...baseInput, name: "entry", label: "Social Security Number" },
      { ...baseInput, name: "socialSecurity", label: "Enter your number" },
      { ...baseInput, name: "entry", label: "Social Insurance Number" },
      { ...baseInput, name: "sin", label: "Number" },
      { ...baseInput, name: "entry", label: "National Insurance number" },
      { ...baseInput, name: "nino", label: "Number" },
      { ...baseInput, name: "entry", label: "National ID" },
      { ...baseInput, name: "entry", label: "Tax ID" },
      { ...baseInput, name: "taxId", label: "Number" },
      { ...baseInput, name: "entry", label: "TIN" },
      { ...baseInput, name: "entry", label: "Passport number" },
      { ...baseInput, name: "passport", label: "Document" },
    ];
    for (const metadata of rejected) {
      expect(classifyField(metadata), JSON.stringify(metadata)).toEqual({
        supported: false,
        reason: "sensitive",
      });
    }
  });

  it("does not overfit identity words into ordinary free-text fields", () => {
    // The veto keys on the identity term itself, not on any sentence that
    // happens to mention it. These must stay eligible, exactly as the date
    // rules already refuse to veto "date notes".
    const supported: SafeFieldMetadata[] = [
      { ...baseInput, name: "notes", label: "Passport application notes" },
      { ...baseInput, name: "comments", label: "Tax ID verification comments" },
      { ...baseInput, name: "message", label: "Message about your national insurance claim" },
      { ...baseInput, name: "description", label: "Describe the identity document you provided" },
      // Unrelated words that merely contain a veto term as a substring.
      { ...baseInput, name: "sincerity", label: "Sincerity" },
      { ...baseInput, name: "singer", label: "Singer name" },
      { ...baseInput, name: "tinting", label: "Tinting preference" },
      { ...baseInput, name: "destination", label: "Destination" },
    ];
    for (const metadata of supported) {
      expect(classifyField(metadata), JSON.stringify(metadata)).toEqual({
        supported: true,
        reason: "supported",
      });
    }
  });
});
