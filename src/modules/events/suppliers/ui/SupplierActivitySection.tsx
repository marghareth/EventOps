// src/modules/events/suppliers/ui/SupplierActivitySection.tsx
// A supplier's recent Activity on its detail page (B4-07, D-074): the latest entries about the
// supplier (and its quotes, B4-09), newest first, worded by the audit context. The page renders this
// only for roles with audit.view; Viewers never get the entries (D-035).
import Link from "next/link";
import {
  describeAuditEntry,
  formatAuditTime,
  type AuditEntryView,
} from "@/modules/events/audit/public";

type Props = {
  entries: AuditEntryView[];
  /** The event's full Activity page. */
  activityHref: string;
  limit: number;
};

export function SupplierActivitySection({ entries, activityHref, limit }: Props) {
  return (
    <section
      aria-labelledby="supplier-activity-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="supplier-activity-heading" className="text-h4 font-bold">
        Recent activity
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">No changes recorded for this supplier yet.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Changes to this supplier, newest first. Showing up to the latest {limit}.
          </p>
          <ol className="mt-4 flex flex-col divide-y divide-line">
            {entries.map((entry) => {
              const { summary, lines } = describeAuditEntry(entry);
              return (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-ink-2">
                    <time dateTime={entry.createdAt.toISOString()}>
                      {formatAuditTime(entry.createdAt)}
                    </time>{" "}
                    · {entry.actorName ?? "Former member"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{summary}</p>
                  {lines.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-sm wrap-break-word text-ink-2">
                      {lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="mt-4 text-sm">
        <Link href={activityHref} className="text-blue underline-offset-2 hover:underline">
          See all event activity
        </Link>
      </p>
    </section>
  );
}