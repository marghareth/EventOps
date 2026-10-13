// src/modules/events/attendees/import-state.ts
// The CSV import's steps as the page sees them (B2-14 to B2-18, D-052). No server code, so the
// client page can use the types. The browser holds this between steps, but the server never trusts
// it: every step re-reads the file text and re-checks everything.
import type { ColumnMapping, ImportPreview, PreviewRow } from "./import-rules";

/** A preview row as sent to the page: without the parsed attendee. */
export type PreviewRowView = Omit<PreviewRow, "attendee">;
export type ImportPreviewView = Omit<ImportPreview, "rows"> & { rows: PreviewRowView[] };

type FileContext = {
  /** The file's text, carried between steps and re-checked by the server each time. */
  csv: string;
  fileName: string;
  headers: string[];
  mapping: ColumnMapping;
};

export type ImportState =
  | { step: "upload"; error?: string }
  | (FileContext & {
      step: "map";
      rowCount: number;
      /** Up to three example values per column, from the first rows. */
      examples: string[][];
      errors?: string[];
    })
  | (FileContext & {
      step: "preview";
      preview: ImportPreviewView;
      includeDuplicates: boolean;
      /** Why the last confirm didn't import, for example the guest list changed. */
      message?: string;
    })
  | { step: "done"; count: number; first: string; last: string; skipped: number };

export const initialImportState: ImportState = { step: "upload" };

export const IMPORT_MESSAGES = {
  forbidden: "Your role can view this event but not import guests. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  noFile: "Choose a CSV file to upload.",
  notCsv: "Choose a .csv file. In Excel or Google Sheets, save or download the sheet as CSV.",
  tooLarge: "The file is larger than 500 KB. Split it into smaller files and import each one.",
  notUtf8: "The file isn't readable text. In Excel, save it as “CSV UTF-8 (Comma delimited)”.",
  fileChanged: "The file couldn't be read again. Upload it again.",
  changed: "The guest list changed since this preview. Check the new numbers, then confirm again.",
  nothingToImport:
    "There are no rows to import. Fix the rows that need correction, or change the mapping.",
  failed: "We couldn't import the guests. Nothing was saved. Try again in a moment.",
} as const;