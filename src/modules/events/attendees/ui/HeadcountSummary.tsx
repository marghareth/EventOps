// src/modules/events/attendees/ui/HeadcountSummary.tsx
// The guest list's expected headcount (B2-05, D-046), from expectedHeadcount(). Labelled "from the
// guest list" so it is never mistaken for the event's planning number or for live attendance.
import type { ExpectedHeadcount } from "../headcount";

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
const attendees = (n: number) => (n === 1 ? "1 attendee" : `${n} attendees`);
const plusOnes = (n: number) => (n === 1 ? "1 plus-one" : `${n} plus-ones`);

export function HeadcountSummary({ headcount }: { headcount: ExpectedHeadcount }) {
  const { total, confirmedAttendees, confirmedPlusOnes, notYetConfirmed, declinedAttendees } =
    headcount;
  return (
    <section aria-labelledby="headcount-heading" className="rounded-xl bg-white p-5 shadow-xs">
      <h2 id="headcount-heading" className="sr-only">
        Headcount from the guest list
      </h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-semibold text-ink-2">Expected headcount</dt>
          <dd className="mt-1">
            <span className="font-display text-h2 font-extrabold tabular-nums">{total}</span>
            <span className="mt-1 block text-sm text-ink-2">
              {confirmedAttendees} confirmed + {plusOnes(confirmedPlusOnes)}, from the guest list
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink-2">Not yet confirmed</dt>
          <dd className="mt-1">
            <span className="font-display text-h3 font-bold tabular-nums">
              {notYetConfirmed.attendees}
            </span>
            <span className="mt-1 block text-sm text-ink-2">
              {attendees(notYetConfirmed.attendees)}, {people(notYetConfirmed.people)} with
              plus-ones. Not counted yet.
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink-2">Declined</dt>
          <dd className="mt-1">
            <span className="font-display text-h3 font-bold tabular-nums">{declinedAttendees}</span>
            <span className="mt-1 block text-sm text-ink-2">Not counted.</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}