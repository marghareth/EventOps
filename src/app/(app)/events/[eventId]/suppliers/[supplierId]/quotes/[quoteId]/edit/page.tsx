// src/app/(app)/events/[eventId]/suppliers/[supplierId]/quotes/[quoteId]/edit/page.tsx
// Edit a quote (B4-10, D-075, D-076). Checks access itself (D-027). Owners and Coordinators get the
// form with the stored values and the edit version (D-032); Viewers get "You don't have access" and
// nothing is loaded for them. An unknown quote, a malformed ID, another event's or another
// supplier's quote is "not found". The action authorizes again, so the page is never the security
// check.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import {
  QuoteForm,
  formatQuoteReference,
  getQuoteForEditing,
  toQuoteFormValues,
  updateQuoteAction,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Edit quote" };

type Props = { params: Promise<{ eventId: string; supplierId: string; quoteId: string }> };

export default async function EditQuotePage({ params }: Props) {
  const { eventId, supplierId, quoteId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/suppliers`;
  const refused = (
    <div className="rounded-xl bg-white shadow-xs">
      <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to suppliers" />
    </div>
  );
  if (!can(event.role, "suppliers.manage")) return refused;

  const result = await getQuoteForEditing(event.id, supplierId, quoteId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { supplier, quote } = result;
  const supplierHref = `${listHref}/${supplier.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={supplierHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to {supplier.name}
      </Link>
      <p className="mt-4 font-mono text-[13px] text-ink-2">{formatQuoteReference(quote.number)}</p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Edit a quote from {supplier.name}</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <QuoteForm
          action={updateQuoteAction.bind(null, event.id, supplier.id, quote.id)}
          cancelHref={supplierHref}
          mode="edit"
          saved={toQuoteFormValues(quote)}
          version={quote.updatedAt.toISOString()}
        />
      </div>
    </div>
  );
}