// src/modules/events/attendees/ui/HeadcountSummary.tsx
// The guest list's expected headcount (B2-05, D-046), from expectedHeadcount(). Labelled "from the
// guest list" so it is never mistaken for the event's planning number or for live attendance.
import { NavIcon } from "@/components/layout/NavIcon";
import { Decor } from "@/components/shared/Decor";
import { StateIcon } from "@/components/shared/StateIcon";
import type { ExpectedHeadcount } from "../headcount";

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
const attendees = (n: number) => (n === 1 ? "1 attendee" : `${n} attendees`);
const plusOnes = (n: number) => (n === 1 ? "1 plus-one" : `${n} plus-ones`);

export function HeadcountSummary({ headcount }: { headcount: ExpectedHeadcount }) {
  const { total, confirmedAttendees, confirmedPlusOnes, notYetConfirmed, declinedAttendees } =
    headcount;
  const tile = "relative flex flex-col gap-3 overflow-hidden rounded-[28px] p-5 shadow-xs";
  const label = "flex items-center gap-2.5 text-sm font-semibold";
  const figure =
    "font-display text-[44px] leading-none font-extrabold tracking-[-0.03em] tabular-nums";
  return (
    <section aria-labelledby="headcount-heading">
      <h2 id="headcount-heading" className="sr-only">
        Headcount from the guest list
      </h2>
      {/* D-118, D-119: bento tiles; the soft violet tile is the number that counts. */}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className={`${tile} bg-violet-soft text-ink`}>
          <Decor shape="flower" className="-right-14 -bottom-24 size-44 text-violet/25" />
          <dt className={`${label} relative`}>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-violet">
              <NavIcon name="users" className="size-4" />
            </span>
            Expected headcount
          </dt>
          <dd className="relative flex flex-col gap-2">
            <span className={figure}>{total}</span>
            <span className="text-sm text-ink-2">
              {confirmedAttendees} confirmed + {plusOnes(confirmedPlusOnes)}, from the guest list
            </span>
          </dd>
        </div>
        <div className={`${tile} bg-white`}>
          <dt className={`${label} text-ink-2`}>
            <span className="flex size-8 items-center justify-center rounded-full bg-lime-soft text-ink">
              <StateIcon name="warning" className="size-4" />
            </span>
            Not yet confirmed
          </dt>
          <dd className="flex flex-col gap-2">
            <span className={figure}>{notYetConfirmed.attendees}</span>
            <span className="text-sm text-ink-2">
              {attendees(notYetConfirmed.attendees)}, {people(notYetConfirmed.people)} with
              plus-ones. Not counted yet.
            </span>
          </dd>
        </div>
        <div className={`${tile} bg-white`}>
          <dt className={`${label} text-ink-2`}>
            <span className="flex size-8 items-center justify-center rounded-full bg-paper text-ink-2">
              <StateIcon name="info" className="size-4" />
            </span>
            Declined
          </dt>
          <dd className="flex flex-col gap-2">
            <span className={figure}>{declinedAttendees}</span>
            <span className="text-sm text-ink-2">Not counted.</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}