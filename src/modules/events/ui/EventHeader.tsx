// src/modules/events/ui/EventHeader.tsx
// Workspace header (B1-04): which event you are in and your role, above every event section.
// Not a heading: each section page has its own h1.
import { formatEventWhen, type EventDetails } from "../list";
import { EventStatusBadge, RoleBadge } from "./EventBadges";

export function EventHeader({ event }: { event: EventDetails }) {
  return (
    <section
      aria-label="Current event"
      className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-5 shadow-xs md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0">
        <p className="font-mono text-[13px] text-ink-2">{event.reference}</p>
        <p className="mt-1 font-display text-h3 leading-tight font-extrabold break-words">
          {event.name}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {formatEventWhen(event.startsAt, event.endsAt)}
          {event.venue ? <span className="break-words"> · {event.venue}</span> : null}
        </p>
      </div>
      <dl className="flex shrink-0 flex-wrap gap-2">
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
    </section>
  );
}