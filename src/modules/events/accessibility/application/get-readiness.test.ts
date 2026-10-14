// src/modules/events/accessibility/application/get-readiness.test.ts
// The readiness use case (B3-10): loads the event's requirements and resources and returns the
// domain's status, counts, coverage and gaps, for that event only. No permission is decided here.
import { describe, expect, it, vi } from "vitest";
import type { AccessibilityRepository } from "./ports";
import { getReadiness } from "./get-readiness";

function repository(overrides: Partial<AccessibilityRepository>): AccessibilityRepository {
  return new Proxy(overrides as AccessibilityRepository, {
    get: (target, key) =>
      key in target
        ? target[key as keyof AccessibilityRepository]
        : () => {
            throw new Error(`unexpected call: ${String(key)}`);
          },
  });
}

describe("getReadiness", () => {
  it("reads this event only and returns the calculated result", async () => {
    const listEventRequirements = vi.fn().mockResolvedValue([
      {
        id: "q1",
        type: "CAPTIONING",
        priority: "REQUIRED",
        attendee: { id: "a1", number: 1, name: "Ana", rsvpStatus: "CONFIRMED" },
      },
    ]);
    const listResources = vi.fn().mockResolvedValue([
      {
        id: "r1",
        type: "CAPTIONING",
        status: "ARRANGING",
        quantity: null,
        note: null,
        updatedAt: new Date(),
      },
    ]);
    const result = await getReadiness(repository({ listEventRequirements, listResources }), "e1");
    expect(listEventRequirements).toHaveBeenCalledWith("e1");
    expect(listResources).toHaveBeenCalledWith("e1");
    expect(result.status).toBe("ALMOST_READY");
    expect(result.counts).toMatchObject({ total: 1, arranging: 1 });
    expect(result.gaps.map((g) => g.key)).toEqual(["CAPTIONING:being-arranged"]);
    expect(result.resources).toHaveLength(1);
  });

  it("gives the same result for the same stored data", async () => {
    const repo = repository({
      listEventRequirements: async () => [],
      listResources: async () => [],
    });
    expect(await getReadiness(repo, "e1")).toEqual(await getReadiness(repo, "e1"));
  });
});