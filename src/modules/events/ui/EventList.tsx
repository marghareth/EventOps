// src/modules/events/ui/EventList.tsx
// "My events" cards (B1-03). Each card is one link to the event's workspace; the link covers the
// whole card. Status and role are written as text, never shown by color alone.
import Link from "next/link";
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_LABEL,
  MEMBER_ROLE_LABEL,
  formatEventWhen,
  formatExpectedAttendees,
  type EventGroups,
  type EventListItem,
} from "../list";

const STATUS_STYLE: Record<EventListItem["status"], { icon: StateIconName; className: string }> = {
  DRAFT: { icon: "info", className: "border-line bg-mist text-ink" },
  PLANNING: { icon: "info", className: "border-info-line bg-info-tint text-info" },
  LIVE: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  COMPLETED: { icon: "success", className: "border-line bg-mist text-ink-2" },
  CANCELLED: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
};

const badge =
  "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium";

function EventCard({ event }: { event: EventListItem }) {
  const status = STATUS_STYLE[event.status];
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
          <dd className={cn(badge, status.className)}>
            <StateIcon name={status.icon} className="size-3.5" />
            {EVENT_STATUS_LABEL[event.status]}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Your role</dt>
          <dd className={cn(badge, "border-info-line bg-blue-tint text-blue-dark")}>
            {MEMBER_ROLE_LABEL[event.role]}
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