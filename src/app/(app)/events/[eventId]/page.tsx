// src/app/(app)/events/[eventId]/page.tsx
// Event overview (B1-04): event details and tiles for the Tier 1 sections. Checks access itself
// (shared, cached query with the layout). Shows the B1-02 "Event created" notice when arriving from
// Create Event; the reference in the URL is only displayed, and only if it is well formed.
// Batch 8 makes it the dashboard (B8-F11 to B8-F13, D-107): Event Health status and score, the
// operational summaries, the attention list (top 5 issues) and, for Owners and Coordinators, recent
// activity. Accessibility gaps now show as one Event Health issue, which replaces the Batch 3
// accessibility alert here (D-107, point 4), so they appear once.
import type { Metadata } from "next";
import Link from "next/link";
import { navigationFor } from "@/components/layout/navigation";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import {
  HealthIssueList,
  HealthStatusPanel,
  HealthSummaryTiles,
  RecentActivityList,
  getEventHealth,
} from "@/modules/events/health/public";
import {
  EventCreatedNotice,
  EventDetailsCard,
  SectionTiles,
  can,
  isEventReference,
  requireEventAccess,
} from "@/modules/events/public";
import { eventNameForTitle } from "./event-title";

/** "Overview · Santos wedding · EventOps" (B1-13, D-038). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await eventNameForTitle((await params).eventId);
  return { title: name ? { absolute: `Overview · ${name} · EventOps` } : "Overview" };
}

/** How many issues the attention list shows; the rest are on the Health page (B8-F12, D-107). */
const ATTENTION_LIMIT = 5;

/** The health read authorizes itself; a failure is shown, never silently treated as "healthy". */
async function loadHealth(eventId: string) {
  try {
    const result = await getEventHealth(eventId, { withActivity: true });
    return result.ok ? result : null;
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventOverviewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const { created } = await searchParams;
  const reference = Array.isArray(created) ? created[0] : created;

  const health = await loadHealth(event.id);
  const base = `/events/${event.id}`;

  const sections = navigationFor(`/events/${eventId}`)
    .items.filter((item) => item.match === "prefix")
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex flex-col gap-8">
      {isEventReference(reference) ? <EventCreatedNotice reference={reference} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Overview</h1>
        {can(event.role, "event.edit") ? (
          <Button asChild variant="secondary">
            <Link href={`/events/${event.id}/settings`}>Edit event</Link>
          </Button>
        ) : null}
      </div>
      {!health ? (
        <Banner severity="warning" title="We couldn't check the event's health" role="status">
          Everything else on this page is up to date. Reload the page to try again.
        </Banner>
      ) : (
        <>
          <section aria-labelledby="overview-health" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="overview-health" className="text-h3 font-bold">
                Event health
              </h2>
              <Link
                href={`${base}/health`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
              >
                See every check
              </Link>
            </div>
            <HealthStatusPanel report={health.health} />
            <HealthSummaryTiles summary={health.health.summary} eventId={event.id} />
          </section>

          <section aria-labelledby="overview-attention" className="flex flex-col gap-4">
            <h2 id="overview-attention" className="text-h3 font-bold">
              Needs your attention
            </h2>
            {health.health.issues.length === 0 ? (
              <p role="status" className="rounded-xl bg-white p-5 text-sm text-ink-2 shadow-xs">
                {health.health.status === null
                  ? "Nothing to check yet."
                  : "Nothing needs your attention right now."}
              </p>
            ) : (
              <>
                <HealthIssueList
                  issues={health.health.issues.slice(0, ATTENTION_LIMIT)}
                  eventId={event.id}
                  label="Needs your attention"
                />
                <p className="flex flex-wrap gap-x-6">
                  {health.health.counts.CRITICAL > 0 ? (
                    <Link
                      href={`${base}/health?show=critical`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
                    >
                      View {health.health.counts.CRITICAL} critical{" "}
                      {health.health.counts.CRITICAL === 1 ? "issue" : "issues"}
                    </Link>
                  ) : null}
                  {health.health.issues.length > ATTENTION_LIMIT ? (
                    <Link
                      href={`${base}/health`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
                    >
                      See all {health.health.issues.length} issues
                    </Link>
                  ) : null}
                </p>
              </>
            )}
          </section>

          {health.activity.status !== "hidden" ? (
            <section aria-labelledby="overview-activity" className="flex flex-col gap-4">
              <h2 id="overview-activity" className="text-h3 font-bold">
                Recent activity
              </h2>
              {health.activity.status === "ok" ? (
                <RecentActivityList
                  entries={health.activity.entries}
                  activityHref={`${base}/activity`}
                />
              ) : (
                <Banner severity="warning" title="We couldn't load recent activity" role="status">
                  Open Activity to see every change.
                </Banner>
              )}
            </section>
          ) : null}
        </>
      )}
      <EventDetailsCard event={event} />
      <SectionTiles sections={sections} />
    </div>
  );
}