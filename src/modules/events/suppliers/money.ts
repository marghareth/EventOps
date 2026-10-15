// src/modules/events/suppliers/money.ts
// Peso amounts for supplier quotes (B4-08, D-075). Amounts are Philippine pesos with exactly two
// decimal places, stored as Decimal(12, 2). They are handled as strings from the form to the
// database and back, never as JavaScript numbers, so no floating-point error can creep in. Nothing
// is rounded: an amount with more than two decimal places is refused. Pure: no database, no clock,
// safe for client components.

/** The largest amount Decimal(12, 2) holds. */
export const MAX_PESO_AMOUNT = "9999999999.99";

const MESSAGES = {
  required: "Enter the amount.",
  format: "Enter an amount in pesos, like 120000 or 120,000.50.",
  negative: "Enter an amount more than ₱0.",
  zero: "Enter an amount more than ₱0.",
  decimals: "Use at most two decimal places (centavos).",
  tooLarge: "Enter an amount up to ₱9,999,999,999.99.",
} as const;

export type ParsedPesoAmount =
  /** `value` is canonical: digits, a point and two decimals, no leading zeros ("120000.50"). */
  { ok: true; value: string } | { ok: false; message: string };

// Whole pesos either plain ("120000") or with correctly grouped commas ("120,000"); then optional
// centavos after a point. Anything else (spaces inside, "1.000,00", "1e5", ranges, letters) is
// refused as ambiguous.
const WHOLE = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)`;
const AMOUNT = new RegExp(String.raw`^(${WHOLE})(?:\.(\d+))?$`);

/**
 * Reads a peso amount typed by a person. An optional leading "₱" is allowed. Refuses empty,
 * negative, zero, more than two decimals (never rounded), anything over ₱9,999,999,999.99, and any
 * other format.
 */
export function parsePesoAmount(input: string): ParsedPesoAmount {
  let text = input.trim();
  if (text === "") return { ok: false, message: MESSAGES.required };
  if (text.startsWith("₱")) text = text.slice(1).trimStart();
  if (/^[-−]/.test(text)) return { ok: false, message: MESSAGES.negative };
  const match = AMOUNT.exec(text);
  if (!match) return { ok: false, message: MESSAGES.format };
  const [, whole, centavos = ""] = match;
  if (centavos.length > 2) return { ok: false, message: MESSAGES.decimals };
  const digits = whole.replace(/,/g, "").replace(/^0+(?=\d)/, "");
  if (digits.length > 10) return { ok: false, message: MESSAGES.tooLarge };
  const value = `${digits}.${centavos.padEnd(2, "0")}`;
  if (/^0\.00$/.test(value)) return { ok: false, message: MESSAGES.zero };
  return { ok: true, value };
}

/** True for a canonical amount as stored ("120000.50"): what the database sends back. */
export function isCanonicalPesoAmount(value: string): boolean {
  return /^(?:0|[1-9]\d{0,9})\.\d{2}$/.test(value);
}

/** "₱120,000.50" from a canonical amount. String-based: no number conversion. */
export function formatPeso(value: string): string {
  const [whole, centavos] = value.split(".");
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${centavos}`;
}

/** "120,000.50": a canonical amount as the edit form shows it (no peso sign). */
export function toPesoInput(value: string): string {
  return formatPeso(value).slice(1);
}

/**
 * Whole centavos from a canonical amount ("120000.50" → 12,000,050 centavos), as a BigInt so sums
 * stay exact (B4-13, D-078). Only canonical amounts are accepted; anything else throws, because it would mean
 * unchecked data reached a money calculation.
 */
export function toCentavos(value: string): bigint {
  if (!isCanonicalPesoAmount(value)) throw new Error("Not a canonical peso amount.");
  return BigInt(value.replace(".", ""));
}

/** A canonical amount from whole centavos (12,000,050 → "120000.50"). Zero and more only. */
export function fromCentavos(centavos: bigint): string {
  if (centavos < BigInt(0)) throw new Error("A peso amount can't be negative.");
  const digits = centavos.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}