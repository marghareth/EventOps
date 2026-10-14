// src/app/(app)/events/[eventId]/attendees/[attendeeId]/accessibility/new/page.tsx
// Add an accessibility need (B3-04), reached from the attendee's details page. Checks access itself
// (D-027). Owners and Coordinators get the form (accessibility.manage); Viewers get "You don't have
// access", even when they type the URL, without the attendee being loaded. An unknown attendee or
// another event's attendee is "not found". The action authorizes again; the page is never the check.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  RequirementForm,
  createRequirementAction,
  getNewRequirementContext,
} from "@/modules/events/accessibility/public";
import { formatAttendeeReference } from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Add accessibility need", robots: { index: false } };

const ALL_TYPES = 7;

type Props = { params: Promise<{ eventId: string; attendeeId: string }> };

export default async function NewRequirementPage({ params }: Props) {
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
  if (!can(event.role, "accessibility.manage")) return refused;

  const context = await getNewRequirementContext(event.id, attendeeId);
  if (!context.ok) {
    if (context.reason === "not-found") notFound();
    return refused;
  }
  const { attendee, takenTypes } = context;
  const attendeeHref = `${listHref}/${attendee.id}`;

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[13px] text-ink-2">{formatAttendeeReference(attendee.number)}</p>
      <h1 className="text-h2 font-extrabold wrap-break-word">
        Add an accessibility need for {attendee.name}
      </h1>
      <p className="mt-2 text-ink-2">
        Record one need at a time. Choose what the guest needs and how important it is.
      </p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        {takenTypes.length >= ALL_TYPES ? (
          <EmptyState
            title="Every listed need is already recorded"
            description="Edit an existing need from the guest's details instead."
            action={
              <Button asChild>
                <Link href={attendeeHref}>Back to {attendee.name}</Link>
              </Button>
            }
            headingLevel={2}
          />
        ) : (
          <RequirementForm
            action={createRequirementAction.bind(null, event.id, attendee.id)}
            cancelHref={attendeeHref}
            takenTypes={takenTypes}
          />
        )}
      </div>
    </div>
  );
}