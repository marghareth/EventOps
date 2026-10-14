// src/app/(app)/events/[eventId]/attendees/[attendeeId]/page.tsx
// Attendee details (B2-07, D-048; B2-13), opened from a name on the guest list. Every member can open it
// (event.view); the read loads only the fields the member's role may see, so the page never
// decides that. Owners and Coordinators also get "Edit attendee" (attendees.manage). An unknown
// attendee, a malformed ID or another event's attendee is "not found", like an unknown event.
// Batch 3 adds the Accessibility section from the accessibility module (B3-04, D-051), with its own
// read and its own notice after adding, editing or removing a need, and above it the alerts about
// this guest's needs (B3-11, D-066).
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
import {
  ACCESSIBILITY_NOTICES,
  AccessibilityAlertsUnavailable,
  AccessibilityNotice,
  AccessibilitySection,
  GuestAccessibilityAlerts,
  getAccessibilityAlerts,
  getAttendeeAccessibility,
  isRequirementType,
} from "@/modules/events/accessibility/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Attendee" };

type Props = {
  params: Promise<{ eventId: string; attendeeId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type Notice = { kind: (typeof ACCESSIBILITY_NOTICES)[number]; type: string };

/** Only a known notice and a known need type are read from the address; anything else is ignored. */
function noticeFrom(search: Record<string, string | string[] | undefined>): Notice | null {
  const kind = ACCESSIBILITY_NOTICES.find((k) => k === search.accessibility);
  return kind && isRequirementType(search.need) ? { kind, type: search.need } : null;
}

/** The section's data, or an error state so the rest of the page still works. */
async function loadAccessibility(eventId: string, attendeeId: string) {
  try {
    const result = await getAttendeeAccessibility(eventId, attendeeId);
    return result.ok ? ({ status: "ok", ...result } as const) : ({ status: "error" } as const);
  } catch {
    return { status: "error" } as const;
  }
}

/** This guest's alerts, or null when they couldn't be read (shown, never treated as none). */
async function loadAlerts(eventId: string, attendeeId: string) {
  try {
    const result = await getAccessibilityAlerts(eventId, { attendeeId });
    return result.ok ? result : null;
  } catch {
    return null;
  }
}

export default async function AttendeePage({ params, searchParams }: Props) {
  const { eventId, attendeeId } = await params;
  const notice = noticeFrom((await searchParams) ?? {});
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
  const [accessibility, alerts] = await Promise.all([
    loadAccessibility(event.id, attendee.id),
    loadAlerts(event.id, attendee.id),
  ]);
  const attendeeHref = `${listHref}/${attendee.id}`;

  return (
    <div className="max-w-3xl">
      <Link href={listHref} className="text-sm text-blue underline-offset-2 hover:underline">
        Back to the guest list
      </Link>
      {notice && isRequirementType(notice.type) ? (
        <div className="mt-4">
          <AccessibilityNotice kind={notice.kind} type={notice.type} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-2">
            {formatAttendeeReference(attendee.number)}
          </p>
          <h1 className="text-h2 font-extrabold wrap-break-word">{attendee.name}</h1>
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
        module's read and decides for itself what the role may see. The Accessibility section comes
        from modules/accessibility (its own read, authorized the same way, B3-04); no accessibility
        data or rules go into the attendees module.
      */}
      <div className="mt-6 flex flex-col gap-6">
        <AttendeeDetailsSection attendee={attendee} fields={fields} />
        <AttendeeNotesSection attendee={attendee} fields={fields} />
        {alerts ? (
          <GuestAccessibilityAlerts
            alerts={alerts.alerts}
            accessibilityPath={`/events/${event.id}/accessibility`}
            canManage={alerts.canManage}
          />
        ) : (
          <AccessibilityAlertsUnavailable />
        )}
        <AccessibilitySection
          attendeeHref={attendeeHref}
          attendeeName={attendee.name}
          data={accessibility}
        />
      </div>
    </div>
  );
}