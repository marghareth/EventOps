// src/modules/events/suppliers/categories.test.ts
// Supplier categories (B4-02, D-069): one canonical list equal to the database enum, a label and a
// description for each, and validation that accepts only canonical values, requires a description
// for Other and never stores one for another category.
import { describe, expect, it } from "vitest";
import { SupplierCategory as DbSupplierCategory } from "@/generated/prisma/enums";
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_DEFINITIONS,
  isSupplierCategory,
  supplierCategoryText,
} from "./categories";
import { supplierCategoryFields } from "./schema";

const parse = (category: string, categoryDetail = "") =>
  supplierCategoryFields.safeParse({ category, categoryDetail });
const errorFor = (result: ReturnType<typeof parse>, field: string) =>
  result.success ? undefined : result.error.issues.find((i) => i.path[0] === field)?.message;

describe("the canonical supplier categories", () => {
  it("equal the database enum", () => {
    expect([...SUPPLIER_CATEGORIES].sort()).toEqual(Object.values(DbSupplierCategory).sort());
  });

  it("each have a distinct label and a description, with Other last", () => {
    const labels = SUPPLIER_CATEGORIES.map((c) => SUPPLIER_CATEGORY_DEFINITIONS[c].label);
    expect(new Set(labels).size).toBe(SUPPLIER_CATEGORIES.length);
    for (const category of SUPPLIER_CATEGORIES) {
      expect(SUPPLIER_CATEGORY_DEFINITIONS[category].description).toMatch(/\.$/);
    }
    expect(SUPPLIER_CATEGORIES.at(-1)).toBe("OTHER");
  });

  it("recognise only canonical values", () => {
    expect(isSupplierCategory("CATERING")).toBe(true);
    for (const value of ["catering", "Catering", " CATERING", "DRONES", "", null, 3]) {
      expect(isSupplierCategory(value)).toBe(false);
    }
  });

  it("read as the label, or Other with what the supplier provides", () => {
    expect(supplierCategoryText("SOUND_AND_LIGHTS", null)).toBe("Sound and lights");
    expect(supplierCategoryText("OTHER", "Fireworks")).toBe("Other: Fireworks");
    expect(supplierCategoryText("OTHER", null)).toBe("Other");
  });
});

describe("supplierCategoryFields", () => {
  it.each(SUPPLIER_CATEGORIES.filter((c) => c !== "OTHER"))("accepts %s", (category) => {
    expect(parse(category)).toEqual({
      success: true,
      data: { category, categoryDetail: null },
    });
  });

  it.each(["catering", "Catering", "DRONES", ""])("refuses %j, with a message", (value) => {
    expect(errorFor(parse(value), "category")).toBe("Choose what the supplier provides.");
  });

  it("requires a description for Other, tidied", () => {
    expect(errorFor(parse("OTHER"), "categoryDetail")).toMatch(/Say what the supplier provides/);
    expect(errorFor(parse("OTHER", "   "), "categoryDetail")).toMatch(/Say what/);
    expect(parse("OTHER", "  Fireworks   and  sparklers ")).toEqual({
      success: true,
      data: { category: "OTHER", categoryDetail: "Fireworks and sparklers" },
    });
  });

  it("drops a description sent with another category, so it is never stored", () => {
    expect(parse("CATERING", "Fireworks")).toEqual({
      success: true,
      data: { category: "CATERING", categoryDetail: null },
    });
  });

  it("limits the description to 60 characters and refuses a NUL character", () => {
    expect(parse("OTHER", "a".repeat(60)).success).toBe(true);
    expect(errorFor(parse("OTHER", "a".repeat(61)), "categoryDetail")).toBe(
      "Use 60 characters or fewer.",
    );
    expect(errorFor(parse("OTHER", "Fire\u0000works"), "categoryDetail")).toMatch(/invisible/);
  });
});