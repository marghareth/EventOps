// src/modules/events/impact/schema.test.ts
// @vitest-environment node
// B7-F15 (D-101 to D-103): server-side validation of the proposed number, the assumptions and the
// saved-analysis snapshot. Boundaries on both sides of every limit.
import { describe, expect, it } from "vitest";
import { assumptionsFormSchema, impactSnapshotSchema, proposedAttendeesSchema } from "./schema";

const assumptions = (over: Record<string, string> = {}) =>
  assumptionsFormSchema.safeParse({
    cateringCostPerHead: "",
    accessibleSeatsPer100: "",
    cateringCategoryId: "",
    ...over,
  });

describe("the proposed expected attendees", () => {
  it.each([
    ["0", 0],
    ["220", 220],
    [" 1,200 ", 1200],
    ["1000000", 1_000_000],
  ])("accepts %j", (raw, value) => {
    expect(proposedAttendeesSchema.parse(raw)).toBe(value);
  });

  it.each(["", "  ", "-1", "2.5", "1e3", "abc", "1000001", "99999999"])("refuses %j", (raw) => {
    expect(proposedAttendeesSchema.safeParse(raw).success).toBe(false);
  });
});

describe("the assumptions", () => {
  it("reads blanks as not set", () => {
    expect(assumptions().data).toEqual({
      cateringCostPerHead: null,
      accessibleSeatsPer100: null,
      cateringCategoryId: null,
    });
  });

  it("stores pesos exactly, with the budget's peso rule", () => {
    expect(assumptions({ cateringCostPerHead: "₱1,350.5" }).data?.cateringCostPerHead).toBe(
      "1350.50",
    );
    expect(assumptions({ cateringCostPerHead: "0" }).data?.cateringCostPerHead).toBe("0.00");
    expect(assumptions({ cateringCostPerHead: "-1" }).success).toBe(false);
    expect(assumptions({ cateringCostPerHead: "1.005" }).success).toBe(false);
    expect(assumptions({ cateringCostPerHead: "10000000000" }).success).toBe(false);
  });

  it.each([
    ["0", "0.00"],
    ["2.5", "2.50"],
    ["4.55", "4.55"],
    ["99.99", "99.99"],
    ["100", "100.00"],
    ["100.0", "100.00"],
    ["007", "7.00"],
  ])("accepts the ratio %j as %j", (raw, value) => {
    expect(assumptions({ accessibleSeatsPer100: raw }).data?.accessibleSeatsPer100).toBe(value);
  });

  it.each(["100.01", "101", "-1", "2.555", "abc", "1,5"])("refuses the ratio %j", (raw) => {
    expect(assumptions({ accessibleSeatsPer100: raw }).success).toBe(false);
  });

  it("accepts only an ID for the catering category", () => {
    const id = "c0000000-0000-4000-8000-000000000001";
    expect(assumptions({ cateringCategoryId: id }).data?.cateringCategoryId).toBe(id);
    expect(assumptions({ cateringCategoryId: "catering" }).success).toBe(false);
  });
});

describe("the saved-analysis snapshot", () => {
  const item = {
    key: "seating-capacity",
    area: "SEATING",
    severity: "CRITICAL",
    title: "t",
    reason: "r",
    basis: "ESTIMATE",
    assumptions: [],
    fix: null,
    references: [],
  };
  const snapshot = {
    version: 1,
    from: 180,
    to: 220,
    assumptions: { cateringCostPerHead: null, accessibleSeatsPer100: null, cateringCategory: null },
    overall: "CRITICAL",
    counts: { CRITICAL: 1, NEEDS_ATTENTION: 0, INFO: 0, PASSED: 0 },
    items: [item],
  };

  it("accepts the documented shape", () => {
    expect(impactSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("refuses unknown fields, versions, severities and empty results", () => {
    expect(impactSnapshotSchema.safeParse({ ...snapshot, extra: 1 }).success).toBe(false);
    expect(impactSnapshotSchema.safeParse({ ...snapshot, version: 2 }).success).toBe(false);
    expect(impactSnapshotSchema.safeParse({ ...snapshot, overall: "FINE" }).success).toBe(false);
    expect(impactSnapshotSchema.safeParse({ ...snapshot, items: [] }).success).toBe(false);
    expect(
      impactSnapshotSchema.safeParse({ ...snapshot, items: [{ ...item, area: "TRANSPORT" }] })
        .success,
    ).toBe(false);
  });
});

describe("one severity list", () => {
  it("is the same in the domain, the audit registry and the database enum", async () => {
    const { ImpactSeverity } = await import("@/generated/prisma/enums");
    const { IMPACT_SEVERITIES: AUDIT } = await import("@/modules/events/audit/public");
    const { IMPACT_SEVERITIES: DOMAIN } = await import("./domain/impact-item");
    expect([...DOMAIN]).toEqual(Object.values(ImpactSeverity));
    expect([...AUDIT]).toEqual([...DOMAIN]);
  });
});