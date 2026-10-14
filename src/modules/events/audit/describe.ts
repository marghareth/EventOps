// src/modules/events/audit/describe.ts
// Plain-language lines for an audit entry (B1-11), shown on the Activity page. Pure: no database,
// no clock. Times are in Philippine time.
import type {
  AttendeeChanges,
  AuditDetails,
  EventChanges,
  RequirementChanges,
  ResourceChanges,
} from "./actions";
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

const RSVP_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  MAYBE: "Maybe",
};

const ATTENDEE_FIELD_LABEL: Record<keyof AttendeeChanges, string> = {
  name: "Name",
  rsvpStatus: "RSVP",
  plusOnes: "Plus-ones",
  category: "Category",
  email: "Email",
  phone: "Phone",
  dietaryNeeds: "Dietary needs",
  notes: "Notes",
};

/**
 * Accessibility labels (B3-03). The audit context keeps its own copy because it can't import the
 * accessibility context; a test keeps them equal to the canonical definitions (D-057).
 */
export const REQUIREMENT_TYPE_LABEL: Record<string, string> = {
  MOBILITY_ASSISTANCE: "Mobility assistance",
  ACCESSIBLE_SEATING: "Accessible seating",
  STEP_FREE_ENTRANCE: "Step-free entry",
  ACCESSIBLE_RESTROOM: "Accessible restroom",
  SIGN_LANGUAGE: "Sign-language interpretation",
  CAPTIONING: "Captioning",
  OTHER: "Other",
};
export const REQUIREMENT_PRIORITY_LABEL: Record<string, string> = {
  REQUIRED: "Required",
  PREFERRED: "Preferred",
  INFORMATIONAL: "For information",
};

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  ACCESSIBLE_SEATS: "Accessible seats",
  ACCESSIBLE_ENTRANCE: "Accessible entrance",
  RAMP_OR_ELEVATOR: "Ramp or elevator",
  ACCESSIBLE_RESTROOM: "Accessible restroom",
  CAPTIONING: "Captioning",
  SIGN_LANGUAGE: "Sign-language interpreter",
};
export const RESOURCE_STATUS_LABEL: Record<string, string> = {
  NOT_AVAILABLE: "Not available",
  ARRANGING: "Being arranged",
  AVAILABLE: "Available",
};

function resourceChangeLines(changes: ResourceChanges): string[] {
  const lines: string[] = [];
  if (changes.status) {
    lines.push(
      `Status: ${RESOURCE_STATUS_LABEL[changes.status.from]} → ${RESOURCE_STATUS_LABEL[changes.status.to]}`,
    );
  }
  if (changes.quantity) {
    const seats = (n: number | null) => (n === null ? "none" : n.toLocaleString("en-US"));
    lines.push(`Seats: ${seats(changes.quantity.from)} → ${seats(changes.quantity.to)}`);
  }
  if (changes.note) lines.push("Note changed");
  return lines;
}

function requirementChangeLines(changes: RequirementChanges): string[] {
  const lines: string[] = [];
  if (changes.type) {
    lines.push(
      `Need: ${REQUIREMENT_TYPE_LABEL[changes.type.from]} → ${REQUIREMENT_TYPE_LABEL[changes.type.to]}`,
    );
  }
  if (changes.priority) {
    lines.push(
      `Priority: ${REQUIREMENT_PRIORITY_LABEL[changes.priority.from]} → ${REQUIREMENT_PRIORITY_LABEL[changes.priority.to]}`,
    );
  }
  if (changes.note) lines.push("Note changed");
  return lines;
}

function showAttendeeValue(value: string | number | null, field: keyof AttendeeChanges): string {
  if (value === null) return "none";
  if (field === "rsvpStatus") return RSVP_LABEL[String(value)] ?? String(value);
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
  if (entry.action === "attendee.created") {
    const { reference, name } = entry.details as AuditDetails<"attendee.created">;
    return { summary: `Added the attendee ${name} (${reference})`, lines: [] };
  }
  if (entry.action === "attendee.updated") {
    const { reference, changes } = entry.details as AuditDetails<"attendee.updated">;
    const lines = (Object.keys(ATTENDEE_FIELD_LABEL) as (keyof AttendeeChanges)[]).flatMap(
      (field) => {
        const change = changes[field];
        if (!change) return [];
        if ("changed" in change) return [`${ATTENDEE_FIELD_LABEL[field]} changed`];
        return [
          `${ATTENDEE_FIELD_LABEL[field]}: ${showAttendeeValue(change.from, field)} → ${showAttendeeValue(change.to, field)}`,
        ];
      },
    );
    return { summary: `Edited the attendee ${reference}`, lines };
  }
  if (entry.action === "attendee.deleted") {
    const { reference, name } = entry.details as AuditDetails<"attendee.deleted">;
    return { summary: `Removed the attendee ${name} (${reference})`, lines: [] };
  }
  if (entry.action === "accessibility_requirement.created") {
    const { reference, type, priority } =
      entry.details as AuditDetails<"accessibility_requirement.created">;
    return {
      summary: `Added an accessibility need for ${reference}: ${REQUIREMENT_TYPE_LABEL[type]} (${REQUIREMENT_PRIORITY_LABEL[priority]})`,
      lines: [],
    };
  }
  if (entry.action === "accessibility_requirement.updated") {
    const { reference, type, changes } =
      entry.details as AuditDetails<"accessibility_requirement.updated">;
    return {
      summary: `Edited an accessibility need of ${reference}: ${REQUIREMENT_TYPE_LABEL[type]}`,
      lines: requirementChangeLines(changes),
    };
  }
  if (entry.action === "accessibility_requirement.deleted") {
    const { reference, type } = entry.details as AuditDetails<"accessibility_requirement.deleted">;
    return {
      summary: `Removed an accessibility need from ${reference}: ${REQUIREMENT_TYPE_LABEL[type]}`,
      lines: [],
    };
  }
  if (entry.action === "accessibility_resource.created") {
    const { type, status, quantity } =
      entry.details as AuditDetails<"accessibility_resource.created">;
    const seats = quantity === null ? "" : `, ${quantity.toLocaleString("en-US")} seats`;
    return {
      summary: `Set up ${RESOURCE_TYPE_LABEL[type]}: ${RESOURCE_STATUS_LABEL[status]}${seats}`,
      lines: [],
    };
  }
  if (entry.action === "accessibility_resource.updated") {
    const { type, changes } = entry.details as AuditDetails<"accessibility_resource.updated">;
    return { summary: `Edited ${RESOURCE_TYPE_LABEL[type]}`, lines: resourceChangeLines(changes) };
  }
  if (entry.action === "accessibility_resource.deleted") {
    const { type } = entry.details as AuditDetails<"accessibility_resource.deleted">;
    return { summary: `Removed ${RESOURCE_TYPE_LABEL[type]}`, lines: [] };
  }
  if (entry.action === "attendees.exported") {
    const { count } = entry.details as AuditDetails<"attendees.exported">;
    return {
      summary: `Exported the guest list as CSV (${count === 1 ? "1 attendee" : `${count} attendees`})`,
      lines: [],
    };
  }
  if (entry.action === "attendees.imported") {
    const { count, first, last, skipped } = entry.details as AuditDetails<"attendees.imported">;
    const people = count === 1 ? "1 attendee" : `${count} attendees`;
    const range = count === 1 ? first : `${first} to ${last}`;
    const lines = skipped ? [`${skipped === 1 ? "1 row" : `${skipped} rows`} not imported`] : [];
    return { summary: `Imported ${people} from a CSV file (${range})`, lines };
  }
  return { summary: "Made a change (details unavailable)", lines: [] };
}