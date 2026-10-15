// src/modules/events/suppliers/ui/SupplierList.tsx
// The event's suppliers (B4-03, B4-16): one card per supplier with its readable ID, category,
// contact person, accepted quote (or pending quotes), payment status and next due date, for every
// member (D-068, D-081). Phone, email and notes are not shown in the list (D-073). Cards rather
// than a table, so nothing scrolls sideways on a phone; no totals or charts. Owners and
// Coordinators get an Edit link per supplier (B4-04). Each name opens the supplier's detail page
// (B4-07). Shows only what the server calculated; nothing is decided here.
import Link from "next/link";
import { supplierCategoryText } from "../categories";
import { formatPeso } from "../money";
import { formatCalendarDate } from "../payment-due";
import type { SupplierRecord } from "../queries";
import { formatSupplierReference } from "../schema";
import type { SupplierOverview } from "../supplier-overview";
import { PaymentDueBadge } from "./PaymentDueBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type Props = {
  suppliers: (SupplierRecord & { overview: SupplierOverview })[];
  /** The supplier list's path: each name links to `<basePath>/<id>` (B4-07). */
  basePath: string;
  /** Whether to offer an Edit link per supplier (the reader has suppliers.manage). */
  canEdit: boolean;
};

export function SupplierList({ suppliers, basePath, canEdit }: Props) {
  return (
    <section aria-labelledby="supplier-list-heading">
      <h2 id="supplier-list-heading" className="sr-only">
        Suppliers
      </h2>
      <p className="text-sm text-ink-2">
        {suppliers.length === 1 ? "1 supplier" : `${suppliers.length} suppliers`}
      </p>
      <ul className="mt-3 grid gap-4 md:grid-cols-2">
        {suppliers.map((supplier) => {
          const reference = formatSupplierReference(supplier.number);
          return (
            <li key={supplier.id} className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink-2">{reference}</p>
                  <h3 className="text-h4 font-bold wrap-break-word">
                    <Link
                      href={`${basePath}/${supplier.id}`}
                      // The tap area reaches 13 px above and below the name, so it is at least
                      // 44 px tall on a phone without moving the layout (B4-23).
                      className="relative underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-3.25 before:content-[''] hover:text-blue hover:underline"
                    >
                      {supplier.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-ink-2">
                    <span className="sr-only">Category: </span>
                    {supplierCategoryText(supplier.category, supplier.categoryDetail)}
                  </p>
                </div>
                {canEdit ? (
                  <Link
                    href={`${basePath}/${supplier.id}/edit`}
                    aria-label={`Edit ${supplier.name} (${reference})`}
                    className="-my-2.5 inline-flex min-h-11 min-w-11 shrink-0 items-center text-sm font-semibold text-blue underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                ) : null}
              </div>
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold text-ink-2">Contact</dt>
                <dd className="wrap-break-word">{supplier.contactName ?? "Not recorded"}</dd>
                <dt className="font-semibold text-ink-2">Quote</dt>
                <dd>{quoteText(supplier.overview)}</dd>
                <dt className="font-semibold text-ink-2">Payment</dt>
                <dd>
                  <PaymentStatusBadge status={supplier.overview.paymentStatus} />
                  {supplier.overview.due.overdueCount > 1 ? (
                    <span className="ml-2 font-semibold text-critical">
                      {supplier.overview.due.overdueCount} overdue
                    </span>
                  ) : null}
                </dd>
                <dt className="font-semibold text-ink-2">Next due</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {supplier.overview.due.next ? (
                    <>
                      <span>{formatCalendarDate(supplier.overview.due.next.dueDate)}</span>
                      <PaymentDueBadge status={supplier.overview.due.next.dueStatus} />
                    </>
                  ) : (
                    "Nothing due"
                  )}
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "₱165,000.00 accepted", or what is pending when no quote is accepted. */
function quoteText(overview: SupplierOverview): string {
  if (overview.acceptedQuote) return `${formatPeso(overview.acceptedQuote)} accepted`;
  if (overview.pendingQuotes === 0) return "No quotes yet";
  return overview.pendingQuotes === 1
    ? "None accepted, 1 pending"
    : `None accepted, ${overview.pendingQuotes} pending`;
}