// src/modules/events/impact/application/impact-rules.test.ts
// @vitest-environment node
// B7-F03 to B7-F10, B7-F16 (D-101, D-102): every impact rule, its boundaries and severities, run
// through the real engine with the budget context's real rules (D-088), so "over budget" here is the
// Budget page's own calculation.
import { describe, expect, it } from "vitest";
import { NO_ASSUMPTIONS, type ImpactAssumptions } from "../domain/assumptions";
import { expectedAttendanceChange, InvalidChange } from "../domain/change-event";
import type { EventState } from "../domain/event-state";
import type { ImpactItem } from "../domain/impact-item";
import { runImpact } from "../domain/run-impact";
import { budgetTools } from "./budget-tools";

const CATERING_ID = "c0000000-0000-4000-8000-000000000001";
const VENUE_ID = "c0000000-0000-4000-8000-000000000002";

function state(overrides: Partial<EventState> = {}): EventState {
  return {
    expectedAttendees: 180,
    capacity: 200,
    budget: [],
    accessibility: { alerts: [], seatsAvailable: 0, seatsRecordedNeeds: 0 },
    tasks: [],
    ...overrides,
  };
}

const assume = (overrides: Partial<ImpactAssumptions> = {}): ImpactAssumptions => ({
  ...NO_ASSUMPTIONS,
  ...overrides,
});

function run(s: EventState, to: number, a: ImpactAssumptions = NO_ASSUMPTIONS) {
  return runImpact(s, expectedAttendanceChange(s.expectedAttendees, to), a, budgetTools);
}

const byKey = (items: ImpactItem[], key: string) => {
  const item = items.find((i) => i.key === key);
  if (!item) throw new Error(`No impact ${key} in ${items.map((i) => i.key).join(", ")}`);
  return item;
};

const category = (id: string, name: string, allocation: string, committed: string) => ({
  id,
  name,
  allocation,
  items: [{ estimated: committed, committed, paid: "0.00" }],
});

describe("the brand book example: expected attendees 180 → 220", () => {
  const s = state({
    capacity: 200,
    budget: [
      category(CATERING_ID, "Catering", "100000.00", "95000.00"),
      category(VENUE_ID, "Venue", "250000.00", "205000.00"),
    ],
    accessibility: {
      alerts: [
        {
          key: "ACCESSIBLE_SEATS:not-enough-seats",
          severity: "critical",
          title: "Not enough accessible seats",
          reason: "8 Required seating needs, 6 seats available. Makes the event Not ready.",
        },
      ],
      seatsAvailable: 8,
      seatsRecordedNeeds: 8,
    },
    tasks: [
      { reference: "TSK-0001", title: "Confirm catering headcount", description: null, done: false },
      { reference: "TSK-0002", title: "Book extra chairs", description: null, done: true },
      { reference: "TSK-0003", title: "Print the programs", description: null, done: false },
    ],
  });
  const result = run(
    s,
    220,
    assume({
      cateringCostPerHead: "300.00",
      accessibleSeatsPer100: "4.55",
      cateringCategoryId: CATERING_ID,
    }),
  );

  it("estimates catering at 40 × ₱300.00 = ₱12,000.00, as Needs attention", () => {
    const item = byKey(result.items, "catering-cost");
    expect(item).toMatchObject({
      severity: "NEEDS_ATTENTION",
      title: "Catering may increase by ₱12,000.00",
      basis: "ESTIMATE",
      assumptions: [{ label: "Catering cost per head", value: "₱300.00" }],
    });
    expect(item.reason).toContain("40 more people expected (180 → 220 (+40)) at ₱300.00 per head");
  });

  it("flags 20 more people than the venue holds as Critical", () => {
    expect(byKey(result.items, "seating-capacity")).toMatchObject({
      severity: "CRITICAL",
      title: "20 more people than the venue holds",
    });
  });

  it("puts the catering category over budget, but the event stays within", () => {
    expect(byKey(result.items, "budget-overrun:category")).toMatchObject({
      severity: "CRITICAL",
      title: "“Catering” may go over budget by ₱7,000.00",
    });
    const event = byKey(result.items, "budget-overrun");
    expect(event.severity).toBe("PASSED");
    expect(event.reason).toBe(
      "₱38,000.00 of ₱350,000.00 allocated remains after the estimated catering increase of ₱12,000.00.",
    );
  });

  it("keeps the recorded accessibility gap at Batch 3's severity and adds the seat estimate", () => {
    expect(byKey(result.items, "accessibility:ACCESSIBLE_SEATS:not-enough-seats")).toMatchObject({
      severity: "CRITICAL",
      basis: "RECORDED",
      title: "Still unresolved: Not enough accessible seats",
    });
    // 220 × 4.55 ÷ 100 = 10.01 → 11 seats; 8 available → 3 short.
    expect(byKey(result.items, "accessibility-seats-estimate")).toMatchObject({
      severity: "NEEDS_ATTENTION",
      title: "About 3 more accessible seats may be needed",
    });
  });

  it("lists only open tasks that mention an affected area", () => {
    expect(byKey(result.items, "related-tasks")).toMatchObject({
      severity: "NEEDS_ATTENTION",
      title: "1 task may need review",
      references: ["TSK-0001"],
    });
  });

  it("sums up as Critical, most serious first", () => {
    expect(result.overall).toBe("CRITICAL");
    expect(result.counts).toEqual({ CRITICAL: 3, NEEDS_ATTENTION: 3, INFO: 0, PASSED: 1 });
    const ranks = result.items.map((i) => ["CRITICAL", "NEEDS_ATTENTION", "INFO", "PASSED"].indexOf(i.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(result.items[0]?.area).toBe("SEATING");
  });

  it("is deterministic: the same input gives the same result", () => {
    const again = run(
      s,
      220,
      assume({
        cateringCostPerHead: "300.00",
        accessibleSeatsPer100: "4.55",
        cateringCategoryId: CATERING_ID,
      }),
    );
    expect(again).toEqual(result);
  });
});

describe("no change and invalid changes (B7-F15, B7-F17)", () => {
  it("analyzes nothing when the proposed value equals the stored one", () => {
    expect(run(state(), 180)).toEqual({
      change: { kind: "EXPECTED_ATTENDEES", from: 180, to: 180 },
      noChange: true,
      overall: null,
      counts: { CRITICAL: 0, NEEDS_ATTENTION: 0, INFO: 0, PASSED: 0 },
      items: [],
    });
  });

  it("refuses negative, fractional or too large numbers", () => {
    expect(() => expectedAttendanceChange(180, -1)).toThrow(InvalidChange);
    expect(() => expectedAttendanceChange(180, 2.5)).toThrow(InvalidChange);
    expect(() => expectedAttendanceChange(180, 1_000_001)).toThrow(InvalidChange);
    expect(() => expectedAttendanceChange(-1, 10)).toThrow(InvalidChange);
    expect(expectedAttendanceChange(0, 1_000_000)).toEqual({
      kind: "EXPECTED_ATTENDEES",
      from: 0,
      to: 1_000_000,
    });
  });

  it("refuses a change that doesn't start from the stored value", () => {
    expect(() =>
      runImpact(state(), expectedAttendanceChange(100, 220), NO_ASSUMPTIONS, budgetTools),
    ).toThrow(/does not start/);
  });
});

describe("seating capacity (B7-F04)", () => {
  it("passes exactly at capacity, with no room left", () => {
    const item = byKey(run(state({ capacity: 200 }), 200).items, "seating-capacity");
    expect(item.severity).toBe("PASSED");
    expect(item.reason).toContain("exactly full");
  });

  it("is Critical one person over capacity", () => {
    expect(byKey(run(state({ capacity: 200 }), 201).items, "seating-capacity")).toMatchObject({
      severity: "CRITICAL",
      title: "1 more person than the venue holds",
    });
  });

  it("passes below capacity and says how much room is left", () => {
    const item = byKey(run(state({ capacity: 250 }), 220).items, "seating-capacity");
    expect(item.severity).toBe("PASSED");
    expect(item.reason).toContain("leaving room for 30 more");
  });

  it("is Info with a link to settings when no capacity is set", () => {
    expect(byKey(run(state({ capacity: null }), 220).items, "seating-capacity")).toMatchObject({
      severity: "INFO",
      fix: { target: "settings" },
    });
  });

  it("says it is not a seating chart", () => {
    expect(byKey(run(state({ capacity: 100 }), 220).items, "seating-capacity").reason).toContain(
      "not a seating chart",
    );
  });
});

describe("catering cost (B7-F03)", () => {
  it("is Info and guesses nothing without a cost per head", () => {
    const item = byKey(run(state(), 220).items, "catering-cost");
    expect(item).toMatchObject({ severity: "INFO", fix: { target: "assumptions" } });
    expect(item.title).toBe("Catering cost not estimated");
  });

  it("multiplies in exact centavos (3 × ₱333.33 = ₱999.99)", () => {
    const item = byKey(
      run(state(), 183, assume({ cateringCostPerHead: "333.33" })).items,
      "catering-cost",
    );
    expect(item.title).toBe("Catering may increase by ₱999.99");
  });

  it("handles large values without floating point (999,999 × ₱9,999,999.99)", () => {
    const item = byKey(
      run(state({ expectedAttendees: 1 }), 1_000_000, assume({ cateringCostPerHead: "9999999.99" }))
        .items,
      "catering-cost",
    );
    expect(item.title).toBe("Catering may increase by ₱9,999,989,990,000.01");
  });

  it("reports a decrease as Info and warns that contracts may not shrink", () => {
    const item = byKey(
      run(state(), 150, assume({ cateringCostPerHead: "300.00" })).items,
      "catering-cost",
    );
    expect(item).toMatchObject({ severity: "INFO", title: "Catering may decrease by ₱9,000.00" });
    expect(item.reason).toContain("30 fewer people expected");
  });

  it("says ₱0.00 when the cost per head is zero", () => {
    expect(
      byKey(run(state(), 220, assume({ cateringCostPerHead: "0.00" })).items, "catering-cost"),
    ).toMatchObject({ severity: "INFO", title: "No catering cost change estimated" });
  });
});

describe("budget overrun (B7-F06)", () => {
  const within = [category(CATERING_ID, "Catering", "100000.00", "88000.00")];

  it("is Info when the event has no budget", () => {
    expect(byKey(run(state(), 220).items, "budget-overrun")).toMatchObject({
      severity: "INFO",
      title: "Budget not checked",
    });
  });

  it("passes exactly at the allocation (₱0.00 remaining)", () => {
    const item = byKey(
      run(state({ budget: within }), 220, assume({ cateringCostPerHead: "300.00" })).items,
      "budget-overrun",
    );
    expect(item.severity).toBe("PASSED");
    expect(item.reason).toContain("₱0.00 of ₱100,000.00 allocated remains");
  });

  it("is Critical one centavo over the allocation", () => {
    const tight = [category(CATERING_ID, "Catering", "100000.00", "88000.01")];
    expect(
      byKey(
        run(state({ budget: tight }), 220, assume({ cateringCostPerHead: "300.00" })).items,
        "budget-overrun",
      ),
    ).toMatchObject({ severity: "CRITICAL", title: "The event may go over budget by ₱0.01" });
  });

  it("says when the budget was already over before the change", () => {
    const over = [category(CATERING_ID, "Catering", "100000.00", "101000.00")];
    const item = byKey(
      run(state({ budget: over }), 220, assume({ cateringCostPerHead: "300.00" })).items,
      "budget-overrun",
    );
    expect(item).toMatchObject({ severity: "CRITICAL", title: "The event is already over budget" });
    expect(item.reason).toContain("would make it ₱13,000.00 over");
  });

  it("is already over even without a cost per head, and says the catering change isn't included", () => {
    const over = [category(CATERING_ID, "Catering", "100.00", "200.00")];
    expect(byKey(run(state({ budget: over }), 220).items, "budget-overrun").severity).toBe(
      "CRITICAL",
    );
    const fine = byKey(run(state({ budget: within }), 220).items, "budget-overrun");
    expect(fine.severity).toBe("PASSED");
    expect(fine.reason).toContain("no cost per head is set");
  });

  it("does not subtract an estimated decrease", () => {
    const item = byKey(
      run(state({ budget: within }), 100, assume({ cateringCostPerHead: "300.00" })).items,
      "budget-overrun",
    );
    expect(item.reason).toBe(
      "₱12,000.00 of ₱100,000.00 allocated remains. An estimated decrease isn't subtracted: committed amounts are already agreed.",
    );
  });

  it("is over as soon as anything is committed against a zero allocation", () => {
    const zero = [category(CATERING_ID, "Catering", "0.00", "0.00")];
    expect(
      byKey(
        run(state({ budget: zero }), 181, assume({ cateringCostPerHead: "0.01" })).items,
        "budget-overrun",
      ).severity,
    ).toBe("CRITICAL");
  });

  it("checks the chosen catering category on its own", () => {
    const budget = [
      category(CATERING_ID, "Catering", "10000.00", "9000.00"),
      category(VENUE_ID, "Venue", "500000.00", "0.00"),
    ];
    const items = run(
      state({ budget }),
      190,
      assume({ cateringCostPerHead: "300.00", cateringCategoryId: CATERING_ID }),
    ).items;
    expect(byKey(items, "budget-overrun").severity).toBe("PASSED");
    expect(byKey(items, "budget-overrun:category")).toMatchObject({
      severity: "CRITICAL",
      title: "“Catering” may go over budget by ₱2,000.00",
    });
  });

  it("is Info when the chosen category no longer exists", () => {
    const items = run(
      state({ budget: within }),
      220,
      assume({ cateringCategoryId: "c0000000-0000-4000-8000-0000000000ff" }),
    ).items;
    expect(byKey(items, "budget-category-missing")).toMatchObject({
      severity: "INFO",
      fix: { target: "assumptions" },
    });
  });
});

describe("accessibility (B7-F05)", () => {
  it("passes when Batch 3 found no gaps", () => {
    expect(byKey(run(state(), 220).items, "accessibility-gaps").severity).toBe("PASSED");
  });

  it("maps a Batch 3 warning to Needs attention", () => {
    const s = state({
      accessibility: {
        alerts: [
          {
            key: "CAPTIONING:being-arranged",
            severity: "warning",
            title: "Captioning is still being arranged",
            reason: "x",
          },
        ],
        seatsAvailable: 0,
        seatsRecordedNeeds: 0,
      },
    });
    expect(byKey(run(s, 220).items, "accessibility:CAPTIONING:being-arranged").severity).toBe(
      "NEEDS_ATTENTION",
    );
  });

  it("does not estimate seats without the ratio", () => {
    expect(byKey(run(state(), 220).items, "accessibility-seats-estimate")).toMatchObject({
      severity: "INFO",
      fix: { target: "assumptions" },
    });
  });

  it("rounds a fraction of a seat up (201 × 1 ÷ 100 = 2.01 → 3)", () => {
    const s = state({ accessibility: { alerts: [], seatsAvailable: 3, seatsRecordedNeeds: 0 } });
    const enough = byKey(
      run(s, 201, assume({ accessibleSeatsPer100: "1.00" })).items,
      "accessibility-seats-estimate",
    );
    expect(enough.severity).toBe("PASSED");
    expect(enough.reason).toContain("need about 3 accessible seats; 3 are available");
    const short = byKey(
      run(
        state({ accessibility: { alerts: [], seatsAvailable: 2, seatsRecordedNeeds: 0 } }),
        201,
        assume({ accessibleSeatsPer100: "1.00" }),
      ).items,
      "accessibility-seats-estimate",
    );
    expect(short).toMatchObject({ severity: "NEEDS_ATTENTION", title: "About 1 more accessible seat may be needed" });
  });

  it("needs no seats at a ratio of 0 and every seat at 100", () => {
    expect(
      byKey(run(state(), 220, assume({ accessibleSeatsPer100: "0.00" })).items, "accessibility-seats-estimate")
        .severity,
    ).toBe("PASSED");
    expect(
      byKey(run(state(), 220, assume({ accessibleSeatsPer100: "100.00" })).items, "accessibility-seats-estimate")
        .title,
    ).toBe("About 220 more accessible seats may be needed");
  });
});

describe("related tasks (B7-F07)", () => {
  const task = (reference: string, title: string, description: string | null = null, done = false) => ({
    reference,
    title,
    description,
    done,
  });

  it("matches whole words, plurals and stems, ignoring accents and capitals", () => {
    const s = state({
      tasks: [
        task("TSK-0001", "CATÉRING tasting"),
        task("TSK-0002", "Update the timetable"),
        task("TSK-0003", "Order linens", "for 22 Tables"),
        task("TSK-0004", "Seating plan"),
        task("TSK-0005", "Send RSVP reminders"),
      ],
    });
    const item = byKey(run(s, 220).items, "related-tasks");
    expect(item.references).toEqual(["TSK-0001", "TSK-0003", "TSK-0004", "TSK-0005"]);
    expect(item.reason).toContain("catering, seats, tables and RSVPs");
  });

  it("never reports a Done task", () => {
    const s = state({ tasks: [task("TSK-0001", "Confirm catering", null, true)] });
    expect(byKey(run(s, 220).items, "related-tasks").severity).toBe("PASSED");
  });

  it("passes when no task mentions an affected area", () => {
    expect(byKey(run(state({ tasks: [task("TSK-0001", "Print programs")] }), 220).items, "related-tasks"))
      .toMatchObject({ severity: "PASSED", references: [] });
  });
});

describe("explanations (B7-F09)", () => {
  it("gives every item a reason and labels estimates", () => {
    const result = run(
      state({ budget: [category(CATERING_ID, "Catering", "1.00", "0.00")] }),
      220,
      assume({ cateringCostPerHead: "300.00", accessibleSeatsPer100: "2.00" }),
    );
    for (const item of result.items) {
      expect(item.reason.length).toBeGreaterThan(20);
      expect(["ESTIMATE", "RECORDED"]).toContain(item.basis);
    }
    expect(byKey(result.items, "catering-cost").basis).toBe("ESTIMATE");
    expect(byKey(result.items, "accessibility-gaps").basis).toBe("RECORDED");
  });
});