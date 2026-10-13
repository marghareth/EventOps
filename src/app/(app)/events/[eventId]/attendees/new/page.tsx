// src/app/(app)/events/[eventId]/attendees/new/page.tsx
// Add attendee (B2-02). Checks access itself (D-027). Owners and Coordinators get the form
// (attendees.manage, D-035); Viewers get "You don't have access", even when they type the URL. The
// action authorizes again, so the page is never the security check.
import type { Metadata } from "next";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { AttendeeForm, createAttendeeAction } from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Add attendee" };

export default async function AddAttendeePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const listHref = `/events/${event.id}/attendees`;

  if (!can(event.role, "attendees.manage")) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to attendees" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">Add an attendee</h1>
      <p className="mt-2 text-ink-2">Only the name is required. Everything else is optional.</p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <AttendeeForm action={createAttendeeAction.bind(null, event.id)} cancelHref={listHref} />
      </div>
    </div>
  );
}