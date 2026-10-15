// src/app/(app)/events/[eventId]/suppliers/[supplierId]/quotes/new/page.tsx
// Add a quote to a supplier (B4-09, D-075, D-076). Checks access itself (D-027). Owners and
// Coordinators get the form; Viewers get "You don't have access" and nothing is loaded for them. An
// unknown supplier, a malformed ID or another event's supplier is "not found". The action
// authorizes again, so the page is never the security check.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import {
  QuoteForm,
  createQuoteAction,
  formatSupplierReference,
  getSupplierForEditing,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Add a quote" };

type Props = { params: Promise<{ eventId: string; supplierId: string }> };

export default async function AddQuotePage({ params }: Props) {
  const { eventId, supplierId } = await params;
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

  const result = await getSupplierForEditing(event.id, supplierId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { supplier } = result;
  const supplierHref = `${listHref}/${supplier.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={supplierHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to {supplier.name}
      </Link>
      <p className="mt-4 font-mono text-[13px] text-ink-2">
        {formatSupplierReference(supplier.number)}
      </p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Add a quote from {supplier.name}</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <QuoteForm
          action={createQuoteAction.bind(null, event.id, supplier.id)}
          cancelHref={supplierHref}
        />
      </div>
    </div>
  );
}