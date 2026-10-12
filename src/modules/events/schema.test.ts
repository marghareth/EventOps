// src/modules/events/schema.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatEventReference, isEventReference, manilaYear } from "./reference";
import {
  createEventFormSchema,
  isCalendarDate,
  manilaDateTime,
  eventChanges,
  sameEventDetails,
  toEventFormValues,
  toNewEvent,
  type CreateEventForm,
} from "./schema";

const valid: CreateEventForm = {
  name: "Santos wedding",
  date: "2026-12-12",
  startTime: "16:00",
  endTime: "",
  venue: "",
  description: "",
  capacity: "",
  expectedAttendees: "",
};

function errorsFor(input: Partial<CreateEventForm>): Record<string, string> {
  const result = createEventFormSchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}

describe("createEventFormSchema: required fields", () => {
  it("accepts the essentials alone", () => {
    expect(errorsFor({})).toEqual({});
  });

  it.each([
    ["name", { name: "" }, "Enter the event name."],
    ["name (spaces only)", { name: "   " }, "Enter the event name."],
    ["date", { date: "" }, "Enter the event date."],
    ["start time", { startTime: "" }, "Enter the start time."],
  ])("requires the %s", (_label, input, message) => {
    expect(Object.values(errorsFor(input))).toContain(message);
  });

  it("reports every missing field at once", () => {
    expect(Object.keys(errorsFor({ name: "", date: "", startTime: "" })).sort()).toEqual([
      "date",
      "name",
      "startTime",
    ]);
  });
});

describe("createEventFormSchema: formats and limits", () => {
  it.each([
    ["an impossible date", { date: "2026-02-30" }, "date"],
    ["a date in another format", { date: "12/12/2026" }, "date"],
    ["a 24:00 start", { startTime: "24:00" }, "startTime"],
    ["a malformed end time", { endTime: "9pm" }, "endTime"],
    ["an end before the start", { startTime: "16:00", endTime: "15:59" }, "endTime"],
    ["a 121-character name", { name: "a".repeat(121) }, "name"],
    ["a 201-character venue", { venue: "a".repeat(201) }, "venue"],
    ["a 5,001-character description", { description: "a".repeat(5001) }, "description"],
    ["capacity 0", { capacity: "0" }, "capacity"],
    ["a decimal capacity", { capacity: "12.5" }, "capacity"],
    ["a negative headcount", { expectedAttendees: "-1" }, "expectedAttendees"],
    ["capacity over 1,000,000", { capacity: "1000001" }, "capacity"],
  ])("rejects %s", (_label, input, field) => {
    expect(Object.keys(errorsFor(input))).toContain(field);
  });

  it.each([
    ["a leap day", { date: "2028-02-29" }],
    ["an end equal to the start", { startTime: "16:00", endTime: "16:00" }],
    [
      "exactly 120, 200 and 5,000 characters",
      { name: "a".repeat(120), venue: "b".repeat(200), description: "c".repeat(5000) },
    ],
    ["capacity 1 and 0 expected attendees", { capacity: "1", expectedAttendees: "0" }],
    ["1,000,000 people", { capacity: "1000000", expectedAttendees: "1000000" }],
  ])("accepts %s", (_label, input) => {
    expect(errorsFor(input)).toEqual({});
  });

  it("counts characters like the database: 120 emoji are a valid name", () => {
    expect(errorsFor({ name: "🎉".repeat(120) })).toEqual({});
    expect(Object.keys(errorsFor({ name: "🎉".repeat(121) }))).toContain("name");
  });

  it("explains the capacity limits in words", () => {
    expect(errorsFor({ capacity: "0" }).capacity).toBe(
      "Enter a whole number of 1 or more, up to 1,000,000.",
    );
  });
});

describe("toNewEvent", () => {
  it("converts Philippine time to UTC and fills defaults", () => {
    const parsed = createEventFormSchema.parse({ ...valid, endTime: "22:30", venue: "  Cebu  " });
    expect(toNewEvent(parsed)).toEqual({
      name: "Santos wedding",
      venue: "Cebu",
      description: null,
      startsAt: new Date("2026-12-12T08:00:00Z"),
      endsAt: new Date("2026-12-12T14:30:00Z"),
      capacity: null,
      expectedAttendees: 0,
    });
  });

  it("keeps optional numbers", () => {
    const parsed = createEventFormSchema.parse({
      ...valid,
      capacity: "200",
      expectedAttendees: "180",
    });
    expect(toNewEvent(parsed)).toMatchObject({ capacity: 200, expectedAttendees: 180 });
  });

  it("handles an early-morning start that is the previous day in UTC", () => {
    expect(manilaDateTime("2027-01-01", "07:00")).toEqual(new Date("2026-12-31T23:00:00Z"));
  });
});

describe("isCalendarDate", () => {
  it.each(["2026-12-12", "2028-02-29", "2026-01-31"])("accepts %s", (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });
  it.each(["2026-02-29", "2026-13-01", "2026-00-10", "2026-1-1", ""])("rejects %j", (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});

describe("event references (D-005)", () => {
  it.each([
    [1, "EVT-2026-0001"],
    [42, "EVT-2026-0042"],
    [9999, "EVT-2026-9999"],
    [10000, "EVT-2026-10000"],
  ])("formats number %i as %s", (sequence, expected) => {
    expect(formatEventReference(2026, sequence)).toBe(expected);
  });

  it("refuses a number below 1", () => {
    expect(() => formatEventReference(2026, 0)).toThrow(RangeError);
  });

  it("uses the Philippine year at the new-year boundary", () => {
    expect(manilaYear(new Date("2026-12-31T15:59:59Z"))).toBe(2026);
    expect(manilaYear(new Date("2026-12-31T16:00:00Z"))).toBe(2027);
  });

  it.each([
    ["EVT-2026-0001", true],
    ["EVT-2026-10000", true],
    ["EVT-26-0001", false],
    ["<script>", false],
    [undefined, false],
  ])("recognises %j as a reference: %s", (value, expected) => {
    expect(isEventReference(value)).toBe(expected);
  });
});

describe("toEventFormValues (B1-05)", () => {
  it("turns a stored event back into Philippine-time form values", () => {
    expect(
      toEventFormValues({
        name: "Santos wedding",
        venue: null,
        description: "Garden ceremony",
        startsAt: new Date("2026-12-31T23:00:00Z"),
        endsAt: new Date("2027-01-01T04:30:00Z"),
        capacity: null,
        expectedAttendees: 0,
      }),
    ).toEqual({
      name: "Santos wedding",
      date: "2027-01-01",
      startTime: "07:00",
      endTime: "12:30",
      venue: "",
      description: "Garden ceremony",
      capacity: "",
      expectedAttendees: "0",
    });
  });

  it("round-trips through the form schema unchanged", () => {
    const original = toNewEvent(
      createEventFormSchema.parse({ ...valid, endTime: "22:00", venue: "Cebu", capacity: "200" }),
    );
    const again = toNewEvent(createEventFormSchema.parse(toEventFormValues(original)));
    expect(again).toEqual(original);
    expect(sameEventDetails(original, again)).toBe(true);
  });

  it.each([
    ["name", { name: "Reyes debut" }],
    ["venue", { venue: "Manila" }],
    ["end time", { endsAt: new Date("2026-12-12T15:00:00Z") }],
    ["capacity", { capacity: 150 }],
  ])("notices a changed %s", (_label, change) => {
    const base = toNewEvent(createEventFormSchema.parse({ ...valid, endTime: "22:00" }));
    expect(sameEventDetails(base, { ...base, ...change })).toBe(false);
  });
});

describe("eventChanges (B1-11 audit)", () => {
  const base = toNewEvent(
    createEventFormSchema.parse({
      ...valid,
      endTime: "22:00",
      venue: "Cebu",
      description: "Notes",
    }),
  );

  it("is empty when nothing changed", () => {
    expect(eventChanges(base, { ...base })).toEqual({});
  });

  it("records each changed field old → new, dates as ISO strings", () => {
    expect(
      eventChanges(base, {
        ...base,
        venue: null,
        endsAt: null,
        expectedAttendees: 220,
        startsAt: new Date("2026-12-12T09:00:00Z"),
      }),
    ).toEqual({
      venue: { from: "Cebu", to: null },
      endsAt: { from: "2026-12-12T14:00:00.000Z", to: null },
      expectedAttendees: { from: 0, to: 220 },
      startsAt: { from: "2026-12-12T08:00:00.000Z", to: "2026-12-12T09:00:00.000Z" },
    });
  });

  it("marks the description as changed without copying its text", () => {
    expect(eventChanges(base, { ...base, description: "Secret new text" })).toEqual({
      description: { changed: true },
    });
  });
});