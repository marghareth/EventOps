// src/modules/events/attendees/csv.test.ts
// CSV reading and writing (B2-14, B2-19; D-052, D-053): RFC 4180 quoting, line endings, BOM,
// blank lines, ragged rows, limits, malformed files, and formula-safe output that reads back.
import { describe, expect, it } from "vitest";
import { CSV_LIMITS, neutralizeFormula, parseCsv, toCsv } from "./csv";

const table = (text: string) => {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(result.error);
  return result.table;
};
const error = (text: string) => {
  const result = parseCsv(text);
  return result.ok ? undefined : result.error;
};

describe("parseCsv", () => {
  it("reads a header and rows, with the line of each row", () => {
    expect(table("Name,RSVP\nAna,Yes\nBen,No\n")).toEqual({
      headers: ["Name", "RSVP"],
      rows: [
        { line: 2, cells: ["Ana", "Yes"] },
        { line: 3, cells: ["Ben", "No"] },
      ],
    });
  });

  it("handles quotes, doubled quotes, commas and line breaks inside quotes", () => {
    const t = table('Name,Notes\n"Reyes, Ana","Says ""hi""\nand bye"\nBen,x\n');
    expect(t.rows[0].cells).toEqual(["Reyes, Ana", 'Says "hi"\nand bye']);
    // Ben's row starts on line 4: the quoted line break counts.
    expect(t.rows[1]).toEqual({ line: 4, cells: ["Ben", "x"] });
  });

  it("accepts CRLF, a byte-order mark, no final line break and blank lines", () => {
    expect(table("﻿Name,RSVP\r\n\r\nAna,Yes\r\n,\r\nBen,No").rows.map((r) => r.cells[0])).toEqual([
      "Ana",
      "Ben",
    ]);
  });

  it("skips blank lines before the header", () => {
    expect(table("\n\nName\nAna").headers).toEqual(["Name"]);
  });

  it("pads short rows and accepts trailing empty values", () => {
    expect(table("Name,Email,Phone\nAna\nBen,b@x.co,,\n").rows.map((r) => r.cells)).toEqual([
      ["Ana", "", ""],
      ["Ben", "b@x.co", ""],
    ]);
  });

  it("names empty and repeated headers so each column can be told apart", () => {
    expect(table(" Name ,,Email,email\nAna,1,2,3").headers).toEqual([
      "Name",
      "Column 2",
      "Email",
      "email (2)",
    ]);
  });

  it("keeps formulas and markup as plain text", () => {
    expect(table('Name,Notes\n=HYPERLINK("x"),<script>alert(1)</script>').rows[0].cells).toEqual([
      '=HYPERLINK("x")',
      "<script>alert(1)</script>",
    ]);
  });

  it.each([
    ["", "The file is empty."],
    ["\n \n,,\n", "The file is empty."],
    ["Name,RSVP\n", "The file has a header row but no rows below it."],
    [
      'Name\n"Ana',
      'A quoted value that starts on line 2 never ends. Check for a missing closing quote (").',
    ],
    ["Name\nAna,extra", "Line 2 has more values than there are column headers."],
    ["Name\nA\u0000na", "This doesn't look like a text CSV file."],
  ])("refuses %j", (text, message) => {
    expect(error(text)).toBe(message);
  });

  it("refuses more rows, columns or a longer value than the limits", () => {
    expect(error(`Name\n${"Ana\n".repeat(CSV_LIMITS.rows + 1)}`)).toBe(
      "The file has 2,001 rows. The limit is 2,000 per import.",
    );
    expect(table(`Name\n${"Ana\n".repeat(CSV_LIMITS.rows)}`).rows).toHaveLength(CSV_LIMITS.rows);
    expect(error(`${Array.from({ length: 51 }, (_, i) => `c${i}`).join(",")}\nx`)).toBe(
      "The file has 51 columns. The limit is 50.",
    );
    expect(error(`Name\n${"a".repeat(CSV_LIMITS.cell + 1)}`)).toBe(
      "A value on line 2 is longer than 5,000 characters.",
    );
  });
});

describe("toCsv and neutralizeFormula", () => {
  it("quotes only when needed and ends lines with CRLF", () => {
    expect(
      toCsv([
        ["Name", "Notes"],
        ["Reyes, Ana", 'Says "hi"'],
        ["Ben", "two\nlines"],
      ]),
    ).toBe('Name,Notes\r\n"Reyes, Ana","Says ""hi"""\r\nBen,"two\nlines"\r\n');
  });

  it.each(["=1+1", "+63 917", "-5", "@SUM(A1)", "\tx", "\rx"])("neutralizes %j", (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it("leaves ordinary text alone", () => {
    expect(neutralizeFormula("Ana = guest")).toBe("Ana = guest");
  });

  it("adds a byte-order mark on request, and reads back what it writes", () => {
    const rows = [
      ["Name", "Notes"],
      ["José Peña", 'a, "b"\nc'],
    ];
    const text = toCsv(rows, { bom: true });
    expect(text.startsWith("﻿")).toBe(true);
    expect(table(text)).toEqual({ headers: rows[0], rows: [{ line: 2, cells: rows[1] }] });
  });
});