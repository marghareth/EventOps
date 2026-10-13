// src/modules/events/attendees/schema.test.ts
// Attendee validation (B2-01, D-042): required fields, formats, limits and the audit diff.
import { describe, expect, it } from "vitest";
import { RSVP_STATUSES as AUDIT_RSVP_STATUSES } from "@/modules/events/audit/public";
import {
  RSVP_STATUSES,
  ATTENDEE_FIELDS,
  ATTENDEE_LIMITS,
  attendeeChanges,
  attendeeFormSchema,
  formatAttendeeReference,
  toAttendeeFormValues,
  type AttendeeForm,
  type RsvpStatus,
} from "./schema";

const blank: Required<AttendeeForm> = {
  name: "",
  email: "",
  phone: "",
  category: "",
  rsvpStatus: "",
  plusOnes: "",
  dietaryNeeds: "",
  notes: "",
};
const parse = (fields: Partial<AttendeeForm>) =>
  attendeeFormSchema.safeParse({ ...blank, name: "Maria Santos", ...fields });
const errorFor = (fields: Partial<AttendeeForm>, field: keyof AttendeeForm) => {
  const result = parse(fields);
  return result.success ? undefined : result.error.issues.find((i) => i.path[0] === field)?.message;
};

describe("attendee form", () => {
  it("accepts a name alone, with the domain defaults: Pending, no plus-ones, empty as null", () => {
    expect(parse({}).data).toEqual({
      name: "Maria Santos",
      email: null,
      phone: null,
      category: null,
      rsvpStatus: "PENDING",
      plusOnes: 0,
      dietaryNeeds: null,
      notes: null,
    });
  });

  it("accepts every field, trimmed, with the email in lower case", () => {
    expect(
      parse({
        name: "  Maria Santos ",
        email: " Maria@Example.COM ",
        phone: "+63 917 123 4567",
        category: " Family ",
        rsvpStatus: "CONFIRMED",
        plusOnes: "2",
        dietaryNeeds: "Vegetarian, no nuts",
        notes: "Arrives late",
      }).data,
    ).toEqual({
      name: "Maria Santos",
      email: "maria@example.com",
      phone: "+63 917 123 4567",
      category: "Family",
      rsvpStatus: "CONFIRMED",
      plusOnes: 2,
      dietaryNeeds: "Vegetarian, no nuts",
      notes: "Arrives late",
    });
  });

  it.each(["", "   "])("requires a name (%j)", (name: string) => {
    expect(errorFor({ name }, "name")).toBe("Enter the attendee's name.");
  });

  it("limits the name to 120 characters, counting emoji once", () => {
    expect(parse({ name: "a".repeat(120) }).success).toBe(true);
    expect(errorFor({ name: "a".repeat(121) }, "name")).toBe("Use 120 characters or fewer.");
    expect(parse({ name: "🎉".repeat(120) }).success).toBe(true);
  });

  it.each(["PENDING", "CONFIRMED", "DECLINED", "MAYBE"])(
    "accepts the RSVP status %s",
    (rsvp: RsvpStatus) => {
      expect(parse({ rsvpStatus: rsvp }).data?.rsvpStatus).toBe(rsvp);
    },
  );

  it.each(["ATTENDING", "confirmed", "yes", "NULL"])(
    "refuses the RSVP status %j",
    (rsvp: string) => {
      expect(errorFor({ rsvpStatus: rsvp }, "rsvpStatus")).toBe("Choose an RSVP status.");
    },
  );

  it.each([
    ["0", 0],
    ["10", 10],
    ["", 0],
    [" 3 ", 3],
  ])("accepts %j plus-ones as %d", (plusOnes: string, expected: number) => {
    expect(parse({ plusOnes }).data?.plusOnes).toBe(expected);
  });

  it.each(["11", "-1", "1.5", "two", "007", "1e1"])("refuses %j plus-ones", (plusOnes: string) => {
    expect(errorFor({ plusOnes }, "plusOnes")).toBe(
      "Plus-ones must be a whole number from 0 to 10.",
    );
  });

  it.each(["maria", "maria@", "@example.com", "maria example.com"])(
    "refuses the email %j",
    (email: string) => {
      expect(errorFor({ email }, "email")).toBe("Enter an email like name@example.com.");
    },
  );

  it.each(["0917 123 4567", "+63 917 123 4567", "(032) 234-5678", "09171234567"])(
    "accepts the phone %j",
    (phone: string) => {
      expect(parse({ phone }).data?.phone).toBe(phone);
    },
  );

  it.each(["12345", "call me", "+63 917 123 4567 ext 2", "++63917", "1".repeat(16)])(
    "refuses the phone %j",
    (phone: string) => {
      expect(errorFor({ phone }, "phone")).toBe(
        "Enter a phone number like 0917 123 4567 or +63 917 123 4567.",
      );
    },
  );

  it.each([
    ["category", ATTENDEE_LIMITS.category, "Category can be at most 60 characters."],
    ["dietaryNeeds", ATTENDEE_LIMITS.dietaryNeeds, "Dietary needs can be at most 500 characters."],
    ["notes", ATTENDEE_LIMITS.notes, "Notes can be at most 2,000 characters."],
  ] as const)(
    "limits %s to %d characters",
    (field: "category" | "dietaryNeeds" | "notes", max: number, message: string) => {
      expect(parse({ [field]: "x".repeat(max) }).success).toBe(true);
      expect(errorFor({ [field]: "x".repeat(max + 1) }, field)).toBe(message);
    },
  );

  it("lists every form field once", () => {
    expect([...ATTENDEE_FIELDS].sort()).toEqual(Object.keys(blank).sort());
  });

  it("turns a stored attendee back into the same form values", () => {
    const stored = parse({ email: "a@b.co", plusOnes: "1", rsvpStatus: "MAYBE" }).data!;
    expect(attendeeFormSchema.parse(toAttendeeFormValues(stored))).toEqual(stored);
  });
});

describe("readable attendee IDs", () => {
  it.each([
    [1, "ATT-0001"],
    [184, "ATT-0184"],
    [12345, "ATT-12345"],
  ])("%d is %s", (number: number, reference: string) => {
    expect(formatAttendeeReference(number)).toBe(reference);
  });
});

describe("attendee changes for the audit log", () => {
  const before = parse({
    email: "old@example.com",
    phone: "0917 123 4567",
    dietaryNeeds: "Vegan",
    notes: "Old note",
    category: "Family",
  }).data!;

  it("records name, RSVP, plus-ones and category old → new", () => {
    const after = {
      ...before,
      name: "Maria S.",
      rsvpStatus: "DECLINED" as const,
      plusOnes: 2,
      category: null,
    };
    expect(attendeeChanges(before, after)).toEqual({
      name: { from: "Maria Santos", to: "Maria S." },
      rsvpStatus: { from: "PENDING", to: "DECLINED" },
      plusOnes: { from: 0, to: 2 },
      category: { from: "Family", to: null },
    });
  });

  it("records contact details, dietary needs and notes only as changed, never their values", () => {
    const after = {
      ...before,
      email: "new@example.com",
      phone: null,
      dietaryNeeds: "None",
      notes: "Secret",
    };
    const changes = attendeeChanges(before, after);
    expect(changes).toEqual({
      email: { changed: true },
      phone: { changed: true },
      dietaryNeeds: { changed: true },
      notes: { changed: true },
    });
    expect(JSON.stringify(changes)).not.toMatch(/example\.com|0917|Vegan|Secret/);
  });

  it("is empty when nothing changed", () => {
    expect(attendeeChanges(before, { ...before })).toEqual({});
  });
});

describe("RSVP values", () => {
  it("match the audit registry's copy (which a test keeps equal to the database enum)", () => {
    expect([...RSVP_STATUSES]).toEqual([...AUDIT_RSVP_STATUSES]);
  });
});
