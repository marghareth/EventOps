// src/app/(app)/events/[eventId]/attendees/page.tsx
// The event's guest list (B2-02). Every member can read it (event.view); Owners and Coordinators
// also get "Add attendee" (attendees.manage, D-035). Every name opens the attendee's details (B2-07),
// where editing starts. The table can be searched, filtered and sorted (B2-08..B2-12, D-049, D-050). Dietary
// needs show for roles with attendees.dietary (B2-06, D-047). Checks access itself (D-027); the add
// action checks again. Search, filters and row actions arrive with their own tasks.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  AttendeeNotice,
  HeadcountSummary,
  AttendeeList,
  RSVP_LABEL,
  GuestListControls,
  RsvpFilter,
  SORT_LABEL,
  applyGuestListQuery,
  categoriesOf,
  describeCriteria,
  expectedHeadcount,
  formatAttendeeReference,
  getEventAttendees,
  guestListQueryString,
  hasCriteriaBeyondRsvp,
  isAttendeeReference,
  isNarrowed,
  parseGuestListQuery,
  rsvpCounts,
  type GuestListQuery,
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
  const { attendees, showDietaryNeeds } = result;
  // Email and phone search only for roles that receive them (attendees.private, D-048, D-050).
  const canSearchContact = can(event.role, "attendees.private");
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
  // B2-08..B2-12, D-049, D-050: RSVP, search, filters and sort from the address, applied to the
  // guest list the server authorized for this role. Unknown values are ignored. The headcount
  // summary and the RSVP counts always cover the whole guest list; only the table changes.
  const categories = categoriesOf(attendees);
  const listQuery = parseGuestListQuery(query, {
    categories,
    dietaryVisible: showDietaryNeeds,
  });
  const shown = applyGuestListQuery(attendees, listQuery);
  const listHref = `/events/${event.id}/attendees`;
  const hrefFor = (change: Partial<GuestListQuery>) =>
    `${listHref}${guestListQueryString({ ...listQuery, ...change })}`;
  const total = attendees.length === 1 ? "1 attendee" : `${attendees.length} attendees`;
  const countText = !isNarrowed(listQuery)
    ? total
    : hasCriteriaBeyondRsvp(listQuery)
      ? `${shown.length} of ${total} match`
      : `${shown.length} of ${total}, ${RSVP_LABEL[listQuery.rsvp!]}`;
  const criteria = describeCriteria(listQuery);
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
          <p className="mt-1 text-sm text-ink-2">{countText}</p>
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
          <GuestListControls
            listHref={listHref}
            query={listQuery}
            categories={categories}
            dietaryVisible={showDietaryNeeds}
            contactSearch={canSearchContact}
          />
          <RsvpFilter
            hrefFor={(rsvp) => hrefFor({ rsvp })}
            current={listQuery.rsvp}
            counts={rsvpCounts(attendees)}
            total={attendees.length}
          />
          {shown.length === 0 ? (
            <div className="rounded-xl bg-white shadow-xs">
              {hasCriteriaBeyondRsvp(listQuery) ? (
                <EmptyState
                  headingLevel={2}
                  title="No attendees match"
                  description={`${criteria.join(" · ")}. Change the search or filters, or clear them.`}
                  action={
                    <Button asChild variant="secondary">
                      <Link href={listHref}>Clear search and filters</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  headingLevel={2}
                  title={`No ${RSVP_LABEL[listQuery.rsvp!]} attendees`}
                  description="Choose another RSVP above, or show everyone."
                  action={
                    <Button asChild variant="secondary">
                      <Link href={hrefFor({ rsvp: null })}>Show everyone</Link>
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <AttendeeList
              attendees={shown}
              showDietaryNeeds={showDietaryNeeds}
              detailsHref={(id) => `/events/${event.id}/attendees/${id}`}
              sort={{
                column: listQuery.sort,
                direction: listQuery.dir === "desc" ? "descending" : "ascending",
                label: SORT_LABEL[listQuery.sort],
              }}
            />
          )}
        </>
      )}
    </div>
  );
}