// src/modules/events/import/domain/file-policy.ts
// What the import accepts (B9-F01 to F04; D-109): CSV (UTF-8, up to 500 KB, D-052) or Excel .xlsx
// (up to 750 KB, values only), for attendees or suppliers. An Excel sheet is converted to rows that
// must fit the CSV limits too, so every later step works the same way. Files are never stored.
// Pure.

export const IMPORT_TYPES = ["attendees", "suppliers"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const FILE_TYPES = ["csv", "xlsx"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const XLSX_LIMITS = {
  /** Largest .xlsx accepted, in bytes. Stays under the 1 MB request limit with the form. */
  bytes: 750 * 1024,
  /** Largest total unpacked size of the parts read: stops zip bombs (D-109). */
  unpackedBytes: 20 * 1024 * 1024,
  /** Entries in the archive; a workbook has a few dozen. */
  entries: 2000,
  sheets: 50,
} as const;

/** Browsers send these for .csv files (Windows Excel sends application/vnd.ms-excel). */
const CSV_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "text/x-csv",
]);
const XLSX_TYPES = new Set([
  "",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

/** The file type from the name and the browser's media type, or null if not accepted. */
export function fileTypeOf(name: string, mediaType: string): FileType | null {
  const type = mediaType.toLowerCase();
  if (/\.csv$/i.test(name) && CSV_TYPES.has(type)) return "csv";
  if (/\.xlsx$/i.test(name) && XLSX_TYPES.has(type)) return "xlsx";
  return null;
}

/** Only the base name, at most 120 characters, for display. Never used as a path. */
export function displayName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? "").slice(0, 120);
}

export const isImportType = (value: unknown): value is ImportType =>
  typeof value === "string" && (IMPORT_TYPES as readonly string[]).includes(value);

export const isFileType = (value: unknown): value is FileType =>
  typeof value === "string" && (FILE_TYPES as readonly string[]).includes(value);