// src/modules/events/health/ui/RecentActivityList.tsx
// The latest Activity entries on the dashboard (B8-F13; D-107), worded by the existing activity feed
// (describeAuditEntry). Shown only to roles with audit.view; the page doesn't render it otherwise.
import Link from "next/link";

export function RecentActivityList({
  entries,
  activityHref,
}: {
  entries: readonly { id: string; summary: string; who: string; when: string }[];
  activityHref: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-ink-2 shadow-xs">
          No changes recorded yet.
        </p>
      ) : (
        <ol
          aria-label="Recent changes"
          className="flex flex-col divide-y divide-line rounded-xl bg-white shadow-xs"
        >
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 p-4">
              <span className="text-sm font-medium wrap-break-word">{entry.summary}</span>
              <span className="text-xs text-ink-3">
                {entry.who} · {entry.when}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p>
        <Link
          href={activityHref}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
        >
          See all activity
        </Link>
      </p>
    </div>
  );
}