// src/components/layout/navigation.ts
// Pure navigation model for the app shell: which links show, and which one is current.
// Only Tier 1 event sections are linked (BUILD_BACKLOG.md). Tier 2 pages exist but are not linked.
import type { NavIconName } from "./NavIcon";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  /** "exact": current only on this exact path. "prefix": also on paths below it. */
  match: "exact" | "prefix";
};

export type Navigation =
  | { kind: "global"; label: string; items: NavItem[] }
  | { kind: "event"; label: string; eventId: string; items: NavItem[] };

const GLOBAL_ITEMS: NavItem[] = [
  { href: "/events", label: "My events", icon: "calendar", match: "exact" },
  { href: "/events/new", label: "New event", icon: "plus", match: "exact" },
];

// Order follows the brand book's dashboard-first structure.
const EVENT_SECTIONS: { segment: string; label: string; icon: NavIconName }[] = [
  { segment: "", label: "Overview", icon: "dashboard" },
  { segment: "attendees", label: "Attendees", icon: "users" },
  { segment: "accessibility", label: "Accessibility", icon: "accessibility" },
  { segment: "suppliers", label: "Suppliers", icon: "truck" },
  { segment: "budget", label: "Budget", icon: "wallet" },
  { segment: "tasks", label: "Tasks", icon: "tasks" },
  { segment: "impact", label: "Impact", icon: "zap" },
  { segment: "import", label: "Import", icon: "upload" },
  { segment: "activity", label: "Activity", icon: "history" },
  { segment: "settings", label: "Settings", icon: "settings" },
];

/** Paths under /events/ that are pages, not event IDs. */
const RESERVED_EVENT_SEGMENTS = new Set(["new"]);

/** The event ID in the current path, or null outside an event. Reads the URL only. */
export function eventIdFromPath(pathname: string): string | null {
  const match = /^\/events\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return RESERVED_EVENT_SEGMENTS.has(segment) ? null : segment;
}

export function navigationFor(pathname: string): Navigation {
  const eventId = eventIdFromPath(pathname);
  if (!eventId) return { kind: "global", label: "Main", items: GLOBAL_ITEMS };

  const base = `/events/${encodeURIComponent(eventId)}`;
  return {
    kind: "event",
    label: "Event sections",
    eventId,
    items: EVENT_SECTIONS.map(({ segment, label, icon }) => ({
      href: segment ? `${base}/${segment}` : base,
      label,
      icon,
      match: segment ? "prefix" : "exact",
    })),
  };
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isCurrent(item: NavItem, pathname: string): boolean {
  const path = trimTrailingSlash(pathname);
  if (item.match === "exact") return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}