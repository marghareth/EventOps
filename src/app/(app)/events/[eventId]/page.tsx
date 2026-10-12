// src/app/(app)/events/[eventId]/page.tsx
// Event overview. Still a placeholder (D-019) until the Event Health task; shows the B1-02
// "Event created" notice when arriving from Create Event. The reference comes from the URL, so it
// is shown only if it is well formed; it is never trusted for anything else.
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { EventCreatedNotice, isEventReference } from "@/modules/events/public";

export const metadata: Metadata = { title: "Overview" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { created } = await searchParams;
  const reference = Array.isArray(created) ? created[0] : created;
  return (
    <>
      {isEventReference(reference) ? <EventCreatedNotice reference={reference} /> : null}
      <PagePlaceholder title="Overview" />
    </>
  );
}