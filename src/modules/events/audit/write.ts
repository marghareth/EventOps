// src/modules/events/audit/write.ts
// Appends one audit entry (B1-11, D-037). Call it with the transaction client of the change it
// records, so both are saved or neither is. Only registered actions with valid details can be
// written; anything else throws and rolls the change back. The table is append-only (trigger).
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT_ACTIONS, type AuditAction, type AuditDetails } from "./actions";

export type AuditEntry<A extends AuditAction> = {
  eventId: string;
  /** The signed-in user who made the change. */
  actorId: string;
  action: A;
  /** The record the action is about. Its type comes from the registry. */
  entityId: string;
  details: AuditDetails<A>;
};

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAudit<A extends AuditAction>(
  tx: AuditClient,
  entry: AuditEntry<A>,
): Promise<void> {
  const definition = AUDIT_ACTIONS[entry.action];
  if (!definition) throw new Error(`Unknown audit action: ${String(entry.action)}`);
  // Strict schemas: unlisted fields are refused, not silently dropped.
  const details = definition.details.parse(entry.details) as Prisma.InputJsonValue;
  await tx.auditLog.create({
    data: {
      eventId: entry.eventId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: definition.entityType,
      entityId: entry.entityId,
      details,
    },
  });
}