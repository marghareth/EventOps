// src/modules/events/reference.ts
// Readable event IDs such as EVT-2026-0001 (D-005). Pure: the clock is passed in.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The calendar year in Philippine time (UTC+8, no daylight saving) at the given instant. */
export function manilaYear(now: Date): number {
  return new Date(now.getTime() + MANILA_OFFSET_MS).getUTCFullYear();
}

/** EVT-<year>-<number>, the number zero-padded to at least 4 digits. */
export function formatEventReference(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("An event reference number starts at 1.");
  }
  return `EVT-${year}-${String(sequence).padStart(4, "0")}`;
}

const REFERENCE_PATTERN = /^EVT-\d{4}-\d{4,}$/;

/** True for a well-formed event reference. Used before showing one taken from a URL. */
export function isEventReference(value: unknown): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}