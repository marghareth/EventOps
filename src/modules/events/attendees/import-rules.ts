// src/modules/events/attendees/import-rules.ts
// CSV import rules (B2-14 to B2-18, D-052). Pure functions, run on the server at every step (and
// never trusted from the browser): suggest a mapping from the headers, check a mapping, turn each
// row into an attendee with the same schema as the add form, find duplicates, and build the
// preview. Nothing here touches the database.
import { fold } from "./guest-list-query";
import type { CsvTable } from "./csv";
import {
  ATTENDEE_FIELDS,
  RSVP_LABEL,
  attendeeFormSchema,
  type AttendeeField,
  type AttendeeInput,
} from "./schema";

/** The EventOps fields a column can go into, in the order the mapping shows them. */
export const IMPORT_FIELDS = [
  "name",
  "email",
  "phone",
  "rsvpStatus",
  "plusOnes",
  "category",
  "dietaryNeeds",
  "notes",
] as const satisfies readonly AttendeeField[];
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  rsvpStatus: "RSVP",
  plusOnes: "Plus-ones",
  category: "Category",
  dietaryNeeds: "Dietary needs",
  notes: "Notes",
};

export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ["name"];

/** For each column (by position): the field it goes into, or null for "Don't import". */
export type ColumnMapping = (ImportField | null)[];

const key = (header: string) => fold(header).replace(/[^a-z0-9]/g, "");

/** Header names (letters and digits only, lower case) that suggest a field. Not AI: a fixed list. */
export const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  name: ["name", "guest", "guestname", "fullname", "attendee", "attendeename", "nameofguest"],
  email: ["email", "emailaddress", "mail"],
  phone: [
    "phone",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "contact",
    "contactnumber",
    "cellphone",
    "cell",
    "tel",
    "telephone",
  ],
  rsvpStatus: ["rsvp", "rsvpstatus", "status", "attending", "response"],
  plusOnes: ["plusones", "plusone", "plus1", "extraguests", "companions"],
  category: ["category", "group", "guestgroup", "side"],
  dietaryNeeds: [
    "dietary",
    "dietaryneeds",
    "dietaryrequirements",
    "diet",
    "allergies",
    "foodrestrictions",
  ],
  notes: ["notes", "note", "remarks", "comments"],
};

/** A first mapping from the headers. Each field is suggested for at most one column. */
export function suggestMapping(headers: readonly string[]): ColumnMapping {
  const used = new Set<ImportField>();
  return headers.map((header) => {
    const k = key(header);
    const field = IMPORT_FIELDS.find((f) => !used.has(f) && HEADER_SYNONYMS[f].includes(k));
    if (!field) return null;
    used.add(field);
    return field;
  });
}

export type MappingCheck = { ok: true; mapping: ColumnMapping } | { ok: false; errors: string[] };

/**
 * Reads and checks a mapping sent by the browser: one entry per column, only known fields, each
 * field at most once, and the required fields present.
 */
export function readMapping(raw: readonly unknown[], columnCount: number): MappingCheck {
  const errors: string[] = [];
  if (raw.length !== columnCount)
    return { ok: false, errors: ["The mapping doesn't match the file. Upload it again."] };
  let unsupported = false;
  const mapping: ColumnMapping = raw.map((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const field = IMPORT_FIELDS.find((f) => f === value);
    if (!field) unsupported = true;
    return field ?? null;
  });
  if (unsupported) {
    errors.push(
      "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
    );
  }
  for (const field of IMPORT_FIELDS) {
    if (mapping.filter((f) => f === field).length > 1) {
      errors.push(
        `${IMPORT_FIELD_LABEL[field]} is chosen for more than one column. Choose it once.`,
      );
    }
  }
  for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!mapping.includes(field))
      errors.push(
        `Choose the column that holds each guest's ${IMPORT_FIELD_LABEL[field].toLowerCase()}.`,
      );
  }
  return errors.length ? { ok: false, errors } : { ok: true, mapping };
}

/**
 * RSVP words accepted in a file, ignoring case and spaces. The four states by name, plus a short
 * fixed list of common spreadsheet words. Empty means Pending (the default).
 */
const RSVP_WORDS: Record<string, AttendeeInput["rsvpStatus"]> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  maybe: "MAYBE",
  declined: "DECLINED",
  yes: "CONFIRMED",
  attending: "CONFIRMED",
  going: "CONFIRMED",
  no: "DECLINED",
  notattending: "DECLINED",
  regrets: "DECLINED",
  tentative: "MAYBE",
  unsure: "MAYBE",
};

/** The RSVP state for a cell, "" for empty (the form's default), or null if not understood. */
export function readRsvp(cell: string): string | null {
  if (!cell.trim()) return "";
  // Letters only, so "Not attending" and "not-attending" match. A cell with no letters ("1") is
  // not understood, never quietly Pending.
  const k = fold(cell).replace(/[^a-z]/g, "");
  return RSVP_WORDS[k] ?? null;
}

export type RowStatus = "valid" | "invalid" | "duplicate";
export type PreviewRow = {
  line: number;
  /** The mapped values as they appear in the file (trimmed), by field. */
  values: Partial<Record<ImportField, string>>;
  status: RowStatus;
  /** Why the row needs correction, in words. */
  errors: string[];
  /** For a duplicate: what it repeats. */
  duplicateOf?: string;
  /** The attendee to create, for valid rows (and duplicates, if imported anyway). */
  attendee?: AttendeeInput;
  /** What will be saved, in words, for valid rows and duplicates: "Confirmed", "0", "" for none. */
  saved?: Partial<Record<ImportField, string>>;
  /** The original cells, so rows needing correction can be downloaded and fixed. */
  cells: string[];
};

export type ImportPreview = {
  rows: PreviewRow[];
  totals: { rows: number; valid: number; invalid: number; duplicates: number; toImport: number };
  /** Headers of columns that won't be imported. */
  ignoredColumns: string[];
};

/** Who is already on the guest list, for duplicate checks. */
export type ExistingIdentity = { name: string; email: string | null; reference: string };

const sameGuest = (
  a: { name: string; email: string | null },
  b: { name: string; email: string | null },
) =>
  fold(a.name) === fold(b.name) &&
  (!a.email || !b.email || a.email.toLowerCase() === b.email.toLowerCase());

/**
 * The preview: every data row mapped and validated with the add form's schema, then checked for
 * duplicates against the guest list and earlier rows in the file (same name ignoring case and
 * accents, and the same email when both have one). Valid rows are imported; rows needing
 * correction never are; duplicates only when includeDuplicates is set.
 */
export function buildImportPreview(
  table: CsvTable,
  mapping: ColumnMapping,
  existing: readonly ExistingIdentity[],
  options: { includeDuplicates: boolean },
): ImportPreview {
  const accepted: { name: string; email: string | null; line: number }[] = [];
  const rows: PreviewRow[] = table.rows.map((row) => {
    const values: Partial<Record<ImportField, string>> = {};
    mapping.forEach((field, column) => {
      if (field) values[field] = row.cells[column].trim();
    });
    const errors: string[] = [];
    const form = Object.fromEntries(
      ATTENDEE_FIELDS.map((f) => [f, values[f as ImportField] ?? ""]),
    ) as Record<AttendeeField, string>;
    if (values.rsvpStatus !== undefined) {
      const rsvp = readRsvp(values.rsvpStatus);
      if (rsvp === null) {
        errors.push(
          `RSVP: “${values.rsvpStatus}” isn't one we know. Use Confirmed, Pending, Maybe or Declined.`,
        );
      } else {
        form.rsvpStatus = rsvp;
      }
    }
    const parsed = attendeeFormSchema.safeParse(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ImportField;
        if (field === "rsvpStatus" && errors.length) continue;
        errors.push(`${IMPORT_FIELD_LABEL[field] ?? "Value"}: ${issue.message}`);
      }
    }
    if (errors.length || !parsed.success) {
      return { line: row.line, values, status: "invalid", errors, cells: row.cells };
    }
    const attendee = parsed.data;
    const saved: Partial<Record<ImportField, string>> = {};
    for (const field of IMPORT_FIELDS) {
      if (!mapping.includes(field)) continue;
      const value = attendee[field];
      saved[field] =
        field === "rsvpStatus"
          ? RSVP_LABEL[attendee.rsvpStatus]
          : value === null
            ? ""
            : String(value);
    }
    const before = existing.find((e) => sameGuest(e, attendee));
    const earlier = accepted.find((a) => sameGuest(a, attendee));
    accepted.push({ name: attendee.name, email: attendee.email, line: row.line });
    if (before || earlier) {
      return {
        line: row.line,
        values,
        status: "duplicate",
        errors: [],
        duplicateOf: before
          ? `Already on the guest list as ${before.name} (${before.reference})`
          : `Repeats line ${earlier!.line} of the file`,
        attendee,
        saved,
        cells: row.cells,
      };
    }
    return {
      line: row.line,
      values,
      status: "valid",
      errors: [],
      attendee,
      saved,
      cells: row.cells,
    };
  });
  const count = (status: RowStatus) => rows.filter((r) => r.status === status).length;
  const valid = count("valid");
  const duplicates = count("duplicate");
  return {
    rows,
    totals: {
      rows: rows.length,
      valid,
      invalid: count("invalid"),
      duplicates,
      toImport: valid + (options.includeDuplicates ? duplicates : 0),
    },
    ignoredColumns: table.headers.filter((_, i) => mapping[i] === null),
  };
}

/** The attendees an import would create, in file order. */
export function attendeesToImport(
  preview: ImportPreview,
  options: { includeDuplicates: boolean },
): AttendeeInput[] {
  return preview.rows
    .filter((r) => r.status === "valid" || (options.includeDuplicates && r.status === "duplicate"))
    .map((r) => r.attendee!);
}