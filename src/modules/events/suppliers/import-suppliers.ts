// src/modules/events/suppliers/import-suppliers.ts
// Supplier import use case (B9-F17, D-109). One transaction for the whole import, like the
// attendee import (D-052):
//   1. take the next N supplier numbers in one statement; the same statement checks that the
//      importer is a member whose role may import (import.run, D-035), so a refused user changes
//      nothing,
//   2. insert every supplier,
//   3. record one "suppliers.imported" entry (counts, ID range, file type and whether AI suggested
//      the matching; never names, contacts or file contents).
// If anything fails, nothing is saved and no number is used. The caller authorizes first and
// passes only rows that passed the import rules on the server.
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatSupplierReference, type SupplierInput } from "./schema";

export type ImportSuppliersResult =
  | { ok: true; count: number; first: string; last: string }
  /** No such event, the importer may not import, or nothing to import: nothing was saved. */
  | { ok: false };

export async function importSuppliers(
  db: PrismaClient,
  args: {
    eventId: string;
    importerId: string;
    suppliers: SupplierInput[];
    skipped: number;
    fileType: "csv" | "xlsx";
    aiSuggested: boolean;
  },
): Promise<ImportSuppliersResult> {
  const count = args.suppliers.length;
  if (count === 0) return { ok: false };
  const roles = [...rolesAllowed("import.run")] as MemberRole[];

  return db.$transaction(
    async (tx) => {
      // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
      // locked until commit, so a concurrent addition or import gets numbers after these.
      const [counter] = await tx.$queryRaw<{ lastSupplierNumber: number }[]>`
        UPDATE events SET "lastSupplierNumber" = "lastSupplierNumber" + ${count}
        WHERE id = ${args.eventId}::uuid
          AND EXISTS (
            SELECT 1 FROM event_members m
            WHERE m."eventId" = events.id AND m."userId" = ${args.importerId}::uuid
              AND m.role = ANY(${roles}::member_role[])
          )
        RETURNING "lastSupplierNumber"`;
      if (!counter) return { ok: false } as const;

      const firstNumber = counter.lastSupplierNumber - count + 1;
      await tx.supplier.createMany({
        data: args.suppliers.map((supplier, i) => ({
          ...supplier,
          eventId: args.eventId,
          number: firstNumber + i,
        })),
      });
      const first = formatSupplierReference(firstNumber);
      const last = formatSupplierReference(counter.lastSupplierNumber);
      await writeAudit(tx, {
        eventId: args.eventId,
        actorId: args.importerId,
        action: "suppliers.imported",
        entityId: args.eventId,
        details: {
          count,
          first,
          last,
          skipped: args.skipped,
          fileType: args.fileType,
          aiSuggested: args.aiSuggested,
        },
      });
      return { ok: true, count, first, last } as const;
    },
    { timeout: 20_000 },
  );
}