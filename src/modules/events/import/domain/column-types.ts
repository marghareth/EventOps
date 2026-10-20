// src/modules/events/import/domain/column-types.ts
// Data type detection (B9-F07, D-110). Each non-empty value is read as an email, phone number,
// date, number, yes/no or text; a column takes the type more than half of its non-empty values
// share, otherwise text. A column with no values is "empty". The type only helps suggest a field
// and is shown to the user; it never decides what is saved (the import rules do). Pure.

export const COLUMN_TYPES = ["email", "phone", "date", "number", "yesno", "text", "empty"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const COLUMN_TYPE_LABEL: Record<ColumnType, string> = {
  email: "Email addresses",
  phone: "Phone numbers",
  date: "Dates",
  number: "Numbers",
  yesno: "Yes or no",
  text: "Text",
  empty: "Empty",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Digits with spaces, dashes, dots or brackets and an optional leading "+". */
const PHONE_SHAPE = /^\+?[0-9(][0-9 ().-]*[0-9]$/;
const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";
const DATES = [
  /^\d{4}-\d{1,2}-\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  new RegExp(`^(?:${MONTHS})\\.? \\d{1,2},? \\d{4}$`),
  new RegExp(`^\\d{1,2} (?:${MONTHS})\\.?,? \\d{4}$`),
];
const YES_NO = new Set(["yes", "no", "y", "n", "true", "false"]);

/** The type of one value. Order matters: a date is never a phone, a phone never a number. */
export function valueType(raw: string): Exclude<ColumnType, "empty"> | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (value === "") return null;
  if (EMAIL.test(value)) return "email";
  if (DATES.some((pattern) => pattern.test(value))) return "date";
  if (PHONE_SHAPE.test(value)) {
    const digits = value.replace(/\D/g, "").length;
    // A plain 7-to-9-digit number is more likely an amount; phones start with + or 0, have
    // separators, or are 10 digits or longer.
    const looksDialled = /^[+0(]/.test(value) || /[ ().-]/.test(value) || digits >= 10;
    if (digits >= 7 && digits <= 15 && looksDialled) return "phone";
  }
  if (NUMBER.test(value)) return "number";
  if (YES_NO.has(value)) return "yesno";
  return "text";
}

/** The column's type: the type of more than half of its non-empty values, otherwise text. */
export function columnType(values: readonly string[]): ColumnType {
  const counts = new Map<ColumnType, number>();
  let filled = 0;
  for (const value of values) {
    const type = valueType(value);
    if (!type) continue;
    filled += 1;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  if (filled === 0) return "empty";
  for (const [type, count] of counts) if (count * 2 > filled) return type;
  return "text";
}