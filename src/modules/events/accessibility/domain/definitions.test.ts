// src/modules/events/accessibility/domain/definitions.test.ts
// The canonical accessibility definitions (B3-02, D-057): one list per concept, every value
// defined, and the change helpers the audit log uses. Equality with the database enums is checked
// in ../definitions.test.ts (domain code may not import the database client).
import { describe, expect, it } from "vitest";
import { requirementChanges } from "./requirement";
import {
  DEFAULT_REQUIREMENT_PRIORITY,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_DEFINITIONS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DEFINITIONS,
  isRequirementType,
} from "./requirement-type";
import {
  RESOURCE_STATUSES,
  RESOURCE_STATUS_DEFINITIONS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_DEFINITIONS,
  isResourceType,
  resourceChanges,
  resourceSlug,
  resourceTypeFromSlug,
} from "./resource";

const sorted = (values: readonly string[]) => [...values].sort();

describe("one canonical list per concept", () => {
  it("has no duplicate values", () => {
    for (const list of [
      REQUIREMENT_TYPES,
      REQUIREMENT_PRIORITIES,
      RESOURCE_TYPES,
      RESOURCE_STATUSES,
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("defines every value with a label and a description, and no extra values", () => {
    for (const [list, definitions] of [
      [REQUIREMENT_TYPES, REQUIREMENT_TYPE_DEFINITIONS],
      [REQUIREMENT_PRIORITIES, REQUIREMENT_PRIORITY_DEFINITIONS],
      [RESOURCE_TYPES, RESOURCE_TYPE_DEFINITIONS],
      [RESOURCE_STATUSES, RESOURCE_STATUS_DEFINITIONS],
    ] as const) {
      expect(sorted(Object.keys(definitions))).toEqual(sorted(list));
      for (const definition of Object.values(definitions)) {
        expect(definition.label.trim()).not.toBe("");
        expect(definition.description.trim()).not.toBe("");
      }
    }
  });

  it("covers the Tier 1 needs and the six approved resources (1a, 5a)", () => {
    expect(REQUIREMENT_TYPES).toEqual([
      "MOBILITY_ASSISTANCE",
      "ACCESSIBLE_SEATING",
      "STEP_FREE_ENTRANCE",
      "ACCESSIBLE_RESTROOM",
      "SIGN_LANGUAGE",
      "CAPTIONING",
      "OTHER",
    ]);
    expect(RESOURCE_TYPES).toHaveLength(6);
    // Dietary needs stay on the attendee (D-047); no transport, seating plan or volunteer types.
    expect(REQUIREMENT_TYPES.join()).not.toMatch(/DIET|TRANSPORT|SHUTTLE|VOLUNTEER|TABLE/);
  });

  it("only Other needs a note, and only accessible seats have a count", () => {
    expect(REQUIREMENT_TYPES.filter((t) => REQUIREMENT_TYPE_DEFINITIONS[t].noteRequired)).toEqual([
      "OTHER",
    ]);
    expect(RESOURCE_TYPES.filter((t) => RESOURCE_TYPE_DEFINITIONS[t].hasQuantity)).toEqual([
      "ACCESSIBLE_SEATS",
    ]);
  });

  it("defaults new requirements to Required (2a)", () => {
    expect(DEFAULT_REQUIREMENT_PRIORITY).toBe("REQUIRED");
  });

  it("recognises only listed values", () => {
    expect(isRequirementType("CAPTIONING")).toBe(true);
    expect(isRequirementType("captioning")).toBe(false);
    expect(isRequirementType("DIETARY")).toBe(false);
    expect(isRequirementType(undefined)).toBe(false);
    expect(isResourceType("ACCESSIBLE_SEATS")).toBe(true);
    expect(isResourceType("ACCESSIBLE_SEATING")).toBe(false);
  });
});

describe("change helpers for the audit log (D-059)", () => {
  it("lists only what changed, and flags the note without copying it", () => {
    expect(
      requirementChanges(
        { type: "CAPTIONING", priority: "REQUIRED", note: "Front row" },
        { type: "SIGN_LANGUAGE", priority: "REQUIRED", note: "Back row" },
      ),
    ).toEqual({ type: { from: "CAPTIONING", to: "SIGN_LANGUAGE" }, note: { changed: true } });
    expect(
      requirementChanges(
        { type: "OTHER", priority: "PREFERRED", note: "x" },
        { type: "OTHER", priority: "PREFERRED", note: "x" },
      ),
    ).toEqual({});
  });

  it("records resource status and seat count changes in full", () => {
    expect(
      resourceChanges(
        { status: "ARRANGING", quantity: 6, note: null },
        { status: "AVAILABLE", quantity: 8, note: "By the stage" },
      ),
    ).toEqual({
      status: { from: "ARRANGING", to: "AVAILABLE" },
      quantity: { from: 6, to: 8 },
      note: { changed: true },
    });
  });
});

describe("resource addresses (B3-05)", () => {
  it("gives each type a readable segment that maps back to it", () => {
    expect(RESOURCE_TYPES.map(resourceSlug)).toEqual([
      "accessible-seats",
      "accessible-entrance",
      "ramp-or-elevator",
      "accessible-restroom",
      "captioning",
      "sign-language",
    ]);
    for (const type of RESOURCE_TYPES) expect(resourceTypeFromSlug(resourceSlug(type))).toBe(type);
  });

  it.each(["ACCESSIBLE_SEATS", "seats", "", "../captioning", undefined, 3])(
    "refuses the segment %j",
    (slug) => {
      expect(resourceTypeFromSlug(slug)).toBeNull();
    },
  );
});