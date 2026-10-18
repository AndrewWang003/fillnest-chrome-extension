export interface SyntheticCaseDescriptor {
  id: string;
  category:
    | "dynamic-insertion"
    | "repeated-groups"
    | "dom-replacement"
    | "hidden-lifecycle"
    | "low-confidence"
    | "excluded-zero-touch";
  name: string;
  description: string;
  fieldId: string;
  isEligible: boolean;
  expectedVetoReason?: string;
  declaredInput: string;
  expectedOutcome: string;
  protectedRule: string;
  actionTriggerId?: string;
}

export const SYNTHETIC_FIXTURE_CASES: SyntheticCaseDescriptor[] = [
  // 1. Dynamic Insertion
  {
    id: "dyn-insert-text",
    category: "dynamic-insertion",
    name: "Dynamically Inserted Text Input",
    description: "An ordinary text input dynamically added to DOM via button action",
    fieldId: "dyn-text-field",
    isEligible: true,
    declaredInput: '<input id="dyn-text-field" name="dynamic_text" type="text" value="Dynamic text content">',
    expectedOutcome: "Eligible candidate field; acquires FillNest control on interaction/observation",
    protectedRule: "Only text-like input becomes eligible; fail-closed on unapproved types",
    actionTriggerId: "btn-add-dynamic-text",
  },
  {
    id: "dyn-insert-textarea",
    category: "dynamic-insertion",
    name: "Dynamically Inserted Textarea",
    description: "A textarea revealed inside conditional section upon user action",
    fieldId: "dyn-note-textarea",
    isEligible: true,
    declaredInput: '<textarea id="dyn-note-textarea" name="conditional_note">Conditional note content</textarea>',
    expectedOutcome: "Eligible textarea candidate with single-field interaction",
    protectedRule: "No automatic form fill or multi-field inference",
    actionTriggerId: "btn-add-conditional-note",
  },

  // 2. Repeated Groups
  {
    id: "repeat-group-distinct-0",
    category: "repeated-groups",
    name: "Repeated Group Row 0 (Distinct Key)",
    description: "Initial instance of a repeating structured group with index 0",
    fieldId: "repeat-contact-0-name",
    isEligible: true,
    declaredInput: '<input id="repeat-contact-0-name" name="contacts[0].name" type="text" value="Alice">',
    expectedOutcome: "Eligible field; accepts single-field insertion without affecting Row 1",
    protectedRule: "Single-field insertion isolation: never touches sibling/repeated rows",
  },
  {
    id: "repeat-group-distinct-1",
    category: "repeated-groups",
    name: "Repeated Group Row 1 (Dynamically Added Distinct Key)",
    description: "Dynamically added second instance with distinct structural index",
    fieldId: "repeat-contact-1-name",
    isEligible: true,
    declaredInput: '<input id="repeat-contact-1-name" name="contacts[1].name" type="text" value="Bob">',
    expectedOutcome: "Eligible field; receives distinct structural recognition identity",
    protectedRule: "Dynamic row indexes are runtime clues only; single-field isolation strictly preserved",
    actionTriggerId: "btn-add-repeat-contact-row",
  },
  {
    id: "repeat-group-reorder",
    category: "repeated-groups",
    name: "Repeated Group Reorder",
    description: "A second repeated row moves before the first without changing either field's logical slot",
    fieldId: "repeat-contact-1-name",
    isEligible: true,
    declaredInput: '<input id="repeat-contact-1-name" name="contacts[1].name" type="text" value="Bob">',
    expectedOutcome: "The fixture reorders live rows without reusing a DOM node or persistent row index as identity",
    protectedRule: "Current DOM order is runtime-only evidence and cannot silently widen a Binding",
    actionTriggerId: "btn-reorder-repeat-contact-rows",
  },
  {
    id: "repeat-group-ambiguous-0",
    category: "repeated-groups",
    name: "Ambiguous Repeated Item 0",
    description: "First instance of ambiguous repeating item with duplicate label and name",
    fieldId: "ambiguous-item-0",
    isEligible: true,
    declaredInput: '<input id="ambiguous-item-0" name="item_note" type="text" value="First note">',
    expectedOutcome: "Eligible for manual single-field Create/Bind; receives no automatic repeat binding",
    protectedRule: "Matching labels alone do not prove logical identity; no speculative binding inheritance",
  },
  {
    id: "repeat-group-ambiguous-1",
    category: "repeated-groups",
    name: "Ambiguous Repeated Item 1 (Dynamically Added)",
    description: "Second instance with identical label and name attribute",
    fieldId: "ambiguous-item-1",
    isEligible: true,
    declaredInput: '<input id="ambiguous-item-1" name="item_note" type="text" value="Second note">',
    expectedOutcome: "Eligible for manual action only; does NOT inherit binding from Item 0",
    protectedRule: "Ambiguous repeat instance receives zero inherited binding or shared template scope",
    actionTriggerId: "btn-add-ambiguous-item",
  },

  // 3. DOM Replacement
  {
    id: "dom-replace-rerender",
    category: "dom-replacement",
    name: "DOM Node Replacement via Framework Re-render",
    description: "Existing eligible field is removed and replaced by a fresh DOM element",
    fieldId: "replace-target",
    isEligible: true,
    declaredInput: '<input id="replace-target" name="replaceable_field" type="text" value="Initial replaceable value">',
    expectedOutcome: "Old node torn down; open Picker closes/cancels silently; new node receives fresh assessment",
    protectedRule: "Picker is permanently bound to target; never retargets insertion to replacement node",
    actionTriggerId: "btn-replace-field",
  },

  // 4. Hidden-State Lifecycle
  {
    id: "hidden-lifecycle-attr",
    category: "hidden-lifecycle",
    name: "Hidden Attribute Lifecycle Toggle",
    description: "Field toggles native hidden attribute dynamically",
    fieldId: "toggle-hidden-field",
    isEligible: true,
    declaredInput: '<input id="toggle-hidden-field" name="hidden_toggle_field" type="text" value="Toggle hidden value">',
    expectedOutcome: "When hidden: immediate teardown of overlay/picker; when restored: fresh candidate assessment",
    protectedRule: "Ineligible / unavailable fields receive zero extension UI / interaction path",
    actionTriggerId: "btn-toggle-hidden-attr",
  },
  {
    id: "hidden-lifecycle-display-none",
    category: "hidden-lifecycle",
    name: "Ancestor Display None Lifecycle Toggle",
    description: "Container toggles style.display = 'none' dynamically",
    fieldId: "display-none-field",
    isEligible: true,
    declaredInput: '<input id="display-none-field" name="display_none_field" type="text" value="Display none value">',
    expectedOutcome: "When ancestor hidden: immediate teardown; durable data retained",
    protectedRule: "Generic rendered/interactable evidence checks ancestor visibility",
    actionTriggerId: "btn-toggle-display-none",
  },
  {
    id: "hidden-lifecycle-disabled",
    category: "hidden-lifecycle",
    name: "Dynamic Disabled Toggle",
    description: "Field toggles disabled property dynamically",
    fieldId: "toggle-disabled-field",
    isEligible: true,
    declaredInput: '<input id="toggle-disabled-field" name="disabled_toggle_field" type="text" value="Toggle disabled value">',
    expectedOutcome: "Disabled state triggers immediate teardown of extension UI",
    protectedRule: "Disabled fields are vetoed from eligibility",
    actionTriggerId: "btn-toggle-disabled",
  },
  {
    id: "hidden-lifecycle-readonly",
    category: "hidden-lifecycle",
    name: "Dynamic ReadOnly Toggle",
    description: "Field toggles readOnly property dynamically",
    fieldId: "toggle-readonly-field",
    isEligible: true,
    declaredInput: '<input id="toggle-readonly-field" name="readonly_toggle_field" type="text" value="Toggle readonly value">',
    expectedOutcome: "ReadOnly state triggers immediate teardown of extension UI",
    protectedRule: "ReadOnly fields are vetoed from eligibility",
    actionTriggerId: "btn-toggle-readonly",
  },

  // 5. Low-Confidence / Ambiguous Fields
  {
    id: "low-conf-unlabelled-0",
    category: "low-confidence",
    name: "Unlabelled Bare Input 0",
    description: "Bare text input without name, id, label or aria attributes",
    fieldId: "unlabelled-input-0",
    isEligible: true,
    declaredInput: '<input id="unlabelled-input-0" type="text" value="Bare 1">',
    expectedOutcome: "Recognized with low-confidence structural ordinal; requires deliberate manual Bind",
    protectedRule: "Fail-closed on low confidence; no speculative binding inheritance across bare inputs",
  },
  {
    id: "low-conf-unlabelled-1",
    category: "low-confidence",
    name: "Unlabelled Bare Input 1",
    description: "Second bare text input in the same form",
    fieldId: "unlabelled-input-1",
    isEligible: true,
    declaredInput: '<input id="unlabelled-input-1" type="text" value="Bare 2">',
    expectedOutcome: "Distinct structural ordinal; does not inherit bindings from Input 0",
    protectedRule: "Zero accidental cross-field binding",
  },

  // 6. Excluded Fields Zero-Touch
  {
    id: "excluded-password",
    category: "excluded-zero-touch",
    name: "Password Input",
    description: "Sensitive password input",
    fieldId: "excluded-password",
    isEligible: false,
    expectedVetoReason: "type",
    declaredInput: '<input id="excluded-password" type="password" value="secret123">',
    expectedOutcome: "Zero value read, zero marker, zero listener, zero overlay, zero picker",
    protectedRule: "Strict fail-closed zero touch on sensitive authentication inputs",
  },
  {
    id: "excluded-otp",
    category: "excluded-zero-touch",
    name: "One-Time-Code (OTP) Input",
    description: "One-time passcode input identified via autocomplete attribute",
    fieldId: "excluded-otp",
    isEligible: false,
    expectedVetoReason: "sensitive",
    declaredInput: '<input id="excluded-otp" type="text" autocomplete="one-time-code" value="987654">',
    expectedOutcome: "Zero touch across all extension surfaces",
    protectedRule: "Veto one-time-code / 2FA fields unconditionally",
  },
  {
    id: "excluded-section-otp",
    category: "excluded-zero-touch",
    name: "Sectioned OTP Input",
    description: "One-time passcode input with sectioned autocomplete token",
    fieldId: "excluded-section-otp",
    isEligible: false,
    expectedVetoReason: "sensitive",
    declaredInput: '<input id="excluded-section-otp" type="text" autocomplete="section-login one-time-code" value="123456">',
    expectedOutcome: "Zero touch across all extension surfaces",
    protectedRule: "Veto composite autocomplete tokens containing one-time-code",
  },
  {
    id: "excluded-payment-cc",
    category: "excluded-zero-touch",
    name: "Payment Credit Card Number Input",
    description: "Credit card number field identified via cc-number autocomplete",
    fieldId: "excluded-payment-cc",
    isEligible: false,
    expectedVetoReason: "sensitive",
    declaredInput: '<input id="excluded-payment-cc" type="text" autocomplete="cc-number" value="4111222233334444">',
    expectedOutcome: "Zero touch: no read, no profile, no marker, no overlay",
    protectedRule: "Veto payment / credit card fields unconditionally",
  },
  {
    id: "excluded-payment-cvv",
    category: "excluded-zero-touch",
    name: "Payment Security Code (CVV)",
    description: "Security code / CVV field identified via ariaLabel and name",
    fieldId: "excluded-payment-cvv",
    isEligible: false,
    expectedVetoReason: "sensitive",
    declaredInput: '<input id="excluded-payment-cvv" type="text" name="securityCode" aria-label="CVV" value="123">',
    expectedOutcome: "Zero touch: no read, no profile, no marker, no overlay",
    protectedRule: "Veto payment security code fields unconditionally",
  },
  {
    id: "excluded-label-card",
    category: "excluded-zero-touch",
    name: "Credit Card Field via Label",
    description: "Field with text type but labelled Credit card number",
    fieldId: "excluded-label-card",
    isEligible: false,
    expectedVetoReason: "sensitive",
    declaredInput: '<label>Credit card number<input id="excluded-label-card" type="text" name="entry" value="4111222233334444"></label>',
    expectedOutcome: "Zero touch: no read, no profile, no marker, no overlay",
    protectedRule: "Veto payment fields matching semantic card labels",
  },
  {
    id: "excluded-number",
    category: "excluded-zero-touch",
    name: "Number Input",
    description: "Native numeric input",
    fieldId: "excluded-number",
    isEligible: false,
    expectedVetoReason: "type",
    declaredInput: '<input id="excluded-number" type="number" value="100">',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Non-text input types are excluded in V1",
  },
  {
    id: "excluded-date",
    category: "excluded-zero-touch",
    name: "Native Date Input",
    description: "Native date picker input",
    fieldId: "excluded-date",
    isEligible: false,
    expectedVetoReason: "type",
    declaredInput: '<input id="excluded-date" type="date" value="2026-08-27">',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Native date controls are excluded",
  },
  {
    id: "excluded-script-date-picker",
    category: "excluded-zero-touch",
    name: "Script Date Picker Input",
    description: "Text input labelled Date picker",
    fieldId: "excluded-script-date-picker",
    isEligible: false,
    expectedVetoReason: "special-purpose",
    declaredInput: '<label>Date picker<input id="excluded-script-date-picker" type="text" name="my-date" value="2026-08-27"></label>',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Special purpose date picker widgets are vetoed",
  },
  {
    id: "excluded-controlled-date",
    category: "excluded-zero-touch",
    name: "Controlled Date Combobox",
    description: "Combobox input with aria-controls dialog calendar",
    fieldId: "excluded-controlled-date",
    isEligible: false,
    expectedVetoReason: "special-purpose",
    declaredInput: '<label>Appointment<input id="excluded-controlled-date" type="text" role="combobox" aria-haspopup="dialog" aria-controls="app-calendar" aria-label="Choose date" placeholder="YYYY-MM-DD" value="2026-08-27"></label><div id="app-calendar" role="dialog" hidden>Calendar</div>',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Custom controlled calendar widgets are vetoed",
  },
  {
    id: "excluded-combobox-country",
    category: "excluded-zero-touch",
    name: "Combobox Country Listbox",
    description: "Combobox input controlling listbox options",
    fieldId: "excluded-combobox-country",
    isEligible: false,
    expectedVetoReason: "special-purpose",
    declaredInput: '<label>Country<input id="excluded-combobox-country" type="text" role="combobox" aria-haspopup="listbox" aria-controls="country-list" value="Australia"></label><div id="country-list" role="listbox" hidden>Australia</div>',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Custom combobox / autocomplete listbox controls are vetoed",
  },
  {
    id: "excluded-spinbutton",
    category: "excluded-zero-touch",
    name: "Quantity Spinbutton",
    description: "Text input with role spinbutton",
    fieldId: "excluded-spinbutton",
    isEligible: false,
    expectedVetoReason: "special-purpose",
    declaredInput: '<label>Quantity<input id="excluded-spinbutton" type="text" role="spinbutton" value="5"></label>',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "Spinbuttons and complex widget roles are vetoed",
  },
  {
    id: "excluded-hidden-input",
    category: "excluded-zero-touch",
    name: "Hidden Input Element",
    description: "Input with type=hidden",
    fieldId: "excluded-hidden-input",
    isEligible: false,
    expectedVetoReason: "type",
    declaredInput: '<input id="excluded-hidden-input" type="hidden" value="hidden-payload">',
    expectedOutcome: "Zero touch: completely ignored",
    protectedRule: "Hidden fields receive zero extension touch",
  },
  {
    id: "excluded-static-readonly",
    category: "excluded-zero-touch",
    name: "Static ReadOnly Input",
    description: "Input with readonly attribute",
    fieldId: "excluded-static-readonly",
    isEligible: false,
    expectedVetoReason: "state",
    declaredInput: '<input id="excluded-static-readonly" type="text" readonly value="readonly-content">',
    expectedOutcome: "Zero touch: no overlay or picker",
    protectedRule: "ReadOnly inputs cannot receive insertions and are vetoed",
  },
  {
    id: "excluded-static-disabled",
    category: "excluded-zero-touch",
    name: "Static Disabled Input",
    description: "Input with disabled attribute",
    fieldId: "excluded-static-disabled",
    isEligible: false,
    expectedVetoReason: "state",
    declaredInput: '<input id="excluded-static-disabled" type="text" disabled value="disabled-content">',
    expectedOutcome: "Zero touch: no overlay or picker",
    protectedRule: "Disabled inputs cannot receive insertions and are vetoed",
  },
  {
    id: "excluded-contenteditable",
    category: "excluded-zero-touch",
    name: "ContentEditable Div",
    description: "Rich text contenteditable element",
    fieldId: "excluded-contenteditable",
    isEligible: false,
    // Task 036 changed why, not whether. A bare editing host declares nothing
    // - no `role="textbox"`, no accessible name - so it is vetoed as
    // undeclared rather than as "not an input". The zero-touch outcome this
    // case exists to protect is unchanged.
    expectedVetoReason: "type",
    declaredInput: '<div id="excluded-contenteditable" contenteditable="true">Editable content</div>',
    expectedOutcome: "Zero touch: no extension interaction",
    protectedRule: "An undeclared contenteditable host is excluded",
  },
];

export function renderSyntheticLifecyclePageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FillNest Synthetic Lifecycle Matrix</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 32px;
      padding-bottom: 600px;
      color: #1a1a1a;
      background: #fdfdfd;
    }
    h1, h2, h3 { color: #0f172a; margin-top: 24px; margin-bottom: 12px; }
    section {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      background: #ffffff;
    }
    .field-row {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .button-group {
      margin: 12px 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    button {
      padding: 6px 12px;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      background: #f1f5f9;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: #e2e8f0; }
    input[type="text"], input[type="email"], input[type="tel"], input[type="search"], input[type="url"], textarea {
      width: 380px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 14px;
    }
    .hidden-section { display: none; }
  </style>
</head>
<body>
  <h1>FillNest Synthetic Lifecycle Matrix</h1>
  <p>Synthetic, site-neutral test harness for dynamic DOM, repeated groups, DOM replacement, hidden state transitions, and zero-touch excluded fields.</p>

  <form id="synthetic-main-form">
    <!-- Category 1: Dynamic Insertion -->
    <section id="sec-dynamic-insertion">
      <h2>1. Dynamic Insertion</h2>
      <div class="button-group">
        <button id="btn-add-dynamic-text" type="button">Add dynamic text input</button>
        <button id="btn-add-conditional-note" type="button">Reveal conditional textarea</button>
      </div>
      <div id="dynamic-text-container"></div>
      <div id="conditional-notes-container"></div>
    </section>

    <!-- Category 2: Repeated Groups -->
    <section id="sec-repeated-groups">
      <h2>2. Repeated Groups</h2>
      <div class="button-group">
        <button id="btn-add-repeat-contact-row" type="button">Add Contact Row (Distinct Index)</button>
        <button id="btn-reorder-repeat-contact-rows" type="button">Reorder Contact Rows</button>
        <button id="btn-add-ambiguous-item" type="button">Add Item Note (Ambiguous Label/Name)</button>
      </div>
      <div id="repeat-contacts-container">
        <div class="field-row" data-repeat-row="0">
          <label for="repeat-contact-0-name">Contact name</label>
          <input id="repeat-contact-0-name" name="contacts[0].name" type="text" value="Alice">
          <label for="repeat-contact-0-phone">Contact 0 Phone</label>
          <input id="repeat-contact-0-phone" name="contacts[0].phone" type="tel" value="555-0100">
        </div>
      </div>
      <div id="repeat-ambiguous-container">
        <div class="field-row" data-ambiguous-row="0">
          <label>Item note
            <input id="ambiguous-item-0" name="item_note" type="text" value="First note">
          </label>
        </div>
      </div>
    </section>

    <!-- Category 3: DOM Replacement -->
    <section id="sec-dom-replacement">
      <h2>3. DOM Replacement & Re-render</h2>
      <div class="button-group">
        <button id="btn-replace-field" type="button">Re-render / Replace Field Node</button>
        <button id="btn-replace-semantic-field" type="button">Re-render / Replace Email Field Node</button>
      </div>
      <div id="replace-container">
        <div class="field-row">
          <label for="replace-target">Replaceable Target Field</label>
          <input id="replace-target" name="replaceable_field" type="text" value="Initial replaceable value">
        </div>
      </div>
      <div id="replace-semantic-container">
        <div class="field-row">
          <label for="replace-semantic-target">Contact email</label>
          <input id="replace-semantic-target" name="contact_email" type="email" value="person@example.test">
        </div>
      </div>
    </section>

    <!-- Category 4: Hidden-State Lifecycle -->
    <section id="sec-hidden-lifecycle">
      <h2>4. Hidden-State Lifecycle & Teardown</h2>
      <div class="button-group">
        <button id="btn-toggle-hidden-attr" type="button">Toggle hidden attribute</button>
        <button id="btn-toggle-display-none" type="button">Toggle ancestor display:none</button>
        <button id="btn-toggle-disabled" type="button">Toggle disabled state</button>
        <button id="btn-toggle-readonly" type="button">Toggle readOnly state</button>
        <button id="btn-toggle-otp-autocomplete" type="button">Toggle sensitive autocomplete</button>
      </div>
      <div class="field-row">
        <label for="toggle-hidden-field">Toggle Hidden Attribute Field</label>
        <input id="toggle-hidden-field" name="hidden_toggle_field" type="text" value="Toggle hidden value">
      </div>
      <div id="display-none-container">
        <div class="field-row">
          <label for="display-none-field">Ancestor Display:None Field</label>
          <input id="display-none-field" name="display_none_field" type="text" value="Display none value">
        </div>
      </div>
      <div class="field-row">
        <label for="toggle-disabled-field">Toggle Disabled Field</label>
        <input id="toggle-disabled-field" name="disabled_toggle_field" type="text" value="Toggle disabled value">
      </div>
      <div class="field-row">
        <label for="toggle-readonly-field">Toggle ReadOnly Field</label>
        <input id="toggle-readonly-field" name="readonly_toggle_field" type="text" value="Toggle readonly value">
      </div>
      <div class="field-row">
        <label for="toggle-transition-field">Toggle Metadata Field</label>
        <input id="toggle-transition-field" name="toggle_transition_field" type="text" value="Toggle metadata value">
      </div>
    </section>

    <!-- Category 5: Low-Confidence / Ambiguous Fields -->
    <section id="sec-low-confidence">
      <h2>5. Low-Confidence & Ambiguous Fields</h2>
      <div id="low-confidence-container">
        <div class="field-row">
          <input id="unlabelled-input-0" type="text" value="Bare 1">
          <input id="unlabelled-input-1" type="text" value="Bare 2">
        </div>
      </div>
    </section>

    <!-- Category 6: Excluded Fields Zero-Touch -->
    <section id="sec-excluded-zero-touch">
      <h2>6. Excluded Fields Zero-Touch</h2>
      <div class="field-row">
        <label for="excluded-password">Password (Excluded)</label>
        <input id="excluded-password" type="password" value="secret123">
      </div>
      <div class="field-row">
        <label for="excluded-otp">One-Time Code (Excluded)</label>
        <input id="excluded-otp" type="text" autocomplete="one-time-code" value="987654">
      </div>
      <div class="field-row">
        <label for="excluded-section-otp">Sectioned OTP (Excluded)</label>
        <input id="excluded-section-otp" type="text" autocomplete="section-login one-time-code" value="123456">
      </div>
      <div class="field-row">
        <label for="excluded-payment-cc">Payment Card Number (Excluded)</label>
        <input id="excluded-payment-cc" type="text" autocomplete="cc-number" value="4111222233334444">
      </div>
      <div class="field-row">
        <label for="excluded-payment-cvv">Security Code (Excluded)</label>
        <input id="excluded-payment-cvv" type="text" name="securityCode" aria-label="CVV" value="123">
      </div>
      <div class="field-row">
        <label>Credit card number
          <input id="excluded-label-card" type="text" name="entry" value="4111222233334444">
        </label>
      </div>
      <div class="field-row">
        <label for="excluded-number">Number (Excluded)</label>
        <input id="excluded-number" type="number" value="100">
      </div>
      <div class="field-row">
        <label for="excluded-date">Date (Excluded)</label>
        <input id="excluded-date" type="date" value="2026-08-27">
      </div>
      <div class="field-row">
        <label>Date picker
          <input id="excluded-script-date-picker" type="text" name="my-date" value="2026-08-27">
        </label>
      </div>
      <div class="field-row">
        <label>Appointment
          <input id="excluded-controlled-date" type="text" role="combobox" aria-haspopup="dialog" aria-controls="app-calendar" aria-label="Choose date" placeholder="YYYY-MM-DD" value="2026-08-27">
        </label>
        <div id="app-calendar" role="dialog" hidden>Calendar Dialog</div>
      </div>
      <div class="field-row">
        <label>Country
          <input id="excluded-combobox-country" type="text" role="combobox" aria-haspopup="listbox" aria-controls="country-list" value="Australia">
        </label>
        <div id="country-list" role="listbox" hidden>Country list</div>
      </div>
      <div class="field-row">
        <label>Quantity
          <input id="excluded-spinbutton" type="text" role="spinbutton" value="5">
        </label>
      </div>
      <input id="excluded-hidden-input" type="hidden" value="hidden-payload">
      <div class="field-row">
        <label for="excluded-static-readonly">ReadOnly (Excluded)</label>
        <input id="excluded-static-readonly" type="text" readonly value="readonly-content">
      </div>
      <div class="field-row">
        <label for="excluded-static-disabled">Disabled (Excluded)</label>
        <input id="excluded-static-disabled" type="text" disabled value="disabled-content">
      </div>
      <div class="field-row">
        <label>ContentEditable Div (Excluded)</label>
        <div id="excluded-contenteditable" contenteditable="true">Editable content</div>
      </div>
    </section>

    <button id="synthetic-submit-button" type="submit">Submit synthetic form</button>
  </form>

  <script>
    // Synthetic Oracles
    window.syntheticEventLogs = {};
    window.syntheticReadCounts = {};
    window.syntheticSubmitCount = 0;

    function registerFieldInstrumentation(element) {
      if (!element || !element.id) return;
      const id = element.id;
      if (!window.syntheticEventLogs[id]) {
        window.syntheticEventLogs[id] = [];
      }
      if (window.syntheticReadCounts[id] === undefined) {
        window.syntheticReadCounts[id] = 0;
      }

      for (const eventName of ['beforeinput', 'input', 'change']) {
        element.addEventListener(eventName, function(event) {
          window.syntheticEventLogs[id].push({
            type: event.type,
            constructor: event.constructor ? event.constructor.name : 'Event',
            inputType: event.inputType || null,
            data: event.data || null,
            bubbles: Boolean(event.bubbles),
            composed: Boolean(event.composed),
            cancelable: Boolean(event.cancelable),
            timestamp: Date.now()
          });
        });
      }
    }

    // Zero-touch probes and lifecycle targets must have no host-page direct
    // listeners so E2E can inspect extension listener teardown without
    // conflating fixture instrumentation with extension behaviour.
    document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(function(element) {
      if (!element.closest('#sec-excluded-zero-touch, #sec-hidden-lifecycle')) {
        registerFieldInstrumentation(element);
      }
    });

    // Form submit listener
    document.getElementById('synthetic-main-form').addEventListener('submit', function(event) {
      window.syntheticSubmitCount += 1;
      event.preventDefault();
    });

    // 1. Dynamic Insertion Actions
    document.getElementById('btn-add-dynamic-text').addEventListener('click', function() {
      const container = document.getElementById('dynamic-text-container');
      if (document.getElementById('dyn-text-field')) return;
      const row = document.createElement('div');
      row.className = 'field-row';
      row.innerHTML = '<label for="dyn-text-field">Dynamic Text Field</label><input id="dyn-text-field" name="dynamic_text" type="text" value="Dynamic text content">';
      container.appendChild(row);
      const input = document.getElementById('dyn-text-field');
      registerFieldInstrumentation(input);
    });

    document.getElementById('btn-add-conditional-note').addEventListener('click', function() {
      const container = document.getElementById('conditional-notes-container');
      if (document.getElementById('dyn-note-textarea')) return;
      const row = document.createElement('div');
      row.className = 'field-row';
      row.innerHTML = '<label for="dyn-note-textarea">Conditional Note Textarea</label><textarea id="dyn-note-textarea" name="conditional_note">Conditional note content</textarea>';
      container.appendChild(row);
      const textarea = document.getElementById('dyn-note-textarea');
      registerFieldInstrumentation(textarea);
    });

    // 2. Repeated Groups Actions
    document.getElementById('btn-add-repeat-contact-row').addEventListener('click', function() {
      const container = document.getElementById('repeat-contacts-container');
      if (document.getElementById('repeat-contact-1-name')) return;
      const row = document.createElement('div');
      row.className = 'field-row';
      row.setAttribute('data-repeat-row', '1');
      row.innerHTML = '<label for="repeat-contact-1-name">Contact name</label><input id="repeat-contact-1-name" name="contacts[1].name" type="text" value="Bob"><label for="repeat-contact-1-phone">Contact phone</label><input id="repeat-contact-1-phone" name="contacts[1].phone" type="tel" value="555-0200">';
      container.appendChild(row);
      registerFieldInstrumentation(document.getElementById('repeat-contact-1-name'));
      registerFieldInstrumentation(document.getElementById('repeat-contact-1-phone'));
    });

    document.getElementById('btn-reorder-repeat-contact-rows').addEventListener('click', function() {
      const container = document.getElementById('repeat-contacts-container');
      const row0 = container?.querySelector('[data-repeat-row="0"]');
      const row1 = container?.querySelector('[data-repeat-row="1"]');
      if (container && row0 && row1) container.insertBefore(row1, row0);
    });

    document.getElementById('btn-add-ambiguous-item').addEventListener('click', function() {
      const container = document.getElementById('repeat-ambiguous-container');
      if (document.getElementById('ambiguous-item-1')) return;
      const row = document.createElement('div');
      row.className = 'field-row';
      row.setAttribute('data-ambiguous-row', '1');
      row.innerHTML = '<label>Item note<input id="ambiguous-item-1" name="item_note" type="text" value="Second note"></label>';
      container.appendChild(row);
      registerFieldInstrumentation(document.getElementById('ambiguous-item-1'));
    });

    // 3. DOM Replacement Action
    document.getElementById('btn-replace-field').addEventListener('click', function() {
      const container = document.getElementById('replace-container');
      const oldRow = container.querySelector('.field-row');
      if (oldRow) oldRow.remove();
      const newRow = document.createElement('div');
      newRow.className = 'field-row';
      newRow.innerHTML = '<label for="replace-target">Replaceable Target Field</label><input id="replace-target" name="replaceable_field" type="text" value="Initial replaceable value">';
      container.appendChild(newRow);
      registerFieldInstrumentation(document.getElementById('replace-target'));
    });

    document.getElementById('btn-replace-semantic-field').addEventListener('click', function() {
      const container = document.getElementById('replace-semantic-container');
      const oldRow = container.querySelector('.field-row');
      if (oldRow) oldRow.remove();
      const newRow = document.createElement('div');
      newRow.className = 'field-row';
      newRow.innerHTML = '<label for="replace-semantic-target">Contact email</label><input id="replace-semantic-target" name="contact_email" type="email" value="person@example.test">';
      container.appendChild(newRow);
      registerFieldInstrumentation(document.getElementById('replace-semantic-target'));
    });

    // 4. Hidden-State Lifecycle Actions
    document.getElementById('btn-toggle-hidden-attr').addEventListener('click', function() {
      const field = document.getElementById('toggle-hidden-field');
      if (field) field.hidden = !field.hidden;
    });

    document.getElementById('btn-toggle-display-none').addEventListener('click', function() {
      const container = document.getElementById('display-none-container');
      if (container) {
        container.style.display = container.style.display === 'none' ? '' : 'none';
      }
    });

    document.getElementById('btn-toggle-disabled').addEventListener('click', function() {
      const field = document.getElementById('toggle-disabled-field');
      if (field) field.disabled = !field.disabled;
    });

    document.getElementById('btn-toggle-readonly').addEventListener('click', function() {
      const field = document.getElementById('toggle-readonly-field');
      if (field) field.readOnly = !field.readOnly;
    });

    document.getElementById('btn-toggle-otp-autocomplete').addEventListener('click', function() {
      const field = document.getElementById('toggle-transition-field');
      if (field) field.autocomplete = field.autocomplete === 'one-time-code' ? '' : 'one-time-code';
    });
  </script>
</body>
</html>`;
}
