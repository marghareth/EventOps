// src/modules/events/accessibility/domain/scenarios.test.ts
// Accessibility domain unit tests (B3-14): the named cases, each run through the whole pure chain,
// coverage (D-062) → status (D-063) → gaps (D-064) → alerts (D-066). Gap detection also has its own
// tests (gaps.test.ts). No database, clock, network or AI; fast and deterministic.
import { describe, expect, it } from "vitest";
import { deriveAlerts } from "./alerts";
import { detectGaps } from "./gaps";
import {
  InvalidReadinessInput,
  assessCoverage,
  type ReadinessRequirement,
  type ReadinessResource,
} from "./readiness";
import { readinessStatus } from "./readiness-status";
import type { RequirementPriority, RequirementType } from "./requirement-type";

let n = 0;
const need = (
  type: RequirementType,
  guest: number,
  priority: RequirementPriority = "REQUIRED",
): ReadinessRequirement => {
  n += 1;
  return {
    id: `r${String(n).padStart(3, "0")}`,
    type,
    priority,
    attendee: { id: `a${guest}`, number: guest, name: `Guest ${guest}`, rsvpStatus: "CONFIRMED" },
  };
};
const res = (
  type: ReadinessResource["type"],
  status: ReadinessResource["status"] = "AVAILABLE",
  quantity: number | null = null,
): ReadinessResource => ({ type, status, quantity });

/** The whole chain, as the server runs it. */
function evaluate(requirements: ReadinessRequirement[], resources: ReadinessResource[]) {
  const coverage = assessCoverage({ requirements, resources });
  const status = readinessStatus(coverage);
  const gaps = detectGaps(coverage);
  return { coverage, status, gaps, alerts: deriveAlerts(status, gaps) };
}
const NOTHING = { event: null, gaps: [] };

describe("accessibility domain scenarios (B3-14)", () => {
  it("no attendees requiring accessibility: nothing to check, no gaps, no alerts", () => {
    // Guests whose needs don't count: For information, and a declined guest.
    const declined = need("CAPTIONING", 2);
    declined.attendee.rsvpStatus = "DECLINED";
    for (const requirements of [[], [need("CAPTIONING", 1, "INFORMATIONAL"), declined]]) {
      const result = evaluate(requirements, [res("CAPTIONING")]);
      expect(result.status).toBe("NO_REQUIRED_NEEDS");
      expect(result.coverage.requirements).toEqual([]);
      expect(result.gaps).toEqual([]);
      expect(result.alerts).toEqual(NOTHING);
    }
  });

  it("one requirement with a matching resource: covered and Ready", () => {
    const result = evaluate([need("SIGN_LANGUAGE", 1)], [res("SIGN_LANGUAGE")]);
    expect(result.coverage.requirements[0]).toMatchObject({ state: "covered", problems: [] });
    expect(result.status).toBe("READY");
    expect(result.gaps).toEqual([]);
    expect(result.alerts).toEqual(NOTHING);
  });

  it("one requirement without a matching resource: missing, Not ready, one gap, one alert", () => {
    // An unrelated resource does not count as a match.
    const result = evaluate([need("SIGN_LANGUAGE", 1)], [res("CAPTIONING")]);
    expect(result.coverage.requirements[0]).toMatchObject({
      state: "missing",
      problems: [{ resource: "SIGN_LANGUAGE", problem: "not-set-up" }],
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.gaps.map((g) => g.key)).toEqual(["SIGN_LANGUAGE:not-set-up"]);
    expect(result.alerts.gaps.map((a) => a.severity)).toEqual(["critical"]);
    expect(result.alerts.event?.title).toBe("Accessibility: Not ready");
  });

  it("multiple attendees with the same requirement: one gap naming them all; one resource covers them", () => {
    const requirements = [need("CAPTIONING", 3), need("CAPTIONING", 1), need("CAPTIONING", 2)];
    const missing = evaluate(requirements, []);
    expect(missing.gaps).toHaveLength(1);
    expect(missing.gaps[0].requirements.map((r) => r.attendee.number)).toEqual([1, 2, 3]);
    expect(missing.gaps[0].summary).toBe("Captioning is not set up, but 3 guests need it.");
    expect(missing.alerts.gaps[0].attendeeIds).toEqual(["a1", "a2", "a3"]);
    expect(evaluate(requirements, [res("CAPTIONING")]).status).toBe("READY");
  });

  it("multiple attendees needing seats: counted per guest", () => {
    const requirements = [need("ACCESSIBLE_SEATING", 1), need("ACCESSIBLE_SEATING", 2)];
    expect(evaluate(requirements, [res("ACCESSIBLE_SEATS", "AVAILABLE", 2)]).status).toBe("READY");
    const short = evaluate(requirements, [res("ACCESSIBLE_SEATS", "AVAILABLE", 1)]);
    expect(short.status).toBe("NOT_READY");
    expect(short.gaps).toEqual([
      expect.objectContaining({
        kind: "not-enough-seats",
        seats: { available: 1, required: 2, preferred: 0 },
      }),
    ]);
  });

  it("multiple requirement types: each judged against its own resource", () => {
    const result = evaluate(
      [need("CAPTIONING", 1), need("ACCESSIBLE_RESTROOM", 1), need("STEP_FREE_ENTRANCE", 2)],
      [res("CAPTIONING"), res("ACCESSIBLE_ENTRANCE")],
    );
    // Sorted by guest number, then type order.
    expect(result.coverage.requirements.map((c) => [c.requirement.type, c.state])).toEqual([
      ["ACCESSIBLE_RESTROOM", "missing"],
      ["CAPTIONING", "covered"],
      ["STEP_FREE_ENTRANCE", "covered"],
    ]);
    expect(result.gaps.map((g) => g.key)).toEqual(["ACCESSIBLE_RESTROOM:not-set-up"]);
  });

  it("multiple simultaneous gaps: each kept apart, worst first", () => {
    const result = evaluate(
      [
        need("CAPTIONING", 1),
        need("SIGN_LANGUAGE", 2),
        need("ACCESSIBLE_SEATING", 3),
        need("ACCESSIBLE_RESTROOM", 4),
        need("OTHER", 5),
      ],
      [
        res("SIGN_LANGUAGE", "NOT_AVAILABLE"),
        res("ACCESSIBLE_SEATS", "AVAILABLE", 0),
        res("ACCESSIBLE_RESTROOM", "ARRANGING"),
      ],
    );
    expect(result.status).toBe("NOT_READY");
    expect(result.gaps.map((g) => [g.kind, g.consequence])).toEqual([
      ["not-enough-seats", "not-ready"],
      ["not-set-up", "not-ready"],
      ["not-available", "not-ready"],
      ["being-arranged", "almost-ready"],
      ["check-by-hand", "almost-ready"],
    ]);
    expect(result.alerts.gaps.map((a) => a.severity)).toEqual([
      "critical",
      "critical",
      "critical",
      "warning",
      "warning",
    ]);
    expect(result.alerts.event?.reason).toMatch(/^5 issues need attention\./);
  });

  it("resource added resolves a gap", () => {
    const requirements = [need("CAPTIONING", 1), need("SIGN_LANGUAGE", 1)];
    const before = evaluate(requirements, [res("SIGN_LANGUAGE")]);
    expect(before.status).toBe("NOT_READY");
    expect(before.gaps.map((g) => g.key)).toEqual(["CAPTIONING:not-set-up"]);
    const after = evaluate(requirements, [res("SIGN_LANGUAGE"), res("CAPTIONING")]);
    expect(after.status).toBe("READY");
    expect(after.gaps).toEqual([]);
    expect(after.alerts).toEqual(NOTHING);
  });

  it("resource removed creates a gap", () => {
    const requirements = [need("ACCESSIBLE_SEATING", 1)];
    const before = evaluate(requirements, [res("ACCESSIBLE_SEATS", "AVAILABLE", 1)]);
    expect(before.status).toBe("READY");
    const after = evaluate(requirements, []);
    expect(after.status).toBe("NOT_READY");
    expect(after.gaps.map((g) => g.key)).toEqual(["ACCESSIBLE_SEATS:not-set-up"]);
    expect(after.alerts.gaps).toHaveLength(1);
  });

  it.each([
    ["an unsupported requirement type", { type: "SHUTTLE_BUS" }, /Unsupported requirement type/],
    ["an unsupported priority", { priority: "URGENT" }, /Unsupported priority/],
  ])("refuses %s instead of guessing", (_name, change, message) => {
    const invalid = { ...need("CAPTIONING", 1), ...change } as unknown as ReadinessRequirement;
    expect(() => evaluate([invalid], [res("CAPTIONING")])).toThrow(InvalidReadinessInput);
    expect(() => evaluate([need("CAPTIONING", 2), invalid], [])).toThrow(message);
  });

  it("empty resource set: every counted need is missing, nothing is guessed as covered", () => {
    const result = evaluate(
      [need("CAPTIONING", 1), need("STEP_FREE_ENTRANCE", 2), need("SIGN_LANGUAGE", 3, "PREFERRED")],
      [],
    );
    expect(result.coverage.requirements.map((c) => c.state)).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
    expect(result.coverage.seats).toEqual({ available: 0, required: 0, preferred: 0 });
    expect(result.status).toBe("NOT_READY");
    // The Preferred need is advice only: a gap, but no alert of its own.
    expect(result.gaps.map((g) => g.consequence)).toEqual(["not-ready", "not-ready", "advice"]);
    expect(result.alerts.gaps).toHaveLength(2);
  });

  it("empty requirement set: resources alone never make a status, gap or alert", () => {
    const result = evaluate(
      [],
      [res("CAPTIONING", "NOT_AVAILABLE"), res("ACCESSIBLE_SEATS", "AVAILABLE", 5)],
    );
    expect(result.status).toBe("NO_REQUIRED_NEEDS");
    expect(result.coverage).toEqual({
      requirements: [],
      excluded: [],
      seats: { available: 5, required: 0, preferred: 0 },
    });
    expect(result.gaps).toEqual([]);
    expect(result.alerts).toEqual(NOTHING);
  });
});