// src/app/(app)/events/[eventId]/page.tsx
// Event overview (B1-04): event details and tiles for the Tier 1 sections. Checks access itself
// (shared, cached query with the layout). Shows the B1-02 "Event created" notice when arriving from
// Create Event; the reference in the URL is only displayed, and only if it is well formed.
// Batch 3 adds the accessibility alert (B3-11, D-066) from the accessibility module's own read,
// shown only while the event is Not ready or Almost ready.
import type { Metadata } from "next";
import Link from "next/link";
import { navigationFor } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import {
  AccessibilityAlertsUnavailable,
  EventAccessibilityAlert,
  getAccessibilityAlerts,
} from "@/modules/events/accessibility/public";
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

/** The alert read authorizes itself; a failure is shown, never silently treated as "no alert". */
async function loadAccessibilityAlerts(eventId: string) {
  try {
    const result = await getAccessibilityAlerts(eventId);
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

  const alerts = await loadAccessibilityAlerts(event.id);

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
      {!alerts ? (
        <AccessibilityAlertsUnavailable />
      ) : alerts.event ? (
        <EventAccessibilityAlert
          alert={alerts.event}
          issues={alerts.alerts}
          accessibilityPath={`/events/${event.id}/accessibility`}
        />
      ) : null}
      <EventDetailsCard event={event} />
      <SectionTiles sections={sections} />
    </div>
  );
}