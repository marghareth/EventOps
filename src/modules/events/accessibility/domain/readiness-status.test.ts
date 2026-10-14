// src/modules/events/accessibility/domain/readiness-status.test.ts
// The readiness status (B3-08, D-063): the canonical list, the rule in order, and that only needs
// that decide readiness can change it.
import { describe, expect, it } from "vitest";
import { assessCoverage, type ReadinessRequirement, type ReadinessResource } from "./readiness";
import {
  READINESS_STATUSES,
  READINESS_STATUS_DEFINITIONS,
  decidingCounts,
  readinessStatus,
} from "./readiness-status";
import type { RequirementPriority, RequirementType } from "./requirement-type";

let n = 0;
const need = (
  type: RequirementType,
  priority: RequirementPriority = "REQUIRED",
  rsvp: ReadinessRequirement["attendee"]["rsvpStatus"] = "CONFIRMED",
): ReadinessRequirement => {
  n += 1;
  return {
    id: `r${n}`,
    type,
    priority,
    attendee: { id: `a${n}`, number: n, name: `Guest ${n}`, rsvpStatus: rsvp },
  };
};
const res = (
  type: ReadinessResource["type"],
  status: ReadinessResource["status"] = "AVAILABLE",
  quantity: number | null = type === "ACCESSIBLE_SEATS" ? 10 : null,
): ReadinessResource => ({ type, status, quantity });
const statusOf = (requirements: ReadinessRequirement[], resources: ReadinessResource[]) =>
  readinessStatus(assessCoverage({ requirements, resources }));

describe("canonical statuses", () => {
  it("are exactly four, each with a label, a description and a severity", () => {
    expect(READINESS_STATUSES).toEqual(["NO_REQUIRED_NEEDS", "NOT_READY", "ALMOST_READY", "READY"]);
    expect(Object.keys(READINESS_STATUS_DEFINITIONS).sort()).toEqual(
      [...READINESS_STATUSES].sort(),
    );
    expect(
      Object.fromEntries(
        READINESS_STATUSES.map((s) => [s, READINESS_STATUS_DEFINITIONS[s].severity]),
      ),
    ).toEqual({
      NO_REQUIRED_NEEDS: "info",
      NOT_READY: "critical",
      ALMOST_READY: "warning",
      READY: "success",
    });
  });
});

describe("readinessStatus", () => {
  it("is No required needs with nothing recorded, or only left-out and Preferred needs", () => {
    expect(statusOf([], [])).toBe("NO_REQUIRED_NEEDS");
    expect(
      statusOf(
        [
          need("CAPTIONING", "PREFERRED"),
          need("CAPTIONING", "INFORMATIONAL"),
          need("CAPTIONING", "REQUIRED", "DECLINED"),
        ],
        [],
      ),
    ).toBe("NO_REQUIRED_NEEDS");
  });

  it("is Ready when every deciding need is covered", () => {
    expect(
      statusOf(
        [need("CAPTIONING"), need("ACCESSIBLE_SEATING"), need("STEP_FREE_ENTRANCE")],
        [res("CAPTIONING"), res("ACCESSIBLE_SEATS"), res("ACCESSIBLE_ENTRANCE")],
      ),
    ).toBe("READY");
  });

  it.each([
    ["a resource being arranged", [res("CAPTIONING", "ARRANGING")], [need("CAPTIONING")]],
    ["a need to check by hand", [], [need("OTHER")]],
  ])("is Almost ready with %s", (_label, resources, requirements) => {
    expect(statusOf(requirements, resources)).toBe("ALMOST_READY");
  });

  it.each([
    ["a resource not set up", [], [need("CAPTIONING")]],
    ["a resource not available", [res("CAPTIONING", "NOT_AVAILABLE")], [need("CAPTIONING")]],
    [
      "too few seats",
      [res("ACCESSIBLE_SEATS", "AVAILABLE", 1)],
      [need("ACCESSIBLE_SEATING"), need("ACCESSIBLE_SEATING")],
    ],
  ])("is Not ready with %s", (_label, resources, requirements) => {
    expect(statusOf(requirements, resources)).toBe("NOT_READY");
  });

  it("lets Not ready win over Almost ready", () => {
    expect(
      statusOf(
        [need("OTHER"), need("CAPTIONING"), need("SIGN_LANGUAGE")],
        [res("CAPTIONING", "ARRANGING")],
      ),
    ).toBe("NOT_READY");
  });

  it("never lets a Preferred need change the status", () => {
    expect(
      statusOf([need("CAPTIONING"), need("SIGN_LANGUAGE", "PREFERRED")], [res("CAPTIONING")]),
    ).toBe("READY");
  });

  it("counts the deciding needs behind the status", () => {
    const coverage = assessCoverage({
      requirements: [
        need("CAPTIONING"),
        need("SIGN_LANGUAGE"),
        need("OTHER"),
        need("CAPTIONING", "PREFERRED"),
      ],
      resources: [res("CAPTIONING")],
    });
    expect(decidingCounts(coverage)).toEqual({
      total: 3,
      covered: 1,
      arranging: 0,
      "check-by-hand": 1,
      missing: 1,
      short: 0,
    });
  });
});