// src/modules/events/budget/domain/budget.money.ts
// Peso amounts for the budget (B5-F01, B5-F02; D-084, D-085). Money is Decimal(12, 2) in PHP and is
// handled here as an exact decimal STRING with two places ("1234.50"), never as a floating-point
// number (PROJECT_RULES section 6.1). Nothing in this file adds, subtracts or rounds: it only
// reads what the user typed, refuses what does not fit the column, and formats for display.
// If a shared peso parser from B4 (D-075) exists, replace this file's parsePesos with it so the
// project keeps one money rule.

/** The largest amount DECIMAL(12,2) holds: ₱9,999,999,999.99 (10 digits before the point). */
export const MAX_PESO_INTEGER_DIGITS = 10;

export type PesoParseResult =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "format" | "negative" | "too-large" };

/**
 * Reads a typed amount into an exact two-place string.
 * Accepts "1500", "1500.5", "1,500.50" and "₱1,500.50". Refuses blank, negative, more than two
 * decimal places (it never rounds for the user), misplaced commas and anything above the maximum.
 */
export function parsePesos(raw: string): PesoParseResult {
  const text = raw.trim().replace(/^₱\s*/, "");
  if (text === "") return { ok: false, reason: "empty" };
  if (/^-\s*\d/.test(text)) return { ok: false, reason: "negative" };

  const plain = /^\d+(\.\d{1,2})?$/;
  const grouped = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
  if (!plain.test(text) && !grouped.test(text)) return { ok: false, reason: "format" };

  const [whole = "0", fraction = ""] = text.replace(/,/g, "").split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > MAX_PESO_INTEGER_DIGITS) return { ok: false, reason: "too-large" };
  return { ok: true, value: `${integer}.${fraction.padEnd(2, "0")}` };
}

/** "1234.5" or "1234.50" → "₱1,234.50". Display only; the input is already a two-place string. */
export function formatPesos(value: string): string {
  const [whole = "0", fraction = "00"] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₱${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}