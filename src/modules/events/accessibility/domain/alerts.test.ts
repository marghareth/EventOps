// src/modules/events/accessibility/domain/alerts.test.ts
// Accessibility alerts (B3-11, D-066): alerts come only from real gaps, never for a covered need or
// advice; each names its reason; the event-level alert follows the status; a guest sees only the
// alerts about them; the result is deterministic.
import { describe, expect, it } from "vitest";
import { alertsForGuest, deriveAlerts } from "./alerts";
import { detectGaps } from "./gaps";
import { assessCoverage, type ReadinessRequirement, type ReadinessResource } from "./readiness";
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
const alertsFor = (requirements: ReadinessRequirement[], resources: ReadinessResource[]) => {
  const coverage = assessCoverage({ requirements, resources });
  return deriveAlerts(readinessStatus(coverage), detectGaps(coverage));
};

describe("deriveAlerts", () => {
  it("raises nothing when there are no needs", () => {
    expect(alertsFor([], [])).toEqual({ event: null, gaps: [] });
  });

  it("raises nothing for a covered need", () => {
    expect(
      alertsFor(
        [need("CAPTIONING", 1), need("ACCESSIBLE_SEATING", 2)],
        [res("CAPTIONING"), res("ACCESSIBLE_SEATS", "AVAILABLE", 1)],
      ),
    ).toEqual({ event: null, gaps: [] });
  });

  it("raises nothing for advice from a Preferred need", () => {
    expect(alertsFor([need("CAPTIONING", 1, "PREFERRED")], [])).toEqual({ event: null, gaps: [] });
  });

  it("raises nothing for a For information need", () => {
    expect(alertsFor([need("CAPTIONING", 1, "INFORMATIONAL")], [])).toEqual({
      event: null,
      gaps: [],
    });
  });

  it("names a requirement with no matching resource, with its reason", () => {
    const { event, gaps } = alertsFor([need("CAPTIONING", 2), need("CAPTIONING", 1)], []);
    expect(gaps).toEqual([
      {
        key: "CAPTIONING:not-set-up",
        severity: "critical",
        title: "Captioning is not set up",
        reason: "Captioning is not set up, but 2 guests need it. Makes the event Not ready.",
        gapKind: "not-set-up",
        resource: "CAPTIONING",
        attendeeIds: ["a1", "a2"],
      },
    ]);
    expect(event).toEqual({
      key: "event",
      severity: "critical",
      title: "Accessibility: Not ready",
      reason:
        "1 issue needs attention. At least one Required need has no resource in place, or not enough seats.",
      gapKind: null,
      resource: null,
      attendeeIds: ["a1", "a2"],
    });
  });

  it("names a required resource that is unavailable", () => {
    const { gaps } = alertsFor([need("SIGN_LANGUAGE", 1)], [res("SIGN_LANGUAGE", "NOT_AVAILABLE")]);
    expect(gaps).toEqual([
      expect.objectContaining({
        severity: "critical",
        title: "Sign-language interpreter is not available",
        gapKind: "not-available",
      }),
    ]);
  });

  it("names too few accessible seats", () => {
    const { gaps } = alertsFor(
      [need("ACCESSIBLE_SEATING", 1), need("ACCESSIBLE_SEATING", 2)],
      [res("ACCESSIBLE_SEATS", "AVAILABLE", 1)],
    );
    expect(gaps).toEqual([
      expect.objectContaining({
        severity: "critical",
        title: "Not enough accessible seats",
        gapKind: "not-enough-seats",
        attendeeIds: ["a1", "a2"],
      }),
    ]);
    expect(gaps[0].reason).toContain("2 guests with a Required need, 1 seat available.");
  });

  it("warns, at Almost ready, for a resource being arranged and a need to check by hand", () => {
    const { event, gaps } = alertsFor(
      [need("CAPTIONING", 1), need("OTHER", 2)],
      [res("CAPTIONING", "ARRANGING")],
    );
    expect(gaps.map((a) => [a.severity, a.title, a.resource])).toEqual([
      ["warning", "Captioning is still being arranged", "CAPTIONING"],
      ["warning", "A need to check by hand", null],
    ]);
    expect(event).toMatchObject({
      severity: "warning",
      title: "Accessibility: Almost ready",
      reason: expect.stringMatching(/^2 issues need attention\. /),
    });
  });

  it("keeps several gaps apart, critical first, and leaves advice out of the count", () => {
    const { event, gaps } = alertsFor(
      [
        need("OTHER", 1),
        need("CAPTIONING", 2),
        need("SIGN_LANGUAGE", 3, "PREFERRED"),
        need("STEP_FREE_ENTRANCE", 4),
      ],
      [res("ACCESSIBLE_ENTRANCE", "NOT_AVAILABLE")],
    );
    expect(gaps.map((a) => a.key)).toEqual([
      "ACCESSIBLE_ENTRANCE:not-available",
      "CAPTIONING:not-set-up",
      expect.stringMatching(/^check-by-hand:r\d{3}$/),
    ]);
    expect(gaps.map((a) => a.severity)).toEqual(["critical", "critical", "warning"]);
    expect(event?.reason).toMatch(/^3 issues need attention\./);
    expect(event?.attendeeIds).toEqual(["a4", "a2", "a1"]);
  });

  it("clears the alert when the resource is set up", () => {
    const requirements = [need("CAPTIONING", 1)];
    expect(alertsFor(requirements, []).gaps).toHaveLength(1);
    expect(alertsFor(requirements, [res("CAPTIONING")])).toEqual({ event: null, gaps: [] });
  });

  it("lets the status decide the event alert, never the gaps alone (B3-14)", () => {
    const coverage = assessCoverage({ requirements: [need("CAPTIONING", 1)], resources: [] });
    const gaps = detectGaps(coverage);
    for (const status of ["READY", "NO_REQUIRED_NEEDS"] as const) {
      expect(deriveAlerts(status, gaps).event).toBeNull();
    }
  });

  it("gives no event alert for a status without alerting gaps", () => {
    expect(deriveAlerts("NOT_READY", [])).toEqual({ event: null, gaps: [] });
    expect(deriveAlerts("READY", [])).toEqual({ event: null, gaps: [] });
  });

  it("is deterministic", () => {
    const requirements = [need("CAPTIONING", 2), need("OTHER", 1), need("ACCESSIBLE_SEATING", 3)];
    expect(alertsFor(requirements, [])).toEqual(alertsFor([...requirements].reverse(), []));
  });
});

describe("alertsForGuest", () => {
  it("keeps only the alerts about that guest", () => {
    const alerts = alertsFor([need("CAPTIONING", 1), need("SIGN_LANGUAGE", 2)], []);
    expect(alertsForGuest(alerts, "a2").map((a) => a.title)).toEqual([
      "Sign-language interpreter is not set up",
    ]);
    expect(alertsForGuest(alerts, "a9")).toEqual([]);
  });
});