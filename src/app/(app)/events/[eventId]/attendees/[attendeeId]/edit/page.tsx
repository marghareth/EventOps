// src/app/(app)/events/[eventId]/attendees/[attendeeId]/page.tsx
// Attendee details (B2-07, D-048; B2-13), opened from a name on the guest list. Every member can open it
// (event.view); the read loads only the fields the member's role may see, so the page never
// decides that. Owners and Coordinators also get "Edit attendee" (attendees.manage). An unknown
// attendee, a malformed ID or another event's attendee is "not found", like an unknown event.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  AttendeeDetailsSection,
  AttendeeNotesSection,
  RsvpBadge,
  formatAttendeeReference,
  getAttendeeDetails,
} from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Attendee" };

type Props = { params: Promise<{ eventId: string; attendeeId: string }> };

export default async function AttendeePage({ params }: Props) {
  const { eventId, attendeeId } = await params;
  // Membership is checked here too, not only in the event layout (D-027).
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/attendees`;

  const result = await getAttendeeDetails(event.id, attendeeId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to attendees" />
      </div>
    );
  }
  const { attendee, fields } = result;

  return (
    <div className="max-w-3xl">
      <Link href={listHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to the guest list
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-2">
            {formatAttendeeReference(attendee.number)}
          </p>
          <h1 className="text-h2 font-extrabold break-words">{attendee.name}</h1>
          <p className="mt-2">
            <span className="sr-only">RSVP: </span>
            <RsvpBadge status={attendee.rsvpStatus} />
          </p>
        </div>
        {can(event.role, "attendees.manage") ? (
          <Button asChild>
            <Link href={`${listHref}/${attendee.id}/edit`}>Edit attendee</Link>
          </Button>
        ) : null}
      </div>
      {/*
        The page is a list of independent sections (B2-13). Each section gets its data from its own
        module's read and decides for itself what the role may see. Batch 3 adds the attendee's
        accessibility section here, from modules/accessibility (its own read, authorized the same
        way); no accessibility data or rules go into the attendees module.
      */}
      <div className="mt-6 flex flex-col gap-6">
        <AttendeeDetailsSection attendee={attendee} fields={fields} />
        <AttendeeNotesSection attendee={attendee} fields={fields} />
      </div>
    </div>
  );
}