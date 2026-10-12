// src/modules/events/ui/EventOverview.tsx
// Event overview (B1-04): the event's details and tiles for the sections that will hold its
// operations. No module data yet; each tile says so.
import Link from "next/link";
import {
  formatCapacity,
  formatEventWhen,
  formatExpectedAttendees,
  type EventDetails,
} from "../list";

export type SectionTile = { href: string; label: string };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm font-semibold text-ink-2 sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line">{children}</dd>
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

export function SectionTiles({ sections }: { sections: SectionTile[] }) {
  return (
    <section aria-labelledby="event-sections">
      <h2 id="event-sections" className="text-h4 font-bold">
        Sections
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex h-full min-h-11 flex-col gap-1 rounded-xl bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="font-display font-bold">{section.label}</span>
              <span className="text-sm text-ink-3">Not set up yet</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}