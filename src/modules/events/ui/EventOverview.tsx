// src/modules/events/ui/EventOverview.tsx
// Event overview (B1-04): the event's details card. The section tiles were removed in D-118.
import {
  formatCapacity,
  formatEventWhen,
  formatExpectedAttendees,
  type EventDetails,
} from "../list";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase">{label}</dt>
      <dd className="min-w-0 text-sm wrap-break-word whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function EventDetailsCard({ event }: { event: EventDetails }) {
  return (
    <section aria-labelledby="event-details" className="rounded-xl bg-white p-5 shadow-xs sm:p-6">
      <h2 id="event-details" className="text-h4 font-bold">
        Event details
      </h2>
      <dl className="mt-4 flex flex-col gap-3">
        <Detail label="When">{formatEventWhen(event.startsAt, event.endsAt)}</Detail>
        <Detail label="Venue">{event.venue ?? "Not set"}</Detail>
        <Detail label="Venue capacity">{formatCapacity(event.capacity)}</Detail>
        <Detail label="Expected attendees">
          {formatExpectedAttendees(event.expectedAttendees)}
        </Detail>
        <Detail label="Description">{event.description ?? "None yet"}</Detail>
      </dl>
    </section>
  );
}