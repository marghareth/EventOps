// src/modules/events/import/infrastructure/parsers/xlsx-parser.ts
// Excel .xlsx reading (B9-F03, D-109) with no new dependency: Node's built-in zlib unpacks the
// archive and a small reader takes the cell values from the sheet's XML. Values only: a formula's
// last calculated value is read, the formula never is; styles, macros, links and images are
// ignored. Dates are kept as Excel stores them (a number), since no imported field is a date.
//
// Safety (D-109): the file is at most 750 KB; ZIP64, encrypted and unknown-compression entries are
// refused; the total unpacked size of the parts read is capped (zip bombs); entry and sheet counts
// are capped; rows and columns stop at the CSV limits. Everything is plain text afterwards.
import "server-only";
import { inflateRawSync } from "node:zlib";
import { XLSX_LIMITS } from "../../domain/file-policy";

export type XlsxLimits = { rows: number; columns: number; cell: number };

export type XlsxResult =
  { ok: true; sheets: string[]; sheet: string; rows: string[][] } | { ok: false; error: string };

const NOT_XLSX =
  "This doesn't look like an Excel .xlsx file. Save it as .xlsx or CSV and try again.";
const TOO_BIG_INSIDE =
  "The workbook is too large once unpacked. Copy the sheet you need into a new file and try again.";

class XlsxError extends Error {}

type Entry = {
  name: string;
  method: number;
  flags: number;
  size: number;
  packed: number;
  offset: number;
};

/** The archive's table of contents (central directory). */
function entries(buf: Buffer): Map<string, Entry> {
  const min = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError(NOT_XLSX);
  const count = buf.readUInt16LE(eocd + 10);
  const start = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || start === 0xffffffff) throw new XlsxError(NOT_XLSX); // ZIP64
  if (count > XLSX_LIMITS.entries) throw new XlsxError(TOO_BIG_INSIDE);
  const map = new Map<string, Entry>();
  let p = start;
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new XlsxError(NOT_XLSX);
    const nameLength = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLength);
    map.set(name, {
      name,
      flags: buf.readUInt16LE(p + 8),
      method: buf.readUInt16LE(p + 10),
      packed: buf.readUInt32LE(p + 20),
      size: buf.readUInt32LE(p + 24),
      offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return map;
}

/** Unpacks the named parts, counting every byte against one budget. */
function reader(buf: Buffer) {
  const toc = entries(buf);
  let budget: number = XLSX_LIMITS.unpackedBytes;
  return (name: string): string | null => {
    const entry = toc.get(name);
    if (!entry) return null;
    if (entry.flags & 0x1)
      throw new XlsxError("The workbook is password-protected. Remove the password and try again.");
    if (entry.size === 0xffffffff || entry.packed === 0xffffffff) throw new XlsxError(NOT_XLSX);
    if (entry.size > budget) throw new XlsxError(TOO_BIG_INSIDE);
    const h = entry.offset;
    if (h + 30 > buf.length || buf.readUInt32LE(h) !== 0x04034b50) throw new XlsxError(NOT_XLSX);
    const dataStart = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
    const packed = buf.subarray(dataStart, dataStart + entry.packed);
    if (packed.length !== entry.packed) throw new XlsxError(NOT_XLSX);
    let data: Buffer;
    if (entry.method === 0) data = packed;
    else if (entry.method === 8) {
      try {
        // maxOutputLength stops a part that unpacks to more than it declared.
        data = inflateRawSync(packed, { maxOutputLength: Math.max(1, budget) });
      } catch (error) {
        throw new XlsxError(error instanceof RangeError ? TOO_BIG_INSIDE : NOT_XLSX);
      }
    } else throw new XlsxError(NOT_XLSX);
    budget -= data.length;
    return data.toString("utf8");
  };
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

/** XML text to plain text: entities, character references and Excel's _xHHHH_ escapes. */
function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
      if (ref[0] !== "#") return ENTITIES[ref] ?? match;
      const code =
        ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u0000/g, "");
}

function attributes(tag: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, key, value] of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g))
    map.set(key, decode(value));
  return map;
}

/** The text of every <t> in a string item or inline string, without phonetic runs. */
function itemText(xml: string): string {
  const plain = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return [...plain.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
}

/** "AB12" → 27 (zero-based column). */
function columnIndex(ref: string): number | null {
  const letters = /^([A-Z]{1,3})\d*$/.exec(ref)?.[1];
  if (!letters) return null;
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

/** A number as Excel shows it by default: no floating-point noise ("0.30000000000000004" → "0.3"). */
function numberText(raw: string): string {
  const value = Number(raw);
  return Number.isFinite(value) ? String(Number(value.toPrecision(15))) : raw.trim();
}

/** The sheets in workbook order, with the part each one is stored in. */
function sheetList(read: (name: string) => string | null): { name: string; part: string }[] {
  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new XlsxError(NOT_XLSX);
  const targets = new Map<string, string>();
  for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attributes(tag);
    const id = a.get("Id");
    const target = a.get("Target");
    if (id && target) targets.set(id, target);
  }
  const sheets: { name: string; part: string }[] = [];
  for (const [tag] of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const a = attributes(tag);
    const id = [...a].find(([key]) => key === "id" || key.endsWith(":id"))?.[1];
    const target = id ? targets.get(id) : undefined;
    const name = a.get("name");
    if (!name || !target) continue;
    // Targets are relative to xl/ or absolute from the package root. Never outside it.
    const part = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    if (part.split("/").includes("..")) continue;
    sheets.push({ name: name.slice(0, 100), part });
  }
  if (sheets.length === 0) throw new XlsxError("The workbook has no sheets to read.");
  if (sheets.length > XLSX_LIMITS.sheets) throw new XlsxError(TOO_BIG_INSIDE);
  return sheets;
}

/**
 * Reads one sheet's values (the first, or the one named) as rows of text, row 1 first, with empty
 * rows kept so row numbers match the sheet. Trailing empty columns are dropped.
 */
export function readXlsx(
  bytes: Uint8Array,
  options: { sheet?: string; limits: XlsxLimits },
): XlsxResult {
  try {
    if (bytes.length > XLSX_LIMITS.bytes) {
      return {
        ok: false,
        error: "The file is larger than 750 KB. Split it into smaller files and import each one.",
      };
    }
    const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new XlsxError(NOT_XLSX);
    const read = reader(buf);
    const sheets = sheetList(read);
    const chosen = sheets.find((s) => s.name === options.sheet) ?? sheets[0];
    const xml = read(chosen.part);
    if (xml === null) throw new XlsxError(NOT_XLSX);
    const sharedXml = read("xl/sharedStrings.xml");
    const shared = sharedXml
      ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) =>
          itemText(m[1] ?? ""),
        )
      : [];

    const { limits } = options;
    const rows: string[][] = [];
    let width = 0;
    let rowNumber = 0;
    for (const [, rowAttrs, body = ""] of xml.matchAll(
      /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,
    )) {
      const declared = Number(attributes(rowAttrs).get("r"));
      rowNumber = Number.isInteger(declared) && declared > rowNumber ? declared : rowNumber + 1;
      // Header plus the row limit, with room for blank rows above and between.
      if (rowNumber > limits.rows * 2 + 1000) {
        return {
          ok: false,
          error: `The sheet has too many rows. The limit is ${limits.rows.toLocaleString("en-US")} per import.`,
        };
      }
      const cells: string[] = [];
      let next = 0;
      for (const [, cellAttrs, inner = ""] of body.matchAll(
        /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const a = attributes(cellAttrs);
        const column = columnIndex(a.get("r") ?? "") ?? next;
        next = column + 1;
        const type = a.get("t") ?? "n";
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value = "";
        if (type === "s") value = v === undefined ? "" : (shared[Number(v)] ?? "");
        else if (type === "inlineStr") value = itemText(inner);
        else if (type === "b") value = v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
        else if (type === "e") value = "";
        else if (type === "str") value = v === undefined ? "" : decode(v);
        else value = v === undefined ? "" : numberText(decode(v));
        if (value === "") continue;
        if (column >= limits.columns) {
          return {
            ok: false,
            error: `The sheet has more than ${limits.columns} columns. The limit is ${limits.columns}.`,
          };
        }
        if (value.length > limits.cell) {
          return {
            ok: false,
            error: `A value in row ${rowNumber} is longer than ${limits.cell.toLocaleString("en-US")} characters.`,
          };
        }
        cells[column] = value;
        width = Math.max(width, column + 1);
      }
      while (rows.length < rowNumber - 1) rows.push([]);
      rows.push(Array.from(cells, (c) => c ?? ""));
    }
    return {
      ok: true,
      sheets: sheets.map((s) => s.name),
      sheet: chosen.name,
      rows: rows.map((r) => Array.from({ length: r.length ? width : 0 }, (_, i) => r[i] ?? "")),
    };
  } catch (error) {
    if (error instanceof XlsxError) return { ok: false, error: error.message };
    return { ok: false, error: NOT_XLSX };
  }
}