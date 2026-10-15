// src/app/(app)/events/[eventId]/suppliers/[supplierId]/payments/new/page.tsx
// Add a deposit or payment to a supplier (B4-14, D-077, D-079). Checks access itself (D-027).
// Owners and Coordinators get the form; Viewers get "You don't have access" and nothing is loaded
// for them. An unknown supplier, a malformed ID or another event's supplier is "not found". The
// action authorizes and validates again, so the page is never the security check.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import {
  PaymentForm,
  createPaymentAction,
  formatSupplierReference,
  getPaymentFormContext,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Add a payment" };

type Props = { params: Promise<{ eventId: string; supplierId: string }> };

export default async function AddPaymentPage({ params }: Props) {
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

  const result = await getPaymentFormContext(event.id, supplierId, null);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { supplier, today } = result;
  const supplierHref = `${listHref}/${supplier.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={supplierHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to {supplier.name}
      </Link>
      <p className="mt-4 font-mono text-[13px] text-ink-2">
        {formatSupplierReference(supplier.number)}
      </p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Add a payment to {supplier.name}</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <PaymentForm
          action={createPaymentAction.bind(null, event.id, supplier.id)}
          cancelHref={supplierHref}
          today={today}
        />
      </div>
    </div>
  );
}