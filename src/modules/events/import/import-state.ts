// src/modules/events/import/import-state.ts
// The import wizard's steps as the page sees them (B9-F01 to F21; D-052, D-109). No server code, so
// the client wizard can use the types. The browser holds this between steps, but the server never
// trusts it: every step re-reads the carried file text and re-checks everything.
import type { ColumnType } from "./domain/column-types";
import type { FileType, ImportType } from "./domain/file-policy";

/** A field a column can go into, for the mapping list. */
export type FieldOption = { id: string; label: string; required: boolean };

export type PreviewRowView = {
  line: number;
  values: Partial<Record<string, string>>;
  status: "valid" | "invalid" | "duplicate";
  errors: string[];
  duplicateOf?: string;
  saved?: Partial<Record<string, string>>;
  cells: string[];
};

export type ImportPreviewView = {
  rows: PreviewRowView[];
  totals: { rows: number; valid: number; invalid: number; duplicates: number; toImport: number };
  ignoredColumns: string[];
};

/** How the matching was suggested, shown above it (D-111, D-112). */
export type SuggestionNotice =
  | { source: "ai"; model: string }
  | { source: "rules"; fallback: "off" | "unavailable" | "rejected" };

type FileContext = {
  importType: ImportType;
  /** The file's rows as CSV text (an Excel sheet is converted), carried and re-checked each step. */
  csv: string;
  fileName: string;
  fileType: FileType;
  /** For Excel files: the sheet read and every sheet in the workbook. */
  sheet?: string;
  sheets?: string[];
  headers: string[];
  mapping: (string | null)[];
  fields: FieldOption[];
  /** True when the model's suggestion was offered for this file (recorded in Activity). */
  aiSuggested: boolean;
};

export type ImportState =
  | {
      step: "upload";
      error?: string;
      importType?: ImportType;
      /** After "Choose another sheet": the workbook's sheets, to pick before uploading again. */
      sheets?: string[];
      sheet?: string;
    }
  | (FileContext & {
      step: "map";
      rowCount: number;
      /** Up to three example values per column, from the first rows. */
      examples: string[][];
      columnTypes: ColumnType[];
      /** The suggestion as first made, so the page can mark the AI's choices; gone after Back. */
      suggested?: (string | null)[];
      notice?: SuggestionNotice;
      /** The other import type, when the columns look like it. */
      looksLike?: ImportType;
      errors?: string[];
    })
  | (FileContext & {
      step: "preview";
      preview: ImportPreviewView;
      includeDuplicates: boolean;
      /** The rows needing correction as a formula-safe CSV download. */
      correctionCsv: string;
      /** Why the last confirm didn't import, for example the list changed. */
      message?: string;
    })
  | {
      step: "done";
      importType: ImportType;
      count: number;
      first: string;
      last: string;
      skipped: number;
    };

export const initialImportState: ImportState = { step: "upload" };

/** Words for each import type. */
export const IMPORT_TYPE_WORDS: Record<
  ImportType,
  { one: string; many: string; list: string; title: string; hint: string }
> = {
  attendees: {
    one: "attendee",
    many: "attendees",
    list: "guest list",
    title: "Attendees",
    hint: "Guests, with RSVP, plus-ones and dietary needs.",
  },
  suppliers: {
    one: "supplier",
    many: "suppliers",
    list: "supplier list",
    title: "Suppliers",
    hint: "Name, category and contact details. Quotes and payments are added afterwards.",
  },
};

export const IMPORT_MESSAGES = {
  forbidden: "Your role can view this event but not import into it. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  noFile: "Choose a CSV or Excel (.xlsx) file to upload.",
  notAccepted: "Choose a .csv or .xlsx file. In Google Sheets, download the sheet as CSV or Excel.",
  tooLarge: "The file is larger than 500 KB. Split it into smaller files and import each one.",
  convertedTooLarge:
    "The sheet holds more than 500 KB of text. Split it into smaller files and import each one.",
  notUtf8: "The file isn't readable text. In Excel, save it as “CSV UTF-8 (Comma delimited)”.",
  fileChanged: "The file couldn't be read again. Upload it again.",
  changed: "The list changed since this preview. Check the new numbers, then confirm again.",
  nothingToImport:
    "There are no rows to import. Fix the rows that need correction, or change the matching.",
  failed: "We couldn't import the rows. Nothing was saved. Try again in a moment.",
} as const;