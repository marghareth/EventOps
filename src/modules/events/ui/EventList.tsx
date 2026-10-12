// src/modules/events/ui/EventList.tsx
// "My events" cards (B1-03). Each card is one link to the event's workspace; the link covers the
// whole card. Status and role are written as text, never shown by color alone.
import Link from "next/link";
import {
  formatEventWhen,
  formatExpectedAttendees,
  type EventGroups,
  type EventListItem,
} from "../list";
import { EventStatusBadge, RoleBadge } from "./EventBadges";

function EventCard({ event }: { event: EventListItem }) {
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-xl bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <h3 className="text-h4 leading-snug font-bold break-words">
        <Link
          href={`/events/${event.id}`}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:shadow-none focus-visible:after:shadow-(--ring)"
        >
          {event.name}
        </Link>
      </h3>
      <dl className="grid gap-1 text-sm text-ink-2">
        <div>
          <dt className="sr-only">Reference</dt>
          <dd className="font-mono text-[13px]">{event.reference}</dd>
        </div>
        <div>
          <dt className="sr-only">When</dt>
          <dd>{formatEventWhen(event.startsAt, event.endsAt)}</dd>
        </div>
        {event.venue ? (
          <div>
            <dt className="sr-only">Venue</dt>
            <dd className="break-words">{event.venue}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Expected attendees</dt>
          <dd>{formatExpectedAttendees(event.expectedAttendees)}</dd>
        </div>
      </dl>
      <dl className="mt-auto flex flex-wrap gap-2 pt-1">
        <div>
          <dt className="sr-only">Status</dt>
          <dd>
            <EventStatusBadge status={event.status} />
          </dd>
        </div>
        <div>
          <dt className="sr-only">Your role</dt>
          <dd>
            <RoleBadge role={event.role} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

function EventSection({ title, events }: { title: string; events: EventListItem[] }) {
  if (events.length === 0) return null;
  const headingId = `events-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-h4 font-bold">
        {title} <span className="font-normal text-ink-3">({events.length})</span>
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EventList({ groups }: { groups: EventGroups }) {
  return (
    <div className="flex flex-col gap-10">
      <EventSection title="Upcoming" events={groups.upcoming} />
      <EventSection title="Past" events={groups.past} />
    </div>
  );
}