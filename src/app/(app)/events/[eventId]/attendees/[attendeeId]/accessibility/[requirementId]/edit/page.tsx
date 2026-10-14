// src/app/(app)/events/[eventId]/attendees/[attendeeId]/accessibility/[requirementId]/edit/page.tsx
// Edit an accessibility need (B3-04), reached from "Edit" in the attendee's Accessibility section.
// Checks access itself (D-027). Owners and Coordinators get the form with the stored values and the
// stored version, so a save after someone else's is refused as stale (D-032); Remove sits below it.
// Viewers get "You don't have access" without the need being loaded. An unknown need, or one that
// belongs to another attendee or event, is "not found". The actions authorize again.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import {
  REQUIREMENT_TYPE_DEFINITIONS,
  RemoveRequirementSection,
  RequirementForm,
  deleteRequirementAction,
  getRequirementForEditing,
  toRequirementFormValues,
  updateRequirementAction,
} from "@/modules/events/accessibility/public";
import { formatAttendeeReference } from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Edit accessibility need", robots: { index: false } };

type Props = { params: Promise<{ eventId: string; attendeeId: string; requirementId: string }> };

export default async function EditRequirementPage({ params }: Props) {
  const { eventId, attendeeId, requirementId } = await params;
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

  const result = await getRequirementForEditing(event.id, attendeeId, requirementId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { attendee, requirement, takenTypes } = result;
  const attendeeHref = `${listHref}/${attendee.id}`;
  const label = REQUIREMENT_TYPE_DEFINITIONS[requirement.type].label;

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[13px] text-ink-2">{formatAttendeeReference(attendee.number)}</p>
      <h1 className="text-h2 font-extrabold wrap-break-word">
        Edit {label} for {attendee.name}
      </h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <RequirementForm
          action={updateRequirementAction.bind(null, event.id, attendee.id, requirement.id)}
          cancelHref={attendeeHref}
          takenTypes={takenTypes}
          mode="edit"
          saved={toRequirementFormValues(requirement)}
          version={requirement.updatedAt.toISOString()}
        />
      </div>
      <RemoveRequirementSection
        action={deleteRequirementAction.bind(null, event.id, attendee.id, requirement.id)}
        label={label}
        attendeeName={attendee.name}
      />
    </div>
  );
}