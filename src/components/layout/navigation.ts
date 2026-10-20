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
  /** Sidebar heading the link sits under (event sections only). Order is unchanged by groups. */
  group?: NavGroup;
};

export type NavGroup = "Dashboard" | "Manage" | "Tools";

export type Navigation =
  | { kind: "global"; label: string; items: NavItem[] }
  | { kind: "event"; label: string; eventId: string; items: NavItem[] };

const GLOBAL_ITEMS: NavItem[] = [
  { href: "/events", label: "My events", icon: "calendar", match: "exact" },
  { href: "/events/new", label: "New event", icon: "plus", match: "exact" },
];

// Order follows the brand book's dashboard-first structure.
const EVENT_SECTIONS: { segment: string; label: string; icon: NavIconName; group: NavGroup }[] = [
  { segment: "", label: "Overview", icon: "dashboard", group: "Dashboard" },
  // B8 (D-107): the full Event Health check list and the Critical Alert View.
  { segment: "health", label: "Health", icon: "pulse", group: "Dashboard" },
  { segment: "attendees", label: "Attendees", icon: "users", group: "Manage" },
  { segment: "accessibility", label: "Accessibility", icon: "accessibility", group: "Manage" },
  { segment: "suppliers", label: "Suppliers", icon: "truck", group: "Manage" },
  { segment: "budget", label: "Budget", icon: "wallet", group: "Manage" },
  { segment: "tasks", label: "Tasks", icon: "tasks", group: "Manage" },
  { segment: "impact", label: "Impact", icon: "zap", group: "Tools" },
  { segment: "import", label: "Import", icon: "upload", group: "Tools" },
  { segment: "activity", label: "Activity", icon: "history", group: "Tools" },
  { segment: "settings", label: "Settings", icon: "settings", group: "Tools" },
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
    items: EVENT_SECTIONS.map(({ segment, label, icon, group }) => ({
      href: segment ? `${base}/${segment}` : base,
      label,
      icon,
      group,
      match: segment ? "prefix" : "exact",
    })),
  };
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Consecutive items under the same sidebar heading, in order. Items with no group form one run. */
export function groupNavItems(items: NavItem[]): { group: NavGroup | null; items: NavItem[] }[] {
  const runs: { group: NavGroup | null; items: NavItem[] }[] = [];
  for (const item of items) {
    const group = item.group ?? null;
    const last = runs.at(-1);
    if (last && last.group === group) last.items.push(item);
    else runs.push({ group, items: [item] });
  }
  return runs;
}

export function isCurrent(item: NavItem, pathname: string): boolean {
  const path = trimTrailingSlash(pathname);
  if (item.match === "exact") return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}