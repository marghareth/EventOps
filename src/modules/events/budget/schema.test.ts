// src/modules/events/budget/schema.test.ts
import { describe, expect, it } from "vitest";
import { categoryFormSchema, itemFormSchema } from "./schema";

const CATEGORY_ID = "7b0f1c1e-4a0e-4f3b-9d6a-0d5d6f1f2a3b";

describe("categoryFormSchema", () => {
  it("trims the name and normalizes the allocation", () => {
    const parsed = categoryFormSchema.parse({ name: "  Venue ", allocation: "₱350,000" });
    expect(parsed).toEqual({ name: "Venue", allocation: "350000.00" });
  });

  it("reports a blank name, a too-long name and a bad allocation", () => {
    const result = categoryFormSchema.safeParse({ name: "   ", allocation: "-5" });
    expect(result.success).toBe(false);
    const long = categoryFormSchema.safeParse({ name: "x".repeat(121), allocation: "0" });
    expect(long.success).toBe(false);
  });

  it("collapses inner spaces in the name (D-084)", () => {
    expect(categoryFormSchema.parse({ name: " Food   and  drinks ", allocation: "0" }).name).toBe(
      "Food and drinks",
    );
  });

  it("accepts an allocation of zero", () => {
    expect(categoryFormSchema.parse({ name: "Misc", allocation: "0" }).allocation).toBe("0.00");
  });
});

describe("itemFormSchema", () => {
  const valid = {
    categoryId: CATEGORY_ID,
    name: "Venue deposit",
    estimated: "50000",
    committed: "0",
    paid: "0",
    notes: "",
  };

  it("stores empty notes as null and keeps real notes trimmed", () => {
    expect(itemFormSchema.parse(valid).notes).toBeNull();
    expect(itemFormSchema.parse({ ...valid, notes: "  call back Friday " }).notes).toBe(
      "call back Friday",
    );
  });

  it("stores an empty committed or paid amount as 0.00, but requires an estimate (D-085)", () => {
    const parsed = itemFormSchema.parse({ ...valid, committed: "", paid: "  " });
    expect(parsed.committed).toBe("0.00");
    expect(parsed.paid).toBe("0.00");
    expect(itemFormSchema.safeParse({ ...valid, estimated: "" }).success).toBe(false);
  });

  it("refuses a category ID that is not a UUID", () => {
    expect(itemFormSchema.safeParse({ ...valid, categoryId: "venue" }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...valid, categoryId: "" }).success).toBe(false);
  });

  it.each(["estimated", "committed", "paid"] as const)("refuses a negative %s", (field) => {
    expect(itemFormSchema.safeParse({ ...valid, [field]: "-1" }).success).toBe(false);
  });

  it("refuses notes over 2,000 characters", () => {
    expect(itemFormSchema.safeParse({ ...valid, notes: "n".repeat(2001) }).success).toBe(false);
  });
});