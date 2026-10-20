// src/modules/events/impact/domain/run-impact.test.ts
// @vitest-environment node
// B7-F08, B7-F16 (D-101, D-102): the pure helpers under the rules. The rules themselves run with the
// budget's real calculation in application/impact-rules.test.ts.
import { describe, expect, it } from "vitest";
import { estimateAccessibleSeats, formatRatio, ratioHundredths } from "./assumptions";
import { describeChange, expectedAttendanceChange } from "./change-event";
import {
  countBySeverity,
  sortImpacts,
  worstSeverity,
  type ImpactArea,
  type ImpactItem,
  type ImpactSeverity,
} from "./impact-item";
import { mentionedKeywords } from "./rules/task-review";

const item = (key: string, severity: ImpactSeverity, area: ImpactArea): ImpactItem => ({
  key,
  area,
  severity,
  title: key,
  reason: key,
  basis: "RECORDED",
  assumptions: [],
  fix: null,
  references: [],
});

describe("severity (B7-F08)", () => {
  it("takes the most serious severity, and null for nothing", () => {
    expect(worstSeverity(["PASSED", "INFO", "NEEDS_ATTENTION"])).toBe("NEEDS_ATTENTION");
    expect(worstSeverity(["PASSED", "CRITICAL"])).toBe("CRITICAL");
    expect(worstSeverity(["PASSED"])).toBe("PASSED");
    expect(worstSeverity([])).toBeNull();
  });

  it("sorts by severity, then area, then rule order", () => {
    const sorted = sortImpacts([
      item("a", "PASSED", "SEATING"),
      item("b", "CRITICAL", "TASKS"),
      item("c", "CRITICAL", "SEATING"),
      item("d", "INFO", "BUDGET"),
      item("e", "CRITICAL", "TASKS"),
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["c", "b", "e", "d", "a"]);
  });

  it("counts every severity", () => {
    expect(countBySeverity([item("a", "INFO", "BUDGET"), item("b", "INFO", "TASKS")])).toEqual({
      CRITICAL: 0,
      NEEDS_ATTENTION: 0,
      INFO: 2,
      PASSED: 0,
    });
  });
});

describe("accessible seats per 100 guests (B7-F12, D-102)", () => {
  it("reads two-place ratios exactly", () => {
    expect(ratioHundredths("0.00")).toBe(0);
    expect(ratioHundredths("4.55")).toBe(455);
    expect(ratioHundredths("100.00")).toBe(10_000);
    expect(() => ratioHundredths("4.5")).toThrow();
  });

  it("rounds up to whole seats", () => {
    expect(estimateAccessibleSeats(100, "2.00")).toBe(2);
    expect(estimateAccessibleSeats(101, "2.00")).toBe(3);
    expect(estimateAccessibleSeats(0, "50.00")).toBe(0);
    expect(estimateAccessibleSeats(1_000_000, "100.00")).toBe(1_000_000);
  });

  it("reads a ratio as a short number", () => {
    expect(formatRatio("4.00")).toBe("4");
    expect(formatRatio("2.50")).toBe("2.5");
    expect(formatRatio("0.00")).toBe("0");
  });
});

describe("change description", () => {
  it("shows from, to and the signed difference", () => {
    expect(describeChange(expectedAttendanceChange(180, 220))).toBe("180 → 220 (+40)");
    expect(describeChange(expectedAttendanceChange(1200, 900))).toBe("1,200 → 900 (−300)");
  });
});

describe("task keywords (B7-F07, D-102)", () => {
  it("finds listed words only as whole words or listed stems", () => {
    // "Wheel chair" is also the word "chair".
    expect(mentionedKeywords("Wheel chair ramp and head count")).toEqual([
      "chairs",
      "headcount",
      "wheelchairs",
    ]);
    expect(mentionedKeywords("Accessible entrance; budget review")).toEqual([
      "accessibility",
      "budget",
    ]);
    expect(mentionedKeywords("Notable seafood timetable")).toEqual([]);
  });
});