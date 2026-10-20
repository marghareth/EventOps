// src/modules/events/impact/domain/event-state.ts
// What the impact rules read about an event (D-101). Built on the server from each context's own
// authorized read (budget, accessibility, tasks), so the rules reuse their results instead of
// re-deriving them. Pure data: no database handles, no clock.

export type BudgetStateCategory = {
  id: string;
  name: string;
  /** Two-place peso strings, as the budget stores them. */
  allocation: string;
  items: readonly { estimated: string; committed: string; paid: string }[];
};

/** An accessibility alert as Batch 3 derives it (D-066): severity and words already decided there. */
export type AccessibilityAlertState = {
  key: string;
  severity: "critical" | "warning";
  title: string;
  reason: string;
};

export type TaskState = {
  /** Readable ID, for example TSK-0003. */
  reference: string;
  title: string;
  description: string | null;
  /** Done tasks are never reported. */
  done: boolean;
};

export type EventState = {
  /** The stored planning number. */
  expectedAttendees: number;
  /** Venue capacity, or null when not set. */
  capacity: number | null;
  budget: readonly BudgetStateCategory[];
  accessibility: {
    /** The gap alerts (not the event-level summary alert), most serious first. */
    alerts: readonly AccessibilityAlertState[];
    /** Accessible seats recorded as Available (0 when the resource is missing or not available). */
    seatsAvailable: number;
    /** Required accessible-seating needs recorded on the guest list. */
    seatsRecordedNeeds: number;
  };
  tasks: readonly TaskState[];
};