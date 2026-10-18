import { describe, expect, it } from "vitest";

import { searchTemplates } from "../../src/templates/template-search";
import type { TemplateRecord } from "../../src/storage/fillnest-repository";

const template = (
  id: string,
  content: string,
  siteAffinities: string[],
): TemplateRecord => ({
  id,
  content,
  siteAffinities,
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
  totalUsageCount: 0,
  revision: 0,
});

describe("searchTemplates", () => {
  it("returns every unbound literal body match after trimming outer query whitespace and ignoring case", () => {
    const templates = [
      template("eligible", "Jordan Lee\nSupport contact", ["example.test"]),
      template("already-bound", "Jordan Lee\nBound contact", ["example.test"]),
      template("nonmatching", "Morgan Reed", ["example.test"]),
      template("wrong-site", "Jordan Lee\nPrivate note", ["other.test"]),
      template("global", "JORDAN LEE\nGlobal contact", []),
    ];

    expect(searchTemplates(templates, "  JoRdAn LeE  ", ["already-bound"])).toEqual([
      templates[0],
      templates[3],
      templates[4],
    ]);
    expect(searchTemplates(templates, "", [])).toEqual([]);
  });
});
