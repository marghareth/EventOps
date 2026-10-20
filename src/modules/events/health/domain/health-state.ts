// src/modules/events/health/domain/health-state.ts
// What the Event Health checks read about an event (B8-F01, D-105). Built on the server from each
// context's own authorized read, with their own rules already applied (headcount D-046, supplier
// confirmation and overdue D-078/D-079, over budget D-088/D-090, accessibility readiness D-063 and
// alerts D-066, task overdue D-098). Pure data: no database handles, no clock. Never a contact
// value or a note.

export type HealthAttendee = {
  /** Readable ID, for example ATT-0003. */
  reference: string;
  name: string;
  rsvpStatus: "PENDING" | "CONFIRMED" | "DECLINED" | "MAYBE";
  /** Whether the guest has an email or a phone (the values are never read here). */
  hasContact: boolean;
};

export type HealthSupplier = {
  /** Readable ID, for example SUP-0002. */
  reference: string;
  name: string;
  /** Has an Accepted quote: the supplier is confirmed (D-105). */
  confirmed: boolean;
  /** How many of its payments are overdue today (D-079). */
  overduePayments: number;
  /** Has a phone or an email. */
  hasContact: boolean;
};

export type HealthTask = {
  /** Readable ID, for example TSK-0004. */
  reference: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  done: boolean;
  /** Overdue today by the tasks' own rule (D-098). */
  overdue: boolean;
  assigned: boolean;
};

export type HealthState = {
  expectedAttendees: number;
  capacity: number | null;
  attendees: readonly HealthAttendee[];
  /** Confirmed guests plus their plus-ones (D-046). */
  confirmedHeadcount: number;
  suppliers: readonly HealthSupplier[];
  budget: {
    hasCategories: boolean;
    /** Formatted by the budget ("₱350,000.00"), from its summary (D-088). Display only. */
    allocatedText: string;
    /** What remains of the total allocation, formatted; null when the event is over budget. */
    remainingText: string | null;
    /** The budget's own over-budget warnings (D-090): the event first, then each category. */
    warnings: readonly { scope: "event" | "category"; name: string; message: string }[];
  };
  accessibility: {
    status: "NO_REQUIRED_NEEDS" | "NOT_READY" | "ALMOST_READY" | "READY";
    /** Batch 3's gap alerts (D-066), most serious first. */
    alerts: readonly { title: string; severity: "critical" | "warning" }[];
  };
  tasks: readonly HealthTask[];
};