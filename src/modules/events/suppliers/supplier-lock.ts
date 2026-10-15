// src/modules/events/suppliers/supplier-lock.ts
// The supplier lock for quote and payment use cases (B4-09, B4-14; D-075, D-077). One statement
// finds the supplier only inside the event, checks the user is a member whose role may manage
// suppliers (D-035), and locks the supplier's row until the transaction ends.
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { rolesAllowed } from "@/modules/events/public";

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Locks this event's supplier for the rest of the transaction, if the user may manage suppliers.
 * Returns its readable number, or null when there is no such supplier or the role may not. Quote
 * and payment changes (B4-09, B4-14) take this lock, so a supplier's quotes and payments change
 * one save at a time.
 */
export async function lockSupplierForUpdates(
  tx: Tx,
  args: { eventId: string; supplierId: string; userId: string },
): Promise<number | null> {
  const roles = [...rolesAllowed("suppliers.manage")] as MemberRole[];
  const [row] = await tx.$queryRaw<{ number: number }[]>`
    SELECT s.number FROM suppliers s
    WHERE s.id = ${args.supplierId}::uuid AND s."eventId" = ${args.eventId}::uuid
      AND EXISTS (
        SELECT 1 FROM event_members m
        WHERE m."eventId" = s."eventId" AND m."userId" = ${args.userId}::uuid
          AND m.role = ANY(${roles}::member_role[])
      )
    FOR UPDATE OF s`;
  return row ? row.number : null;
}