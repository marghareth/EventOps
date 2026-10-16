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
// B5-F12: boundaries and relationships the budget forms must hold on the server (D-084, D-085).
describe("budget validation boundaries (B5-F12)", () => {
  const item = {
    categoryId: CATEGORY_ID,
    name: "Venue deposit",
    estimated: "50000",
    committed: "",
    paid: "",
    notes: "",
  };
  const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues[0]?.message;

  it("accepts a name of exactly 120 characters and refuses 121, after trimming", () => {
    expect(categoryFormSchema.safeParse({ name: "x".repeat(120), allocation: "0" }).success).toBe(
      true,
    );
    expect(
      categoryFormSchema.safeParse({ name: ` ${"x".repeat(120)} `, allocation: "0" }).success,
    ).toBe(true);
    expect(categoryFormSchema.safeParse({ name: "x".repeat(121), allocation: "0" }).success).toBe(
      false,
    );
    expect(itemFormSchema.safeParse({ ...item, name: "x".repeat(120) }).success).toBe(true);
    expect(itemFormSchema.safeParse({ ...item, name: "x".repeat(121) }).success).toBe(false);
  });

  it("refuses a name that is only spaces, with a message that says what to enter", () => {
    expect(firstMessage(categoryFormSchema.safeParse({ name: "   ", allocation: "0" }))).toBe(
      "Enter a category name.",
    );
    expect(firstMessage(itemFormSchema.safeParse({ ...item, name: "\t " }))).toBe(
      "Enter an item name.",
    );
  });

  it("accepts notes of exactly 2,000 characters and refuses 2,001", () => {
    expect(itemFormSchema.safeParse({ ...item, notes: "n".repeat(2000) }).success).toBe(true);
    expect(itemFormSchema.safeParse({ ...item, notes: "n".repeat(2001) }).success).toBe(false);
  });

  it("treats notes of only spaces as no notes", () => {
    expect(itemFormSchema.parse({ ...item, notes: "   " }).notes).toBeNull();
  });

  it("requires the category and the estimate, but not committed or paid", () => {
    expect(itemFormSchema.safeParse({ ...item, estimated: "" }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, categoryId: "" }).success).toBe(false);
    expect(itemFormSchema.parse(item)).toMatchObject({ committed: "0.00", paid: "0.00" });
  });

  it("refuses a missing field instead of crashing", () => {
    expect(categoryFormSchema.safeParse({}).success).toBe(false);
    expect(itemFormSchema.safeParse({}).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, notes: undefined }).success).toBe(false);
  });

  it("drops fields that are not part of the form, so they can never reach storage", () => {
    const parsed = itemFormSchema.parse({ ...item, eventId: "other", number: "9", id: "x" });
    expect(Object.keys(parsed).sort()).toEqual(
      ["categoryId", "committed", "estimated", "name", "notes", "paid"].sort(),
    );
    const category = categoryFormSchema.parse({ name: "Venue", allocation: "1", eventId: "other" });
    expect(Object.keys(category).sort()).toEqual(["allocation", "name"]);
  });

  it.each([
    ["-1", "can't be negative"],
    ["1.234", "at most two decimals"],
    ["abc", "at most two decimals"],
    ["10000000000", "too large"],
  ])("reports %s on every amount with a specific message", (raw, part) => {
    for (const field of ["estimated", "committed", "paid"] as const) {
      const result = itemFormSchema.safeParse({ ...item, [field]: raw });
      expect(result.success, `${field} ${raw}`).toBe(false);
      expect(firstMessage(result)).toContain(part);
    }
    expect(firstMessage(categoryFormSchema.safeParse({ name: "V", allocation: raw }))).toContain(
      part,
    );
  });

  it("names the field in the blank-estimate and blank-allocation messages", () => {
    expect(firstMessage(itemFormSchema.safeParse({ ...item, estimated: " " }))).toBe(
      "Enter an estimated amount. Use 0 if there is none.",
    );
    expect(firstMessage(categoryFormSchema.safeParse({ name: "V", allocation: "" }))).toBe(
      "Enter an allocation. Use 0 if there is none.",
    );
  });

  it("accepts the largest amount the column holds, exactly, on every amount", () => {
    const parsed = itemFormSchema.parse({
      ...item,
      estimated: "9,999,999,999.99",
      committed: "9999999999.99",
      paid: "₱9999999999.99",
    });
    expect([parsed.estimated, parsed.committed, parsed.paid]).toEqual(
      Array(3).fill("9999999999.99"),
    );
  });

  // No approved rule ties these amounts together, so none is invented here (D-085; D-089 allows paid
  // above committed). If the product wants one, it is a new decision.
  it("does not tie committed to estimated, or paid to committed", () => {
    const parsed = itemFormSchema.parse({
      ...item,
      estimated: "100",
      committed: "500",
      paid: "900",
    });
    expect(parsed).toMatchObject({ estimated: "100.00", committed: "500.00", paid: "900.00" });
  });

  it("accepts a category ID in any letter case but refuses anything that is not a UUID", () => {
    expect(
      itemFormSchema.safeParse({ ...item, categoryId: CATEGORY_ID.toUpperCase() }).success,
    ).toBe(true);
    for (const bad of [
      "1",
      "7b0f1c1e-4a0e-4f3b-9d6a",
      `${CATEGORY_ID}0`,
      "'; DROP TABLE budget_items;--",
    ]) {
      expect(itemFormSchema.safeParse({ ...item, categoryId: bad }).success, bad).toBe(false);
    }
  });
});