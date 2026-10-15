// src/modules/events/suppliers/create-quote.ts
// Add-quote use case (B4-09, D-075, D-076). One transaction:
//   1. lock the supplier's row, found only inside this event, in the same statement that checks
//      the creator is a member whose role may manage suppliers (D-035). Quotes of one supplier are
//      therefore added and accepted one at a time,
//   2. if the new quote is Accepted, refuse while another quote of the supplier is Accepted (D-076),
//   3. take the event's next quote number,
//   4. insert the quote and record "quote.created" in the audit log (D-037).
// A refusal writes nothing. If anything fails, everything rolls back, including the number. The
// caller must have authenticated the creator and authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { checkQuoteStatus } from "./quote-statuses";
import { formatQuoteReference, type QuoteInput } from "./quote-schema";
import { formatSupplierReference } from "./schema";
import { lockSupplierForUpdates, type Tx } from "./supplier-lock";

export type CreateQuoteResult =
  | { ok: true; quote: { id: string; reference: string } }
  /** No such supplier in this event, or the creator may not manage it: nothing was saved. */
  | { ok: false; reason: "not-found" }
  /** Another quote of the supplier is Accepted (`reference`): nothing was saved. */
  | { ok: false; reason: "another-accepted"; reference: string };

/** The readable ID of the supplier's Accepted quote other than `exceptId`, or null. */
export async function acceptedQuoteReference(
  tx: Tx,
  args: { eventId: string; supplierId: string; exceptId?: string },
): Promise<string | null> {
  const accepted = await tx.supplierQuote.findFirst({
    where: {
      eventId: args.eventId,
      supplierId: args.supplierId,
      status: "ACCEPTED",
      ...(args.exceptId ? { id: { not: args.exceptId } } : {}),
    },
    select: { number: true },
  });
  return accepted ? formatQuoteReference(accepted.number) : null;
}

export async function createQuote(
  db: PrismaClient,
  args: { eventId: string; supplierId: string; creatorId: string; quote: QuoteInput },
): Promise<CreateQuoteResult> {
  return db.$transaction(async (tx) => {
    const supplierNumber = await lockSupplierForUpdates(tx, {
      eventId: args.eventId,
      supplierId: args.supplierId,
      userId: args.creatorId,
    });
    if (supplierNumber === null) return { ok: false, reason: "not-found" } as const;

    const accepted =
      args.quote.status === "ACCEPTED" ? await acceptedQuoteReference(tx, args) : null;
    const check = checkQuoteStatus(args.quote.status, accepted);
    if (!check.ok) return check;

    // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
    // locked until commit, so concurrent additions get distinct numbers.
    const [counter] = await tx.$queryRaw<{ lastQuoteNumber: number }[]>`
      UPDATE events SET "lastQuoteNumber" = "lastQuoteNumber" + 1
      WHERE id = ${args.eventId}::uuid
      RETURNING "lastQuoteNumber"`;

    const created = await tx.supplierQuote.create({
      data: {
        eventId: args.eventId,
        supplierId: args.supplierId,
        number: counter.lastQuoteNumber,
        amount: args.quote.amount,
        status: args.quote.status,
        description: args.quote.description,
      },
      select: { id: true },
    });
    const reference = formatQuoteReference(counter.lastQuoteNumber);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.creatorId,
      action: "quote.created",
      entityId: created.id,
      details: {
        reference,
        supplierReference: formatSupplierReference(supplierNumber),
        amount: args.quote.amount,
        status: args.quote.status,
        description: args.quote.description,
      },
    });
    return { ok: true, quote: { id: created.id, reference } } as const;
  });
}