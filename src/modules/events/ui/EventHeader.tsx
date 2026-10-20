// src/modules/events/ui/EventHeader.tsx
// Workspace header (B1-04): which event you are in and your role, above every event section.
// Not a heading: each section page has its own h1. Styled as a project title (D-118).
import { BrandMark, NavIcon } from "@/components/layout/NavIcon";
import { formatEventWhen, type EventDetails } from "../list";
import { EventStatusBadge, RoleBadge } from "./EventBadges";

export function EventHeader({ event }: { event: EventDetails }) {
  return (
    <section
      aria-label="Current event"
      className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 items-start gap-4">
        <span className="hidden size-14 shrink-0 items-center justify-center rounded-xl bg-ink shadow-sm sm:flex">
          <BrandMark className="size-8" inverted />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-2">{event.reference}</p>
          <p className="mt-0.5 font-display text-h3 leading-tight font-extrabold tracking-[-0.02em] wrap-break-word">
            {event.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <NavIcon name="calendar" className="size-4 text-ink-3" />
              {formatEventWhen(event.startsAt, event.endsAt)}
            </span>
            {event.venue ? <span className="sr-only"> · </span> : null}
            {event.venue ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 wrap-break-word">
                <NavIcon name="map-pin" className="size-4 text-ink-3" />
                {event.venue}
              </span>
            ) : null}
          </div>
        </div>
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