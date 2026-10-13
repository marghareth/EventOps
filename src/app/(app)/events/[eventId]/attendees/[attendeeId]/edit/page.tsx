// src/app/(app)/events/[eventId]/attendees/[attendeeId]/edit/page.tsx
// Edit attendee (B2-03, D-044), reached from "Edit attendee" on the attendee details page. Checks
// access itself (D-027). Owners and Coordinators get the form with the stored values and the
// stored version, so a save after someone else's is refused as stale (D-032); Remove attendee sits
// below it (B2-04, D-045). Viewers get "You don't have access" without the attendee being loaded,
// even when they type the URL. An unknown attendee, a malformed ID or another event's attendee is
// "not found", like an unknown event. The actions authorize again, so the page is never the check.
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

export const metadata: Metadata = { title: "Edit attendee", robots: { index: false } };

type Props = { params: Promise<{ eventId: string; attendeeId: string }> };

export default async function EditAttendeePage({ params }: Props) {
  const { eventId, attendeeId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/attendees`;

  const refused = (
    <div className="rounded-xl bg-white shadow-xs">
      <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to attendees" />
    </div>
  );
  // Checked before loading, so a Viewer's request never reads the attendee's private fields.
  if (!can(event.role, "attendees.manage")) return refused;

  const result = await getAttendeeForEditing(event.id, attendeeId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { attendee } = result;
  const reference = formatAttendeeReference(attendee.number);

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[13px] text-ink-2">{reference}</p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Edit {attendee.name}</h1>
      <p className="mt-2 text-ink-2">Only the name is required. Everything else is optional.</p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <AttendeeForm
          action={updateAttendeeAction.bind(null, event.id, attendee.id)}
          cancelHref={listHref}
          mode="edit"
          saved={toAttendeeFormValues(attendee)}
          version={attendee.updatedAt.toISOString()}
        />
      </div>
      <RemoveAttendeeSection
        action={deleteAttendeeAction.bind(null, event.id, attendee.id)}
        name={attendee.name}
        reference={reference}
      />
    </div>
  );
}