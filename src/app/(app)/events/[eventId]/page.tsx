// src/app/(app)/events/[eventId]/page.tsx
// Event overview (B1-04): event details and tiles for the Tier 1 sections. Checks access itself
// (shared, cached query with the layout). Shows the B1-02 "Event created" notice when arriving from
// Create Event; the reference in the URL is only displayed, and only if it is well formed.
import type { Metadata } from "next";
import { navigationFor } from "@/components/layout/navigation";
import {
  EventCreatedNotice,
  EventDetailsCard,
  SectionTiles,
  isEventReference,
  requireEventAccess,
} from "@/modules/events/public";

export const metadata: Metadata = { title: "Overview" };

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
      <h1 className="text-h2 font-extrabold">Overview</h1>
      {access.kind === "ok" ? <EventDetailsCard event={access.event} /> : null}
      <SectionTiles sections={sections} />
    </div>
  );
}