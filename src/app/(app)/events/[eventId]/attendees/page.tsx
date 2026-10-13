// src/app/(app)/events/[eventId]/attendees/page.tsx
// The event's guest list (B2-02). Every member can read it (event.view); Owners and Coordinators
// also get "Add attendee" and a link to edit each attendee (attendees.manage, D-035, B2-03). Checks access itself (D-027); the add action
// checks again. Search, filters and row actions arrive with their own tasks.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  AttendeeNotice,
  HeadcountSummary,
  AttendeeList,
  expectedHeadcount,
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

  // After adding (B2-02), editing (B2-03) or removing (B2-04). The reference is only displayed, and only if well
  // formed; the name comes from the stored attendee, never from the URL.
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const added = first(query.added);
  const saved = first(query.saved);
  const removed = first(query.removed);
  const notice = isAttendeeReference(added)
    ? ({ kind: "added", reference: added } as const)
    : isAttendeeReference(saved)
      ? ({ kind: "saved", reference: saved } as const)
      : isAttendeeReference(removed)
        ? ({ kind: "removed", reference: removed } as const)
        : null;
  const noticeName = notice
    ? attendees.find((a) => formatAttendeeReference(a.number) === notice.reference)?.name
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <AttendeeNotice kind={notice.kind} reference={notice.reference} name={noticeName} />
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
        <>
          {/* B2-05, D-046: the plus-one rule lives in expectedHeadcount, nowhere else. */}
          <HeadcountSummary headcount={expectedHeadcount(attendees)} />
          <AttendeeList
            attendees={attendees}
            editHref={canManage ? (id) => `/events/${event.id}/attendees/${id}/edit` : undefined}
          />
        </>
      )}
    </div>
  );
}