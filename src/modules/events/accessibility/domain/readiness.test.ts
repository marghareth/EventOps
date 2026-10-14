// src/modules/events/accessibility/domain/readiness.test.ts
// Accessibility readiness coverage (B3-07, D-062): every rule in docs/DATA_MODEL.md
// ("Accessibility readiness"), the edge cases, and determinism (the same input in any order gives
// the same result).
import { describe, expect, it } from "vitest";
import {
  InvalidReadinessInput,
  assessCoverage,
  type GuestRsvp,
  type ReadinessRequirement,
  type ReadinessResource,
} from "./readiness";
import type { RequirementPriority, RequirementType } from "./requirement-type";

let sequence = 0;
function need(
  type: RequirementType,
  options: { guest?: number; priority?: RequirementPriority; rsvp?: GuestRsvp } = {},
): ReadinessRequirement {
  sequence += 1;
  const guest = options.guest ?? sequence;
  return {
    id: `req-${String(sequence).padStart(3, "0")}`,
    type,
    priority: options.priority ?? "REQUIRED",
    attendee: {
      id: `att-${guest}`,
      number: guest,
      name: `Guest ${guest}`,
      rsvpStatus: options.rsvp ?? "CONFIRMED",
    },
  };
}
const available = (type: ReadinessResource["type"], quantity: number | null = null) =>
  ({ type, status: "AVAILABLE", quantity }) as ReadinessResource;
const withStatus = (type: ReadinessResource["type"], status: ReadinessResource["status"]) =>
  ({ type, status, quantity: type === "ACCESSIBLE_SEATS" ? 0 : null }) as ReadinessResource;

const states = (input: Parameters<typeof assessCoverage>[0]) =>
  assessCoverage(input).requirements.map((c) => c.state);

describe("which needs count (1a, 2a)", () => {
  it("lets Required needs decide, checks Preferred as advice, and leaves out the rest", () => {
    const coverage = assessCoverage({
      requirements: [
        need("CAPTIONING", { guest: 1 }),
        need("CAPTIONING", { guest: 2, priority: "PREFERRED" }),
        need("CAPTIONING", { guest: 3, priority: "INFORMATIONAL" }),
        need("CAPTIONING", { guest: 4, rsvp: "DECLINED" }),
        need("CAPTIONING", { guest: 5, rsvp: "PENDING" }),
        need("CAPTIONING", { guest: 6, rsvp: "MAYBE", priority: "PREFERRED" }),
      ],
      resources: [available("CAPTIONING")],
    });
    expect(coverage.requirements.map((c) => [c.requirement.attendee.number, c.role])).toEqual([
      [1, "decides"],
      [2, "advice"],
      [5, "decides"],
      [6, "advice"],
    ]);
    expect(coverage.excluded.map((e) => [e.requirement.attendee.number, e.reason])).toEqual([
      [3, "for-information"],
      [4, "declined"],
    ]);
  });

  it("leaves out a declined guest's need even when it is For information", () => {
    const { excluded } = assessCoverage({
      requirements: [need("CAPTIONING", { priority: "INFORMATIONAL", rsvp: "DECLINED" })],
      resources: [],
    });
    expect(excluded.map((e) => e.reason)).toEqual(["declined"]);
  });
});

describe("which resource covers which need (3a)", () => {
  it.each([
    ["ACCESSIBLE_SEATING", ["ACCESSIBLE_SEATS"]],
    ["ACCESSIBLE_RESTROOM", ["ACCESSIBLE_RESTROOM"]],
    ["SIGN_LANGUAGE", ["SIGN_LANGUAGE"]],
    ["CAPTIONING", ["CAPTIONING"]],
    ["STEP_FREE_ENTRANCE", ["ACCESSIBLE_ENTRANCE"]],
    ["MOBILITY_ASSISTANCE", ["ACCESSIBLE_ENTRANCE"]],
    ["OTHER", []],
  ] as const)("%s depends on %j when no ramp is recorded", (type, expected) => {
    const [coverage] = assessCoverage({ requirements: [need(type)], resources: [] }).requirements;
    expect(coverage.dependsOn).toEqual(expected);
  });

  it.each(["STEP_FREE_ENTRANCE", "MOBILITY_ASSISTANCE"] as const)(
    "%s also depends on the ramp or elevator once it is recorded",
    (type) => {
      const [coverage] = assessCoverage({
        requirements: [need(type)],
        resources: [available("ACCESSIBLE_ENTRANCE"), withStatus("RAMP_OR_ELEVATOR", "ARRANGING")],
      }).requirements;
      expect(coverage.dependsOn).toEqual(["ACCESSIBLE_ENTRANCE", "RAMP_OR_ELEVATOR"]);
      expect(coverage.problems).toEqual([{ resource: "RAMP_OR_ELEVATOR", problem: "arranging" }]);
      expect(coverage.state).toBe("arranging");
    },
  );

  it("is covered by the entrance alone when the ramp is recorded as Available", () => {
    expect(
      states({
        requirements: [need("STEP_FREE_ENTRANCE")],
        resources: [available("ACCESSIBLE_ENTRANCE"), available("RAMP_OR_ELEVATOR")],
      }),
    ).toEqual(["covered"]);
  });

  it("never lets an unrelated resource cover a need", () => {
    expect(
      states({
        requirements: [need("SIGN_LANGUAGE")],
        resources: [available("CAPTIONING"), available("ACCESSIBLE_ENTRANCE")],
      }),
    ).toEqual(["missing"]);
  });

  it("marks Other as to check by hand, whatever is recorded", () => {
    const [coverage] = assessCoverage({
      requirements: [need("OTHER")],
      resources: [available("CAPTIONING")],
    }).requirements;
    expect(coverage).toMatchObject({ state: "check-by-hand", problems: [], dependsOn: [] });
  });
});

describe("when a resource covers a need", () => {
  it.each([
    [null, "missing", "not-set-up"],
    ["NOT_AVAILABLE", "missing", "not-available"],
    ["ARRANGING", "arranging", "arranging"],
    ["AVAILABLE", "covered", null],
  ] as const)("resource %s → %s", (status, state, problem) => {
    const [coverage] = assessCoverage({
      requirements: [need("CAPTIONING")],
      resources: status ? [withStatus("CAPTIONING", status)] : [],
    }).requirements;
    expect(coverage.state).toBe(state);
    expect(coverage.problems).toEqual(problem ? [{ resource: "CAPTIONING", problem }] : []);
  });

  it("takes the worse of two problems, and lists both", () => {
    const [coverage] = assessCoverage({
      requirements: [need("STEP_FREE_ENTRANCE")],
      resources: [withStatus("RAMP_OR_ELEVATOR", "ARRANGING")],
    }).requirements;
    expect(coverage.state).toBe("missing");
    expect(coverage.problems).toEqual([
      { resource: "ACCESSIBLE_ENTRANCE", problem: "not-set-up" },
      { resource: "RAMP_OR_ELEVATOR", problem: "arranging" },
    ]);
  });
});

describe("seats", () => {
  const seating = (required: number, preferred = 0) => [
    ...Array.from({ length: required }, (_, i) => need("ACCESSIBLE_SEATING", { guest: i + 1 })),
    ...Array.from({ length: preferred }, (_, i) =>
      need("ACCESSIBLE_SEATING", { guest: 100 + i, priority: "PREFERRED" }),
    ),
  ];

  it("covers Required seating needs when there are exactly enough seats", () => {
    const coverage = assessCoverage({
      requirements: seating(3),
      resources: [available("ACCESSIBLE_SEATS", 3)],
    });
    expect(coverage.requirements.map((c) => c.state)).toEqual(["covered", "covered", "covered"]);
    expect(coverage.seats).toEqual({ available: 3, required: 3, preferred: 0 });
  });

  it("marks every Required seating need short when seats run out, never picking guests", () => {
    const coverage = assessCoverage({
      requirements: seating(10),
      resources: [available("ACCESSIBLE_SEATS", 8)],
    });
    expect(new Set(coverage.requirements.map((c) => c.state))).toEqual(new Set(["short"]));
    expect(coverage.seats).toEqual({ available: 8, required: 10, preferred: 0 });
  });

  it("seats Required guests first, then Preferred", () => {
    const coverage = assessCoverage({
      requirements: seating(2, 2),
      resources: [available("ACCESSIBLE_SEATS", 3)],
    });
    expect(coverage.requirements.map((c) => [c.role, c.state])).toEqual([
      ["decides", "covered"],
      ["decides", "covered"],
      ["advice", "short"],
      ["advice", "short"],
    ]);
  });

  it("treats 0 Available seats as short, and counts no seats unless they are Available", () => {
    expect(
      states({ requirements: seating(1), resources: [available("ACCESSIBLE_SEATS", 0)] }),
    ).toEqual(["short"]);
    const arranging = assessCoverage({
      requirements: seating(1),
      resources: [{ type: "ACCESSIBLE_SEATS", status: "ARRANGING", quantity: 5 }],
    });
    expect(arranging.requirements[0].state).toBe("arranging");
    expect(arranging.seats.available).toBe(0);
  });

  it("doesn't count declined or For information seating needs", () => {
    const coverage = assessCoverage({
      requirements: [
        need("ACCESSIBLE_SEATING", { guest: 1 }),
        need("ACCESSIBLE_SEATING", { guest: 2, rsvp: "DECLINED" }),
        need("ACCESSIBLE_SEATING", { guest: 3, priority: "INFORMATIONAL" }),
      ],
      resources: [available("ACCESSIBLE_SEATS", 1)],
    });
    expect(coverage.seats).toEqual({ available: 1, required: 1, preferred: 0 });
    expect(coverage.requirements.map((c) => c.state)).toEqual(["covered"]);
  });
});

describe("edge cases", () => {
  it("returns nothing to cover for no needs", () => {
    expect(assessCoverage({ requirements: [], resources: [available("CAPTIONING")] })).toEqual({
      requirements: [],
      excluded: [],
      seats: { available: 0, required: 0, preferred: 0 },
    });
  });

  it("refuses two resources of the same type", () => {
    expect(() =>
      assessCoverage({
        requirements: [],
        resources: [available("CAPTIONING"), withStatus("CAPTIONING", "ARRANGING")],
      }),
    ).toThrow(InvalidReadinessInput);
  });

  it("gives the same result for the same input in any order (deterministic)", () => {
    const requirements = [
      need("OTHER", { guest: 3 }),
      need("CAPTIONING", { guest: 1 }),
      need("ACCESSIBLE_SEATING", { guest: 2 }),
      need("STEP_FREE_ENTRANCE", { guest: 1 }),
      need("ACCESSIBLE_SEATING", { guest: 1, priority: "PREFERRED" }),
      need("SIGN_LANGUAGE", { guest: 4, rsvp: "DECLINED" }),
    ];
    const resources = [
      available("ACCESSIBLE_SEATS", 1),
      withStatus("CAPTIONING", "ARRANGING"),
      available("ACCESSIBLE_ENTRANCE"),
    ];
    const expected = assessCoverage({ requirements, resources });
    const rotations = requirements.map((_, i) => [
      ...requirements.slice(i),
      ...requirements.slice(0, i),
    ]);
    for (const order of [...rotations, [...requirements].reverse()]) {
      expect(assessCoverage({ requirements: order, resources: [...resources].reverse() })).toEqual(
        expected,
      );
    }
    expect(
      expected.requirements.map((c) => `${c.requirement.attendee.number}:${c.requirement.type}`),
    ).toEqual([
      "1:ACCESSIBLE_SEATING",
      "1:STEP_FREE_ENTRANCE",
      "1:CAPTIONING",
      "2:ACCESSIBLE_SEATING",
      "3:OTHER",
    ]);
  });

  it("does not change its input", () => {
    const requirements = [need("CAPTIONING", { guest: 2 }), need("CAPTIONING", { guest: 1 })];
    const copy = structuredClone(requirements);
    assessCoverage({ requirements, resources: [] });
    expect(requirements).toEqual(copy);
  });
});