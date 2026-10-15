// src/modules/events/suppliers/update-quote.ts
// Edit-quote use case (B4-10, D-075, D-076). One transaction:
//   1. lock the quote's supplier, found only inside this event, in the same statement that checks
//      the editor is a member whose role may manage suppliers (D-035). A supplier's quotes are
//      therefore edited and accepted one at a time,
//   2. find the quote, only if it belongs to this supplier of this event,
//   3. refuse a stale save: the quote changed since the editor loaded it (D-032),
//   4. refuse accepting it while another quote of the supplier is Accepted (D-076),
//   5. write the editable fields (the supplier, event and number never change); a status change
//      moves statusChangedAt; record "quote.updated" with what changed (D-037).
// A save that changes nothing writes nothing. The caller must have authenticated the editor and
// authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { acceptedQuoteReference } from "./create-quote";
import { formatQuoteReference, quoteChanges, type QuoteInput } from "./quote-schema";
import { checkQuoteStatus } from "./quote-statuses";
import { formatSupplierReference } from "./schema";
import { lockSupplierForUpdates } from "./supplier-lock";

export type UpdateQuoteResult =
  /** Saved, or nothing to save (`changed: false`, nothing written). */
  | { ok: true; changed: boolean; reference: string }
  /** No such quote for this supplier of this event, or the editor may not edit it. */
  | { ok: false; reason: "not-found" }
  /** Someone saved the quote after `version`: nothing was changed. */
  | { ok: false; reason: "stale" }
  /** Another quote of the supplier is Accepted (`reference`): nothing was changed. */
  | { ok: false; reason: "another-accepted"; reference: string };

export async function updateQuote(
  db: PrismaClient,
  args: {
    eventId: string;
    supplierId: string;
    quoteId: string;
    editorId: string;
    version: Date;
    quote: QuoteInput;
    now: Date;
  },
): Promise<UpdateQuoteResult> {
  return db.$transaction(async (tx) => {
    const supplierNumber = await lockSupplierForUpdates(tx, {
      eventId: args.eventId,
      supplierId: args.supplierId,
      userId: args.editorId,
    });
    if (supplierNumber === null) return { ok: false, reason: "not-found" } as const;

    const current = await tx.supplierQuote.findFirst({
      where: { id: args.quoteId, eventId: args.eventId, supplierId: args.supplierId },
      select: { number: true, amount: true, status: true, description: true, updatedAt: true },
    });
    if (!current) return { ok: false, reason: "not-found" } as const;
    if (current.updatedAt.getTime() !== args.version.getTime()) {
      return { ok: false, reason: "stale" } as const;
    }
    const reference = formatQuoteReference(current.number);
    const before: QuoteInput = {
      amount: current.amount.toFixed(2),
      status: current.status,
      description: current.description,
    };
    const changes = quoteChanges(before, args.quote);
    if (Object.keys(changes).length === 0) return { ok: true, changed: false, reference } as const;

    if (changes.status) {
      const accepted =
        args.quote.status === "ACCEPTED"
          ? await acceptedQuoteReference(tx, {
              eventId: args.eventId,
              supplierId: args.supplierId,
              exceptId: args.quoteId,
            })
          : null;
      const check = checkQuoteStatus(args.quote.status, accepted);
      if (!check.ok) return check;
    }

    await tx.supplierQuote.update({
      where: { id: args.quoteId },
      data: {
        amount: args.quote.amount,
        status: args.quote.status,
        description: args.quote.description,
        ...(changes.status ? { statusChangedAt: args.now } : {}),
      },
    });
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.editorId,
      action: "quote.updated",
      entityId: args.quoteId,
      details: {
        reference,
        supplierReference: formatSupplierReference(supplierNumber),
        changes,
      },
    });
    return { ok: true, changed: true, reference } as const;
  });
}