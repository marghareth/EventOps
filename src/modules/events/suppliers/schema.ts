// src/modules/events/suppliers/schema.ts
// Validation for supplier input (B4-02 categories, D-069; B4-03 the full form, D-070). Forms send
// strings; these schemas turn them into checked values using the canonical lists, so the form, the
// server actions and the database CHECKs agree. The server always validates again. Pure: no
// database, no clock, safe for client components.
import { z } from "zod";
// Type-only: the supplier form is a client component, so this file must not pull in the audit
// context's server code.
import type { SupplierChanges } from "@/modules/events/audit/public";
import { SUPPLIER_CATEGORIES } from "./categories";

export const SUPPLIER_LIMITS = {
  name: 120,
  categoryDetail: 60,
  contactName: 120,
  email: 254,
  phone: 32,
  notes: 2000,
} as const;

/** Characters as Postgres counts them (code points), so emoji count once, like varchar(n). */
const charCount = (value: string) => Array.from(value).length;

/** A NUL character can't be stored in PostgreSQL text: refuse it with a clear message (B3-19). */
const noNul = (value: string) => !value.includes("\u0000");
const NUL_MESSAGE = "Remove the invisible character this text contains, then try again.";

export const supplierCategorySchema = z.enum(SUPPLIER_CATEGORIES, {
  message: "Choose what the supplier provides.",
});

/** The two category fields as the form sends them (D-069). */
const categoryShape = {
  category: z.string().trim().pipe(supplierCategorySchema),
  categoryDetail: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .refine(noNul, NUL_MESSAGE)
    .refine(
      (value) => charCount(value) <= SUPPLIER_LIMITS.categoryDetail,
      `Use ${SUPPLIER_LIMITS.categoryDetail} characters or fewer.`,
    ),
};

/** Other needs to say what the supplier provides. */
function requireOtherDetail(
  value: { category: string; categoryDetail: string },
  ctx: z.RefinementCtx,
) {
  if (value.category === "OTHER" && value.categoryDetail === "") {
    ctx.addIssue({
      code: "custom",
      path: ["categoryDetail"],
      message: "Say what the supplier provides, for example “Fireworks”.",
    });
  }
}

/**
 * Run the Other check even when other fields have errors, so the form lists every problem at once
 * (B4-23). Zod skips an object-level check after any field error by default; this runs it unless
 * the two fields it reads have errors of their own.
 */
const OTHER_DETAIL_CHECK = {
  when: (payload: z.core.ParsePayload) =>
    !payload.issues.some((issue) =>
      ["category", "categoryDetail"].includes(String(issue.path?.[0])),
    ),
};

/** The detail is kept for Other only, so a value left in a hidden field is never stored. */
const detailFor = (category: string, detail: string) => (category === "OTHER" ? detail : null);

/**
 * The category and, for Other, what the supplier provides (D-069). Only canonical values are
 * accepted, exactly as listed. The detail is trimmed with inner spaces collapsed, required for Other
 * and dropped for every other category.
 */
export const supplierCategoryFields = z
  .object(categoryShape)
  .superRefine(requireOtherDetail, OTHER_DETAIL_CHECK)
  .transform(({ category, categoryDetail }) => ({
    category,
    categoryDetail: detailFor(category, categoryDetail),
  }));

const tooLong = (max: number) => `Use ${max.toLocaleString("en-US")} characters or fewer.`;

/** Optional text: trimmed, empty becomes null (the database refuses blank strings). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .refine(noNul, NUL_MESSAGE)
    .refine((value) => charCount(value) <= max, tooLong(max))
    .transform((value) => (value === "" ? null : value));

/** Digits, spaces, dashes, brackets and one leading "+": local and international formats. */
const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]*$/;

/**
 * What the supplier form sends (B4-03, D-070). Every value is a string; empty optional fields are
 * "". Name and category are required; the rest is optional. The same schema checks the form in the
 * browser and again on the server.
 */
export const supplierFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Enter the supplier's name." })
      .refine(noNul, NUL_MESSAGE)
      .refine((value) => charCount(value) <= SUPPLIER_LIMITS.name, tooLong(SUPPLIER_LIMITS.name)),
    ...categoryShape,
    contactName: optionalText(SUPPLIER_LIMITS.contactName),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => charCount(value) <= SUPPLIER_LIMITS.email, tooLong(SUPPLIER_LIMITS.email))
      .refine(
        (value) => value === "" || z.email().safeParse(value).success,
        "Enter an email like name@example.com.",
      )
      .transform((value) => (value === "" ? null : value)),
    phone: z
      .string()
      .trim()
      .refine((value) => charCount(value) <= SUPPLIER_LIMITS.phone, tooLong(SUPPLIER_LIMITS.phone))
      .refine((value) => {
        if (value === "") return true;
        const digits = value.replace(/\D/g, "").length;
        return PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15;
      }, "Enter a phone number like 0917 123 4567 or +63 917 123 4567.")
      .transform((value) => (value === "" ? null : value)),
    notes: optionalText(SUPPLIER_LIMITS.notes),
  })
  .superRefine(requireOtherDetail, OTHER_DETAIL_CHECK)
  .transform((value) => ({
    ...value,
    categoryDetail: detailFor(value.category, value.categoryDetail),
  }));

/**
 * The supplier contact fields (B4-06, D-073): who to talk to and how to reach them. Nothing else
 * personal is collected (no address, ID numbers or social accounts). Every member may see them
 * (D-068); lists show only the contact person, and the audit log never holds their values.
 */
export const SUPPLIER_CONTACT_FIELDS = ["contactName", "phone", "email"] as const;

export type SupplierField =
  "name" | "category" | "categoryDetail" | "contactName" | "email" | "phone" | "notes";
export const SUPPLIER_FIELDS: readonly SupplierField[] = [
  "name",
  "category",
  "categoryDetail",
  "contactName",
  "email",
  "phone",
  "notes",
];

/** The checked values the supplier use cases store. */
export type SupplierInput = z.output<typeof supplierFormSchema>;

/** A stored supplier as form values (for the edit form): the reverse of the schema. */
export function toSupplierFormValues(supplier: SupplierInput): Record<SupplierField, string> {
  return {
    name: supplier.name,
    category: supplier.category,
    categoryDetail: supplier.categoryDetail ?? "",
    contactName: supplier.contactName ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    notes: supplier.notes ?? "",
  };
}

/** "SUP-0001": the readable supplier ID, at least four digits (D-068). */
export function formatSupplierReference(number: number): string {
  return `SUP-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable supplier ID, for example from a URL. Nothing else is trusted. */
export function isSupplierReference(value: unknown): value is string {
  return typeof value === "string" && /^SUP-\d{4,9}$/.test(value);
}

/**
 * What changed, for the audit log (D-037, D-070). Name and category (with what an Other supplier
 * provides) are recorded old → new; contact person, email, phone and notes only as "changed",
 * never their values.
 */
export function supplierChanges(before: SupplierInput, after: SupplierInput): SupplierChanges {
  const changes: SupplierChanges = {};
  if (before.name !== after.name) changes.name = { from: before.name, to: after.name };
  if (before.category !== after.category || before.categoryDetail !== after.categoryDetail) {
    changes.category = {
      from: { category: before.category, detail: before.categoryDetail },
      to: { category: after.category, detail: after.categoryDetail },
    };
  }
  for (const field of [...SUPPLIER_CONTACT_FIELDS, "notes"] as const) {
    if (before[field] !== after[field]) changes[field] = { changed: true };
  }
  return changes;
}