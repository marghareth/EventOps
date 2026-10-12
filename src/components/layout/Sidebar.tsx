// src/components/layout/Sidebar.tsx
// Section navigation. Outside an event it shows the global links; inside /events/[eventId] it
// shows that event's Tier 1 sections. The current page is marked with aria-current="page" and a
// visible bar plus bold text, never by color alone. If the event in the URL turned out to be
// unavailable (not found or not a member), it falls back to the global links (B1-13, D-038).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEventUnavailable } from "./EventContext";
import { NavIcon } from "./NavIcon";
import { isCurrent, navigationFor } from "./navigation";

type SidebarProps = {
  /** Called after a link is chosen, for example to close the mobile drawer. */
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const unavailable = useEventUnavailable();
  // Never offer an unavailable event's sections: they would only lead to more not-found pages.
  const nav = navigationFor(unavailable ? "/events" : pathname);

  return (
    <nav aria-label={nav.label} className={cn("flex flex-col gap-2 p-3", className)}>
      {nav.kind === "event" ? (
        <Link
          href="/events"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-ink-2 hover:bg-mist hover:text-ink"
        >
          <NavIcon name="arrow-left" className="size-4" />
          All events
        </Link>
      ) : null}
      <ul className="flex flex-col gap-1">
        {nav.items.map((item) => {
          const current = isCurrent(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                  current
                    ? "bg-blue-tint font-semibold text-blue-dark before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-blue"
                    : "font-medium text-ink-2 hover:bg-mist hover:text-ink",
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}