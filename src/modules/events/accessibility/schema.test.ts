// src/modules/events/accessibility/schema.test.ts
// Server-side validation of accessibility input (B3-02, D-057): the same schemas the forms use.
import { describe, expect, it } from "vitest";
import { REQUIREMENT_TYPES } from "./domain/requirement-type";
import { RESOURCE_TYPES } from "./domain/resource";
import {
  requirementFormSchema,
  resourceFormSchema,
  toRequirementFormValues,
  toResourceFormValues,
} from "./schema";

const requirement = (values: Partial<Record<"type" | "priority" | "note", string>>) =>
  requirementFormSchema.safeParse({
    type: "ACCESSIBLE_SEATING",
    priority: "",
    note: "",
    ...values,
  });
const errorFor = (result: ReturnType<typeof requirement>, field: string) =>
  result.success ? undefined : result.error.issues.find((i) => i.path[0] === field)?.message;

describe("requirementFormSchema", () => {
  it.each(REQUIREMENT_TYPES.filter((t) => t !== "OTHER"))("accepts %s without a note", (type) => {
    const result = requirement({ type });
    expect(result.success && result.data).toEqual({ type, priority: "REQUIRED", note: null });
  });

  it("defaults the priority to Required and trims the note", () => {
    const result = requirement({ note: "  Near an exit  " });
    expect(result.success && result.data).toMatchObject({
      priority: "REQUIRED",
      note: "Near an exit",
    });
  });

  it.each(["REQUIRED", "PREFERRED", "INFORMATIONAL"])("accepts the priority %s", (priority) => {
    expect(requirement({ priority }).success).toBe(true);
  });

  it.each(["", "DIETARY", "accessible_seating", "<script>", "WHEELCHAIR"])(
    "refuses the type %j",
    (type) => {
      expect(errorFor(requirement({ type }), "type")).toBe("Choose what the guest needs.");
    },
  );

  it.each(["MUST", "required", "HIGH"])("refuses the priority %j", (priority) => {
    expect(errorFor(requirement({ priority }), "priority")).toBe("Choose how important this is.");
  });

  it("requires a note for Other, and refuses a blank one", () => {
    expect(errorFor(requirement({ type: "OTHER" }), "note")).toBe("Describe what the guest needs.");
    expect(errorFor(requirement({ type: "OTHER", note: "   " }), "note")).toBe(
      "Describe what the guest needs.",
    );
    expect(requirement({ type: "OTHER", note: "Quiet room nearby" }).success).toBe(true);
  });

  it("limits the note to 500 characters, counting emoji once", () => {
    expect(requirement({ note: "a".repeat(500) }).success).toBe(true);
    expect(requirement({ note: "🎉".repeat(500) }).success).toBe(true);
    expect(errorFor(requirement({ note: "a".repeat(501) }), "note")).toBe(
      "Use 500 characters or fewer.",
    );
  });

  it("round-trips stored values through the edit form", () => {
    const stored = {
      type: "OTHER" as const,
      priority: "INFORMATIONAL" as const,
      note: "Guide dog",
    };
    const result = requirementFormSchema.safeParse(toRequirementFormValues(stored));
    expect(result.success && result.data).toEqual(stored);
  });
});

describe("resourceFormSchema", () => {
  const parse = (type: (typeof RESOURCE_TYPES)[number], values: Record<string, string>) =>
    resourceFormSchema(type).safeParse({ status: "AVAILABLE", quantity: "", note: "", ...values });

  it("needs a whole seat count from 0 to 10,000 for accessible seats", () => {
    expect(parse("ACCESSIBLE_SEATS", { quantity: "8" })).toMatchObject({
      success: true,
      data: { status: "AVAILABLE", quantity: 8, note: null },
    });
    expect(parse("ACCESSIBLE_SEATS", { quantity: "0" }).success).toBe(true);
    expect(parse("ACCESSIBLE_SEATS", { quantity: "10000" }).success).toBe(true);
    for (const quantity of ["", "-1", "2.5", "10001", "ten", "1e3"]) {
      expect(parse("ACCESSIBLE_SEATS", { quantity }).success).toBe(false);
    }
  });

  it.each(RESOURCE_TYPES.filter((t) => t !== "ACCESSIBLE_SEATS"))(
    "ignores any count for %s",
    (type) => {
      const result = parse(type, { quantity: "12" });
      expect(result.success && result.data.quantity).toBeNull();
    },
  );

  it.each(["", "READY", "available", "NOT_SET_UP"])("refuses the status %j", (status) => {
    const result = parse("CAPTIONING", { status });
    expect(result.success).toBe(false);
  });

  it("round-trips stored values through the edit form", () => {
    const stored = { status: "ARRANGING" as const, quantity: 6, note: "By the stage" };
    expect(resourceFormSchema("ACCESSIBLE_SEATS").parse(toResourceFormValues(stored))).toEqual(
      stored,
    );
    const ramp = { status: "NOT_AVAILABLE" as const, quantity: null, note: null };
    expect(resourceFormSchema("RAMP_OR_ELEVATOR").parse(toResourceFormValues(ramp))).toEqual(ramp);
  });
});