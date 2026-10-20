// src/modules/events/suppliers/import-rules.ts
// Supplier import rules (B9-F05, F08, F10; D-109). Pure functions the import wizard runs on the
// server at every step: the fields a column can go into, check a mapping, read a category word,
// turn each row into a supplier with the add form's schema (D-070), find duplicates and build the
// preview. Money is never imported: quotes and payments are added on the supplier afterwards.
// Nothing here touches the database.
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_DEFINITIONS,
  supplierCategoryText,
  type SupplierCategory,
} from "./categories";
import { foldText } from "./supplier-list-query";
import { SUPPLIER_LIMITS, supplierFormSchema, type SupplierInput } from "./schema";

/** The supplier fields a column can go into, in the order the mapping shows them. */
export const SUPPLIER_IMPORT_FIELDS = [
  "name",
  "category",
  "contactName",
  "email",
  "phone",
  "notes",
] as const;
export type SupplierImportField = (typeof SUPPLIER_IMPORT_FIELDS)[number];

export const SUPPLIER_IMPORT_FIELD_LABEL: Record<SupplierImportField, string> = {
  name: "Name",
  category: "Category",
  contactName: "Contact person",
  email: "Email",
  phone: "Phone",
  notes: "Notes",
};

/** A supplier needs a name and what it provides (D-070), so both columns are required. */
export const REQUIRED_SUPPLIER_IMPORT_FIELDS: readonly SupplierImportField[] = ["name", "category"];

/**
 * Header names (letters and digits only, lower case) that suggest a field. A fixed list, not AI
 * (D-110). The import wizard also matches single words of a longer header against it.
 */
export const SUPPLIER_IMPORT_HEADER_WORDS: Record<SupplierImportField, readonly string[]> = {
  name: [
    "name",
    "supplier",
    "suppliername",
    "vendor",
    "vendorname",
    "company",
    "business",
    "businessname",
  ],
  category: ["category", "type", "service", "services", "suppliertype", "vendortype", "provides"],
  contactName: [
    "contactperson",
    "contactname",
    "contact",
    "person",
    "representative",
    "coordinator",
  ],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contactnumber", "cell", "telephone"],
  notes: ["notes", "note", "remarks", "comments"],
};

/** For each column (by position): the field it goes into, or null for "Don't import". */
export type SupplierColumnMapping = (SupplierImportField | null)[];

export type SupplierMappingCheck =
  { ok: true; mapping: SupplierColumnMapping } | { ok: false; errors: string[] };

/**
 * Reads and checks a mapping from the browser or from the AI suggestion (D-111): one entry per
 * column, only supplier fields, each field at most once, and the required fields present.
 */
export function readSupplierMapping(
  raw: readonly unknown[],
  columnCount: number,
): SupplierMappingCheck {
  if (raw.length !== columnCount)
    return { ok: false, errors: ["The mapping doesn't match the file. Upload it again."] };
  const errors: string[] = [];
  let unsupported = false;
  const mapping: SupplierColumnMapping = raw.map((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const field = SUPPLIER_IMPORT_FIELDS.find((f) => f === value);
    if (!field) unsupported = true;
    return field ?? null;
  });
  if (unsupported) {
    errors.push(
      "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
    );
  }
  for (const field of SUPPLIER_IMPORT_FIELDS) {
    if (mapping.filter((f) => f === field).length > 1) {
      errors.push(
        `${SUPPLIER_IMPORT_FIELD_LABEL[field]} is chosen for more than one column. Choose it once.`,
      );
    }
  }
  if (!mapping.includes("name")) errors.push("Choose the column that holds each supplier's name.");
  if (!mapping.includes("category")) {
    errors.push("Choose the column that says what each supplier provides (Category).");
  }
  return errors.length ? { ok: false, errors } : { ok: true, mapping };
}

/**
 * Words that place a supplier in a category (D-110), matched against the words of the cell. The
 * category's own name ("Photo and video", "PHOTO_AND_VIDEO") always matches too.
 */
const CATEGORY_WORDS: Record<Exclude<SupplierCategory, "OTHER">, readonly string[]> = {
  VENUE: ["venue", "hall", "resort", "hotel", "church", "ballroom", "chapel", "pavilion"],
  CATERING: ["caterer", "caterers", "catering", "food", "buffet", "lechon", "drinks", "bar"],
  CAKE_AND_DESSERTS: ["cake", "cakes", "dessert", "desserts", "pastry", "pastries", "bakery"],
  PHOTO_AND_VIDEO: [
    "photographer",
    "photography",
    "photo",
    "photos",
    "photobooth",
    "video",
    "videographer",
    "videography",
    "film",
  ],
  SOUND_AND_LIGHTS: ["sound", "sounds", "lights", "lighting", "audio", "speakers", "technical"],
  ENTERTAINMENT: [
    "band",
    "dj",
    "host",
    "emcee",
    "mc",
    "singer",
    "entertainment",
    "performer",
    "magician",
  ],
  FLOWERS_AND_STYLING: [
    "florist",
    "flowers",
    "flower",
    "floral",
    "stylist",
    "styling",
    "decor",
    "decorations",
  ],
  HAIR_AND_MAKEUP: ["hair", "makeup", "hmua", "glam"],
  ATTIRE: ["gown", "gowns", "suit", "suits", "attire", "barong", "tailor", "dress", "couturier"],
  RENTALS: ["rental", "rentals", "chairs", "tables", "tent", "tents", "linens", "equipment"],
  TRANSPORT: ["transport", "transportation", "car", "cars", "van", "bus", "shuttle"],
  PRINTING_AND_STATIONERY: [
    "printing",
    "print",
    "invitations",
    "invitation",
    "stationery",
    "signage",
  ],
};

const words = (text: string) =>
  foldText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * The category for a cell (B9-F08, D-110): the category whose words the cell mentions most (ties
 * go to the earlier category in the list), or Other with the cell's text as what the supplier
 * provides. An empty cell gives no category, which the form's rule then refuses.
 */
export function readSupplierCategory(cell: string): {
  category: SupplierCategory | "";
  categoryDetail: string;
} {
  const text = cell.trim().replace(/\s+/g, " ");
  if (text === "") return { category: "", categoryDetail: "" };
  const plain = foldText(text).replace(/[^a-z0-9]/g, "");
  const exact = SUPPLIER_CATEGORIES.find(
    (c) =>
      c.toLowerCase().replace(/_/g, "") === plain ||
      foldText(SUPPLIER_CATEGORY_DEFINITIONS[c].label).replace(/[^a-z0-9]/g, "") === plain,
  );
  if (exact) return { category: exact, categoryDetail: "" };
  const cellWords = new Set(words(text));
  let best: { category: SupplierCategory; score: number } | null = null;
  for (const category of SUPPLIER_CATEGORIES) {
    if (category === "OTHER") continue;
    const score = CATEGORY_WORDS[category].filter((w) => cellWords.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { category, score };
  }
  return best
    ? { category: best.category, categoryDetail: "" }
    : { category: "OTHER", categoryDetail: text };
}

type ImportTable = { headers: string[]; rows: { line: number; cells: string[] }[] };

export type SupplierRowStatus = "valid" | "invalid" | "duplicate";
export type SupplierPreviewRow = {
  line: number;
  /** The mapped values as they appear in the file (trimmed), by field. */
  values: Partial<Record<SupplierImportField, string>>;
  status: SupplierRowStatus;
  errors: string[];
  duplicateOf?: string;
  /** The supplier to create, for valid rows (and duplicates, if imported anyway). */
  supplier?: SupplierInput;
  /** What will be saved, in words: "Catering", "Other: Fireworks", "" for none. */
  saved?: Partial<Record<SupplierImportField, string>>;
  cells: string[];
};

export type SupplierImportPreview = {
  rows: SupplierPreviewRow[];
  totals: { rows: number; valid: number; invalid: number; duplicates: number; toImport: number };
  ignoredColumns: string[];
};

/** Suppliers already added, for duplicate checks. */
export type ExistingSupplier = { name: string; reference: string };

const sameName = (a: string, b: string) => foldText(a) === foldText(b);

/**
 * The preview: each row mapped, its category read (D-110) and validated with the add form's schema
 * (D-070), then checked for duplicates against the event's suppliers and earlier rows (the same
 * name, ignoring case and accents). Valid rows are imported; rows needing correction never are;
 * duplicates only when includeDuplicates is set.
 */
export function buildSupplierImportPreview(
  table: ImportTable,
  mapping: SupplierColumnMapping,
  existing: readonly ExistingSupplier[],
  options: { includeDuplicates: boolean },
): SupplierImportPreview {
  const accepted: { name: string; line: number }[] = [];
  const rows: SupplierPreviewRow[] = table.rows.map((row) => {
    const values: Partial<Record<SupplierImportField, string>> = {};
    mapping.forEach((field, column) => {
      if (field) values[field] = row.cells[column].trim();
    });
    const { category, categoryDetail } = readSupplierCategory(values.category ?? "");
    const parsed = supplierFormSchema.safeParse({
      name: values.name ?? "",
      category,
      categoryDetail,
      contactName: values.contactName ?? "",
      email: values.email ?? "",
      phone: values.phone ?? "",
      notes: values.notes ?? "",
    });
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => {
        const path = String(issue.path[0]);
        const field = (path === "categoryDetail" ? "category" : path) as SupplierImportField;
        const message =
          path === "categoryDetail" && categoryDetail
            ? `“${categoryDetail}” is longer than ${SUPPLIER_LIMITS.categoryDetail} characters. Shorten it or use a category name.`
            : issue.message;
        return `${SUPPLIER_IMPORT_FIELD_LABEL[field] ?? "Value"}: ${message}`;
      });
      return { line: row.line, values, status: "invalid", errors, cells: row.cells };
    }
    const supplier = parsed.data;
    const saved: Partial<Record<SupplierImportField, string>> = {};
    for (const field of SUPPLIER_IMPORT_FIELDS) {
      if (!mapping.includes(field)) continue;
      saved[field] =
        field === "category"
          ? supplierCategoryText(supplier.category, supplier.categoryDetail)
          : (supplier[field] ?? "");
    }
    const before = existing.find((e) => sameName(e.name, supplier.name));
    const earlier = accepted.find((a) => sameName(a.name, supplier.name));
    accepted.push({ name: supplier.name, line: row.line });
    const base = { line: row.line, values, errors: [], supplier, saved, cells: row.cells };
    if (before || earlier) {
      return {
        ...base,
        status: "duplicate",
        duplicateOf: before
          ? `Already added as ${before.name} (${before.reference})`
          : `Repeats line ${earlier!.line} of the file`,
      };
    }
    return { ...base, status: "valid" };
  });
  const count = (status: SupplierRowStatus) => rows.filter((r) => r.status === status).length;
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

/** The suppliers an import would create, in file order. */
export function suppliersToImport(
  preview: SupplierImportPreview,
  options: { includeDuplicates: boolean },
): SupplierInput[] {
  return preview.rows
    .filter((r) => r.status === "valid" || (options.includeDuplicates && r.status === "duplicate"))
    .map((r) => r.supplier!);
}