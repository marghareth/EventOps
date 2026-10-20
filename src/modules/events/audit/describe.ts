// src/modules/events/audit/describe.ts
// Plain-language lines for an audit entry (B1-11), shown on the Activity page. Pure: no database,
// no clock. Times are in Philippine time.
import type {
  AttendeeChanges,
  AuditDetails,
  BudgetItemChanges,
  EventChanges,
  ImpactAssumptionChanges,
  RequirementChanges,
  ResourceChanges,
  SupplierChanges,
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
/** Task priorities as shown in Activity (B6-F05, D-095). A test keeps it equal to the domain's. */
export const TASK_PRIORITY_LABEL: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** Task statuses as shown in Activity (B6-F06, D-096). A test keeps it equal to the domain's. */
export const TASK_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const RESOURCE_STATUS_LABEL: Record<string, string> = {
  NOT_AVAILABLE: "Not available",
  ARRANGING: "Being arranged",
  AVAILABLE: "Available",
};

/**
 * Supplier category labels (B4-02). The audit context keeps its own copy because it can't import
 * the suppliers context; a test keeps them equal to the canonical definitions (D-069).
 */
export const SUPPLIER_CATEGORY_LABEL: Record<string, string> = {
  VENUE: "Venue",
  CATERING: "Catering",
  CAKE_AND_DESSERTS: "Cake and desserts",
  PHOTO_AND_VIDEO: "Photo and video",
  SOUND_AND_LIGHTS: "Sound and lights",
  ENTERTAINMENT: "Entertainment",
  FLOWERS_AND_STYLING: "Flowers and styling",
  HAIR_AND_MAKEUP: "Hair and makeup",
  ATTIRE: "Attire",
  RENTALS: "Rentals",
  TRANSPORT: "Transport",
  PRINTING_AND_STATIONERY: "Printing and stationery",
  OTHER: "Other",
};

/** "Catering", or for Other what the supplier provides: "Other: Fireworks". */
function supplierCategoryText(category: string, detail: string | null): string {
  const label = SUPPLIER_CATEGORY_LABEL[category] ?? category;
  return category === "OTHER" && detail ? `${label}: ${detail}` : label;
}

/**
 * Quote status labels (B4-11, D-076). The audit context's own copy; a test keeps them equal to the
 * canonical definitions.
 */
export const QUOTE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

/**
 * "₱120,000.50" from a stored amount ("120000.50"), string-based like the suppliers context's
 * formatPeso (D-075); a test keeps the two equal.
 */
export function formatAuditPeso(amount: string): string {
  const [whole, centavos] = amount.split(".");
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${centavos}`;
}

/** Payment kind labels (B4-14). The audit context's own copy; a test keeps them equal. */
export const PAYMENT_KIND_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  PAYMENT: "Payment",
};
/** Recorded payment status labels (B4-14). The audit context's own copy; a test keeps them equal. */
export const PAYMENT_RECORD_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Not paid yet",
  PAID: "Paid",
};

/** "Nov 15, 2026" from "2026-11-15", as the suppliers context shows dates (D-079). */
function auditDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

const SUPPLIER_CONTACT_LABEL = {
  contactName: "Contact person",
  email: "Email",
  phone: "Phone",
  notes: "Notes",
} as const;

function supplierChangeLines(changes: SupplierChanges): string[] {
  const lines: string[] = [];
  if (changes.name) lines.push(`Name: “${changes.name.from}” → “${changes.name.to}”`);
  if (changes.category) {
    const { from, to } = changes.category;
    lines.push(
      `Category: ${supplierCategoryText(from.category, from.detail)} → ${supplierCategoryText(to.category, to.detail)}`,
    );
  }
  for (const field of Object.keys(
    SUPPLIER_CONTACT_LABEL,
  ) as (keyof typeof SUPPLIER_CONTACT_LABEL)[]) {
    if (changes[field]) lines.push(`${SUPPLIER_CONTACT_LABEL[field]} changed`);
  }
  return lines;
}

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

/**
 * Lines for an edited budget item (B5-F14, D-093), in the order of the audit schema: category,
 * name, the three amounts, then notes. The notes are never copied into the log, so the line only
 * says they changed (D-085).
 */
function budgetItemChangeLines(changes: BudgetItemChanges): string[] {
  const lines: string[] = [];
  if (changes.category) {
    lines.push(`Category: “${changes.category.from}” → “${changes.category.to}”`);
  }
  if (changes.name) lines.push(`Name: “${changes.name.from}” → “${changes.name.to}”`);
  const amounts = [
    ["estimated", "Estimated"],
    ["committed", "Committed"],
    ["paid", "Paid"],
  ] as const;
  for (const [field, label] of amounts) {
    const change = changes[field];
    if (change) {
      lines.push(`${label}: ${formatAuditPeso(change.from)} → ${formatAuditPeso(change.to)}`);
    }
  }
  if (changes.notes) lines.push("Notes changed");
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
  if (entry.action === "supplier.created") {
    const { reference, name, category, categoryDetail } =
      entry.details as AuditDetails<"supplier.created">;
    return {
      summary: `Added the supplier ${name} (${reference}): ${supplierCategoryText(category, categoryDetail)}`,
      lines: [],
    };
  }
  if (entry.action === "supplier.updated") {
    const { reference, changes } = entry.details as AuditDetails<"supplier.updated">;
    return { summary: `Edited the supplier ${reference}`, lines: supplierChangeLines(changes) };
  }
  if (entry.action === "supplier.deleted") {
    const { reference, name } = entry.details as AuditDetails<"supplier.deleted">;
    return { summary: `Removed the supplier ${name} (${reference})`, lines: [] };
  }
  if (entry.action === "quote.created") {
    const { reference, supplierReference, amount, status, description } =
      entry.details as AuditDetails<"quote.created">;
    return {
      summary: `Added the quote ${reference} for ${supplierReference}: ${formatAuditPeso(amount)} (${QUOTE_STATUS_LABEL[status]})`,
      lines: description ? [`Description: ${description}`] : [],
    };
  }
  if (entry.action === "quote.updated") {
    const { reference, supplierReference, changes } =
      entry.details as AuditDetails<"quote.updated">;
    const lines: string[] = [];
    if (changes.amount) {
      lines.push(
        `Amount: ${formatAuditPeso(changes.amount.from)} → ${formatAuditPeso(changes.amount.to)}`,
      );
    }
    if (changes.status) {
      lines.push(
        `Status: ${QUOTE_STATUS_LABEL[changes.status.from]} → ${QUOTE_STATUS_LABEL[changes.status.to]}`,
      );
    }
    if (changes.description) {
      const text = (value: string | null) => (value === null ? "none" : `“${value}”`);
      lines.push(
        `Description: ${text(changes.description.from)} → ${text(changes.description.to)}`,
      );
    }
    // A status change leads the summary, so Activity says what happened to the quote (B4-20).
    const quote = `the quote ${reference} for ${supplierReference}`;
    const summary =
      changes.status?.to === "ACCEPTED"
        ? `Accepted ${quote}`
        : changes.status?.to === "DECLINED"
          ? `Declined ${quote}`
          : changes.status?.to === "PENDING"
            ? `Set ${quote} back to Pending`
            : `Edited ${quote}`;
    return { summary, lines };
  }
  if (entry.action === "payment.created") {
    const d = entry.details as AuditDetails<"payment.created">;
    const lines = [
      d.status === "PAID" && d.paidOn ? `Paid on ${auditDate(d.paidOn)}` : "Not paid yet",
    ];
    if (d.description) lines.push(`Description: ${d.description}`);
    return {
      summary: `Added the ${PAYMENT_KIND_LABEL[d.kind].toLowerCase()} ${d.reference} for ${d.supplierReference}: ${formatAuditPeso(d.amount)}, due ${auditDate(d.dueDate)}`,
      lines,
    };
  }
  if (entry.action === "payment.updated") {
    const { reference, supplierReference, changes } =
      entry.details as AuditDetails<"payment.updated">;
    const text = (value: string | null) => (value === null ? "none" : `“${value}”`);
    const day = (value: string | null) => (value === null ? "none" : auditDate(value));
    const lines: string[] = [];
    if (changes.kind) {
      lines.push(
        `Kind: ${PAYMENT_KIND_LABEL[changes.kind.from]} → ${PAYMENT_KIND_LABEL[changes.kind.to]}`,
      );
    }
    if (changes.amount) {
      lines.push(
        `Amount: ${formatAuditPeso(changes.amount.from)} → ${formatAuditPeso(changes.amount.to)}`,
      );
    }
    if (changes.dueDate) {
      lines.push(`Due date: ${day(changes.dueDate.from)} → ${day(changes.dueDate.to)}`);
    }
    if (changes.status) {
      lines.push(
        `Status: ${PAYMENT_RECORD_STATUS_LABEL[changes.status.from]} → ${PAYMENT_RECORD_STATUS_LABEL[changes.status.to]}`,
      );
    }
    if (changes.paidOn) {
      lines.push(`Paid on: ${day(changes.paidOn.from)} → ${day(changes.paidOn.to)}`);
    }
    if (changes.description) {
      lines.push(
        `Description: ${text(changes.description.from)} → ${text(changes.description.to)}`,
      );
    }
    // A status change leads the summary (B4-20): "Marked ... as paid (Oct 2, 2026)".
    const payment = `the payment ${reference} for ${supplierReference}`;
    const paidOn = changes.paidOn?.to;
    const summary =
      changes.status?.to === "PAID"
        ? `Marked ${payment} as paid${paidOn ? ` (${auditDate(paidOn)})` : ""}`
        : changes.status?.to === "UNPAID"
          ? `Marked ${payment} as not paid yet`
          : `Edited ${payment}`;
    return { summary, lines };
  }
  if (entry.action === "budget_category.created") {
    const { name, allocation } = entry.details as AuditDetails<"budget_category.created">;
    return {
      summary: `Added the budget category ${name}`,
      lines: [`Allocation: ${formatAuditPeso(allocation)}`],
    };
  }
  if (entry.action === "budget_category.updated") {
    const { name, changes } = entry.details as AuditDetails<"budget_category.updated">;
    const lines: string[] = [];
    if (changes.name) lines.push(`Name: “${changes.name.from}” → “${changes.name.to}”`);
    if (changes.allocation) {
      lines.push(
        `Allocation: ${formatAuditPeso(changes.allocation.from)} → ${formatAuditPeso(changes.allocation.to)}`,
      );
    }
    return { summary: `Edited the budget category ${name}`, lines };
  }
  if (entry.action === "budget_category.deleted") {
    const { name, allocation } = entry.details as AuditDetails<"budget_category.deleted">;
    return {
      summary: `Removed the budget category ${name}`,
      lines: [`Allocation was ${formatAuditPeso(allocation)}`],
    };
  }
  if (entry.action === "budget_item.created") {
    const d = entry.details as AuditDetails<"budget_item.created">;
    return {
      summary: `Added the budget item ${d.name} (${d.reference}) to ${d.category}`,
      lines: [
        `Estimated: ${formatAuditPeso(d.estimated)}`,
        `Committed: ${formatAuditPeso(d.committed)}`,
        `Paid: ${formatAuditPeso(d.paid)}`,
      ],
    };
  }
  if (entry.action === "budget_item.updated") {
    const { reference, changes } = entry.details as AuditDetails<"budget_item.updated">;
    // A move leads the summary (as B4-20 does for quotes), so Activity says what happened.
    const summary = changes.category
      ? `Moved the budget item ${reference} to ${changes.category.to}`
      : `Edited the budget item ${reference}`;
    return { summary, lines: budgetItemChangeLines(changes) };
  }
  if (entry.action === "budget_item.deleted") {
    const { reference, name } = entry.details as AuditDetails<"budget_item.deleted">;
    return { summary: `Removed the budget item ${name} (${reference})`, lines: [] };
  }
  if (entry.action === "task.created") {
    const { reference, title, priority, status, dueDate, assignee } =
      entry.details as AuditDetails<"task.created">;
    const lines: string[] = [];
    if (priority) lines.push(`Priority: ${TASK_PRIORITY_LABEL[priority]}`);
    if (status) lines.push(`Status: ${TASK_STATUS_LABEL[status]}`);
    if (dueDate) lines.push(`Due ${auditDate(dueDate)}`);
    if (assignee) lines.push(`Assigned to ${assignee}`);
    return { summary: `Added the task ${title} (${reference})`, lines };
  }
  if (entry.action === "task.updated") {
    const { reference, title, changes } = entry.details as AuditDetails<"task.updated">;
    const lines: string[] = [];
    if (changes.title) lines.push(`Title: “${changes.title.from}” → “${changes.title.to}”`);
    if (changes.description) lines.push("Description changed");
    if (changes.priority) {
      lines.push(
        `Priority: ${TASK_PRIORITY_LABEL[changes.priority.from]} → ${TASK_PRIORITY_LABEL[changes.priority.to]}`,
      );
    }
    if (changes.status) {
      lines.push(
        `Status: ${TASK_STATUS_LABEL[changes.status.from]} → ${TASK_STATUS_LABEL[changes.status.to]}`,
      );
    }
    if (changes.dueDate) {
      const day = (value: string | null) => (value === null ? "none" : auditDate(value));
      lines.push(`Due date: ${day(changes.dueDate.from)} → ${day(changes.dueDate.to)}`);
    }
    if (changes.assignee) {
      lines.push(
        `Assignee: ${changes.assignee.from ?? "Unassigned"} → ${changes.assignee.to ?? "Unassigned"}`,
      );
    }
    return { summary: `Edited the task ${title} (${reference})`, lines };
  }
  if (entry.action === "task.deleted") {
    const { reference, title } = entry.details as AuditDetails<"task.deleted">;
    return { summary: `Removed the task ${title} (${reference})`, lines: [] };
  }
  if (entry.action === "impact_assumptions.updated") {
    const { changes } = entry.details as AuditDetails<"impact_assumptions.updated">;
    return { summary: "Changed the impact assumptions", lines: impactAssumptionLines(changes) };
  }
  if (entry.action === "impact_analysis.created") {
    const { reference, from, to, overall } =
      entry.details as AuditDetails<"impact_analysis.created">;
    const count = (n: number) => n.toLocaleString("en-US");
    return {
      summary: `Saved the impact analysis ${reference}: expected attendees ${count(from)} → ${count(to)}`,
      lines: [`Overall: ${IMPACT_SEVERITY_AUDIT_LABEL[overall]}`],
    };
  }
  if (entry.action === "attendees.exported") {
    const { count } = entry.details as AuditDetails<"attendees.exported">;
    return {
      summary: `Exported the guest list as CSV (${count === 1 ? "1 attendee" : `${count} attendees`})`,
      lines: [],
    };
  }
  if (entry.action === "attendees.imported") {
    return describeImport(
      ["attendee", "attendees"],
      entry.details as AuditDetails<"attendees.imported">,
    );
  }
  if (entry.action === "suppliers.imported") {
    return describeImport(
      ["supplier", "suppliers"],
      entry.details as AuditDetails<"suppliers.imported">,
    );
  }
  return { summary: "Made a change (details unavailable)", lines: [] };
}
/**
 * An import by counts and ID range (D-052, D-109), never names. Entries from before Batch 9 have no
 * file type: they were CSV files.
 */
function describeImport(
  [one, many]: [string, string],
  details: {
    count: number;
    first: string;
    last: string;
    skipped: number;
    fileType?: "csv" | "xlsx";
    aiSuggested?: boolean;
  },
): { summary: string; lines: string[] } {
  const { count, first, last, skipped } = details;
  const what = count === 1 ? `1 ${one}` : `${count} ${many}`;
  const range = count === 1 ? first : `${first} to ${last}`;
  const file = details.fileType === "xlsx" ? "an Excel file" : "a CSV file";
  const lines = skipped ? [`${skipped === 1 ? "1 row" : `${skipped} rows`} not imported`] : [];
  if (details.aiSuggested)
    lines.push("Column matching suggested by AI and checked before importing");
  return { summary: `Imported ${what} from ${file} (${range})`, lines };
}
/** Impact severities as shown in Activity (D-101). A test keeps it equal to the domain's. */
export const IMPACT_SEVERITY_AUDIT_LABEL: Record<
  "CRITICAL" | "NEEDS_ATTENTION" | "INFO" | "PASSED",
  string
> = {
  CRITICAL: "Critical",
  NEEDS_ATTENTION: "Needs attention",
  INFO: "Info",
  PASSED: "Passed",
};

function impactAssumptionLines(changes: ImpactAssumptionChanges): string[] {
  const lines: string[] = [];
  const peso = (v: string | null) => (v === null ? "not set" : formatAuditPeso(v));
  const ratio = (v: string | null) => (v === null ? "not set" : v.replace(/\.?0+$/, "") || "0");
  const name = (v: string | null) => (v === null ? "not set" : `“${v}”`);
  if (changes.cateringCostPerHead) {
    const c = changes.cateringCostPerHead;
    lines.push(`Catering cost per head: ${peso(c.from)} → ${peso(c.to)}`);
  }
  if (changes.accessibleSeatsPer100) {
    const c = changes.accessibleSeatsPer100;
    lines.push(`Accessible seats per 100 guests: ${ratio(c.from)} → ${ratio(c.to)}`);
  }
  if (changes.cateringCategory) {
    const c = changes.cateringCategory;
    lines.push(`Catering budget category: ${name(c.from)} → ${name(c.to)}`);
  }
  return lines;
}