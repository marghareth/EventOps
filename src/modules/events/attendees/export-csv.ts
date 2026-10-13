// src/modules/events/attendees/export-csv.ts
// The attendee export file (B2-19, D-053). Pure: the same columns the import understands, so an
// exported file can be imported again; UTF-8 with a byte-order mark so Excel shows "Peña"; every
// cell formula-safe (csv.ts). Attendees in ID order (the order they were added).
import { toCsv } from "./csv";
import { RSVP_LABEL, formatAttendeeReference, type AttendeeInput } from "./schema";

export const EXPORT_HEADERS = [
  "ID",
  "Name",
  "RSVP",
  "Plus-ones",
  "Category",
  "Dietary needs",
  "Email",
  "Phone",
  "Notes",
] as const;

export type ExportableAttendee = AttendeeInput & { number: number };

export function attendeesCsv(attendees: readonly ExportableAttendee[]): string {
  const rows = [...attendees]
    .sort((a, b) => a.number - b.number)
    .map((a) => [
      formatAttendeeReference(a.number),
      a.name,
      RSVP_LABEL[a.rsvpStatus],
      String(a.plusOnes),
      a.category ?? "",
      a.dietaryNeeds ?? "",
      a.email ?? "",
      a.phone ?? "",
      a.notes ?? "",
    ]);
  return toCsv([[...EXPORT_HEADERS], ...rows], { bom: true });
}

/** "EVT-2026-0001-attendees-2026-10-13.csv", dated in Manila time. */
export function exportFileName(eventReference: string, now: Date): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
  const safeReference = eventReference.replace(/[^A-Za-z0-9-]/g, "");
  return `${safeReference}-attendees-${date}.csv`;
}