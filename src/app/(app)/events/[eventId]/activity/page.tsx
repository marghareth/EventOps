// src/app/(app)/events/[eventId]/activity/page.tsx
// Activity (B1-11): the event's audit log, newest first, for Owners and Coordinators (audit.view,
// D-035). Checks membership itself (D-027); getEventActivity checks the role on the server.
import type { Metadata } from "next";
import { Banner } from "@/components/shared/Banner";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { describeAuditEntry, formatAuditTime } from "@/modules/events/audit/public";
import { getEventActivity, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { access } = await requireEventAccess(eventId);

  if (access.kind === "no-database") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h2 font-extrabold">Activity</h1>
        <Banner severity="info" title="No database connected">
          Demo sign-in has no activity to show. Set DATABASE_URL in .env.local.
        </Banner>
      </div>
    );
  }

  const activity = await getEventActivity(access.event.id);
  if (!activity.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState
          kind="forbidden"
          href={`/events/${access.event.id}`}
          linkLabel="Back to the overview"
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-h2 font-extrabold">Activity</h1>
        <p className="mt-2 text-ink-2">
          Important changes to this event, newest first. Showing up to the latest 100.
        </p>
      </div>
      {activity.entries.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState headingLevel={2} title="No activity yet" />
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {activity.entries.map((entry) => {
            const { summary, lines } = describeAuditEntry(entry);
            return (
              <li key={entry.id} className="rounded-xl bg-white p-5 shadow-xs">
                <p className="text-sm text-ink-2">
                  <time dateTime={entry.createdAt.toISOString()}>
                    {formatAuditTime(entry.createdAt)}
                  </time>{" "}
                  · {entry.actorName ?? "Former member"}
                </p>
                <p className="mt-1 font-semibold">{summary}</p>
                {lines.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-sm break-words text-ink-2">
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}