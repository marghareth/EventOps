// src/modules/events/accessibility/domain/gaps.test.ts
// Gap detection (B3-09, D-064): missing resources give identifiable gaps, covered needs give none,
// several gaps coexist, consequences follow the status rule, and the result is deterministic.
import { describe, expect, it } from "vitest";
import { GAP_CONSEQUENCE_TEXT, detectGaps, guestReference } from "./gaps";
import { assessCoverage, type ReadinessRequirement, type ReadinessResource } from "./readiness";
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
const gapsFor = (requirements: ReadinessRequirement[], resources: ReadinessResource[]) =>
  detectGaps(assessCoverage({ requirements, resources }));

describe("detectGaps", () => {
  it("gives no gaps when every need is covered", () => {
    expect(
      gapsFor(
        [need("CAPTIONING", 1), need("ACCESSIBLE_SEATING", 2), need("STEP_FREE_ENTRANCE", 3)],
        [res("CAPTIONING"), res("ACCESSIBLE_SEATS", "AVAILABLE", 1), res("ACCESSIBLE_ENTRANCE")],
      ),
    ).toEqual([]);
  });

  it("identifies a missing resource: who needs it, the resource, and the consequence", () => {
    const [gap] = gapsFor([need("CAPTIONING", 3), need("CAPTIONING", 1)], []);
    expect(gap).toMatchObject({
      key: "CAPTIONING:not-set-up",
      kind: "not-set-up",
      resource: "CAPTIONING",
      consequence: "not-ready",
      seats: null,
      summary: "Captioning is not set up, but 2 guests need it.",
    });
    expect(gap.requirements.map((r) => r.attendee.number)).toEqual([1, 3]);
  });

  it.each([
    [
      "NOT_AVAILABLE",
      "not-available",
      "not-ready",
      "Sign-language interpreter is marked Not available, but 1 guest needs it.",
    ],
    [
      "ARRANGING",
      "being-arranged",
      "almost-ready",
      "Sign-language interpreter is still being arranged; 1 guest needs it.",
    ],
  ] as const)("names a resource recorded as %s", (status, kind, consequence, summary) => {
    expect(gapsFor([need("SIGN_LANGUAGE", 1)], [res("SIGN_LANGUAGE", status)])).toEqual([
      expect.objectContaining({ kind, consequence, summary }),
    ]);
  });

  it("gives one seats gap for the event with the numbers behind it", () => {
    const requirements = [1, 2, 3].map((g) => need("ACCESSIBLE_SEATING", g));
    const [gap] = gapsFor(requirements, [res("ACCESSIBLE_SEATS", "AVAILABLE", 2)]);
    expect(gap).toMatchObject({
      key: "ACCESSIBLE_SEATS:not-enough-seats",
      kind: "not-enough-seats",
      consequence: "not-ready",
      seats: { available: 2, required: 3, preferred: 0 },
      summary: "Not enough accessible seats: 3 guests with a Required need, 2 seats available.",
    });
    expect(gap.requirements).toHaveLength(3);
  });

  it("marks a seats gap affecting only Preferred needs as advice", () => {
    const [gap] = gapsFor(
      [need("ACCESSIBLE_SEATING", 1), need("ACCESSIBLE_SEATING", 2, "PREFERRED")],
      [res("ACCESSIBLE_SEATS", "AVAILABLE", 1)],
    );
    expect(gap).toMatchObject({
      consequence: "advice",
      summary: "Not enough accessible seats for Preferred needs: 2 needed in all, 1 available.",
    });
    expect(gap.requirements.map((r) => r.attendee.number)).toEqual([2]);
  });

  it("gives one check-by-hand gap per Other need, naming the guest", () => {
    const gaps = gapsFor([need("OTHER", 4), need("OTHER", 2, "PREFERRED")], []);
    expect(gaps.map((g) => [g.kind, g.consequence, g.requirements[0].attendee.number])).toEqual([
      ["check-by-hand", "almost-ready", 4],
      ["check-by-hand", "advice", 2],
    ]);
    expect(gaps[0].summary).toBe(
      "Guest 4 (ATT-0004) has an Other need that EventOps can't check. Confirm it with the venue or your team.",
    );
  });

  it("lets several gaps coexist, one per resource problem, in a fixed order", () => {
    const gaps = gapsFor(
      [
        need("OTHER", 9),
        need("CAPTIONING", 5, "PREFERRED"),
        need("STEP_FREE_ENTRANCE", 2),
        need("ACCESSIBLE_RESTROOM", 1),
        need("CAPTIONING", 3),
      ],
      [res("RAMP_OR_ELEVATOR", "ARRANGING"), res("CAPTIONING", "ARRANGING")],
    );
    expect(gaps.map((g) => `${g.consequence}|${g.key}`)).toEqual([
      "not-ready|ACCESSIBLE_ENTRANCE:not-set-up",
      "not-ready|ACCESSIBLE_RESTROOM:not-set-up",
      "almost-ready|RAMP_OR_ELEVATOR:being-arranged",
      "almost-ready|CAPTIONING:being-arranged",
      expect.stringMatching(/^almost-ready\|check-by-hand:/),
    ]);
    // Captioning: one gap for the resource, listing the Required and the Preferred need.
    expect(gaps[3].requirements.map((r) => [r.attendee.number, r.priority])).toEqual([
      [3, "REQUIRED"],
      [5, "PREFERRED"],
    ]);
  });

  it("never reports a need that was left out", () => {
    const declined: ReadinessRequirement = {
      ...need("CAPTIONING", 7),
      attendee: { id: "a7", number: 7, name: "Guest 7", rsvpStatus: "DECLINED" },
    };
    expect(gapsFor([declined, need("CAPTIONING", 8, "INFORMATIONAL")], [])).toEqual([]);
  });

  it("is deterministic: the same input in any order gives the same gaps", () => {
    const requirements = [
      need("CAPTIONING", 2),
      need("OTHER", 1),
      need("ACCESSIBLE_SEATING", 3),
      need("SIGN_LANGUAGE", 1, "PREFERRED"),
    ];
    const resources = [
      res("ACCESSIBLE_SEATS", "AVAILABLE", 0),
      res("SIGN_LANGUAGE", "NOT_AVAILABLE"),
    ];
    const expected = gapsFor(requirements, resources);
    expect(gapsFor([...requirements].reverse(), [...resources].reverse())).toEqual(expected);
    expect(
      gapsFor([requirements[2], requirements[0], requirements[3], requirements[1]], resources),
    ).toEqual(expected);
  });
});

describe("gap wording", () => {
  it("states each consequence plainly", () => {
    expect(GAP_CONSEQUENCE_TEXT).toEqual({
      "not-ready": "Makes the event Not ready.",
      "almost-ready": "Keeps the event at Almost ready.",
      advice: "Advice only: Preferred needs don't change readiness.",
    });
  });

  it("formats guest IDs like the attendees context (D-042)", () => {
    expect(guestReference(3)).toBe("ATT-0003");
    expect(guestReference(12345)).toBe("ATT-12345");
  });
});

it("counts seats and guests in correct singular and plural", () => {
  const [gap] = gapsFor([need("ACCESSIBLE_SEATING", 1)], [res("ACCESSIBLE_SEATS", "AVAILABLE", 0)]);
  expect(gap.summary).toBe(
    "Not enough accessible seats: 1 guest with a Required need, 0 seats available.",
  );
});