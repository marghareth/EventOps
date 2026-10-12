// src/components/layout/EventSwitcher.tsx
// Event context placeholder (B0-10, D-018). Inside /events/[eventId] it shows which event the
// shell is in, using the URL only. It never loads event data: the name and the membership check
// arrive with the event-workspace task (PROJECT_RULES section 7).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { eventIdFromPath } from "./navigation";

export function EventSwitcher() {
  const eventId = eventIdFromPath(usePathname() ?? "");
  if (!eventId) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 font-display text-xs font-bold tracking-wider text-ink-3 uppercase">
        Event
      </span>
      <span className="min-w-0 truncate font-mono text-ink-2" title={eventId}>
        {eventId}
      </span>
      <Link
        href="/events"
        className="shrink-0 rounded-sm font-semibold text-blue underline underline-offset-2"
      >
        Switch <span className="sr-only sm:not-sr-only">event</span>
      </Link>
    </div>
  );
}