// src/app/(app)/events/[eventId]/suppliers/[supplierId]/page.tsx
// Supplier details (B4-07, D-074), opened from a name on the supplier list. Every member can open it
// (event.view) and see the supplier's identity, category and contacts (D-068, D-073). Owners and
// Coordinators also get Edit supplier (suppliers.manage) and the supplier's recent Activity
// (audit.view). Checks membership itself (D-027); the read authorizes again and finds the supplier
// only inside this event, so an unknown supplier, a malformed ID or another event's supplier is
// "not found". The Quotes section (B4-09, D-075) lists the supplier's quotes for every member, with
// Add quote for Owners and Coordinators. The Deposits and payments section (B4-14, D-077 to D-079)
// shows the payment status, overdue payments and each payment, all calculated on the server.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import { requireEventAccess } from "@/modules/events/public";
import {
  PaymentNotice,
  QuoteNotice,
  SUPPLIER_ACTIVITY_LIMIT,
  SupplierActivitySection,
  SupplierContactSection,
  SupplierPaymentsSection,
  SupplierQuotesSection,
  formatSupplierReference,
  getSupplierDetail,
  isPaymentReference,
  isQuoteReference,
  supplierCategoryText,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Supplier" };

type Props = {
  params: Promise<{ eventId: string; supplierId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupplierPage({ params, searchParams }: Props) {
  const { eventId, supplierId } = await params;
  // After adding or editing a quote: only a well-formed quote reference is read from the address.
  const search = (await searchParams) ?? {};
  const quoteNotice = isQuoteReference(search.quoteAdded)
    ? ({ kind: "added", reference: search.quoteAdded } as const)
    : isQuoteReference(search.quoteSaved)
      ? ({ kind: "saved", reference: search.quoteSaved } as const)
      : null;
  const paymentNotice = isPaymentReference(search.paymentAdded)
    ? ({ kind: "added", reference: search.paymentAdded } as const)
    : isPaymentReference(search.paymentSaved)
      ? ({ kind: "saved", reference: search.paymentSaved } as const)
      : null;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/suppliers`;

  const result = await getSupplierDetail(event.id, supplierId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to suppliers" />
      </div>
    );
  }
  const { supplier, quotes, payments, paymentSummary, dueSummary, canManage, activity } = result;
  const reference = formatSupplierReference(supplier.number);
  const supplierHref = `${listHref}/${supplier.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={listHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to suppliers
      </Link>
      {paymentNotice ? (
        <div className="mt-4">
          <PaymentNotice kind={paymentNotice.kind} reference={paymentNotice.reference} />
        </div>
      ) : null}
      {quoteNotice ? (
        <div className="mt-4">
          <QuoteNotice kind={quoteNotice.kind} reference={quoteNotice.reference} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-2">{reference}</p>
          <h1 className="text-h2 font-extrabold wrap-break-word">{supplier.name}</h1>
          <p className="mt-1 text-ink-2">
            <span className="sr-only">Category: </span>
            {supplierCategoryText(supplier.category, supplier.categoryDetail)}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href={`${supplierHref}/edit`}>Edit supplier</Link>
          </Button>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <SupplierContactSection supplier={supplier} />
        <SupplierQuotesSection quotes={quotes} supplierHref={supplierHref} canManage={canManage} />
        <SupplierPaymentsSection
          payments={payments}
          summary={paymentSummary}
          due={dueSummary}
          supplierHref={supplierHref}
          canManage={canManage}
        />
        {activity ? (
          <SupplierActivitySection
            entries={activity}
            activityHref={`/events/${event.id}/activity`}
            limit={SUPPLIER_ACTIVITY_LIMIT}
          />
        ) : null}
      </div>
    </div>
  );
}