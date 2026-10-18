// src/modules/events/tasks/domain/due-date.ts
// Calendar-date rules for a task's due date (B6-F07; D-096). Dates are days, not instants: written
// "YYYY-MM-DD", stored as DATE, shown as written ("Nov 15, 2026") with no time zone shift, and
// worked out in Philippine time (D-025, D-079). This mirrors the supplier payment date rules
// (suppliers/payment-due.ts, D-079) on purpose: a client component can't import the suppliers
// context's public interface (D-043), and moving the shared rules is a separate refactoring that
// needs approval (D-096, "Known debt"). Pure: safe for client components.

/** The supported range for a due date, also enforced by the database (tasks_due_date_in_range). */
export const TASK_DUE_DATE_RANGE = { min: "2000-01-01", max: "2100-12-31" } as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written "YYYY-MM-DD" (no 30 February), in any year. */
export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

/** True when the day is inside the supported range. Plain text comparison is exact for ISO dates. */
export const isDueDateInRange = (value: string) =>
  value >= TASK_DUE_DATE_RANGE.min && value <= TASK_DUE_DATE_RANGE.max;

/** "YYYY-MM-DD" from a DATE column value (Prisma returns midnight UTC of that day). */
export function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** The Date Prisma writes to a DATE column for "YYYY-MM-DD". */
export const toDateColumn = (value: string) => new Date(`${value}T00:00:00.000Z`);

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Nov 15, 2026" from "2026-11-15". The day is shown as written: no time zone shift. */
export function formatCalendarDate(value: string): string {
  if (!isCalendarDate(value)) throw new Error("Not a calendar date (YYYY-MM-DD).");
  return DATE_FORMAT.format(new Date(`${value}T00:00:00.000Z`));
}