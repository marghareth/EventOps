// src/modules/events/import/targets.ts
// The two things a file can be imported into (B9-F04, D-109): attendees and suppliers. Each uses
// its own context's public rules (D-001): the fields, the mapping check, the row validation and
// duplicate check of its add form, and its one-transaction import with an Activity entry. This file
// only puts them side by side for the wizard, plus the field-type hints for the matcher (D-110) and
// the dev-only sample data stand-ins (D-041).
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import {
  ATTENDEE_IMPORT_FIELDS,
  ATTENDEE_IMPORT_FIELD_LABEL,
  ATTENDEE_IMPORT_HEADER_WORDS,
  REQUIRED_ATTENDEE_IMPORT_FIELDS,
  attendeesToImport,
  buildAttendeeImportPreview,
  formatAttendeeReference,
  importAttendees,
  listAttendeeIdentities,
  readAttendeeMapping,
  type CsvTable,
} from "@/modules/events/attendees/public";
import {
  sampleImportAttendees,
  sampleImportSuppliers,
  sampleListAttendees,
  sampleListSuppliers,
} from "@/modules/events/public";
import {
  REQUIRED_SUPPLIER_IMPORT_FIELDS,
  SUPPLIER_IMPORT_FIELDS,
  SUPPLIER_IMPORT_FIELD_LABEL,
  SUPPLIER_IMPORT_HEADER_WORDS,
  buildSupplierImportPreview,
  formatSupplierReference,
  importSuppliers,
  listSupplierIdentities,
  readSupplierMapping,
  suppliersToImport,
} from "@/modules/events/suppliers/public";
import type { ImportTargetRules } from "./application/suggest-columns";
import type { ColumnType } from "./domain/column-types";
import type { FieldRule } from "./domain/field-matching";
import type { FileType, ImportType } from "./domain/file-policy";
import type { FieldOption, ImportPreviewView } from "./import-state";

type FieldHint = { accepts?: readonly ColumnType[]; byType?: "email" | "phone" };

/**
 * Which column types fit each field (D-110). Text and empty columns fit every field; a field with
 * no entry fits every type. Phones may be numbers, since Excel often stores them that way.
 */
const HINTS: Record<string, FieldHint> = {
  name: { accepts: [] },
  email: { accepts: ["email"], byType: "email" },
  phone: { accepts: ["phone", "number"], byType: "phone" },
  rsvpStatus: { accepts: ["yesno"] },
  plusOnes: { accepts: ["number"] },
  category: { accepts: [] },
  dietaryNeeds: { accepts: [] },
  contactName: { accepts: [] },
};

function fieldRules(
  fields: readonly string[],
  words: Record<string, readonly string[]>,
): FieldRule[] {
  return fields.map((field) => ({ field, words: words[field], ...HINTS[field] }));
}

function options(
  fields: readonly string[],
  labels: Record<string, string>,
  required: readonly string[],
): FieldOption[] {
  return fields.map((id) => ({ id, label: labels[id], required: required.includes(id) }));
}

export const FIELD_OPTIONS: Record<ImportType, FieldOption[]> = {
  attendees: options(
    ATTENDEE_IMPORT_FIELDS,
    ATTENDEE_IMPORT_FIELD_LABEL,
    REQUIRED_ATTENDEE_IMPORT_FIELDS,
  ),
  suppliers: options(
    SUPPLIER_IMPORT_FIELDS,
    SUPPLIER_IMPORT_FIELD_LABEL,
    REQUIRED_SUPPLIER_IMPORT_FIELDS,
  ),
};

export function readTargetMapping(
  type: ImportType,
  raw: readonly unknown[],
  columnCount: number,
): { ok: true; mapping: (string | null)[] } | { ok: false; errors: string[] } {
  return type === "attendees"
    ? readAttendeeMapping(raw, columnCount)
    : readSupplierMapping(raw, columnCount);
}

export const TARGET_RULES: Record<ImportType, ImportTargetRules> = {
  attendees: {
    fields: FIELD_OPTIONS.attendees,
    rules: fieldRules(ATTENDEE_IMPORT_FIELDS, ATTENDEE_IMPORT_HEADER_WORDS),
    isValidMapping: (mapping) => readTargetMapping("attendees", mapping, mapping.length).ok,
  },
  suppliers: {
    fields: FIELD_OPTIONS.suppliers,
    rules: fieldRules(SUPPLIER_IMPORT_FIELDS, SUPPLIER_IMPORT_HEADER_WORDS),
    isValidMapping: (mapping) => readTargetMapping("suppliers", mapping, mapping.length).ok,
  },
};

/** The preview for the page, without the parsed records, and the records an import would save. */
export type TargetPreview = {
  view: ImportPreviewView;
  /** Only for the server: what confirm would save, by duplicates choice. */
  toSave: () => unknown[];
};

export async function buildPreview(
  type: ImportType,
  eventId: string,
  table: CsvTable,
  mapping: (string | null)[],
  includeDuplicates: boolean,
): Promise<TargetPreview> {
  const options = { includeDuplicates };
  const strip = <R extends { attendee?: unknown; supplier?: unknown }>(row: R) => {
    const view = { ...row };
    delete view.attendee;
    delete view.supplier;
    return view;
  };
  if (type === "attendees") {
    const existing = isSampleDataMode()
      ? sampleListAttendees(eventId).map((a) => ({
          name: a.name,
          email: a.email,
          reference: formatAttendeeReference(a.number),
        }))
      : await listAttendeeIdentities(getDb(), eventId);
    const preview = buildAttendeeImportPreview(
      table,
      mapping as Parameters<typeof buildAttendeeImportPreview>[1],
      existing,
      options,
    );
    return {
      view: { ...preview, rows: preview.rows.map(strip) },
      toSave: () => attendeesToImport(preview, options),
    };
  }
  const existing = isSampleDataMode()
    ? sampleListSuppliers(eventId).map((s) => ({
        name: s.name,
        reference: formatSupplierReference(s.number),
      }))
    : await listSupplierIdentities(getDb(), eventId);
  const preview = buildSupplierImportPreview(
    table,
    mapping as Parameters<typeof buildSupplierImportPreview>[1],
    existing,
    options,
  );
  return {
    view: { ...preview, rows: preview.rows.map(strip) },
    toSave: () => suppliersToImport(preview, options),
  };
}

export type SaveResult = { ok: true; count: number; first: string; last: string } | { ok: false };

/** Saves the checked records in one transaction with one Activity entry (D-052, D-109). */
export async function saveImport(
  type: ImportType,
  args: {
    eventId: string;
    importerId: string;
    records: unknown[];
    skipped: number;
    fileType: FileType;
    aiSuggested: boolean;
  },
): Promise<SaveResult> {
  const { records, ...rest } = args;
  const now = new Date();
  if (type === "attendees") {
    const attendees = records as Parameters<typeof importAttendees>[1]["attendees"];
    return isSampleDataMode()
      ? sampleImportAttendees({ ...rest, attendees, now })
      : importAttendees(getDb(), { ...rest, attendees });
  }
  const suppliers = records as Parameters<typeof importSuppliers>[1]["suppliers"];
  return isSampleDataMode()
    ? sampleImportSuppliers({ ...rest, suppliers, now })
    : importSuppliers(getDb(), { ...rest, suppliers });
}