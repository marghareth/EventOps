// src/components/layout/EventSwitcher.tsx
// Inside an event: the event's name, once the server confirmed access (B1-13, D-038), and a way
// back to the event list. The full identity (number, date, role) is in the workspace header.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfirmedEvent } from "./EventContext";
import { NavIcon } from "./NavIcon";
import { eventIdFromPath } from "./navigation";

export function EventSwitcher() {
  const eventId = eventIdFromPath(usePathname() ?? "");
  const event = useConfirmedEvent(eventId);
  if (!eventId) return null;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      {event ? (
        // On phones the top bar is too narrow to be useful; the workspace header shows the name there.
        <span className="hidden min-w-0 items-center gap-2 sm:flex" title={event.name}>
          <NavIcon name="calendar" className="size-4 shrink-0 text-ink-3" />
          <span className="truncate font-semibold">
            <span className="sr-only">Current event: </span>
            {event.name}
          </span>
        </span>
      ) : null}
      <Link
        href="/events"
        className="relative inline-flex min-h-9 shrink-0 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink-2 after:absolute after:-inset-1 after:content-[''] hover:border-stone hover:text-ink"
      >
        Switch event
      </Link>
    </div>
  );
}