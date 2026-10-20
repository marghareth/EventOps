// src/modules/events/suppliers/import-rules.test.ts
// @vitest-environment node
// Supplier import rules (B9-F05, F08, F10; D-109, D-110): the mapping check, category words, and
// each row through the add form's schema with duplicates found.
import { describe, expect, it } from "vitest";
import { SUPPLIER_CATEGORIES } from "./categories";
import {
  SUPPLIER_IMPORT_FIELDS,
  buildSupplierImportPreview,
  readSupplierCategory,
  readSupplierMapping,
  suppliersToImport,
} from "./import-rules";
import { SUPPLIER_FIELDS } from "./schema";

describe("the fields", () => {
  it("are supplier form fields, and money is never one of them", () => {
    for (const field of SUPPLIER_IMPORT_FIELDS) expect(SUPPLIER_FIELDS).toContain(field);
    expect(SUPPLIER_IMPORT_FIELDS.join()).not.toMatch(/amount|quote|payment|deposit|price/i);
  });
});

describe("readSupplierMapping", () => {
  it("accepts one column each for name and category", () => {
    expect(readSupplierMapping(["name", "category", "", "email"], 4)).toEqual({
      ok: true,
      mapping: ["name", "category", null, "email"],
    });
  });

  it("refuses unknown fields, a field twice, and missing required columns", () => {
    expect(readSupplierMapping(["rsvpStatus", "email", "email"], 3)).toEqual({
      ok: false,
      errors: [
        "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
        "Email is chosen for more than one column. Choose it once.",
        "Choose the column that holds each supplier's name.",
        "Choose the column that says what each supplier provides (Category).",
      ],
    });
    expect(readSupplierMapping(["name"], 2)).toMatchObject({ ok: false });
  });
});

describe("readSupplierCategory (D-110)", () => {
  it.each([
    ["Caterer", "CATERING"],
    ["Lechon and buffet", "CATERING"],
    ["florist", "FLOWERS_AND_STYLING"],
    ["Photographer", "PHOTO_AND_VIDEO"],
    ["Photo and video", "PHOTO_AND_VIDEO"],
    ["PHOTO_AND_VIDEO", "PHOTO_AND_VIDEO"],
    ["Lights and sound", "SOUND_AND_LIGHTS"],
    ["HMUA", "HAIR_AND_MAKEUP"],
    ["Chairs and tables", "RENTALS"],
    ["Bridal car", "TRANSPORT"],
    ["Invitations", "PRINTING_AND_STATIONERY"],
    ["Wedding cake", "CAKE_AND_DESSERTS"],
    ["Église hall", "VENUE"],
  ])("reads %j as %s", (cell, category) => {
    expect(readSupplierCategory(cell)).toEqual({ category, categoryDetail: "" });
  });

  it("keeps anything else as Other, with the original text as what the supplier provides", () => {
    expect(readSupplierCategory("  Fireworks   show ")).toEqual({
      category: "OTHER",
      categoryDetail: "Fireworks show",
    });
  });

  it("gives no category for an empty cell", () => {
    expect(readSupplierCategory(" ")).toEqual({ category: "", categoryDetail: "" });
  });

  it("only returns listed categories", () => {
    for (const cell of ["dj", "venue", "x"]) {
      expect(SUPPLIER_CATEGORIES).toContain(readSupplierCategory(cell).category);
    }
  });
});

describe("buildSupplierImportPreview", () => {
  const table = {
    headers: ["Vendor", "Service", "Email", "Quote"],
    rows: [
      { line: 2, cells: ["Garden Kitchen", "Caterer", "hello@garden.ph", "120000"] },
      { line: 3, cells: ["Boom Bros", "Fireworks", "", "45000"] },
      { line: 4, cells: ["", "Florist", "not-an-email", ""] },
      { line: 5, cells: ["garden kitchen", "Catering", "", ""] },
      { line: 6, cells: ["Bloom Co.", "Florist", "", ""] },
      { line: 7, cells: ["Long Detail Co.", "x".repeat(61), "", ""] },
    ],
  };
  const mapping = ["name", "category", "email", null] as const;

  it("validates each row with the add form's rules and finds duplicates", () => {
    const preview = buildSupplierImportPreview(
      table,
      [...mapping],
      [{ name: "Bloom Co.", reference: "SUP-0003" }],
      { includeDuplicates: false },
    );
    expect(preview.totals).toEqual({ rows: 6, valid: 2, invalid: 2, duplicates: 2, toImport: 2 });
    expect(preview.ignoredColumns).toEqual(["Quote"]);
    const [kitchen, boom, invalid, again, bloom, long] = preview.rows;
    expect(kitchen).toMatchObject({
      status: "valid",
      saved: { name: "Garden Kitchen", category: "Catering", email: "hello@garden.ph" },
    });
    expect(boom.saved?.category).toBe("Other: Fireworks");
    expect(invalid.errors).toEqual([
      "Name: Enter the supplier's name.",
      "Email: Enter an email like name@example.com.",
    ]);
    expect(again).toMatchObject({ status: "duplicate", duplicateOf: "Repeats line 2 of the file" });
    expect(bloom).toMatchObject({
      status: "duplicate",
      duplicateOf: "Already added as Bloom Co. (SUP-0003)",
    });
    expect(long.errors[0]).toMatch(/^Category: “x+” is longer than 60 characters/);
  });

  it("imports valid rows, and duplicates only when chosen", () => {
    const options = { includeDuplicates: true };
    const preview = buildSupplierImportPreview(table, [...mapping], [], options);
    const suppliers = suppliersToImport(preview, options);
    expect(suppliers.map((s) => [s.name, s.category, s.categoryDetail])).toEqual([
      ["Garden Kitchen", "CATERING", null],
      ["Boom Bros", "OTHER", "Fireworks"],
      ["garden kitchen", "CATERING", null],
      ["Bloom Co.", "FLOWERS_AND_STYLING", null],
    ]);
    expect(suppliersToImport(preview, { includeDuplicates: false })).toHaveLength(3);
  });
});