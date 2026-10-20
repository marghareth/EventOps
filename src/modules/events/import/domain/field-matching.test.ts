// src/modules/events/import/domain/field-matching.test.ts
// @vitest-environment node
// Automatic header matching and keyword-based field detection (B9-F06, F08; D-110).
import { describe, expect, it } from "vitest";
import type { ColumnType } from "./column-types";
import { matchColumns, suggestImportType, type FieldRule } from "./field-matching";

const RULES: FieldRule[] = [
  { field: "name", words: ["name", "guest", "guestname", "fullname"], accepts: [] },
  { field: "email", words: ["email", "emailaddress"], accepts: ["email"], byType: "email" },
  {
    field: "phone",
    words: ["phone", "mobile", "contact"],
    accepts: ["phone", "number"],
    byType: "phone",
  },
  { field: "plusOnes", words: ["plusones", "plusone"], accepts: ["number"] },
  { field: "notes", words: ["notes", "remarks"] },
];

const col = (header: string, type: ColumnType = "text") => ({ header, type });

describe("matchColumns", () => {
  it("matches equal headers, ignoring case, accents, spaces and punctuation", () => {
    expect(
      matchColumns(
        [col("Guest Name"), col("E-mail Address", "email"), col("Plus-ones", "number")],
        RULES,
      ),
    ).toEqual(["name", "email", "plusOnes"]);
  });

  it("then headers that contain a word ('Mobile no.', 'Guest's full name')", () => {
    expect(matchColumns([col("Mobile no.", "phone"), col("Guest's full name")], RULES)).toEqual([
      "phone",
      "name",
    ]);
  });

  it("combines the header with the column's type: 'Contact' holding emails is Email", () => {
    expect(matchColumns([col("Name"), col("Contact", "email")], RULES)).toEqual(["name", "email"]);
    expect(matchColumns([col("Name"), col("Contact", "phone")], RULES)).toEqual(["name", "phone"]);
  });

  it("uses the type alone for emails and phones with an unknown header", () => {
    expect(matchColumns([col("Column B", "email"), col("Column C", "phone")], RULES)).toEqual([
      "email",
      "phone",
    ]);
  });

  it("never gives a field to a column of the wrong type", () => {
    expect(matchColumns([col("Name", "number"), col("Plus ones", "date")], RULES)).toEqual([
      null,
      null,
    ]);
  });

  it("gives each field to one column, preferring an equal header to a contained word", () => {
    expect(
      matchColumns([col("Name of company"), col("Name"), col("Notes"), col("Remarks")], RULES),
    ).toEqual([null, "name", "notes", null]);
  });
});

describe("suggestImportType", () => {
  const byType = {
    attendees: [
      { field: "name", words: ["name", "guest"] },
      { field: "rsvpStatus", words: ["rsvp"] },
    ],
    suppliers: [
      { field: "name", words: ["name", "supplier", "vendor"] },
      { field: "category", words: ["category", "service"] },
    ],
  };

  it("counts columns named by words only one type uses", () => {
    expect(suggestImportType([col("Vendor"), col("Service"), col("Name")], byType)).toBe(
      "suppliers",
    );
    expect(suggestImportType([col("Guest"), col("RSVP")], byType)).toBe("attendees");
  });

  it("is null when the headers don't tell", () => {
    expect(suggestImportType([col("Name"), col("Email")], byType)).toBeNull();
    expect(suggestImportType([col("Guest"), col("Vendor")], byType)).toBeNull();
  });
});