// src/modules/events/audit/queries.ts
// Reads the audit log for one event (B1-11). Not an access check: callers must authorize first
// (getEventActivity in the events context does, with the audit.view permission, D-035).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { readAuditDetails, type AuditAction } from "./actions";

export type AuditEntryView = {
  id: string;
  createdAt: Date;
  /** Null if the user has since been deleted. */
  actorName: string | null;
  /** Null if the stored entry is not a known action with valid details. */
  action: AuditAction | null;
  details: unknown;
};

export async function listAuditEntries(
  db: PrismaClient,
  eventId: string,
  limit = 100,
): Promise<AuditEntryView[]> {
  const rows = await db.auditLog.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      createdAt: true,
      action: true,
      details: true,
      actor: { select: { displayName: true } },
    },
  });
  // JSON is validated on every read (DATA_MODEL rule), not only on write.
  return rows.map((row) => {
    const valid = readAuditDetails(row.action, row.details);
    return {
      id: row.id,
      createdAt: row.createdAt,
      actorName: row.actor?.displayName ?? null,
      action: valid?.action ?? null,
      details: valid?.details ?? null,
    };
  });
}