// src/modules/events/attendees/export-csv.test.ts
// The attendee export file (B2-19, D-053): columns, order, words for RSVP, formula-safe cells, a
// byte-order mark, a header-only file for an empty list, a file the import reads back, and the
// file name in Manila time.
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import {
  EXPORT_HEADERS,
  attendeesCsv,
  exportFileName,
  type ExportableAttendee,
} from "./export-csv";
import { suggestMapping } from "./import-rules";

const person = (
  fields: Partial<ExportableAttendee> & { number: number; name: string },
): ExportableAttendee => ({
  email: null,
  phone: null,
  category: null,
  rsvpStatus: "PENDING",
  plusOnes: 0,
  dietaryNeeds: null,
  notes: null,
  ...fields,
});

const read = (text: string) => {
  const parsed = parseCsv(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.table;
};

describe("attendeesCsv", () => {
  it("writes the header and one row per attendee, in ID order, with RSVP in words", () => {
    const text = attendeesCsv([
      person({ number: 12, name: "Ben Lim", rsvpStatus: "DECLINED" }),
      person({
        number: 3,
        name: "José Peña",
        rsvpStatus: "CONFIRMED",
        plusOnes: 2,
        category: "Family",
        dietaryNeeds: "Halal",
        email: "jose@example.com",
        phone: "0917 123 4567",
        notes: "Arrives late",
      }),
    ]);
    expect(text.startsWith("﻿")).toBe(true);
    expect(read(text)).toEqual({
      headers: [...EXPORT_HEADERS],
      rows: [
        {
          line: 2,
          cells: [
            "ATT-0003",
            "José Peña",
            "Confirmed",
            "2",
            "Family",
            "Halal",
            "jose@example.com",
            "0917 123 4567",
            "Arrives late",
          ],
        },
        { line: 3, cells: ["ATT-0012", "Ben Lim", "Declined", "0", "", "", "", "", ""] },
      ],
    });
  });

  it("keeps commas, quotes and line breaks inside values", () => {
    const text = attendeesCsv([
      person({ number: 1, name: "Reyes, Ana", notes: 'Says "hi"\nand bye' }),
    ]);
    expect(read(text).rows[0].cells.slice(1, 2)).toEqual(["Reyes, Ana"]);
    expect(read(text).rows[0].cells[8]).toBe('Says "hi"\nand bye');
  });

  it("neutralizes values a spreadsheet would run as formulas", () => {
    const text = attendeesCsv([
      person({
        number: 1,
        name: '=HYPERLINK("http://x","Ana")',
        phone: "+63 917 123 4567",
        notes: "@SUM(A1)",
      }),
    ]);
    const cells = read(text).rows[0].cells;
    expect(cells[1]).toBe('\'=HYPERLINK("http://x","Ana")');
    expect(cells[7]).toBe("'+63 917 123 4567");
    expect(cells[8]).toBe("'@SUM(A1)");
  });

  it("writes only the header for an empty guest list", () => {
    expect(attendeesCsv([])).toBe(`﻿${EXPORT_HEADERS.join(",")}\r\n`);
  });

  it("can be imported again: every column but ID maps back to its field", () => {
    expect(
      suggestMapping(read(attendeesCsv([person({ number: 1, name: "Ana" })])).headers),
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
});

describe("exportFileName", () => {
  it("uses the event number and the date in Manila", () => {
    // 2026-10-12 17:30 UTC is 2026-10-13 01:30 in Manila.
    expect(exportFileName("EVT-2026-0001", new Date("2026-10-12T17:30:00Z"))).toBe(
      "EVT-2026-0001-attendees-2026-10-13.csv",
    );
  });

  it("keeps only safe characters from the reference", () => {
    expect(exportFileName('EVT-2026-0001"; x=../', new Date("2026-10-13T00:00:00Z"))).toBe(
      "EVT-2026-0001x-attendees-2026-10-13.csv",
    );
  });
});