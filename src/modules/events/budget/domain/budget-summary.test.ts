// src/modules/events/budget/domain/budget-summary.test.ts
// The budget summary and remaining rule (B5-F07, B5-F08; D-088). Boundaries are exact to the
// centavo.
import { describe, expect, it } from "vitest";
import {
  BUDGET_STATUSES,
  BUDGET_STATUS_LABELS,
  overBudgetWarnings,
  summarizeBudget,
  summarizeEventBudget,
} from "./budget-summary";

const item = (estimated: string, committed: string, paid: string) => ({
  estimated,
  committed,
  paid,
});

describe("summarizeBudget", () => {
  it("is within budget with the difference remaining when committed is under", () => {
    expect(summarizeBudget({ allocated: "350000.00", committed: "300000.00" })).toEqual({
      allocated: "350000.00",
      committed: "300000.00",
      remaining: "50000.00",
      overBy: null,
      status: "WITHIN_BUDGET",
    });
  });

  it("is within budget, with 0.00 remaining, when committed equals the allocation", () => {
    const summary = summarizeBudget({ allocated: "350000.00", committed: "350000.00" });
    expect(summary.status).toBe("WITHIN_BUDGET");
    expect(summary.remaining).toBe("0.00");
    expect(summary.overBy).toBeNull();
  });

  it("is over budget by one centavo when committed is one centavo above", () => {
    const summary = summarizeBudget({ allocated: "350000.00", committed: "350000.01" });
    expect(summary.status).toBe("OVER_BUDGET");
    expect(summary.overBy).toBe("0.01");
    expect(summary.remaining).toBe("-0.01");
  });

  it("is within budget when committed is one centavo under", () => {
    const summary = summarizeBudget({ allocated: "350000.00", committed: "349999.99" });
    expect(summary.status).toBe("WITHIN_BUDGET");
    expect(summary.remaining).toBe("0.01");
  });

  it("is over budget for the brand book example: ₱350,000 allocated, ₱370,000 committed", () => {
    const summary = summarizeBudget({ allocated: "350000.00", committed: "370000.00" });
    expect(summary.status).toBe("OVER_BUDGET");
    expect(summary.overBy).toBe("20000.00");
    expect(summary.remaining).toBe("-20000.00");
  });

  it("treats a zero allocation as over once anything is committed, and within at zero", () => {
    expect(summarizeBudget({ allocated: "0.00", committed: "0.01" }).status).toBe("OVER_BUDGET");
    const zero = summarizeBudget({ allocated: "0.00", committed: "0.00" });
    expect(zero.status).toBe("WITHIN_BUDGET");
    expect(zero.remaining).toBe("0.00");
  });

  it("is exact where floating point is not", () => {
    expect(summarizeBudget({ allocated: "0.30", committed: "0.20" }).remaining).toBe("0.10");
    expect(summarizeBudget({ allocated: "0.10", committed: "0.30" }).remaining).toBe("-0.20");
  });

  it("handles amounts at the column limit", () => {
    expect(
      summarizeBudget({ allocated: "9999999999.99", committed: "9999999999.99" }).remaining,
    ).toBe("0.00");
    expect(summarizeBudget({ allocated: "9999999999.99", committed: "0.00" }).remaining).toBe(
      "9999999999.99",
    );
    expect(summarizeBudget({ allocated: "0.00", committed: "9999999999.99" }).overBy).toBe(
      "9999999999.99",
    );
  });

  it("has only the two approved statuses, each with a label", () => {
    expect([...BUDGET_STATUSES]).toEqual(["WITHIN_BUDGET", "OVER_BUDGET"]);
    expect(BUDGET_STATUS_LABELS).toEqual({
      WITHIN_BUDGET: "Within budget",
      OVER_BUDGET: "Over budget",
    });
  });
});

describe("summarizeEventBudget", () => {
  it("is within budget at zero for an event with no categories", () => {
    const summary = summarizeEventBudget([]);
    expect(summary.event).toMatchObject({
      allocated: "0.00",
      committed: "0.00",
      estimated: "0.00",
      paid: "0.00",
      remaining: "0.00",
      status: "WITHIN_BUDGET",
    });
    expect(summary.categories).toEqual([]);
  });

  it("reports an empty category as within budget with its whole allocation remaining", () => {
    const summary = summarizeEventBudget([
      { id: "c1", name: "C1", allocation: "5000.00", items: [] },
    ]);
    expect(summary.categories[0]).toMatchObject({
      id: "c1",
      remaining: "5000.00",
      status: "WITHIN_BUDGET",
    });
  });

  it("can have a category over budget while the event is within it", () => {
    const summary = summarizeEventBudget([
      {
        id: "food",
        name: "Food",
        allocation: "100000.00",
        items: [item("120000.00", "110000.00", "0.00")],
      },
      {
        id: "venue",
        name: "Venue",
        allocation: "200000.00",
        items: [item("90000.00", "80000.00", "40000.00")],
      },
    ]);
    expect(summary.categories.map((category) => category.status)).toEqual([
      "OVER_BUDGET",
      "WITHIN_BUDGET",
    ]);
    expect(summary.categories[0]?.overBy).toBe("10000.00");
    expect(summary.event).toMatchObject({
      allocated: "300000.00",
      committed: "190000.00",
      estimated: "210000.00",
      paid: "40000.00",
      remaining: "110000.00",
      status: "WITHIN_BUDGET",
    });
  });

  it("is within budget at the event level when every category is within its own", () => {
    // The event allocation is the sum of the category allocations, so this must always hold.
    const summary = summarizeEventBudget([
      { id: "a", name: "A", allocation: "100.00", items: [item("0.00", "100.00", "0.00")] },
      { id: "b", name: "B", allocation: "50.00", items: [item("0.00", "50.00", "0.00")] },
    ]);
    expect(summary.categories.every((category) => category.status === "WITHIN_BUDGET")).toBe(true);
    expect(summary.event.status).toBe("WITHIN_BUDGET");
  });

  it("does not raise a status when estimated is above the allocation (D-088)", () => {
    const summary = summarizeEventBudget([
      { id: "a", name: "A", allocation: "1000.00", items: [item("5000.00", "0.00", "0.00")] },
    ]);
    expect(summary.categories[0]?.status).toBe("WITHIN_BUDGET");
    expect(summary.event.status).toBe("WITHIN_BUDGET");
  });

  it("is over budget at the event level when total committed exceeds total allocated", () => {
    const summary = summarizeEventBudget([
      { id: "a", name: "A", allocation: "100.00", items: [item("0.00", "100.01", "0.00")] },
    ]);
    expect(summary.event.status).toBe("OVER_BUDGET");
    expect(summary.event.overBy).toBe("0.01");
  });
});

describe("overBudgetWarnings", () => {
  it("is empty when nothing is over, including exactly equal", () => {
    expect(overBudgetWarnings(summarizeEventBudget([]))).toEqual([]);
    const equal = summarizeEventBudget([
      { id: "a", name: "Venue", allocation: "100.00", items: [item("0.00", "100.00", "0.00")] },
    ]);
    expect(overBudgetWarnings(equal)).toEqual([]);
  });

  it("explains an over category, naming the limit, the amounts and the difference", () => {
    const warnings = overBudgetWarnings(
      summarizeEventBudget([
        {
          id: "food",
          name: "Catering",
          allocation: "100000.00",
          items: [item("0.00", "110000.50", "0.00")],
        },
        {
          id: "venue",
          name: "Venue",
          allocation: "200000.00",
          items: [item("0.00", "80000.00", "0.00")],
        },
      ]),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      scope: "category",
      id: "food",
      name: "Catering",
      allocated: "100000.00",
      committed: "110000.50",
      overBy: "10000.50",
    });
    expect(warnings[0]?.message).toBe(
      "Catering is over budget: ₱110,000.50 is committed and its allocation is ₱100,000.00, ₱10,000.50 more.",
    );
  });

  it("lists the event first, then each over category in order, with the brand book example", () => {
    const warnings = overBudgetWarnings(
      summarizeEventBudget([
        {
          id: "a",
          name: "Venue",
          allocation: "350000.00",
          items: [item("0.00", "370000.00", "0.00")],
        },
        {
          id: "b",
          name: "Music",
          allocation: "10000.00",
          items: [item("0.00", "10000.01", "0.00")],
        },
      ]),
    );
    expect(warnings.map((w) => [w.scope, w.name, w.overBy])).toEqual([
      ["event", "The event", "20000.01"],
      ["category", "Venue", "20000.00"],
      ["category", "Music", "0.01"],
    ]);
    expect(warnings[0]?.message).toBe(
      "The event is over budget: ₱380,000.01 is committed against ₱360,000.00 allocated in total, ₱20,000.01 more.",
    );
  });

  it("says a zero-allocation category has no allocation", () => {
    const [, warning] = overBudgetWarnings(
      summarizeEventBudget([
        { id: "x", name: "Extras", allocation: "0.00", items: [item("0.00", "0.01", "0.00")] },
      ]),
    );
    expect(warning?.message).toContain("Extras is over budget");
    expect(warning?.message).toContain("it has no allocation");
  });

  it("warns about a category even when the event as a whole is within budget", () => {
    const warnings = overBudgetWarnings(
      summarizeEventBudget([
        { id: "a", name: "Food", allocation: "100.00", items: [item("0.00", "150.00", "0.00")] },
        { id: "b", name: "Venue", allocation: "500.00", items: [] },
      ]),
    );
    expect(warnings.map((w) => w.scope)).toEqual(["category"]);
  });

  it("never warns because of estimated or paid alone (D-088)", () => {
    const warnings = overBudgetWarnings(
      summarizeEventBudget([
        { id: "a", name: "Food", allocation: "100.00", items: [item("999.00", "50.00", "999.00")] },
      ]),
    );
    expect(warnings).toEqual([]);
  });
});