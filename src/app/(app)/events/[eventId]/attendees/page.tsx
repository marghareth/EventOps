// src/app/(app)/events/[eventId]/attendees/page.tsx
// The event's guest list (B2-02). Every member can read it (event.view); Owners and Coordinators
// also get "Add attendee" (attendees.manage, D-035). Checks access itself (D-027); the add action
// checks again. Search, filters and row actions arrive with their own tasks.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  AttendeeAddedNotice,
  AttendeeList,
  formatAttendeeReference,
  getEventAttendees,
  isAttendeeReference,
} from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Attendees" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AttendeesPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const result = await getEventAttendees(event.id);
  if (!result.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState
          kind="forbidden"
          href={`/events/${event.id}`}
          linkLabel="Back to the overview"
        />
      </div>
    );
  }
  const { attendees } = result;
  const canManage = can(event.role, "attendees.manage");
  const addHref = `/events/${event.id}/attendees/new`;

  // B2-02: after adding. The reference is only displayed, and only if well formed; the name comes
  // from the attendee itself, never from the URL.
  const { added } = await searchParams;
  const addedReference = Array.isArray(added) ? added[0] : added;
  const addedAttendee = isAttendeeReference(addedReference)
    ? attendees.find((a) => formatAttendeeReference(a.number) === addedReference)
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {isAttendeeReference(addedReference) ? (
        <AttendeeAddedNotice reference={addedReference} name={addedAttendee?.name} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 font-extrabold">Attendees</h1>
          <p className="mt-1 text-sm text-ink-2">
            {attendees.length === 1 ? "1 attendee" : `${attendees.length} attendees`}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href={addHref}>Add attendee</Link>
          </Button>
        ) : null}
      </div>

      {attendees.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No attendees yet"
            description={
              canManage
                ? "Add your first guest to start the guest list."
                : "Owners and Coordinators can add guests to this event."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href={addHref}>Add the first attendee</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <AttendeeList attendees={attendees} />
      )}
    </div>
  );
}