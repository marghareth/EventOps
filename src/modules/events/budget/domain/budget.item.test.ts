// src/modules/events/budget/domain/budget.item.test.ts
import { describe, expect, it } from "vitest";
import { formatBudgetItemReference, isBudgetItemReference } from "./budget.item";

describe("budget item reference", () => {
  it("pads to four digits and grows past 9999", () => {
    expect(formatBudgetItemReference(1)).toBe("BUD-0001");
    expect(formatBudgetItemReference(42)).toBe("BUD-0042");
    expect(formatBudgetItemReference(12345)).toBe("BUD-12345");
  });

  it("recognizes only well-formed references", () => {
    expect(isBudgetItemReference("BUD-0004")).toBe(true);
    expect(isBudgetItemReference("BUD-12345")).toBe(true);
    for (const bad of [undefined, "", "BUD-4", "bud-0004", "SUP-0004", "BUD-0004<script>"]) {
      expect(isBudgetItemReference(bad)).toBe(false);
    }
  });
});