// src/modules/events/attendees/csv.ts
// CSV reading and writing for attendee import and export (B2-14, B2-19; D-052, D-053). Our own
// small RFC 4180 parser, so no dependency is needed: quoted fields, "" inside quotes, commas and
// line breaks inside quotes, CRLF or LF, a leading byte-order mark, ragged rows and blank lines.
// Everything is treated as plain text: nothing in a cell is ever evaluated. Safe for the browser
// too (no server-only code), so the import page can offer the rows that need correction as a file.

export const CSV_LIMITS = {
  /** Largest file accepted, in bytes. Keeps every import step under the 1 MB request limit. */
  bytes: 500 * 1024,
  /** Data rows, not counting the header row or blank lines. */
  rows: 2000,
  columns: 50,
  /** Characters in one cell, before field-level limits apply. */
  cell: 5000,
} as const;

export type CsvTable = { headers: string[]; rows: CsvRow[] };
/** One data row: its cells (padded to the header count) and its line in the file, for messages. */
export type CsvRow = { line: number; cells: string[] };

export type CsvResult = { ok: true; table: CsvTable } | { ok: false; error: string };

/** Splits CSV text into records of raw cells, with the line each record starts on. */
function records(text: string): { ok: true; records: CsvRow[] } | { ok: false; error: string } {
  const out: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let i = 0;
  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    out.push({ line: startLine, cells });
    cells = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      if (ch === "\n") line += 1;
      cell += ch;
      i += 1;
    } else if (ch === '"' && cell === "") {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      endCell();
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      startLine = line;
    } else {
      cell += ch;
      i += 1;
    }
    if (cell.length > CSV_LIMITS.cell) {
      return {
        ok: false,
        error: `A value on line ${startLine} is longer than ${CSV_LIMITS.cell.toLocaleString("en-US")} characters.`,
      };
    }
  }
  if (quoted) {
    return {
      ok: false,
      error: `A quoted value that starts on line ${startLine} never ends. Check for a missing closing quote (").`,
    };
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return { ok: true, records: out };
}

const isBlank = (row: CsvRow) => row.cells.every((c) => c.trim() === "");

/**
 * Headers for display and mapping: trimmed, "Column 3" for an empty one, "Email (2)" for a repeat.
 */
function headerNames(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((raw, index) => {
    const base = raw.trim() || `Column ${index + 1}`;
    const count = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/**
 * Parses CSV text with a header row. The first non-blank record is the header; blank records are
 * skipped; short rows are padded and long rows are refused (a value with no column to go in).
 */
export function parseCsv(input: string): CsvResult {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  if (text.includes("\u0000"))
    return { ok: false, error: "This doesn't look like a text CSV file." };
  const parsed = records(text);
  if (!parsed.ok) return parsed;
  const nonBlank = parsed.records.filter((r) => !isBlank(r));
  if (nonBlank.length === 0) return { ok: false, error: "The file is empty." };
  const [header, ...data] = nonBlank;
  if (header.cells.length > CSV_LIMITS.columns) {
    return {
      ok: false,
      error: `The file has ${header.cells.length} columns. The limit is ${CSV_LIMITS.columns}.`,
    };
  }
  if (data.length === 0) return { ok: false, error: "The file has a header row but no guests." };
  if (data.length > CSV_LIMITS.rows) {
    return {
      ok: false,
      error: `The file has ${data.length.toLocaleString("en-US")} rows. The limit is ${CSV_LIMITS.rows.toLocaleString("en-US")} per import.`,
    };
  }
  const width = header.cells.length;
  const tooWide = data.find(
    (r) => r.cells.length > width && r.cells.slice(width).some((c) => c.trim()),
  );
  if (tooWide) {
    return {
      ok: false,
      error: `Line ${tooWide.line} has more values than there are column headers.`,
    };
  }
  return {
    ok: true,
    table: {
      headers: headerNames(header.cells),
      rows: data.map((r) => ({
        line: r.line,
        cells: Array.from({ length: width }, (_, i) => r.cells[i] ?? ""),
      })),
    },
  };
}

/**
 * Protects a cell from spreadsheet formula injection: a value starting with =, +, -, @, tab or
 * carriage return gets a leading apostrophe, so Excel or Sheets shows it as text.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Writes rows as CSV (CRLF line ends), formula-safe. `bom` adds a byte-order mark for Excel. */
export function toCsv(
  rows: readonly (readonly string[])[],
  options: { bom?: boolean } = {},
): string {
  const body = rows
    .map((row) => row.map((v) => quote(neutralizeFormula(v))).join(","))
    .join("\r\n");
  return `${options.bom ? "﻿" : ""}${body}\r\n`;
}