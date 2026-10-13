// src/app/(app)/events/[eventId]/attendees/[attendeeId]/edit/page.tsx
// Edit attendee (B2-03), with Remove attendee below the form (B2-04). Checks event access itself (D-027). Owners and Coordinators get the form
// with the stored values (attendees.manage, D-035); Viewers get "You don't have access". An unknown
// attendee, a malformed ID or another event's attendee is "not found", like an unknown event. The
// save action authorizes again, so the page is never the security check.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import {
  AttendeeForm,
  RemoveAttendeeSection,
  deleteAttendeeAction,
  formatAttendeeReference,
  getAttendeeForEditing,
  toAttendeeFormValues,
  updateAttendeeAction,
} from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Edit attendee" };

type Props = { params: Promise<{ eventId: string; attendeeId: string }> };

export default async function EditAttendeePage({ params }: Props) {
  const { eventId, attendeeId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/attendees`;

  if (!can(event.role, "attendees.manage")) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to attendees" />
      </div>
    );
  }

  const result = await getAttendeeForEditing(event.id, attendeeId);
  if (!result.ok) notFound();
  const { attendee } = result;

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[13px] text-ink-2">{formatAttendeeReference(attendee.number)}</p>
      <h1 className="text-h2 font-extrabold break-words">Edit {attendee.name}</h1>
      <p className="mt-2 text-ink-2">Only the name is required. Everything else is optional.</p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <AttendeeForm
          mode="edit"
          action={updateAttendeeAction.bind(null, event.id, attendee.id)}
          cancelHref={listHref}
          saved={toAttendeeFormValues(attendee)}
          version={attendee.updatedAt.toISOString()}
        />
      </div>
      <RemoveAttendeeSection
        action={deleteAttendeeAction.bind(null, event.id, attendee.id)}
        name={attendee.name}
        reference={formatAttendeeReference(attendee.number)}
      />
    </div>
  );
}