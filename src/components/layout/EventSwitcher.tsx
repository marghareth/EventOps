// src/components/layout/EventSwitcher.tsx
// Inside an event, a way back to the event list. The event's name and role are shown by the
// workspace header, which loads them on the server after the access check (B1-04, D-027).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { eventIdFromPath } from "./navigation";

export function EventSwitcher() {
  if (!eventIdFromPath(usePathname() ?? "")) return null;
  return (
    <Link
      href="/events"
      className="shrink-0 rounded-sm text-sm font-semibold text-blue underline underline-offset-2"
    >
      Switch event
    </Link>
  );
}