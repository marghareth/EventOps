// src/modules/events/attendees/export-attendees.ts
// Export use case (B2-19, D-053). Reads the event's attendees and records "attendees.exported" in
// the same transaction, so every export that returns data is in Activity. The caller authorizes
// first with attendees.export (authorizeEventRequest); the query filters by the authorized event.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { writeAudit } from "@/modules/events/audit/public";
import { sampleExportAttendees } from "@/modules/events/public";
import type { ExportableAttendee } from "./export-csv";

const EXPORT_SELECT = {
  number: true,
  name: true,
  email: true,
  phone: true,
  category: true,
  rsvpStatus: true,
  plusOnes: true,
  dietaryNeeds: true,
  notes: true,
} as const;

export async function exportAttendees(
  db: PrismaClient,
  args: { eventId: string; userId: string },
): Promise<ExportableAttendee[]> {
  return db.$transaction(async (tx) => {
    const attendees = await tx.attendee.findMany({
      where: { eventId: args.eventId },
      select: EXPORT_SELECT,
      orderBy: { number: "asc" },
    });
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.userId,
      action: "attendees.exported",
      entityId: args.eventId,
      details: { count: attendees.length },
    });
    return attendees;
  });
}

/**
 * For the export route: the database, or dev-only sample data (D-041). Null when the sample store
 * refuses the role (the database path relies on the caller's authorization).
 */
export async function exportEventAttendees(args: {
  eventId: string;
  userId: string;
  now: Date;
}): Promise<ExportableAttendee[] | null> {
  if (isSampleDataMode()) return sampleExportAttendees(args);
  return exportAttendees(getDb(), args);
}