// src/modules/events/health/domain/score.test.ts
// @vitest-environment node
// B8-F01 to B8-F10, B8-F12, B8-F18 (D-105, D-106): every Event Health check with its boundaries, the
// score (passed ÷ evaluated, rounded down; Not checked left out), the status (from severities, never
// the score), the issue order and the empty event.
import { describe, expect, it } from "vitest";
import type { HealthCheckResult } from "./health-check";
import type { HealthAttendee, HealthState, HealthSupplier, HealthTask } from "./health-state";
import { evaluateHealth, healthScore, healthStatus } from "./score";

const EMPTY: HealthState = {
  expectedAttendees: 0,
  capacity: null,
  attendees: [],
  confirmedHeadcount: 0,
  suppliers: [],
  budget: { hasCategories: false, allocatedText: "₱0.00", remainingText: "₱0.00", warnings: [] },
  accessibility: { status: "NO_REQUIRED_NEEDS", alerts: [] },
  tasks: [],
};

const guest = (n: number, over: Partial<HealthAttendee> = {}): HealthAttendee => ({
  reference: `ATT-${String(n).padStart(4, "0")}`,
  name: `Guest ${n}`,
  rsvpStatus: "CONFIRMED",
  hasContact: true,
  ...over,
});
const supplier = (n: number, over: Partial<HealthSupplier> = {}): HealthSupplier => ({
  reference: `SUP-${String(n).padStart(4, "0")}`,
  name: `Supplier ${n}`,
  confirmed: true,
  overduePayments: 0,
  hasContact: true,
  ...over,
});
const task = (n: number, over: Partial<HealthTask> = {}): HealthTask => ({
  reference: `TSK-${String(n).padStart(4, "0")}`,
  title: `Task ${n}`,
  priority: "MEDIUM",
  done: false,
  overdue: false,
  assigned: true,
  ...over,
});

/** A healthy event: every check passes. */
const HEALTHY: HealthState = {
  expectedAttendees: 180,
  capacity: 200,
  attendees: [guest(1), guest(2)],
  confirmedHeadcount: 2,
  suppliers: [supplier(1)],
  budget: {
    hasCategories: true,
    allocatedText: "₱350,000.00",
    remainingText: "₱38,000.00",
    warnings: [],
  },
  accessibility: { status: "READY", alerts: [] },
  tasks: [task(1)],
};

const check = (state: HealthState, id: string): HealthCheckResult => {
  const found = evaluateHealth(state).checks.find((c) => c.id === id);
  if (!found) throw new Error(`No check ${id}`);
  return found;
};

describe("the fixed checks (B8-F01)", () => {
  it("always runs the same 13 checks in the same order", () => {
    const ids = evaluateHealth(HEALTHY).checks.map((c) => c.id);
    expect(ids).toEqual([
      "attendees.list",
      "attendees.rsvp",
      "attendees.contact",
      "attendees.capacity",
      "attendees.planning",
      "suppliers.confirmed",
      "suppliers.overdue",
      "suppliers.contact",
      "budget.event",
      "budget.categories",
      "accessibility.readiness",
      "tasks.overdue",
      "tasks.unassigned",
    ]);
    expect(evaluateHealth(EMPTY).checks.map((c) => c.id)).toEqual(ids);
  });

  it("passes a healthy event: 100%, Ready, no issues", () => {
    const report = evaluateHealth(HEALTHY);
    expect(report.score).toEqual({ percent: 100, passed: 13, evaluated: 13 });
    expect(report.status).toBe("READY");
    expect(report.issues).toEqual([]);
  });

  it("has no score and no status for a brand-new event (B8-F19)", () => {
    const report = evaluateHealth(EMPTY);
    expect(report.counts).toEqual({ CRITICAL: 0, NEEDS_ATTENTION: 0, PASSED: 0, NOT_CHECKED: 13 });
    expect(report.score).toBeNull();
    expect(report.status).toBeNull();
    expect(report.issues).toEqual([]);
  });

  it("is deterministic", () => {
    expect(evaluateHealth(HEALTHY)).toEqual(evaluateHealth(HEALTHY));
  });
});

describe("attendee data (B8-F02)", () => {
  it("flags Pending and Maybe, not Declined, and names them", () => {
    const state = {
      ...HEALTHY,
      attendees: [
        guest(1, { rsvpStatus: "PENDING" }),
        guest(2, { rsvpStatus: "MAYBE" }),
        guest(3, { rsvpStatus: "DECLINED" }),
      ],
    };
    const result = check(state, "attendees.rsvp");
    expect(result).toMatchObject({
      outcome: "NEEDS_ATTENTION",
      summary: "2 guests haven't replied yet",
      references: ["ATT-0001", "ATT-0002"],
    });
    expect(result.reason).toContain("Guest 1 (ATT-0001) and Guest 2 (ATT-0002)");
  });

  it("names at most five guests and counts the rest", () => {
    const attendees = Array.from({ length: 8 }, (_, i) => guest(i + 1, { hasContact: false }));
    const result = check({ ...HEALTHY, attendees }, "attendees.contact");
    expect(result.summary).toBe("8 guests have no email or phone");
    expect(result.reason).toContain("and 3 more");
    expect(result.references).toHaveLength(8);
  });

  it("is Critical one person over capacity, and passes exactly at capacity", () => {
    expect(
      check({ ...HEALTHY, capacity: 200, confirmedHeadcount: 201 }, "attendees.capacity"),
    ).toMatchObject({
      outcome: "CRITICAL",
      summary: "1 person more than the venue holds",
    });
    expect(
      check({ ...HEALTHY, capacity: 200, confirmedHeadcount: 200 }, "attendees.capacity").outcome,
    ).toBe("PASSED");
  });

  it("doesn't check capacity when none is set", () => {
    expect(check({ ...HEALTHY, capacity: null }, "attendees.capacity")).toMatchObject({
      outcome: "NOT_CHECKED",
      fix: { target: "settings" },
    });
  });

  it("needs attention one person above the expected attendance, and passes exactly at it", () => {
    expect(
      check({ ...HEALTHY, expectedAttendees: 10, confirmedHeadcount: 11 }, "attendees.planning")
        .outcome,
    ).toBe("NEEDS_ATTENTION");
    expect(
      check({ ...HEALTHY, expectedAttendees: 10, confirmedHeadcount: 10 }, "attendees.planning")
        .outcome,
    ).toBe("PASSED");
  });

  it("checks nothing about guests while the list is empty", () => {
    const report = evaluateHealth({ ...HEALTHY, attendees: [], confirmedHeadcount: 0 });
    for (const id of [
      "attendees.list",
      "attendees.rsvp",
      "attendees.contact",
      "attendees.capacity",
      "attendees.planning",
    ]) {
      expect(report.checks.find((c) => c.id === id)?.outcome).toBe("NOT_CHECKED");
    }
  });
});

describe("supplier confirmations (B8-F03)", () => {
  it("flags suppliers with no Accepted quote", () => {
    const state = { ...HEALTHY, suppliers: [supplier(1), supplier(2, { confirmed: false })] };
    expect(check(state, "suppliers.confirmed")).toMatchObject({
      outcome: "NEEDS_ATTENTION",
      summary: "1 supplier isn't confirmed",
      references: ["SUP-0002"],
    });
  });

  it("is Critical with any overdue payment, counting payments", () => {
    const state = {
      ...HEALTHY,
      suppliers: [supplier(1, { overduePayments: 2 }), supplier(2, { overduePayments: 1 })],
    };
    expect(check(state, "suppliers.overdue")).toMatchObject({
      outcome: "CRITICAL",
      summary: "3 payments are overdue",
      references: ["SUP-0001", "SUP-0002"],
    });
  });

  it("flags suppliers with no phone or email", () => {
    expect(
      check({ ...HEALTHY, suppliers: [supplier(1, { hasContact: false })] }, "suppliers.contact")
        .outcome,
    ).toBe("NEEDS_ATTENTION");
  });

  it("checks nothing while there are no suppliers", () => {
    const report = evaluateHealth({ ...HEALTHY, suppliers: [] });
    expect(report.checks.filter((c) => c.area === "SUPPLIERS").map((c) => c.outcome)).toEqual([
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
    ]);
  });
});

describe("budget (B8-F04)", () => {
  const over = (scope: "event" | "category", name: string) => ({
    scope,
    name,
    message: `${name} is over budget.`,
  });

  it("uses the budget's own warnings, for the event and each category", () => {
    const state = {
      ...HEALTHY,
      budget: {
        ...HEALTHY.budget,
        remainingText: null,
        warnings: [
          over("event", "The event"),
          over("category", "Catering"),
          over("category", "Venue"),
        ],
      },
    };
    expect(check(state, "budget.event")).toMatchObject({ outcome: "CRITICAL" });
    expect(check(state, "budget.event").reason).toContain("The event is over budget.");
    expect(check(state, "budget.categories")).toMatchObject({
      outcome: "CRITICAL",
      summary: "2 categories are over budget",
    });
  });

  it("can have a category over while the event is within", () => {
    const state = {
      ...HEALTHY,
      budget: { ...HEALTHY.budget, warnings: [over("category", "Catering")] },
    };
    expect(check(state, "budget.event").outcome).toBe("PASSED");
    expect(check(state, "budget.categories").outcome).toBe("CRITICAL");
  });

  it("says how much remains when within", () => {
    expect(check(HEALTHY, "budget.event").reason).toBe(
      "₱38,000.00 of ₱350,000.00 allocated remains, judged on committed amounts.",
    );
  });

  it("checks nothing without budget categories", () => {
    expect(check({ ...HEALTHY, budget: { ...EMPTY.budget } }, "budget.event").outcome).toBe(
      "NOT_CHECKED",
    );
  });
});

describe("accessibility (B8-F05)", () => {
  const withStatus = (status: HealthState["accessibility"]["status"]) => ({
    ...HEALTHY,
    accessibility: {
      status,
      alerts: [{ title: "Captioning is not set up", severity: "critical" as const }],
    },
  });

  it.each([
    ["NOT_READY", "CRITICAL"],
    ["ALMOST_READY", "NEEDS_ATTENTION"],
    ["READY", "PASSED"],
    ["NO_REQUIRED_NEEDS", "PASSED"],
  ] as const)("maps Batch 3's %s to %s", (status, outcome) => {
    expect(check(withStatus(status), "accessibility.readiness").outcome).toBe(outcome);
  });

  it("names the gaps Batch 3 found", () => {
    expect(check(withStatus("NOT_READY"), "accessibility.readiness").reason).toContain(
      "Captioning is not set up",
    );
  });

  it("doesn't check while the guest list is empty", () => {
    expect(
      check({ ...withStatus("NO_REQUIRED_NEEDS"), attendees: [] }, "accessibility.readiness")
        .outcome,
    ).toBe("NOT_CHECKED");
  });
});

describe("tasks (B8-F06)", () => {
  it("needs attention for an overdue task, Critical when one is High priority", () => {
    expect(
      check({ ...HEALTHY, tasks: [task(1, { overdue: true })] }, "tasks.overdue").outcome,
    ).toBe("NEEDS_ATTENTION");
    const result = check(
      {
        ...HEALTHY,
        tasks: [task(1, { overdue: true }), task(2, { overdue: true, priority: "HIGH" })],
      },
      "tasks.overdue",
    );
    expect(result).toMatchObject({
      outcome: "CRITICAL",
      summary: "2 tasks are overdue, 1 High priority",
      references: ["TSK-0001", "TSK-0002"],
    });
  });

  it("flags open High-priority tasks with no one assigned, but not Done or lower ones", () => {
    const state = {
      ...HEALTHY,
      tasks: [
        task(1, { priority: "HIGH", assigned: false }),
        task(2, { priority: "HIGH", assigned: false, done: true }),
        task(3, { priority: "MEDIUM", assigned: false }),
      ],
    };
    expect(check(state, "tasks.unassigned")).toMatchObject({
      outcome: "NEEDS_ATTENTION",
      references: ["TSK-0001"],
    });
  });

  it("checks nothing while there are no tasks", () => {
    expect(check({ ...HEALTHY, tasks: [] }, "tasks.overdue").outcome).toBe("NOT_CHECKED");
  });
});

describe("score and status (B8-F07, B8-F08)", () => {
  const results = (...outcomes: HealthCheckResult["outcome"][]) =>
    outcomes.map((outcome, i) => ({
      id: `c${i}`,
      area: "TASKS" as const,
      label: "x",
      outcome,
      summary: "x",
      reason: "x",
      references: [],
      fix: null,
    }));

  it("is passed ÷ evaluated, rounded down, leaving Not checked out", () => {
    expect(healthScore(results("PASSED", "PASSED", "NEEDS_ATTENTION"))).toEqual({
      percent: 66,
      passed: 2,
      evaluated: 3,
    });
    expect(healthScore(results("PASSED", "NOT_CHECKED", "NOT_CHECKED"))?.percent).toBe(100);
    expect(healthScore(results("CRITICAL"))?.percent).toBe(0);
    expect(healthScore(results("NOT_CHECKED"))).toBeNull();
  });

  it("takes the status from severities, not the score", () => {
    // 12 of 13 pass (92%) but one is Critical: At risk.
    expect(healthStatus(results(...Array(12).fill("PASSED"), "CRITICAL"))).toBe("AT_RISK");
    expect(healthStatus(results("PASSED", "NEEDS_ATTENTION", "NOT_CHECKED"))).toBe(
      "NEEDS_ATTENTION",
    );
    expect(healthStatus(results("PASSED", "NOT_CHECKED"))).toBe("READY");
    expect(healthStatus(results("NOT_CHECKED"))).toBeNull();
  });

  it("lists issues Critical first, then Needs attention, in check order", () => {
    const state: HealthState = {
      ...HEALTHY,
      attendees: [guest(1, { rsvpStatus: "PENDING" })],
      suppliers: [supplier(1, { overduePayments: 1, confirmed: false })],
      tasks: [task(1, { overdue: true, priority: "HIGH" })],
    };
    const report = evaluateHealth(state);
    expect(report.issues.map((i) => [i.id, i.outcome])).toEqual([
      ["suppliers.overdue", "CRITICAL"],
      ["tasks.overdue", "CRITICAL"],
      ["attendees.rsvp", "NEEDS_ATTENTION"],
      ["suppliers.confirmed", "NEEDS_ATTENTION"],
    ]);
    expect(report.status).toBe("AT_RISK");
    // 13 checks, all evaluated; 9 pass.
    expect(report.score).toEqual({ percent: 69, passed: 9, evaluated: 13 });
  });
});