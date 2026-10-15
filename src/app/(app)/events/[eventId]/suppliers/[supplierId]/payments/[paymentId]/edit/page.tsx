// src/app/(app)/events/[eventId]/suppliers/[supplierId]/payments/[paymentId]/edit/page.tsx
// Edit a deposit or payment (B4-14, D-077, D-079). Checks access itself (D-027). Owners and
// Coordinators get the form with the stored values and the edit version (D-032); Viewers get "You
// don't have access" and nothing is loaded for them. An unknown payment, a malformed ID, another
// event's or another supplier's payment is "not found". The action authorizes and validates again.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import {
  PaymentForm,
  formatPaymentReference,
  getPaymentFormContext,
  toPaymentFormValues,
  updatePaymentAction,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Edit payment" };

type Props = { params: Promise<{ eventId: string; supplierId: string; paymentId: string }> };

export default async function EditPaymentPage({ params }: Props) {
  const { eventId, supplierId, paymentId } = await params;
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

  const result = await getPaymentFormContext(event.id, supplierId, paymentId);
  if (!result.ok || !result.payment) {
    if (!result.ok && result.reason !== "not-found") return refused;
    notFound();
  }
  const { supplier, payment, today } = result;
  const supplierHref = `${listHref}/${supplier.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={supplierHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to {supplier.name}
      </Link>
      <p className="mt-4 font-mono text-[13px] text-ink-2">
        {formatPaymentReference(payment.number)}
      </p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Edit a payment to {supplier.name}</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <PaymentForm
          action={updatePaymentAction.bind(null, event.id, supplier.id, payment.id)}
          cancelHref={supplierHref}
          today={today}
          mode="edit"
          saved={toPaymentFormValues(payment)}
          version={payment.updatedAt.toISOString()}
        />
      </div>
    </div>
  );
}