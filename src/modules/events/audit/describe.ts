// src/modules/events/audit/describe.ts
// Plain-language lines for an audit entry (B1-11), shown on the Activity page. Pure: no database,
// no clock. Times are in Philippine time.
import type { AuditDetails, EventChanges } from "./actions";
import type { AuditEntryView } from "./queries";

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatAuditTime(instant: Date): string {
  return `${WHEN.format(instant)} PHT`;
}

const FIELD_LABEL: Record<keyof EventChanges, string> = {
  name: "Name",
  venue: "Venue",
  description: "Description",
  startsAt: "Start",
  endsAt: "End",
  capacity: "Venue capacity",
  expectedAttendees: "Expected attendees",
};

function show(value: string | number | null, field: keyof EventChanges): string {
  if (value === null) return "none";
  if (field === "startsAt" || field === "endsAt") return formatAuditTime(new Date(value));
  if (typeof value === "number") return value.toLocaleString("en-US");
  return `“${value}”`;
}

/** A one-line summary and, for updates, one line per changed field. */
export function describeAuditEntry(entry: Pick<AuditEntryView, "action" | "details">): {
  summary: string;
  lines: string[];
} {
  if (entry.action === "event.created") {
    const details = entry.details as AuditDetails<"event.created">;
    return { summary: `Created the event ${details.reference}`, lines: [] };
  }
  if (entry.action === "event.updated") {
    const { changes } = entry.details as AuditDetails<"event.updated">;
    const lines = (Object.keys(FIELD_LABEL) as (keyof EventChanges)[]).flatMap((field) => {
      const change = changes[field];
      if (!change) return [];
      if ("changed" in change) return [`${FIELD_LABEL[field]} changed`];
      return [`${FIELD_LABEL[field]}: ${show(change.from, field)} → ${show(change.to, field)}`];
    });
    return { summary: "Edited the event details", lines };
  }
  return { summary: "Made a change (details unavailable)", lines: [] };
}