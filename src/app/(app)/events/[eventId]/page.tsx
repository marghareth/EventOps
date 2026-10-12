// src/app/(app)/events/[eventId]/page.tsx
// Event overview (B1-04): event details and tiles for the Tier 1 sections. Checks access itself
// (shared, cached query with the layout). Shows the B1-02 "Event created" notice when arriving from
// Create Event; the reference in the URL is only displayed, and only if it is well formed.
import type { Metadata } from "next";
import Link from "next/link";
import { navigationFor } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
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

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventOverviewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { access } = await requireEventAccess(eventId);
  const { created } = await searchParams;
  const reference = Array.isArray(created) ? created[0] : created;

  const sections = navigationFor(`/events/${eventId}`)
    .items.filter((item) => item.match === "prefix")
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex flex-col gap-8">
      {isEventReference(reference) ? <EventCreatedNotice reference={reference} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Overview</h1>
        {access.kind === "ok" && can(access.event.role, "event.edit") ? (
          <Button asChild variant="secondary">
            <Link href={`/events/${access.event.id}/settings`}>Edit event</Link>
          </Button>
        ) : null}
      </div>
      {access.kind === "ok" ? <EventDetailsCard event={access.event} /> : null}
      <SectionTiles sections={sections} />
    </div>
  );
}