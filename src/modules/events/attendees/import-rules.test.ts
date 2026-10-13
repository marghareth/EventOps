// src/modules/events/attendees/import-rules.test.ts
// CSV import rules (B2-15 to B2-17, D-052): mapping suggestions and checks, the RSVP word list, row
// validation with the add form's schema, duplicates, and the preview totals.
import { describe, expect, it } from "vitest";
import { parseCsv, type CsvTable } from "./csv";
import {
  IMPORT_FIELDS,
  attendeesToImport,
  buildImportPreview,
  readMapping,
  readRsvp,
  suggestMapping,
  type ColumnMapping,
  type ExistingIdentity,
} from "./import-rules";

const csv = (text: string): CsvTable => {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(result.error);
  return result.table;
};

describe("suggestMapping (B2-15)", () => {
  it("recognises common header names, ignoring case, spaces and punctuation", () => {
    expect(
      suggestMapping([
        "Guest Name",
        "E-mail",
        "Mobile No.",
        "RSVP",
        "Plus ones",
        "Group",
        "Dietary Requirements",
        "Remarks",
        "Table",
      ]),
    ).toEqual([
      "name",
      "email",
      null,
      "rsvpStatus",
      "plusOnes",
      "category",
      "dietaryNeeds",
      "notes",
      null,
    ]);
  });

  it("reads back the headers EventOps exports", () => {
    expect(
      suggestMapping([
        "ID",
        "Name",
        "RSVP",
        "Plus-ones",
        "Category",
        "Dietary needs",
        "Email",
        "Phone",
        "Notes",
      ]),
    ).toEqual([
      null,
      "name",
      "rsvpStatus",
      "plusOnes",
      "category",
      "dietaryNeeds",
      "email",
      "phone",
      "notes",
    ]);
  });

  it("suggests each field for one column only", () => {
    expect(suggestMapping(["Name", "Full name", "Phone", "Mobile"])).toEqual([
      "name",
      null,
      "phone",
      null,
    ]);
  });
});

describe("readMapping (B2-15)", () => {
  it("accepts known fields and Don't import", () => {
    expect(readMapping(["name", "", "email"], 3)).toEqual({
      ok: true,
      mapping: ["name", null, "email"],
    });
  });

  it("requires the name", () => {
    expect(readMapping(["", "email"], 2)).toEqual({
      ok: false,
      errors: ["Choose the column that holds each guest's name."],
    });
  });

  it("refuses a field EventOps doesn't have", () => {
    expect(readMapping(["name", "salary"], 2)).toMatchObject({
      ok: false,
      errors: [
        "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
      ],
    });
    expect(readMapping(["name", "number"], 2).ok).toBe(false);
    expect(readMapping(["name", "eventId"], 2).ok).toBe(false);
  });

  it("refuses a field chosen twice", () => {
    expect(readMapping(["name", "email", "email"], 3)).toEqual({
      ok: false,
      errors: ["Email is chosen for more than one column. Choose it once."],
    });
  });

  it("refuses a mapping that doesn't match the file's columns", () => {
    expect(readMapping(["name"], 2)).toEqual({
      ok: false,
      errors: ["The mapping doesn't match the file. Upload it again."],
    });
  });

  it("offers only the attendee fields the add form edits", () => {
    expect([...IMPORT_FIELDS].sort()).toEqual([
      "category",
      "dietaryNeeds",
      "email",
      "name",
      "notes",
      "phone",
      "plusOnes",
      "rsvpStatus",
    ]);
  });
});

describe("readRsvp (B2-17)", () => {
  it.each([
    ["Confirmed", "CONFIRMED"],
    ["YES", "CONFIRMED"],
    [" attending ", "CONFIRMED"],
    ["Going", "CONFIRMED"],
    ["no", "DECLINED"],
    ["Not attending", "DECLINED"],
    ["Regrets", "DECLINED"],
    ["declined", "DECLINED"],
    ["Tentative", "MAYBE"],
    ["unsure", "MAYBE"],
    ["maybe", "MAYBE"],
    ["pending", "PENDING"],
    ["", ""],
    ["  ", ""],
  ])("reads %j as %j", (cell, state) => {
    expect(readRsvp(cell)).toBe(state);
  });

  it.each(["y", "1", "TRUE", "confirmed!!?x", "perhaps"])("doesn't guess %j", (cell) => {
    expect(readRsvp(cell)).toBeNull();
  });
});

describe("buildImportPreview (B2-16, B2-17)", () => {
  const file = csv(
    [
      "Guest Name,Email,RSVP,Plus ones,Table",
      "Ana Reyes,ana@example.com,Yes,1,T1",
      ",nobody@example.com,Yes,0,T2",
      "Ben Lim,not-an-email,perhaps,eleven,T3",
      "José Peña,,No,,T4",
      "ana reyes,ANA@example.com,Maybe,0,T5",
      "Carla Santos,carla@example.com,,2,T6",
    ].join("\n"),
  );
  const mapping: ColumnMapping = ["name", "email", "rsvpStatus", "plusOnes", null];
  const existing: ExistingIdentity[] = [{ name: "Jose Pena", email: null, reference: "ATT-0004" }];
  const preview = buildImportPreview(file, mapping, existing, { includeDuplicates: false });
  const byLine = (line: number) => preview.rows.find((r) => r.line === line)!;

  it("counts every row once", () => {
    expect(preview.totals).toEqual({ rows: 6, valid: 2, invalid: 2, duplicates: 2, toImport: 2 });
    expect(preview.ignoredColumns).toEqual(["Table"]);
  });

  it("maps values by field and turns valid rows into attendees, with the form's defaults", () => {
    expect(byLine(2)).toMatchObject({
      status: "valid",
      values: { name: "Ana Reyes", email: "ana@example.com", rsvpStatus: "Yes", plusOnes: "1" },
      attendee: {
        name: "Ana Reyes",
        email: "ana@example.com",
        rsvpStatus: "CONFIRMED",
        plusOnes: 1,
        category: null,
        notes: null,
      },
    });
    expect(byLine(7).attendee).toMatchObject({ rsvpStatus: "PENDING", plusOnes: 2 });
  });

  it("explains every problem in a row, by field, and never makes an attendee from it", () => {
    expect(byLine(3)).toMatchObject({
      status: "invalid",
      errors: ["Name: Enter the attendee's name."],
    });
    expect(byLine(3).attendee).toBeUndefined();
    expect(byLine(4).errors).toEqual([
      "RSVP: “perhaps” isn't one we know. Use Confirmed, Pending, Maybe or Declined.",
      "Email: Enter an email like name@example.com.",
      "Plus-ones: Plus-ones must be a whole number from 0 to 10.",
    ]);
  });

  it("finds duplicates of existing attendees (accents ignored) and of earlier rows (email case ignored)", () => {
    expect(byLine(5)).toMatchObject({
      status: "duplicate",
      duplicateOf: "Already on the guest list as Jose Pena (ATT-0004)",
    });
    expect(byLine(6)).toMatchObject({
      status: "duplicate",
      duplicateOf: "Repeats line 2 of the file",
    });
  });

  it("treats the same name with different emails as different guests", () => {
    const two = csv("Name,Email\nMaria Santos,maria1@example.com\nMaria Santos,maria2@example.com");
    expect(
      buildImportPreview(two, ["name", "email"], [], { includeDuplicates: false }).totals.valid,
    ).toBe(2);
  });

  it("imports valid rows only, and duplicates only when chosen", () => {
    expect(attendeesToImport(preview, { includeDuplicates: false }).map((a) => a.name)).toEqual([
      "Ana Reyes",
      "Carla Santos",
    ]);
    const withDuplicates = buildImportPreview(file, mapping, existing, { includeDuplicates: true });
    expect(withDuplicates.totals.toImport).toBe(4);
    expect(
      attendeesToImport(withDuplicates, { includeDuplicates: true }).map((a) => a.name),
    ).toEqual(["Ana Reyes", "José Peña", "ana reyes", "Carla Santos"]);
  });

  it("says what will be saved for rows that will be imported, in words", () => {
    expect(byLine(2).saved).toEqual({
      name: "Ana Reyes",
      email: "ana@example.com",
      rsvpStatus: "Confirmed",
      plusOnes: "1",
    });
    // José: empty email stays empty, empty plus-ones becomes 0, "No" becomes Declined.
    expect(byLine(5).saved).toEqual({
      name: "José Peña",
      email: "",
      rsvpStatus: "Declined",
      plusOnes: "0",
    });
    expect(byLine(3).saved).toBeUndefined();
  });

  it("keeps the original cells, so rows needing correction can be downloaded", () => {
    expect(byLine(4).cells).toEqual(["Ben Lim", "not-an-email", "perhaps", "eleven", "T3"]);
  });

  it("applies the add form's length limits", () => {
    const long = csv(`Name,Notes\n${"a".repeat(121)},x\nAna,${"n".repeat(2001)}`);
    const result = buildImportPreview(long, ["name", "notes"], [], { includeDuplicates: false });
    expect(result.rows.map((r) => r.errors)).toEqual([
      ["Name: Use 120 characters or fewer."],
      ["Notes: Notes can be at most 2,000 characters."],
    ]);
  });
});