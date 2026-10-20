// src/modules/events/import/infrastructure/parsers/xlsx-parser.test.ts
// @vitest-environment node
// Excel reading (B9-F03, D-109): values from the first or a chosen sheet, row numbers kept, and
// the safety limits: not an xlsx, encrypted, ZIP64-sized, a zip bomb, too many columns or rows.
import { describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { xlsx, zip } from "./xlsx-test-file";

vi.mock("server-only", () => ({}));
const { readXlsx } = await import("./xlsx-parser");

const LIMITS = { rows: 2000, columns: 50, cell: 5000 };
const read = (bytes: Uint8Array, sheet?: string) => readXlsx(bytes, { sheet, limits: LIMITS });

describe("readXlsx", () => {
  it("reads the first sheet's values as text, numbers without float noise, booleans as words", () => {
    const file = xlsx({
      Guests: [
        ["Guest Name", "Plus ones", "Phone", "Vegan", "Note"],
        ["Ana Reyes", 1, 9171234567, true, "Tom & Jerry <3"],
        ["José Peña", 0.1 + 0.2, null, false, "=1+1"],
      ],
      Suppliers: [["Name"], ["Bloom Co."]],
    });
    expect(read(file)).toEqual({
      ok: true,
      sheets: ["Guests", "Suppliers"],
      sheet: "Guests",
      rows: [
        ["Guest Name", "Plus ones", "Phone", "Vegan", "Note"],
        ["Ana Reyes", "1", "9171234567", "TRUE", "Tom & Jerry <3"],
        // A value that looks like a formula is plain text: it is never evaluated.
        ["José Peña", "0.3", "", "FALSE", "=1+1"],
      ],
    });
  });

  it("reads a chosen sheet, and the first one when the name isn't in the workbook", () => {
    const file = xlsx({ Guests: [["Name"], ["Ana"]], Vendors: [["Name"], ["Bloom Co."]] });
    expect(read(file, "Vendors")).toMatchObject({
      sheet: "Vendors",
      rows: [["Name"], ["Bloom Co."]],
    });
    expect(read(file, "Missing")).toMatchObject({ sheet: "Guests" });
  });

  it("keeps empty rows, so row numbers match the sheet", () => {
    const file = xlsx({ S: [["Name"], [], ["Ana"]] });
    expect(read(file)).toMatchObject({ rows: [["Name"], [], ["Ana"]] });
  });

  it("reads inline strings, formula results and stored (uncompressed) parts", () => {
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><r><t>Plus</t></r><r><t xml:space="preserve"> ones</t></r></is></c></row><row r="2"><c r="A2" t="str"><f>UPPER("ana")</f><v>ANA</v></c><c r="B2"><f>1+1</f><v>2</v></c><c r="C2" t="e"><v>#DIV/0!</v></c></row></sheetData></worksheet>`;
    const file = zip([
      {
        name: "xl/workbook.xml",
        data: Buffer.from('<workbook><sheets><sheet name="One" r:id="rId1"/></sheets></workbook>'),
        store: true,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: Buffer.from(
          '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/a.xml"/></Relationships>',
        ),
      },
      { name: "xl/worksheets/a.xml", data: Buffer.from(sheet) },
    ]);
    expect(read(file)).toMatchObject({
      ok: true,
      rows: [
        ["Name", "Plus ones"],
        ["ANA", "2"],
      ],
    });
  });

  it("refuses something that isn't an xlsx file", () => {
    expect(read(Buffer.from("Name,Email\nAna,ana@example.com"))).toEqual({
      ok: false,
      error: expect.stringContaining("doesn't look like an Excel .xlsx file"),
    });
    expect(read(zip([{ name: "word/document.xml", data: Buffer.from("<w/>") }]))).toMatchObject({
      ok: false,
    });
  });

  it("refuses a password-protected part", () => {
    const file = Buffer.from(xlsx({ S: [["Name"]] }));
    // Set the "encrypted" flag on every central directory entry.
    for (let i = 0; i < file.length - 4; i += 1) {
      if (file.readUInt32LE(i) === 0x02014b50) file.writeUInt16LE(1, i + 8);
    }
    expect(read(file)).toEqual({ ok: false, error: expect.stringContaining("password-protected") });
  });

  it("refuses a zip bomb: a part that unpacks past the cap", () => {
    // 30 MB of zeros packs into about 30 KB.
    const huge = Buffer.alloc(30 * 1024 * 1024, 0x20);
    const sheet = Buffer.concat([Buffer.from("<worksheet><sheetData>"), huge]);
    const file = zip([
      {
        name: "xl/workbook.xml",
        data: Buffer.from('<workbook><sheets><sheet name="S" r:id="r1"/></sheets></workbook>'),
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: Buffer.from(
          '<Relationships><Relationship Id="r1" Target="worksheets/s.xml"/></Relationships>',
        ),
      },
      { name: "xl/worksheets/s.xml", data: sheet },
    ]);
    expect(file.length).toBeLessThan(750 * 1024);
    expect(read(file)).toEqual({
      ok: false,
      error: expect.stringContaining("too large once unpacked"),
    });
  });

  it("refuses a part that unpacks to more than it declared", () => {
    const real = Buffer.alloc(25 * 1024 * 1024, 0x20);
    const file = Buffer.from(
      zip([
        {
          name: "xl/workbook.xml",
          data: Buffer.from('<workbook><sheets><sheet name="S" r:id="r1"/></sheets></workbook>'),
        },
        { name: "xl/_rels/workbook.xml.rels", data: real },
      ]),
    );
    // Lie about the second part's size in the central directory: 10 bytes.
    let seen = 0;
    for (let i = 0; i < file.length - 4; i += 1) {
      if (file.readUInt32LE(i) === 0x02014b50 && ++seen === 2) file.writeUInt32LE(10, i + 24);
    }
    expect(deflateRawSync(real).length).toBeLessThan(750 * 1024);
    expect(read(file)).toEqual({
      ok: false,
      error: expect.stringContaining("too large once unpacked"),
    });
  });

  it("refuses files over 750 KB, more than 50 columns and very long values", () => {
    expect(read(new Uint8Array(750 * 1024 + 1))).toEqual({
      ok: false,
      error: expect.stringContaining("larger than 750 KB"),
    });
    const wide = xlsx({ S: [Array.from({ length: 51 }, (_, i) => `C${i}`)] });
    expect(read(wide)).toEqual({
      ok: false,
      error: expect.stringContaining("more than 50 columns"),
    });
    const long = xlsx({ S: [["Name"], ["x".repeat(5001)]] });
    expect(read(long)).toEqual({ ok: false, error: expect.stringContaining("row 2 is longer") });
  });

  it("refuses a sheet with far too many rows", () => {
    const rows = [["Name"], ...Array.from({ length: 5100 }, (_, i) => [`G${i}`])];
    expect(read(xlsx({ S: rows }))).toEqual({
      ok: false,
      error: expect.stringContaining("too many rows"),
    });
  });

  it("never follows a sheet path out of the package", () => {
    const file = zip([
      {
        name: "xl/workbook.xml",
        data: Buffer.from('<workbook><sheets><sheet name="S" r:id="r1"/></sheets></workbook>'),
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: Buffer.from(
          '<Relationships><Relationship Id="r1" Target="../../etc/passwd"/></Relationships>',
        ),
      },
    ]);
    expect(read(file)).toEqual({ ok: false, error: "The workbook has no sheets to read." });
  });
});