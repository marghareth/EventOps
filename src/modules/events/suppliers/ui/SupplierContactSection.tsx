// src/modules/events/suppliers/ui/SupplierContactSection.tsx
// A supplier's contact details on its detail page (B4-07, D-073, D-074): contact person, phone and
// email as links, and notes, for every member (D-068). Missing values say "Not recorded". Shows only
// what the server sends.
import type { SupplierRecord } from "../queries";

type Props = {
  supplier: Pick<SupplierRecord, "contactName" | "phone" | "email" | "notes">;
};

const linkClass =
  "inline-flex min-h-11 items-center text-blue underline underline-offset-2 sm:min-h-6";

export function SupplierContactSection({ supplier }: Props) {
  return (
    <section
      aria-labelledby="supplier-contact-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="supplier-contact-heading" className="text-h4 font-bold">
        Contact
      </h2>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-ink-2">Contact person</dt>
        <dd className="wrap-break-word">{supplier.contactName ?? "Not recorded"}</dd>
        <dt className="font-semibold text-ink-2">Phone</dt>
        <dd>
          {supplier.phone ? (
            <a href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
              {supplier.phone}
            </a>
          ) : (
            "Not recorded"
          )}
        </dd>
        <dt className="font-semibold text-ink-2">Email</dt>
        <dd className="break-all">
          {supplier.email ? (
            <a href={`mailto:${supplier.email}`} className={linkClass}>
              {supplier.email}
            </a>
          ) : (
            "Not recorded"
          )}
        </dd>
        <dt className="font-semibold text-ink-2">Notes</dt>
        <dd className="wrap-break-word whitespace-pre-wrap">{supplier.notes ?? "None"}</dd>
      </dl>
    </section>
  );
}