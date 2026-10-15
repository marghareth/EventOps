// src/modules/events/suppliers/ui/SupplierQuotesSection.tsx
// A supplier's quotes on its detail page (B4-09, D-075, D-076): each quote's readable ID,
// description, amount in pesos and status (a badge with an icon and label). Every member sees
// them; Owners and Coordinators also get Add quote and an Edit link per quote (B4-10). Shows only what the server sends; amounts are
// formatted from their canonical strings, never converted to numbers.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPeso } from "../money";
import type { QuoteRecord } from "../quote-queries";
import { formatQuoteReference } from "../quote-schema";
import { QuoteStatusBadge } from "./QuoteStatusBadge";

type Props = {
  quotes: QuoteRecord[];
  /** The supplier's page; Add quote is `<supplierHref>/quotes/new`. */
  supplierHref: string;
  canManage: boolean;
};

export function SupplierQuotesSection({ quotes, supplierHref, canManage }: Props) {
  return (
    <section
      aria-labelledby="supplier-quotes-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="supplier-quotes-heading" className="text-h4 font-bold">
          Quotes
        </h2>
        {canManage ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`${supplierHref}/quotes/new`}>Add quote</Link>
          </Button>
        ) : null}
      </div>
      {quotes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">
          No quotes yet.{" "}
          {canManage
            ? "Add the first price this supplier gave you."
            : "Owners and Coordinators can add quotes."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {quotes.map((quote) => {
            const reference = formatQuoteReference(quote.number);
            return (
              <li
                key={quote.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink-2">{reference}</p>
                  <p className="wrap-break-word">{quote.description ?? "No description"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="font-display text-lg font-bold tabular-nums">
                    <span className="sr-only">Amount: </span>
                    {formatPeso(quote.amount)}
                  </p>
                  <p>
                    <span className="sr-only">Status: </span>
                    <QuoteStatusBadge status={quote.status} />
                  </p>
                  {canManage ? (
                    <Link
                      href={`${supplierHref}/quotes/${quote.id}/edit`}
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