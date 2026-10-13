// src/modules/events/attendees/import-actions.ts
// CSV import server action (B2-14 to B2-18, D-052). Server actions are public HTTP endpoints, so
// every step authorizes with import.run (Owner, Coordinator) and re-reads the file text from
// scratch: parse, check the mapping, validate every row, check duplicates. Nothing the browser
// sends back (rows, totals, results) is trusted, and nothing is written until "confirm", which
// imports in one transaction.
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import {
  authorizeEvent,
  sampleImportAttendees,
  sampleListAttendees,
} from "@/modules/events/public";
import { CSV_LIMITS, parseCsv, type CsvTable } from "./csv";
import { importAttendees, type ImportResult } from "./import-attendees";
import {
  attendeesToImport,
  IMPORT_FIELDS,
  buildImportPreview,
  readMapping,
  suggestMapping,
  type ColumnMapping,
  type ExistingIdentity,
} from "./import-rules";
import { IMPORT_MESSAGES, type ImportPreviewView, type ImportState } from "./import-state";
import { listAttendeeIdentities } from "./queries";
import { formatAttendeeReference } from "./schema";

const attendeesPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/attendees`;
const importPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/import`;

/** Browsers send these for .csv files (Windows Excel sends application/vnd.ms-excel). */
const CSV_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "text/x-csv",
]);

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** Decodes an uploaded file as UTF-8 text, refusing anything that isn't. */
async function readUpload(
  file: FormDataEntryValue | null,
): Promise<{ ok: true; csv: string; name: string } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: IMPORT_MESSAGES.noFile };
  if (!/\.csv$/i.test(file.name) || !CSV_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: IMPORT_MESSAGES.notCsv };
  }
  if (file.size > CSV_LIMITS.bytes) return { ok: false, error: IMPORT_MESSAGES.tooLarge };
  try {
    const csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    // Only the base name, trimmed, for display. Never used as a path.
    const name = file.name.split(/[\\/]/).pop()!.slice(0, 120);
    return { ok: true, csv, name };
  } catch {
    return { ok: false, error: IMPORT_MESSAGES.notUtf8 };
  }
}

/** Re-reads the carried file text. Its size is checked again: it came back from the browser. */
function reparse(csv: string): { ok: true; table: CsvTable } | { ok: false; error: string } {
  if (new TextEncoder().encode(csv).length > CSV_LIMITS.bytes)
    return { ok: false, error: IMPORT_MESSAGES.tooLarge };
  const parsed = parseCsv(csv);
  return parsed.ok ? parsed : { ok: false, error: parsed.error };
}

function mapStep(
  csv: string,
  fileName: string,
  table: CsvTable,
  mapping: ColumnMapping,
  errors?: string[],
): ImportState {
  return {
    step: "map",
    csv,
    fileName,
    headers: table.headers,
    mapping,
    rowCount: table.rows.length,
    examples: table.headers.map((_, column) =>
      table.rows
        .map((r) => r.cells[column].trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((v) => v.slice(0, 80)),
    ),
    errors,
  };
}

async function existingIdentities(eventId: string): Promise<ExistingIdentity[]> {
  if (isSampleDataMode()) {
    return sampleListAttendees(eventId).map((a) => ({
      name: a.name,
      email: a.email,
      reference: formatAttendeeReference(a.number),
    }));
  }
  return listAttendeeIdentities(getDb(), eventId);
}

/** One import step: upload, preview, back (to mapping), confirm, or restart. */
export async function importStepAction(
  eventId: string,
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const auth = await authorizeEvent(eventId, "import.run", importPath(eventId));
  if (!auth.ok) {
    return {
      step: "upload",
      error:
        auth.reason === "forbidden" ? IMPORT_MESSAGES.forbidden : IMPORT_MESSAGES.eventNotFound,
    };
  }
  const intent = text(formData, "intent");
  if (intent === "restart") return { step: "upload" };

  if (intent === "upload") {
    const upload = await readUpload(formData.get("file"));
    if (!upload.ok) return { step: "upload", error: upload.error };
    const parsed = parseCsv(upload.csv);
    if (!parsed.ok) return { step: "upload", error: `${upload.name}: ${parsed.error}` };
    return mapStep(upload.csv, upload.name, parsed.table, suggestMapping(parsed.table.headers));
  }

  // Every later step starts from the carried file text again.
  const csv = text(formData, "csv");
  const fileName = text(formData, "fileName").slice(0, 120);
  const reparsed = reparse(csv);
  if (!reparsed.ok) return { step: "upload", error: reparsed.error || IMPORT_MESSAGES.fileChanged };
  const { table } = reparsed;
  const rawMapping = table.headers.map((_, i) => text(formData, `map-${i}`));
  const mapping = readMapping(rawMapping, table.headers.length);

  if (intent === "back") {
    return mapStep(
      csv,
      fileName,
      table,
      mapping.ok ? mapping.mapping : suggestMapping(table.headers),
    );
  }
  if (intent !== "preview" && intent !== "confirm")
    return { step: "upload", error: IMPORT_MESSAGES.fileChanged };
  if (!mapping.ok) {
    // Shown again for correction: known fields only, anything else back to "Don't import".
    const partial: ColumnMapping = rawMapping.map(
      (v) => IMPORT_FIELDS.find((f) => f === v) ?? null,
    );
    return mapStep(csv, fileName, table, partial, mapping.errors);
  }

  const includeDuplicates = text(formData, "includeDuplicates") === "on";
  const existing = await existingIdentities(auth.event.id);
  const preview = buildImportPreview(table, mapping.mapping, existing, { includeDuplicates });
  const view: ImportPreviewView = {
    ...preview,
    rows: preview.rows.map((row) => {
      // The parsed attendee stays on the server; the page gets the values and messages only.
      const view = { ...row };
      delete view.attendee;
      return view;
    }),
  };
  const previewStep = (message?: string): ImportState => ({
    step: "preview",
    csv,
    fileName,
    headers: table.headers,
    mapping: mapping.mapping,
    preview: view,
    includeDuplicates,
    message,
  });
  if (intent === "preview") return previewStep();

  // Confirm: import exactly what the user saw, or show the new numbers instead.
  const expected = Number(text(formData, "expected"));
  if (expected !== preview.totals.toImport) return previewStep(IMPORT_MESSAGES.changed);
  const attendees = attendeesToImport(preview, { includeDuplicates });
  if (attendees.length === 0) return previewStep(IMPORT_MESSAGES.nothingToImport);
  const skipped = preview.totals.rows - attendees.length;

  let result: ImportResult;
  try {
    const args = { eventId: auth.event.id, importerId: auth.user.id, attendees, skipped };
    result = isSampleDataMode()
      ? sampleImportAttendees({ ...args, now: new Date() }) // Dev-only sample data (D-041).
      : await importAttendees(getDb(), args);
  } catch {
    return previewStep(IMPORT_MESSAGES.failed);
  }
  if (!result.ok) return previewStep(IMPORT_MESSAGES.forbidden);
  revalidatePath(attendeesPath(auth.event.id));
  return { step: "done", count: result.count, first: result.first, last: result.last, skipped };
}