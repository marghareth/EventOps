// src/modules/events/ui/EventList.tsx
// "My events" cards (B1-03). Each card is one link to the event's workspace; the link covers the
// whole card. Status and role are written as text, never shown by color alone.
import Link from "next/link";
import { BrandMark, NavIcon } from "@/components/layout/NavIcon";
import {
  formatEventWhen,
  formatExpectedAttendees,
  type EventGroups,
  type EventListItem,
} from "../list";
import { EventStatusBadge, RoleBadge } from "./EventBadges";

function EventCard({ event }: { event: EventListItem }) {
  // D-118: a project-style card: logo block and reference, the name, then details with icons.
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-xl bg-white p-5 shadow-xs transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-ink">
          <BrandMark className="size-7" inverted />
        </span>
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white"
        >
          <NavIcon name="arrow-up-right" className="size-4" />
        </span>
      </div>
      <h3 className="text-h4 leading-snug font-bold wrap-break-word">
        <Link
          href={`/events/${event.id}`}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:shadow-none focus-visible:after:shadow-(--ring)"
        >
          {event.name}
        </Link>
      </h3>
      <dl className="grid gap-1.5 text-sm text-ink-2">
        <div>
          <dt className="sr-only">Reference</dt>
          <dd className="font-mono text-[13px] text-ink-3">{event.reference}</dd>
        </div>
        <div>
          <dt className="sr-only">When</dt>
          <dd className="flex items-start gap-2">
            <NavIcon name="calendar" className="mt-0.5 size-4 text-ink-3" />
            <span>{formatEventWhen(event.startsAt, event.endsAt)}</span>
          </dd>
        </div>
        {event.venue ? (
          <div>
            <dt className="sr-only">Venue</dt>
            <dd className="flex items-start gap-2 wrap-break-word">
              <NavIcon name="map-pin" className="mt-0.5 size-4 text-ink-3" />
              <span>{event.venue}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Expected attendees</dt>
          <dd className="flex items-start gap-2">
            <NavIcon name="users" className="mt-0.5 size-4 text-ink-3" />
            <span>{formatExpectedAttendees(event.expectedAttendees)}</span>
          </dd>
        </div>
      </dl>
      <dl className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
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