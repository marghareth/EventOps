// src/modules/events/budget/domain/budget.totals.test.ts
import { describe, expect, it } from "vitest";
import { sumPesos, totalAllocated, totalsOf } from "./budget.totals";

describe("sumPesos", () => {
  it("is 0.00 for no values", () => {
    expect(sumPesos([])).toBe("0.00");
  });

  it("adds exactly, with no floating-point error", () => {
    expect(sumPesos(["0.10", "0.20"])).toBe("0.30");
    expect(sumPesos(["0.01", "0.01", "0.01"])).toBe("0.03");
    expect(sumPesos(["1234.50", "0.50"])).toBe("1235.00");
  });

  it("keeps sub-peso amounts padded", () => {
    expect(sumPesos(["0.00"])).toBe("0.00");
    expect(sumPesos(["0.05"])).toBe("0.05");
    expect(sumPesos(["0.99", "0.01"])).toBe("1.00");
  });

  it("does not overflow past the column maximum of a single amount", () => {
    expect(sumPesos(["9999999999.99", "9999999999.99"])).toBe("19999999999.98");
  });
});

describe("totalsOf", () => {
  it("totals estimated, committed and paid separately", () => {
    expect(
      totalsOf([
        { estimated: "50000.00", committed: "20000.00", paid: "5000.25" },
        { estimated: "12500.50", committed: "0.00", paid: "0.10" },
      ]),
    ).toEqual({
      estimated: "62500.50",
      committed: "20000.00",
      paid: "5000.35",
    });
  });

  it("is zero for a category with no items", () => {
    expect(totalsOf([])).toEqual({
      estimated: "0.00",
      committed: "0.00",
      paid: "0.00",
    });
  });
});

describe("totalAllocated", () => {
  it("adds the allocations of all categories exactly", () => {
    expect(
      totalAllocated([
        { allocation: "350000.00" },
        { allocation: "0.10" },
        { allocation: "0.20" },
      ]),
    ).toBe("350000.30");
  });

  it("is 0.00 when there are no categories", () => {
    expect(totalAllocated([])).toBe("0.00");
  });

  it("counts a category with an allocation of zero as nothing", () => {
    expect(
      totalAllocated([{ allocation: "0.00" }, { allocation: "1200.00" }]),
    ).toBe("1200.00");
  });
});