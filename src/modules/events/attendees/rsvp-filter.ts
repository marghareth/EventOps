// src/modules/events/attendees/rsvp-filter.ts
// Filtering the guest list by RSVP (B2-08, D-049). Pure functions: the page filters the guest list
// it has already authorized, so the filter never widens what a role may see. The value in the
// address is parsed against the fixed list of states; anything else means "no filter".
import { RSVP_STATUSES, type RsvpStatus } from "./schema";

/** The order the filter shows: most useful first. Every state appears exactly once. */
export const RSVP_FILTER_ORDER = [
  "CONFIRMED",
  "PENDING",
  "MAYBE",
  "DECLINED",
] as const satisfies readonly RsvpStatus[];

/** The address value for a state: `?rsvp=confirmed`. */
export function rsvpFilterParam(status: RsvpStatus): string {
  return status.toLowerCase();
}

/** The state named in the address, or null for none, unknown or malformed values. */
export function parseRsvpFilter(value: string | string[] | undefined): RsvpStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  return RSVP_STATUSES.find((status) => rsvpFilterParam(status) === raw) ?? null;
}

/** How many attendees are in each state. */
export function rsvpCounts(attendees: readonly { rsvpStatus: RsvpStatus }[]) {
  const counts = Object.fromEntries(RSVP_STATUSES.map((s) => [s, 0])) as Record<RsvpStatus, number>;
  for (const attendee of attendees) counts[attendee.rsvpStatus] += 1;
  return counts;
}

/** The attendees in one state, in the same order; everyone when status is null. */
export function filterByRsvp<T extends { rsvpStatus: RsvpStatus }>(
  attendees: readonly T[],
  status: RsvpStatus | null,
): T[] {
  return status ? attendees.filter((a) => a.rsvpStatus === status) : [...attendees];
}