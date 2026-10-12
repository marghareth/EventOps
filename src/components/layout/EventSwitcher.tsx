// src/components/layout/EventSwitcher.tsx
// Inside an event: the event's name, once the server confirmed access (B1-13, D-038), and a way
// back to the event list. The full identity (number, date, role) is in the workspace header.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfirmedEvent } from "./EventContext";
import { eventIdFromPath } from "./navigation";

export function EventSwitcher() {
  const eventId = eventIdFromPath(usePathname() ?? "");
  const event = useConfirmedEvent(eventId);
  if (!eventId) return null;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      {event ? (
        // On phones the top bar is too narrow to be useful; the workspace header shows the name there.
        <span className="hidden min-w-0 truncate font-semibold sm:inline" title={event.name}>
          <span className="sr-only">Current event: </span>
          {event.name}
        </span>
      ) : null}
      <Link
        href="/events"
        className="shrink-0 rounded-sm font-semibold text-blue underline underline-offset-2"
      >
        Switch event
      </Link>
    </div>
  );
}