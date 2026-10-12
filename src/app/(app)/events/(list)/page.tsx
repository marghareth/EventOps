// src/app/(app)/events/(list)/page.tsx
// My events (B1-03): the events the signed-in user is a member of. Loading and error states are in
// loading.tsx and error.tsx next to this page.
import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/shared/Banner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  EventDeletedNotice,
  EventList,
  getMyEvents,
  groupEvents,
  isEventReference,
} from "@/modules/events/public";

export const metadata: Metadata = { title: "My events" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/events");
  const result = await getMyEvents(user.id);
  // B1-06: after deleting an event. Displayed only if well formed; never trusted for anything else.
  const { deleted } = await searchParams;
  const deletedReference = Array.isArray(deleted) ? deleted[0] : deleted;

  return (
    <div className="flex flex-col gap-6">
      {isEventReference(deletedReference) ? (
        <EventDeletedNotice reference={deletedReference} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">My events</h1>
        <Button asChild>
          <Link href="/events/new">New event</Link>
        </Button>
      </div>

      {result.status === "no-database" ? (
        <Banner severity="info" title="No database connected">
          Demo sign-in has no events to show. Set DATABASE_URL in .env.local to see and create
          events.
        </Banner>
      ) : result.events.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No events yet"
            description="Events you create or are added to appear here."
            action={
              <Button asChild>
                <Link href="/events/new">Create an event</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <EventList groups={groupEvents(result.events, new Date())} />
      )}
    </div>
  );
}