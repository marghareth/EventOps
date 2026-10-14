// src/modules/events/accessibility/audit.test.ts
// Accessibility entries in the audit log (B3-03, D-059). The audit registry keeps its own copies of
// the requirement lists and labels (it can't import this context); these tests keep them equal to
// the canonical definitions (D-057), check what each entry may hold, and how Activity words it.
import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_REQUIREMENT_TYPES,
  ACCESSIBILITY_RESOURCE_TYPES,
  AUDIT_ACTIONS,
  REQUIREMENT_PRIORITIES as AUDIT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABEL,
  REQUIREMENT_TYPE_LABEL,
  RESOURCE_STATUSES as AUDIT_RESOURCE_STATUSES,
  RESOURCE_STATUS_LABEL,
  RESOURCE_TYPE_LABEL,
  describeAuditEntry,
} from "@/modules/events/audit/public";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_DEFINITIONS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DEFINITIONS,
} from "./domain/requirement-type";
import {
  RESOURCE_STATUSES,
  RESOURCE_STATUS_DEFINITIONS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_DEFINITIONS,
} from "./domain/resource";

describe("the audit registry's copies", () => {
  it("list the same requirement types and priorities, resource types and statuses", () => {
    expect([...ACCESSIBILITY_REQUIREMENT_TYPES]).toEqual([...REQUIREMENT_TYPES]);
    expect([...AUDIT_PRIORITIES]).toEqual([...REQUIREMENT_PRIORITIES]);
    expect([...ACCESSIBILITY_RESOURCE_TYPES]).toEqual([...RESOURCE_TYPES]);
    expect([...AUDIT_RESOURCE_STATUSES]).toEqual([...RESOURCE_STATUSES]);
  });

  it("use the same labels", () => {
    for (const type of REQUIREMENT_TYPES) {
      expect(REQUIREMENT_TYPE_LABEL[type]).toBe(REQUIREMENT_TYPE_DEFINITIONS[type].label);
    }
    for (const priority of REQUIREMENT_PRIORITIES) {
      expect(REQUIREMENT_PRIORITY_LABEL[priority]).toBe(
        REQUIREMENT_PRIORITY_DEFINITIONS[priority].label,
      );
    }
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_TYPE_LABEL[type]).toBe(RESOURCE_TYPE_DEFINITIONS[type].label);
    }
    for (const status of RESOURCE_STATUSES) {
      expect(RESOURCE_STATUS_LABEL[status]).toBe(RESOURCE_STATUS_DEFINITIONS[status].label);
    }
  });
});

describe("requirement entries", () => {
  const created = AUDIT_ACTIONS["accessibility_requirement.created"].details;
  const updated = AUDIT_ACTIONS["accessibility_requirement.updated"].details;
  const deleted = AUDIT_ACTIONS["accessibility_requirement.deleted"].details;

  it("accept the documented details", () => {
    expect(
      created.safeParse({ reference: "ATT-0003", type: "CAPTIONING", priority: "REQUIRED" })
        .success,
    ).toBe(true);
    expect(
      updated.safeParse({
        reference: "ATT-0003",
        type: "CAPTIONING",
        changes: { priority: { from: "REQUIRED", to: "PREFERRED" }, note: { changed: true } },
      }).success,
    ).toBe(true);
    expect(deleted.safeParse({ reference: "ATT-0003", type: "OTHER" }).success).toBe(true);
  });

  it.each([
    ["the note", { reference: "ATT-0003", type: "OTHER", priority: "REQUIRED", note: "Guide dog" }],
    ["the name", { reference: "ATT-0003", type: "OTHER", priority: "REQUIRED", name: "Maria" }],
    ["an unknown type", { reference: "ATT-0003", type: "DIETARY", priority: "REQUIRED" }],
    ["a malformed reference", { reference: "Maria", type: "OTHER", priority: "REQUIRED" }],
  ])("refuse created details with %s", (_label, details) => {
    expect(created.safeParse(details).success).toBe(false);
  });

  it("refuse an update that copies the note or changes nothing", () => {
    const base = { reference: "ATT-0003", type: "OTHER" };
    expect(updated.safeParse({ ...base, changes: { note: { from: "a", to: "b" } } }).success).toBe(
      false,
    );
    expect(updated.safeParse({ ...base, changes: {} }).success).toBe(false);
  });

  it("read plainly in Activity", () => {
    expect(
      describeAuditEntry({
        action: "accessibility_requirement.created",
        details: { reference: "ATT-0003", type: "ACCESSIBLE_SEATING", priority: "REQUIRED" },
      }),
    ).toEqual({
      summary: "Added an accessibility need for ATT-0003: Accessible seating (Required)",
      lines: [],
    });
    expect(
      describeAuditEntry({
        action: "accessibility_requirement.updated",
        details: {
          reference: "ATT-0003",
          type: "SIGN_LANGUAGE",
          changes: {
            type: { from: "CAPTIONING", to: "SIGN_LANGUAGE" },
            priority: { from: "REQUIRED", to: "INFORMATIONAL" },
            note: { changed: true },
          },
        },
      }),
    ).toEqual({
      summary: "Edited an accessibility need of ATT-0003: Sign-language interpretation",
      lines: [
        "Need: Captioning → Sign-language interpretation",
        "Priority: Required → For information",
        "Note changed",
      ],
    });
    expect(
      describeAuditEntry({
        action: "accessibility_requirement.deleted",
        details: { reference: "ATT-0003", type: "OTHER" },
      }).summary,
    ).toBe("Removed an accessibility need from ATT-0003: Other");
  });
});

describe("resource entries (B3-05)", () => {
  const created = AUDIT_ACTIONS["accessibility_resource.created"].details;
  const updated = AUDIT_ACTIONS["accessibility_resource.updated"].details;

  it("accept the documented details and refuse a copied note", () => {
    expect(
      created.safeParse({ type: "ACCESSIBLE_SEATS", status: "AVAILABLE", quantity: 8 }).success,
    ).toBe(true);
    expect(
      created.safeParse({ type: "CAPTIONING", status: "ARRANGING", quantity: null }).success,
    ).toBe(true);
    expect(
      created.safeParse({ type: "CAPTIONING", status: "ARRANGING", quantity: null, note: "x" })
        .success,
    ).toBe(false);
    expect(
      updated.safeParse({ type: "CAPTIONING", changes: { note: { from: "a", to: "b" } } }).success,
    ).toBe(false);
    expect(updated.safeParse({ type: "CAPTIONING", changes: {} }).success).toBe(false);
  });

  it("read plainly in Activity", () => {
    expect(
      describeAuditEntry({
        action: "accessibility_resource.created",
        details: { type: "ACCESSIBLE_SEATS", status: "AVAILABLE", quantity: 8 },
      }).summary,
    ).toBe("Set up Accessible seats: Available, 8 seats");
    expect(
      describeAuditEntry({
        action: "accessibility_resource.updated",
        details: {
          type: "ACCESSIBLE_SEATS",
          changes: {
            status: { from: "ARRANGING", to: "AVAILABLE" },
            quantity: { from: 6, to: 8 },
            note: { changed: true },
          },
        },
      }),
    ).toEqual({
      summary: "Edited Accessible seats",
      lines: ["Status: Being arranged → Available", "Seats: 6 → 8", "Note changed"],
    });
    expect(
      describeAuditEntry({
        action: "accessibility_resource.deleted",
        details: { type: "RAMP_OR_ELEVATOR" },
      }).summary,
    ).toBe("Removed Ramp or elevator");
  });
});