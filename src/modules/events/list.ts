// src/modules/events/list.ts
// Pure rules for the event list (B1-03): grouping, order and display text. No database, no clock:
// callers pass `now`. Dates are shown in Philippine time (D-025, D-026).
import type { EventStatus, MemberRole } from "@/generated/prisma/client";

/** One row of "My events". An explicit allow-list: nothing else about an event is listed. */
export type EventListItem = {
  id: string;
  reference: string;
  name: string;
  venue: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
  expectedAttendees: number;
  /** The signed-in user's role in this event. */
  role: MemberRole;
};

export type EventGroups = { upcoming: EventListItem[]; past: EventListItem[] };

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PLANNING: "Planning",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: "Owner",
  COORDINATOR: "Coordinator",
  VIEWER: "Viewer",
};

const MANILA = "Asia/Manila";
const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA,
  hour: "numeric",
  minute: "2-digit",
});

/** The calendar day in Philippine time, as "YYYY-MM-DD" (UTC+8, no daylight saving). */
export function manilaDay(instant: Date): string {
  return new Date(instant.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "Sat, Dec 12, 2026 · 4:00 PM – 10:00 PM PHT". A different end day is written out in full. */
export function formatEventWhen(startsAt: Date, endsAt: Date | null): string {
  const start = `${DAY.format(startsAt)} · ${TIME.format(startsAt)}`;
  if (!endsAt) return `${start} PHT`;
  const end =
    manilaDay(endsAt) === manilaDay(startsAt)
      ? TIME.format(endsAt)
      : `${DAY.format(endsAt)} · ${TIME.format(endsAt)}`;
  return `${start} – ${end} PHT`;
}

export function formatExpectedAttendees(count: number): string {
  if (count === 0) return "No expected headcount yet";
  return `${count.toLocaleString("en-US")} expected ${count === 1 ? "attendee" : "attendees"}`;
}

const byStart = (a: EventListItem, b: EventListItem) =>
  a.startsAt.getTime() - b.startsAt.getTime() || a.reference.localeCompare(b.reference);

/**
 * Upcoming: the event's last day (its end, or its start when there is no end) is today or later
 * in Philippine time, so an event stays "upcoming" for the whole of its day. Soonest first.
 * Past: everything else, most recent first. Status does not move an event between groups.
 */
export function groupEvents(events: readonly EventListItem[], now: Date): EventGroups {
  const today = manilaDay(now);
  const upcoming: EventListItem[] = [];
  const past: EventListItem[] = [];
  for (const event of events) {
    (manilaDay(event.endsAt ?? event.startsAt) >= today ? upcoming : past).push(event);
  }
  upcoming.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  return { upcoming, past };
}