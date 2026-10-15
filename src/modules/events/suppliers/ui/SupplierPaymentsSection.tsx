// src/modules/events/suppliers/ui/SupplierPaymentsSection.tsx
// A supplier's deposits and payments on its detail page (B4-14; D-077 to D-079): the payment
// status against the Accepted quote, the overdue count, and each payment with its amount, due date
// and due status. Every member sees them; Owners and Coordinators also get Add payment and an Edit
// link per payment. Statuses come calculated from the server; amounts and dates are formatted from
// their canonical strings.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPeso } from "../money";
import { PAYMENT_KIND_DEFINITIONS } from "../payment-definitions";
import { formatCalendarDate, type PaymentDueStatus, type SupplierDueSummary } from "../payment-due";
import type { PaymentRecord } from "../payment-queries";
import { formatPaymentReference } from "../payment-schema";
import type { SupplierPaymentSummary } from "../payment-status";
import { PaymentDueBadge } from "./PaymentDueBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type Props = {
  payments: (PaymentRecord & { dueStatus: PaymentDueStatus })[];
  summary: SupplierPaymentSummary;
  due: SupplierDueSummary;
  /** The supplier's page; Add payment is `<supplierHref>/payments/new`. */
  supplierHref: string;
  canManage: boolean;
};

export function SupplierPaymentsSection({
  payments,
  summary,
  due,
  supplierHref,
  canManage,
}: Props) {
  return (
    <section
      aria-labelledby="supplier-payments-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="supplier-payments-heading" className="text-h4 font-bold">
          Deposits and payments
        </h2>
        {canManage ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`${supplierHref}/payments/new`}>Add payment</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Payment status: </span>
          <PaymentStatusBadge status={summary.status} />
          <span className="text-ink-2">
            {summary.committed
              ? `${formatPeso(summary.paid)} paid of the accepted ${formatPeso(summary.committed)} quote`
              : `${formatPeso(summary.paid)} paid. Accept a quote to know what's owed.`}
          </span>
        </p>
        {summary.overpaidBy ? (
          <p className="text-warning">
            {formatPeso(summary.overpaidBy)} more than the accepted quote has been paid.
          </p>
        ) : null}
        {due.overdueCount > 0 ? (
          <p className="font-semibold text-critical">
            {due.overdueCount === 1
              ? "1 payment is overdue."
              : `${due.overdueCount} payments are overdue.`}
          </p>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          No deposits or payments yet.{" "}
          {canManage
            ? "Add the deposit and any balance you owe, with their due dates."
            : "Owners and Coordinators can add them."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line">
          {payments.map((payment) => {
            const reference = formatPaymentReference(payment.number);
            return (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink-2">{reference}</p>
                  <p className="wrap-break-word">
                    {PAYMENT_KIND_DEFINITIONS[payment.kind].label}
                    {payment.description ? `: ${payment.description}` : ""}
                  </p>
                  <p className="text-sm text-ink-2">
                    Due {formatCalendarDate(payment.dueDate)}
                    {payment.paidOn ? ` · Paid ${formatCalendarDate(payment.paidOn)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="font-display text-lg font-bold tabular-nums">
                    <span className="sr-only">Amount: </span>
                    {formatPeso(payment.amount)}
                  </p>
                  <p>
                    <span className="sr-only">Due status: </span>
                    <PaymentDueBadge status={payment.dueStatus} />
                  </p>
                  {canManage ? (
                    <Link
                      href={`${supplierHref}/payments/${payment.id}/edit`}
                      aria-label={`Edit ${reference}`}
                      className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-blue underline-offset-2 hover:underline"
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}