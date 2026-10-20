// src/components/layout/Sidebar.tsx
// Section navigation. Outside an event it shows the global links; inside /events/[eventId] it
// shows that event's Tier 1 sections under small group headings (Dashboard, Manage, Tools; D-118).
// The current page is marked with aria-current="page", a visible bar and bold text, never by color
// alone. If the event in the URL turned out to be unavailable (not found or not a member), it falls
// back to the global links (B1-13, D-038).
"use client";

import Link from "next/link";
import { useId } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEventUnavailable } from "./EventContext";
import { NavIcon } from "./NavIcon";
import { groupNavItems, isCurrent, navigationFor, type NavItem } from "./navigation";

type SidebarProps = {
  /** Called after a link is chosen, for example to close the mobile drawer. */
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const unavailable = useEventUnavailable();
  const headingId = useId();
  // Never offer an unavailable event's sections: they would only lead to more not-found pages.
  const nav = navigationFor(unavailable ? "/events" : pathname);
  const runs = groupNavItems(nav.items);

  return (
    <nav aria-label={nav.label} className={cn("flex flex-col gap-1 px-3 py-4", className)}>
      {nav.kind === "event" ? (
        <Link
          href="/events"
          onClick={onNavigate}
          className="mb-2 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-mist hover:text-ink"
        >
          <NavIcon name="arrow-left" className="size-4" />
          All events
        </Link>
      ) : null}
      {runs.map((run, index) => {
        const id = `${headingId}-${index}`;
        return (
          <div key={run.group ?? index} className={cn(index > 0 && "mt-4")}>
            {run.group ? (
              <p
                id={id}
                className="mb-1 px-3 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase"
              >
                {run.group}
              </p>
            ) : null}
            <ul aria-labelledby={run.group ? id : undefined} className="flex flex-col gap-0.5">
              {run.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  current={isCurrent(item, pathname)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarLink({
  item,
  current,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
          current
            ? "bg-blue-tint font-semibold text-blue-dark before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full before:bg-blue"
            : "font-medium text-ink-2 hover:bg-mist hover:text-ink",
        )}
      >
        <NavIcon
          name={item.icon}
          className={cn("size-5", current ? "text-blue" : "text-ink-3 group-hover:text-ink")}
        />
        {item.label}
      </Link>
    </li>
  );
}