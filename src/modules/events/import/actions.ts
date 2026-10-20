// src/modules/events/import/actions.ts
// The import wizard's server action (B9-F01 to F19; D-052, D-109 to D-112). Server actions are
// public HTTP endpoints, so every step authorizes with import.run (Owner, Coordinator) for the event
// in the address, and re-reads the carried file text from scratch: parse, check the mapping,
// validate every row, check duplicates. Nothing the browser sends back (rows, totals, results, the
// AI's suggestion) is trusted, and nothing is written until "confirm", which imports in one
// transaction. Uploaded files are read in memory and never stored.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeEvent } from "@/modules/events/public";
import { CSV_LIMITS, parseCsv, toCsv, type CsvTable } from "@/modules/events/attendees/public";
import {
  detectColumnTypes,
  suggestColumns,
  type ColumnSuggestion,
} from "./application/suggest-columns";
import { columnSuggester } from "./composition";
import {
  XLSX_LIMITS,
  displayName,
  fileTypeOf,
  isFileType,
  isImportType,
  type FileType,
  type ImportType,
} from "./domain/file-policy";
import { readXlsx } from "./infrastructure/parsers/xlsx-parser";
import { IMPORT_MESSAGES, type ImportState, type SuggestionNotice } from "./import-state";
import {
  FIELD_OPTIONS,
  TARGET_RULES,
  buildPreview,
  readTargetMapping,
  saveImport,
} from "./targets";

const listPath = (eventId: string, type: ImportType) =>
  `/events/${encodeURIComponent(eventId)}/${type === "attendees" ? "attendees" : "suppliers"}`;
const importPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/import`;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const importTypeFrom = (formData: FormData, name = "importType"): ImportType => {
  const value = text(formData, name);
  return isImportType(value) ? value : "attendees";
};

/** Sheet names are only shown, never trusted: at most 50 names of 100 characters. */
const sheetsSchema = z.array(z.string().max(100)).max(XLSX_LIMITS.sheets);
function sheetsFrom(formData: FormData): string[] | undefined {
  try {
    const parsed = sheetsSchema.safeParse(JSON.parse(text(formData, "sheets") || "null"));
    return parsed.success && parsed.data.length ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

type Upload = {
  csv: string;
  table: CsvTable;
  name: string;
  fileType: FileType;
  sheet?: string;
  sheets?: string[];
};

/** Reads an uploaded CSV or Excel file into rows (B9-F01 to F03), refusing anything else. */
async function readUpload(
  file: FormDataEntryValue | null,
  sheet: string,
): Promise<{ ok: true; upload: Upload } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: IMPORT_MESSAGES.noFile };
  const fileType = fileTypeOf(file.name, file.type);
  if (!fileType) return { ok: false, error: IMPORT_MESSAGES.notAccepted };
  const name = displayName(file.name);

  if (fileType === "csv") {
    if (file.size > CSV_LIMITS.bytes) return { ok: false, error: IMPORT_MESSAGES.tooLarge };
    let csv: string;
    try {
      csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return { ok: false, error: IMPORT_MESSAGES.notUtf8 };
    }
    const parsed = parseCsv(csv);
    if (!parsed.ok) return { ok: false, error: `${name}: ${parsed.error}` };
    return { ok: true, upload: { csv, table: parsed.table, name, fileType } };
  }

  if (file.size > XLSX_LIMITS.bytes) {
    return {
      ok: false,
      error: "The file is larger than 750 KB. Split it into smaller files and import each one.",
    };
  }
  const read = readXlsx(new Uint8Array(await file.arrayBuffer()), {
    sheet: sheet || undefined,
    limits: CSV_LIMITS,
  });
  if (!read.ok) return { ok: false, error: `${name}: ${read.error}` };
  // The sheet becomes CSV text, exactly (no formula guard: it's read back, never downloaded), so
  // every later step parses it the same way as a CSV file, within the same limits.
  const csv = toCsv(read.rows, { exact: true });
  if (new TextEncoder().encode(csv).length > CSV_LIMITS.bytes) {
    return { ok: false, error: IMPORT_MESSAGES.convertedTooLarge };
  }
  const parsed = parseCsv(csv);
  if (!parsed.ok) return { ok: false, error: `${name} (${read.sheet}): ${parsed.error}` };
  return {
    ok: true,
    upload: {
      csv,
      table: parsed.table,
      name,
      fileType,
      sheet: read.sheet,
      sheets: read.sheets.length > 1 ? read.sheets : undefined,
    },
  };
}

/** Re-reads the carried file text. Its size is checked again: it came back from the browser. */
function reparse(csv: string): { ok: true; table: CsvTable } | { ok: false; error: string } {
  if (new TextEncoder().encode(csv).length > CSV_LIMITS.bytes)
    return { ok: false, error: IMPORT_MESSAGES.tooLarge };
  const parsed = parseCsv(csv);
  return parsed.ok ? parsed : { ok: false, error: parsed.error };
}

function examples(table: CsvTable): string[][] {
  return table.headers.map((_, column) =>
    table.rows
      .map((r) => r.cells[column].trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((v) => v.slice(0, 80)),
  );
}

type Carried = Omit<Upload, "table"> & { importType: ImportType; aiSuggested: boolean };

function mapStep(
  carried: Carried,
  table: CsvTable,
  mapping: (string | null)[],
  extra: {
    suggestion?: ColumnSuggestion;
    errors?: string[];
  } = {},
): ImportState {
  const { suggestion } = extra;
  const notice: SuggestionNotice | undefined = suggestion
    ? suggestion.source === "ai"
      ? { source: "ai", model: suggestion.model }
      : { source: "rules", fallback: suggestion.fallback }
    : undefined;
  return {
    step: "map",
    importType: carried.importType,
    csv: carried.csv,
    fileName: carried.name,
    fileType: carried.fileType,
    sheet: carried.sheet,
    sheets: carried.sheets,
    headers: table.headers,
    mapping,
    fields: FIELD_OPTIONS[carried.importType],
    aiSuggested: carried.aiSuggested,
    rowCount: table.rows.length,
    examples: examples(table),
    columnTypes: suggestion?.columnTypes ?? detectColumnTypes(table),
    suggested: suggestion?.mapping,
    notice,
    looksLike: suggestion?.looksLike ?? undefined,
    errors: extra.errors,
  };
}

async function suggestedMapStep(carried: Omit<Carried, "aiSuggested">, table: CsvTable) {
  const suggestion = await suggestColumns({
    table,
    importType: carried.importType,
    targets: TARGET_RULES,
    suggester: columnSuggester(),
  });
  return mapStep(
    { ...carried, aiSuggested: suggestion.source === "ai" },
    table,
    suggestion.mapping,
    {
      suggestion,
    },
  );
}

/** One import step: upload, switch type, choose a sheet, preview, back, confirm, or restart. */
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
  const importType = importTypeFrom(formData);
  if (intent === "restart") return { step: "upload", importType };

  if (intent === "upload") {
    const read = await readUpload(formData.get("file"), text(formData, "sheet").slice(0, 100));
    if (!read.ok)
      return { step: "upload", error: read.error, importType, sheets: sheetsFrom(formData) };
    const { table, ...upload } = read.upload;
    return suggestedMapStep({ ...upload, importType }, table);
  }

  // Every later step starts from the carried file text again.
  const csv = text(formData, "csv");
  const fileType = text(formData, "fileType");
  const reparsed = reparse(csv);
  if (!reparsed.ok || !isFileType(fileType)) {
    return {
      step: "upload",
      importType,
      error: (!reparsed.ok && reparsed.error) || IMPORT_MESSAGES.fileChanged,
    };
  }
  const { table } = reparsed;
  const carried: Carried = {
    importType,
    csv,
    name: text(formData, "fileName").slice(0, 120),
    fileType,
    sheet: text(formData, "sheet").slice(0, 100) || undefined,
    sheets: sheetsFrom(formData),
    aiSuggested: text(formData, "aiSuggested") === "true",
  };

  if (intent === "pick-sheet") {
    return { step: "upload", importType, sheets: carried.sheets, sheet: carried.sheet };
  }
  if (intent === "switch-type") {
    return suggestedMapStep(
      { ...carried, importType: importTypeFrom(formData, "switchTo") },
      table,
    );
  }

  const rawMapping = table.headers.map((_, i) => text(formData, `map-${i}`));
  const mapping = readTargetMapping(importType, rawMapping, table.headers.length);
  const fieldIds = FIELD_OPTIONS[importType].map((f) => f.id);

  if (intent === "back") {
    const kept = mapping.ok
      ? mapping.mapping
      : rawMapping.map((v) => (fieldIds.includes(v) ? v : null));
    return mapStep(carried, table, kept);
  }
  if (intent !== "preview" && intent !== "confirm")
    return { step: "upload", importType, error: IMPORT_MESSAGES.fileChanged };
  if (!mapping.ok) {
    // Shown again for correction: known fields only, anything else back to "Don't import".
    const partial = rawMapping.map((v) => (fieldIds.includes(v) ? v : null));
    return mapStep(carried, table, partial, { errors: mapping.errors });
  }

  const includeDuplicates = text(formData, "includeDuplicates") === "on";
  const preview = await buildPreview(
    importType,
    auth.event.id,
    table,
    mapping.mapping,
    includeDuplicates,
  );
  const invalid = preview.view.rows.filter((r) => r.status === "invalid");
  const previewStep = (message?: string): ImportState => ({
    step: "preview",
    importType,
    csv,
    fileName: carried.name,
    fileType,
    sheet: carried.sheet,
    sheets: carried.sheets,
    headers: table.headers,
    mapping: mapping.mapping,
    fields: FIELD_OPTIONS[importType],
    aiSuggested: carried.aiSuggested,
    preview: preview.view,
    includeDuplicates,
    correctionCsv: invalid.length
      ? toCsv([table.headers, ...invalid.map((r) => r.cells)], { bom: true })
      : "",
    message,
  });
  if (intent === "preview") return previewStep();

  // Confirm: import exactly what the user saw, or show the new numbers instead.
  const expected = Number(text(formData, "expected"));
  if (expected !== preview.view.totals.toImport) return previewStep(IMPORT_MESSAGES.changed);
  const records = preview.toSave();
  if (records.length === 0) return previewStep(IMPORT_MESSAGES.nothingToImport);
  const skipped = preview.view.totals.rows - records.length;

  let result: Awaited<ReturnType<typeof saveImport>>;
  try {
    result = await saveImport(importType, {
      eventId: auth.event.id,
      importerId: auth.user.id,
      records,
      skipped,
      fileType,
      aiSuggested: carried.aiSuggested,
    });
  } catch {
    return previewStep(IMPORT_MESSAGES.failed);
  }
  if (!result.ok) return previewStep(IMPORT_MESSAGES.forbidden);
  revalidatePath(listPath(auth.event.id, importType));
  return {
    step: "done",
    importType,
    count: result.count,
    first: result.first,
    last: result.last,
    skipped,
  };
}