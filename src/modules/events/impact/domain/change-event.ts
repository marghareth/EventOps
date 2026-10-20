// src/modules/events/impact/domain/change-event.ts
// The proposed change an analysis is about (B7-F01, B7-F02; D-101). Batch 7 supports one kind:
// a new expected attendance (the event's planning number). The current value always comes from the
// stored event on the server, never from the browser. Other kinds need their own approval.

/** Same upper bound as the event form (EVENT_LIMITS.headcount): far inside the integer range. */
export const MAX_EXPECTED_ATTENDEES = 1_000_000;

export type ExpectedAttendanceChange = {
  kind: "EXPECTED_ATTENDEES";
  /** The stored expected attendees now. */
  from: number;
  /** The proposed expected attendees. */
  to: number;
};

export class InvalidChange extends Error {}

const isHeadcount = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= MAX_EXPECTED_ATTENDEES;

/** A checked change. Throws for numbers the validated forms could never produce. */
export function expectedAttendanceChange(from: number, to: number): ExpectedAttendanceChange {
  if (!isHeadcount(from) || !isHeadcount(to)) {
    throw new InvalidChange(`Expected attendees must be whole numbers from 0 to ${MAX_EXPECTED_ATTENDEES}.`);
  }
  return { kind: "EXPECTED_ATTENDEES", from, to };
}

/** Signed difference in people: positive when attendance goes up. */
export const attendanceDelta = (change: ExpectedAttendanceChange): number => change.to - change.from;

export const formatCount = (value: number): string => value.toLocaleString("en-US");

/** "180 → 220 (+40)". */
export function describeChange(change: ExpectedAttendanceChange): string {
  const delta = attendanceDelta(change);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${formatCount(change.from)} → ${formatCount(change.to)} (${sign}${formatCount(Math.abs(delta))})`;
}