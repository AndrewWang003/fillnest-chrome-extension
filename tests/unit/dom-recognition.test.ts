// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";

import { fieldObservedTitle, readSafeMetadata } from "../../src/fields/dom-field";
import {
  readDomRecognitionEvidence,
  readLogicalPageEvidence,
} from "../../src/recognition/dom-recognition";

describe("DOM recognition evidence", () => {
  afterEach(() => document.body.replaceChildren());

  it("assigns distinct structural ordinals to identical unlabelled supported fields", () => {
    document.body.innerHTML = '<main><input type="text"><input type="text"><textarea name="address"></textarea></main>';
    const [first, second] = [...document.querySelectorAll<HTMLInputElement>("input")];
    if (!first || !second) throw new Error("Test inputs are unavailable");

    const firstEvidence = readDomRecognitionEvidence(first);
    const secondEvidence = readDomRecognitionEvidence(second);

    expect(firstEvidence.fieldIdentityKey).not.toBeNull();
    expect(secondEvidence.fieldIdentityKey).not.toBeNull();
    expect(firstEvidence.fieldIdentityKey).not.toBe(secondEvidence.fieldIdentityKey);
    expect(firstEvidence.fieldIdentityKey).toContain('"ordinal":0');
    expect(secondEvidence.fieldIdentityKey).toContain('"ordinal":1');
  });

  it("derives opaque logical-page evidence from eligible metadata and group legends", async () => {
    document.body.innerHTML = `
      <fieldset><legend>Applicant details</legend>
        <label>Email <input id="email" name="email" type="email" value="must-not-be-read@example.test"></label>
        <label>Name <input id="name" name="name" type="text"></label>
      </fieldset>`;
    const email = document.querySelector<HTMLInputElement>("#email");
    if (!email) throw new Error("Email input is unavailable");

    const evidence = await readLogicalPageEvidence(email, "site-key");

    expect(evidence.origin).toBe(location.origin);
    expect(evidence.routePattern).toBe("/");
    expect(evidence.fieldIdentityKey).toContain('"name":"email"');
    expect([...evidence.fieldFeatures].join(" ")).not.toContain("Applicant");
    expect([...evidence.groupedFieldFeatures].join(" ")).not.toContain("Applicant");
    expect([...evidence.fieldFeatures].join(" ")).not.toContain("must-not-be-read");
  });

  // Task 039 Addendum A. C1's rule for native controls: a label's own text is
  // metadata; the text of a control inside that label is the page's or the
  // user's content. A `<textarea>`'s text is its content - filled in by the
  // server, or the typed value itself where a framework mirrors it there.
  it("keeps a wrapped textarea's content out of its label metadata and observed title (Task 039 Addendum A)", () => {
    document.body.innerHTML = `<label>Notes <textarea name="notes">private server draft</textarea></label>`;
    const field = document.querySelector("textarea");
    if (!field) throw new Error("Textarea is unavailable");

    expect(readSafeMetadata(field).label).toBe("Notes ");
    expect(fieldObservedTitle(field)).toBe("Notes");
    expect(readDomRecognitionEvidence(field).observedTitle).toBe("Notes");
  });

  it("keeps a typed value mirrored into a textarea's text out of its label (Task 039 Addendum A)", () => {
    document.body.innerHTML = `<label>Reply <textarea name="reply"></textarea></label>`;
    const field = document.querySelector("textarea");
    if (!field) throw new Error("Textarea is unavailable");
    // What a controlled React textarea does on every keystroke.
    field.value = "what the user is typing";
    field.defaultValue = "what the user is typing";

    expect(readSafeMetadata(field).label).toBe("Reply ");
    expect(fieldObservedTitle(field)).toBe("Reply");
  });

  it("keeps another control's text out of a native Field's label (Task 039 Addendum A)", () => {
    document.body.innerHTML = `<label for="subject">Subject
      <span contenteditable="true">PRIVATE EDITABLE TEXT</span>
      <textarea name="other">PRIVATE OTHER TEXT</textarea></label><input id="subject" name="subject">`;
    const field = document.querySelector("input");
    if (!field) throw new Error("Input is unavailable");

    expect(fieldObservedTitle(field)).toBe("Subject");
  });

  it("reads labels that hold no control exactly as before (Task 039 Addendum A)", () => {
    // The control sits outside its labels: happy-dom's `labels` grows on
    // every read for a wrapped control that has an `id`.
    document.body.innerHTML = `<label for="first">  First   name </label><label for="first">Given
      <b>name</b></label><input id="first" name="first">`;
    const field = document.querySelector("input");
    if (!field) throw new Error("Input is unavailable");
    const labels = [...document.querySelectorAll("label")];

    expect(readSafeMetadata(field).label).toBe(labels.map((label) => label.textContent ?? "").join(" "));
  });

  it("derives the same Logical Page evidence whatever a wrapped textarea holds (Task 039 Addendum A)", async () => {
    const markup = (content: string) => `
      <fieldset><legend>Case <textarea name="summary">${content}</textarea></legend>
        <label>Notes <textarea name="notes">${content}</textarea></label>
      </fieldset>`;
    document.body.innerHTML = markup("");
    const emptyField = document.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
    if (!emptyField) throw new Error("Textarea is unavailable");
    const empty = await readLogicalPageEvidence(emptyField, "site-key");

    document.body.innerHTML = markup("private server draft");
    const filledField = document.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
    if (!filledField) throw new Error("Textarea is unavailable");
    const filled = await readLogicalPageEvidence(filledField, "site-key");

    expect([...filled.fieldFeatures].sort()).toEqual([...empty.fieldFeatures].sort());
    expect([...filled.groupedFieldFeatures].sort()).toEqual([...empty.groupedFieldFeatures].sort());
    expect(filled.fieldIdentityKey).toBe(empty.fieldIdentityKey);
  });
});
