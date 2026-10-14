// src/modules/events/accessibility/definitions.test.ts
// The canonical accessibility lists (B3-02, D-057) equal the database enums, so a value the domain
// accepts is always one PostgreSQL stores, and the other way round.
import { describe, expect, it } from "vitest";
import {
  AccessibilityRequirementType,
  AccessibilityResourceType,
  RequirementPriority,
  ResourceStatus,
} from "@/generated/prisma/enums";
import { REQUIREMENT_PRIORITIES, REQUIREMENT_TYPES } from "./domain/requirement-type";
import { RESOURCE_STATUSES, RESOURCE_TYPES } from "./domain/resource";

const sorted = (values: readonly string[]) => [...values].sort();

describe("accessibility definitions match the database enums", () => {
  it.each([
    ["requirement types", REQUIREMENT_TYPES, AccessibilityRequirementType],
    ["requirement priorities", REQUIREMENT_PRIORITIES, RequirementPriority],
    ["resource types", RESOURCE_TYPES, AccessibilityResourceType],
    ["resource statuses", RESOURCE_STATUSES, ResourceStatus],
  ] as const)("%s", (_label, list, dbEnum) => {
    expect(sorted(list)).toEqual(sorted(Object.values(dbEnum)));
  });
});