// src/modules/events/sample-data.ts
// Dev-only sample data (D-041). While demo sign-in is on and no DATABASE_URL is set, the event
// reads and writes use this in-memory store instead of PostgreSQL, so the app can be clicked
// through before a database is connected. Everything else is the real code: pages, the access
// check, the permission matrix, validation and the audit registry.
//
// It follows the same rules as the database code it stands in for:
//   - events are returned only to members (non-members get null, like an unknown event, D-027),
//   - writes re-check the role (rolesAllowed), edits refuse stale versions (D-032),
//   - every create and edit records an audit entry through the audit registry's schemas (D-037).
// Since B2-02 it also holds sample attendees: adding (B2-02), editing (B2-03) and removing (B2-04)
// work like the database (members with attendees.manage only, per-event ATT numbers that are never
// reused, stale edits refused, audit entries). Since B4-03 it also holds sample suppliers, with
// per-event SUP numbers that are never reused (D-068), and since B4-09 their quotes (D-075), with
// amounts kept as canonical strings and at most one Accepted quote per supplier (D-076), and since
// B4-14 their payments (D-077), with dates as calendar-day strings.
// Changes live in memory only and reset when `npm run dev` restarts. Never used in a build:
// isSampleDataMode() needs NODE_ENV=development and `next build` refuses DEV_DEMO_AUTH=true.
import "server-only";
import type {
  AccessibilityRequirementType,
  AccessibilityResourceType,
  EventStatus,
  MemberRole,
  RequirementPriority,
  PaymentKind,
  PaymentRecordStatus,
  QuoteStatus,
  ResourceStatus,
  SupplierCategory,
} from "@/generated/prisma/client";
import { DEMO_USER } from "@/lib/demo-auth";
import {
  AUDIT_ACTIONS,
  RSVP_STATUSES,
  type AuditAction,
  type AuditEntryView,
} from "@/modules/events/audit/public";
import type { CreatedEvent } from "./create-event";
import type { DeleteEventResult } from "./delete-event";
import type { EventDetails, EventListItem } from "./list";
import { rolesAllowed } from "./permissions";
import { formatEventReference, manilaYear } from "./reference";
import { eventChanges, type NewEvent } from "./schema";
import type { UpdateEventResult } from "./update-event";

type SampleEvent = Omit<EventDetails, "role"> & { createdAt: Date };
type SampleMember = { eventId: string; userId: string; role: MemberRole };
type SampleAudit = {
  id: string;
  eventId: string;
  actorId: string;
  action: AuditAction;
  details: unknown;
  createdAt: Date;
  /** The record the entry is about; optional, like the database's nullable entityId. */
  entityId?: string | null;
};
/** An attendee's editable fields, as the attendees context validates them (D-042). */
export type SampleAttendeeInput = {
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  rsvpStatus: (typeof RSVP_STATUSES)[number];
  plusOnes: number;
  dietaryNeeds: string | null;
  notes: string | null;
};
/** One attendee as the guest list reads it (same shape as the attendees context's records). */
export type SampleAttendee = SampleAttendeeInput & { id: string; number: number; updatedAt: Date };
type StoredAttendee = SampleAttendee & { eventId: string };
/** An attendee's accessibility requirement, as the accessibility context validates it (D-056). */
export type SampleRequirementInput = {
  type: AccessibilityRequirementType;
  priority: RequirementPriority;
  note: string | null;
};
/** One stored requirement (same shape as the accessibility context's records). */
export type SampleRequirement = SampleRequirementInput & {
  id: string;
  attendeeId: string;
  updatedAt: Date;
};
type StoredRequirement = SampleRequirement & { eventId: string };
/** An event accessibility resource's editable values (B3-05, D-056). */
export type SampleResourceInput = {
  status: ResourceStatus;
  quantity: number | null;
  note: string | null;
};
/** One stored resource (same shape as the accessibility context's records). */
export type SampleResource = SampleResourceInput & {
  id: string;
  type: AccessibilityResourceType;
  updatedAt: Date;
};
type StoredResource = SampleResource & { eventId: string };

/** A supplier's editable values (B4-03, D-068), as the suppliers context validates them. */
export type SampleSupplierInput = {
  name: string;
  category: SupplierCategory;
  categoryDetail: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};
/** One stored supplier (same shape as the suppliers context's records). */
export type SampleSupplier = SampleSupplierInput & { id: string; number: number; updatedAt: Date };
type StoredSupplier = SampleSupplier & { eventId: string };
/** A quote's editable values (B4-09, D-075): the amount is a canonical string, "120000.50". */
export type SampleQuoteInput = { amount: string; status: QuoteStatus; description: string | null };
/** One stored quote (same shape as the suppliers context's quote records). */
export type SampleQuote = SampleQuoteInput & {
  id: string;
  supplierId: string;
  number: number;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
type StoredQuote = SampleQuote & { eventId: string };
/** A payment's editable values (B4-14, D-077): amount and dates are canonical strings. */
export type SamplePaymentInput = {
  kind: PaymentKind;
  amount: string;
  dueDate: string;
  status: PaymentRecordStatus;
  paidOn: string | null;
  description: string | null;
};
/** One stored payment (same shape as the suppliers context's payment records). */
export type SamplePayment = SamplePaymentInput & {
  id: string;
  supplierId: string;
  number: number;
  createdAt: Date;
  updatedAt: Date;
};
type StoredPayment = SamplePayment & { eventId: string };

type SampleStore = {
  users: Map<string, string>;
  events: SampleEvent[];
  members: SampleMember[];
  audit: SampleAudit[];
  attendees: StoredAttendee[];
  /** Last attendee number issued per event, like events.lastAttendeeNumber: never reused. */
  lastAttendeeNumber: Map<string, number>;
  /** Accessibility requirements (B3-03); removed with their attendee or event, like the cascade. */
  requirements: StoredRequirement[];
  /** Event accessibility resources (B3-05); at most one per type per event; removed with the event. */
  resources: StoredResource[];
  /** Suppliers (B4-03); removed with the event, like the cascade. */
  suppliers: StoredSupplier[];
  /** Last supplier number issued per event, like events.lastSupplierNumber: never reused. */
  lastSupplierNumber: Map<string, number>;
  /** Supplier quotes (B4-09); removed with their supplier or event, like the cascade. */
  quotes: StoredQuote[];
  /** Last quote number issued per event, like events.lastQuoteNumber: never reused. */
  lastQuoteNumber: Map<string, number>;
  /** Supplier payments (B4-14); removed with their supplier or event, like the cascade. */
  payments: StoredPayment[];
  /** Last payment number issued per event, like events.lastPaymentNumber: never reused. */
  lastPaymentNumber: Map<string, number>;
};

const MIKA = "5e000000-0000-4000-8000-0000000000a1";
const PAOLO = "5e000000-0000-4000-8000-0000000000a2";

/** Fixed sample event IDs, so links stay valid across restarts. */
export const SAMPLE_EVENT_IDS = {
  wedding: "5e000000-0000-4000-8000-000000000001",
  summit: "5e000000-0000-4000-8000-000000000002",
  reunion: "5e000000-0000-4000-8000-000000000003",
  yearEnd: "5e000000-0000-4000-8000-000000000004",
  debut: "5e000000-0000-4000-8000-000000000005",
  /** The demo user is not a member: opening it must show "not found". */
  otherTeam: "5e000000-0000-4000-8000-000000000006",
} as const;

const at = (iso: string) => new Date(iso);

function seed(): SampleStore {
  const ids = SAMPLE_EVENT_IDS;
  const event = (
    id: string,
    sequence: number,
    fields: Omit<SampleEvent, "id" | "reference" | "createdAt" | "updatedAt">,
    createdAt: string,
    updatedAt = createdAt,
  ): SampleEvent => ({
    id,
    reference: formatEventReference(2026, sequence),
    ...fields,
    createdAt: at(createdAt),
    updatedAt: at(updatedAt),
  });

  const events: SampleEvent[] = [
    event(
      ids.wedding,
      1,
      {
        name: "Santos–Lim Wedding Reception",
        venue: "Shangri-La Mactan, Lapu-Lapu City, Cebu",
        description: "Reception for 180 guests. Plated dinner, live band, photo booth.",
        startsAt: at("2026-12-12T08:00:00Z"),
        endsAt: at("2026-12-12T14:00:00Z"),
        status: "PLANNING" as EventStatus,
        capacity: 200,
        expectedAttendees: 180,
      },
      "2026-10-03T02:10:00Z",
      "2026-10-08T06:45:00Z",
    ),
    event(
      ids.summit,
      2,
      {
        name: "Cebu Tech Summit 2026",
        venue: "Waterfront Cebu City Hotel",
        description: "One-day conference with two tracks and a sponsor hall.",
        startsAt: at("2026-11-20T00:00:00Z"),
        endsAt: at("2026-11-20T10:00:00Z"),
        status: "PLANNING" as EventStatus,
        capacity: 500,
        expectedAttendees: 420,
      },
      "2026-10-04T01:00:00Z",
    ),
    event(
      ids.reunion,
      3,
      {
        name: "Reyes Family Reunion",
        venue: null,
        description: null,
        startsAt: at("2027-01-09T02:00:00Z"),
        endsAt: null,
        status: "DRAFT" as EventStatus,
        capacity: null,
        expectedAttendees: 60,
      },
      "2026-10-06T09:30:00Z",
    ),
    event(
      ids.yearEnd,
      4,
      {
        name: "Makati Year-End Party",
        venue: "Makati Shangri-La, Manila",
        description: "Company year-end party with awards night.",
        startsAt: at("2026-12-18T10:00:00Z"),
        endsAt: at("2026-12-18T15:00:00Z"),
        status: "PLANNING" as EventStatus,
        capacity: 300,
        expectedAttendees: 250,
      },
      "2026-10-05T03:00:00Z",
    ),
    event(
      ids.debut,
      5,
      {
        name: "Dela Cruz Debut",
        venue: "Casino Español de Cebu",
        description: "18th birthday celebration.",
        startsAt: at("2026-08-22T10:00:00Z"),
        endsAt: at("2026-08-22T15:00:00Z"),
        status: "COMPLETED" as EventStatus,
        capacity: 150,
        expectedAttendees: 120,
      },
      "2026-07-01T04:00:00Z",
    ),
    event(
      ids.otherTeam,
      6,
      {
        name: "Other Team Gala",
        venue: "Marco Polo Plaza, Cebu",
        description: null,
        startsAt: at("2026-12-05T11:00:00Z"),
        endsAt: null,
        status: "PLANNING" as EventStatus,
        capacity: null,
        expectedAttendees: 90,
      },
      "2026-10-07T05:00:00Z",
    ),
  ];

  const me = DEMO_USER.id;
  const members: SampleMember[] = [
    { eventId: ids.wedding, userId: me, role: "OWNER" },
    { eventId: ids.summit, userId: MIKA, role: "OWNER" },
    { eventId: ids.summit, userId: me, role: "COORDINATOR" },
    { eventId: ids.reunion, userId: me, role: "OWNER" },
    { eventId: ids.yearEnd, userId: PAOLO, role: "OWNER" },
    { eventId: ids.yearEnd, userId: me, role: "VIEWER" },
    { eventId: ids.debut, userId: me, role: "OWNER" },
    { eventId: ids.otherTeam, userId: PAOLO, role: "OWNER" },
  ];

  const ownerOf = (eventId: string) =>
    members.find((m) => m.eventId === eventId && m.role === "OWNER")!.userId;
  const audit: SampleAudit[] = events.map((e, index) => ({
    id: `5e000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    eventId: e.id,
    actorId: ownerOf(e.id),
    action: "event.created",
    details: { reference: e.reference, name: e.name },
    createdAt: e.createdAt,
  }));
  audit.push(
    {
      id: "5e000000-0000-4000-8000-000000000201",
      eventId: ids.wedding,
      actorId: me,
      action: "event.updated",
      details: { changes: { expectedAttendees: { from: 150, to: 180 } } },
      createdAt: at("2026-10-06T03:20:00Z"),
    },
    {
      id: "5e000000-0000-4000-8000-000000000202",
      eventId: ids.wedding,
      actorId: me,
      action: "event.updated",
      details: {
        changes: {
          venue: {
            from: "Waterfront Hotel, Cebu",
            to: "Shangri-La Mactan, Lapu-Lapu City, Cebu",
          },
          capacity: { from: 180, to: 200 },
        },
      },
      createdAt: at("2026-10-08T06:45:00Z"),
    },
  );

  const attendees = seedAttendees();
  const lastAttendeeNumber = new Map<string, number>();
  for (const a of attendees) {
    lastAttendeeNumber.set(a.eventId, Math.max(lastAttendeeNumber.get(a.eventId) ?? 0, a.number));
  }

  return {
    users: new Map([
      [me, DEMO_USER.displayName],
      [MIKA, "Mika Santos"],
      [PAOLO, "Paolo Reyes"],
    ]),
    events,
    members,
    audit,
    attendees,
    lastAttendeeNumber,
    requirements: seedRequirements(),
    resources: seedResources(),
    suppliers: seedSuppliers(),
    lastSupplierNumber: new Map([[SAMPLE_EVENT_IDS.wedding, 4]]),
    quotes: seedQuotes(),
    lastQuoteNumber: new Map([[SAMPLE_EVENT_IDS.wedding, 3]]),
    payments: seedPayments(),
    lastPaymentNumber: new Map([[SAMPLE_EVENT_IDS.wedding, 3]]),
  };
}

/**
 * Three payments (B4-14): the caterer's deposit paid and balance not yet, and the sound supplier's
 * deposit unpaid with an early due date, so the pages show Paid, Upcoming and Overdue.
 */
function seedPayments(): StoredPayment[] {
  const rows: [number, number, PaymentKind, string, string, string | null, string | null][] = [
    [1, 1, "DEPOSIT", "49500.00", "2026-10-05", "2026-10-03", "30% deposit"],
    [1, 2, "PAYMENT", "115500.00", "2026-12-05", null, "Balance"],
    [2, 3, "DEPOSIT", "15000.00", "2026-10-10", null, null],
  ];
  return rows.map(([supplier, number, kind, amount, dueDate, paidOn, description]) => ({
    id: `5e000000-0000-4000-8000-5c0${String(number).padStart(9, "0")}`,
    eventId: SAMPLE_EVENT_IDS.wedding,
    supplierId: `5e000000-0000-4000-8000-5a0${String(supplier).padStart(9, "0")}`,
    number,
    kind,
    amount,
    dueDate,
    status: paidOn ? "PAID" : "UNPAID",
    paidOn,
    description,
    createdAt: at("2026-10-01T04:00:00Z"),
    updatedAt: at("2026-10-03T04:00:00Z"),
  }));
}

/** Three quotes: two from the caterer (one Accepted), one Pending from the sound supplier (B4-09). */
function seedQuotes(): StoredQuote[] {
  const rows: [number, number, string, QuoteStatus, string | null][] = [
    [1, 1, "180000.00", "DECLINED", "Plated dinner, 220 guests"],
    [1, 2, "165000.00", "ACCEPTED", "Buffet, 220 guests"],
    [2, 3, "45000.00", "PENDING", null],
  ];
  return rows.map(([supplier, number, amount, status, description]) => ({
    id: `5e000000-0000-4000-8000-5b0${String(number).padStart(9, "0")}`,
    eventId: SAMPLE_EVENT_IDS.wedding,
    supplierId: `5e000000-0000-4000-8000-5a0${String(supplier).padStart(9, "0")}`,
    number,
    amount,
    status,
    description,
    statusChangedAt: at("2026-10-11T04:00:00Z"),
    createdAt: at("2026-10-10T04:00:00Z"),
    updatedAt: at("2026-10-11T04:00:00Z"),
  }));
}

/** Four of the wedding's suppliers, so the supplier list has something to show (B4-03). */
function seedSuppliers(): StoredSupplier[] {
  const rows: [
    string,
    SupplierCategory,
    string | null,
    string | null,
    string | null,
    string | null,
  ][] = [
    [
      "Garden Kitchen",
      "CATERING",
      "Liza Tan",
      "0917 555 0101",
      "hello@gardenkitchen.ph",
      "Tasting on Nov 3",
    ],
    ["Loud Studio", "SOUND_AND_LIGHTS", "Rico Mendoza", "0918 555 0102", null, null],
    ["Bloom Co.", "FLOWERS_AND_STYLING", null, null, "orders@bloomco.ph", "Peonies if in season"],
    ["Sparkle Lights", "OTHER", "Joy Aquino", "0919 555 0104", null, null],
  ];
  return rows.map(([name, category, contactName, phone, email, notes], index) => ({
    id: `5e000000-0000-4000-8000-5a0${String(index + 1).padStart(9, "0")}`,
    eventId: SAMPLE_EVENT_IDS.wedding,
    number: index + 1,
    name,
    category,
    categoryDetail: category === "OTHER" ? "Fireworks" : null,
    contactName,
    email,
    phone,
    notes,
    updatedAt: at("2026-10-10T04:00:00Z"),
  }));
}

/** Some of the wedding's resources set up, so the Accessibility page shows each status. */
function seedResources(): StoredResource[] {
  const rows: [AccessibilityResourceType, ResourceStatus, number | null, string | null][] = [
    ["ACCESSIBLE_SEATS", "AVAILABLE", 2, "Front left, beside the aisle"],
    ["ACCESSIBLE_ENTRANCE", "AVAILABLE", null, "Side entrance on the garden level"],
    ["CAPTIONING", "ARRANGING", null, null],
    ["SIGN_LANGUAGE", "NOT_AVAILABLE", null, null],
  ];
  return rows.map(([type, status, quantity, note], index) => ({
    id: `5e000000-0000-4000-8000-a12${String(index + 1).padStart(9, "0")}`,
    eventId: SAMPLE_EVENT_IDS.wedding,
    type,
    status,
    quantity,
    note,
    updatedAt: at("2026-10-10T03:00:00Z"),
  }));
}

/** A few accessibility needs on the wedding guest list, so the details page has something to show. */
function seedRequirements(): StoredRequirement[] {
  const wedding = SAMPLE_EVENT_IDS.wedding;
  const guest = (number: number) =>
    `5e000000-0000-4000-8000-${wedding.slice(-3)}${String(number).padStart(9, "0")}`;
  const rows: [number, AccessibilityRequirementType, RequirementPriority, string | null][] = [
    [1, "ACCESSIBLE_SEATING", "REQUIRED", "Near the aisle, close to an exit"],
    [1, "STEP_FREE_ENTRANCE", "REQUIRED", "Uses a power wheelchair"],
    [8, "CAPTIONING", "PREFERRED", null],
  ];
  return rows.map(([number, type, priority, note], index) => ({
    id: `5e000000-0000-4000-8000-a11${String(index + 1).padStart(9, "0")}`,
    eventId: wedding,
    attendeeId: guest(number),
    type,
    priority,
    note,
    updatedAt: at("2026-10-10T02:00:00Z"),
  }));
}

/** Sample guests. The Reyes Family Reunion has none, so the empty guest list can be seen too. */
function seedAttendees(): StoredAttendee[] {
  const ids = SAMPLE_EVENT_IDS;
  type Row = [string, (typeof RSVP_STATUSES)[number], number, Partial<SampleAttendeeInput>?];
  const guests: Record<string, Row[]> = {
    [ids.wedding]: [
      ["Ana Reyes", "CONFIRMED", 1, { category: "Family", dietaryNeeds: "Vegetarian" }],
      ["Ben Lim", "CONFIRMED", 0, { category: "Family", email: "ben.lim@example.com" }],
      ["Carla Santos", "PENDING", 2, { category: "Family", phone: "0917 555 0101" }],
      ["Diego Tan", "MAYBE", 0, { category: "Friends", notes: "Confirming after his flight" }],
      ["Elena Cruz", "CONFIRMED", 1, { category: "Friends", dietaryNeeds: "No shellfish" }],
      ["Felix Uy", "DECLINED", 0, { category: "Colleagues" }],
      ["Grace Villanueva", "PENDING", 0, { category: "Colleagues" }],
      ["Hector Ramos", "CONFIRMED", 3, { category: "Family", notes: "Bringing his three kids" }],
    ],
    [ids.summit]: [
      ["Ivy Navarro", "CONFIRMED", 0, { category: "Speakers" }],
      ["Jun Mercado", "CONFIRMED", 0, { category: "Sponsors", email: "jun@sponsor.example" }],
      ["Kai Domingo", "PENDING", 0, { category: "Attendees" }],
      ["Lea Bautista", "MAYBE", 1, { category: "Attendees", dietaryNeeds: "Halal" }],
    ],
    [ids.yearEnd]: [
      ["Mon Garcia", "CONFIRMED", 1, { category: "Finance", dietaryNeeds: "No pork; low sugar" }],
      ["Nina Ocampo", "PENDING", 0, { category: "Operations" }],
      ["Oscar Dizon", "DECLINED", 0, { category: "Operations" }],
    ],
    [ids.debut]: [
      ["Pia Dela Cruz", "CONFIRMED", 0, { category: "Family" }],
      ["Quin Salazar", "CONFIRMED", 1, { category: "Friends" }],
    ],
  };
  return Object.entries(guests).flatMap(([eventId, rows]) =>
    rows.map(([name, rsvpStatus, plusOnes, extra], index) => ({
      id: `5e000000-0000-4000-8000-${eventId.slice(-3)}${String(index + 1).padStart(9, "0")}`,
      eventId,
      number: index + 1,
      name,
      email: null,
      phone: null,
      category: null,
      rsvpStatus,
      plusOnes,
      dietaryNeeds: null,
      notes: null,
      ...extra,
      updatedAt: at("2026-10-09T02:00:00Z"),
    })),
  );
}

// Kept on globalThis so every part of the dev server (pages, actions, route handlers) and hot
// reloads share one store.
// The key has a version: a dev server still holding an older store shape after a code update
// starts a fresh one instead of failing.
const globalStore = globalThis as typeof globalThis & { __eventopsSampleDataV6?: SampleStore };

function store(): SampleStore {
  globalStore.__eventopsSampleDataV6 ??= seed();
  return globalStore.__eventopsSampleDataV6;
}

/** Back to the seeded samples. For tests. */
export function resetSampleData(): void {
  globalStore.__eventopsSampleDataV6 = seed();
}

function roleOf(s: SampleStore, eventId: string, userId: string): MemberRole | null {
  return s.members.find((m) => m.eventId === eventId && m.userId === userId)?.role ?? null;
}

/** The list fields only: an explicit allow-list, like the database query (LIST_FIELDS). */
function toListItem(event: SampleEvent, role: MemberRole): EventListItem {
  // Copies, so callers can never change the store by accident.
  return {
    id: event.id,
    reference: event.reference,
    name: event.name,
    venue: event.venue,
    startsAt: new Date(event.startsAt),
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
    status: event.status,
    expectedAttendees: event.expectedAttendees,
    role,
  };
}

function toDetails(event: SampleEvent, role: MemberRole): EventDetails {
  return {
    ...toListItem(event, role),
    description: event.description,
    capacity: event.capacity,
    updatedAt: new Date(event.updatedAt),
  };
}

function addAudit<A extends AuditAction>(
  s: SampleStore,
  entry: {
    eventId: string;
    actorId: string;
    action: A;
    details: unknown;
    now: Date;
    /** The record the entry is about, like the database's entityId (B4-07). */
    entityId?: string;
  },
): void {
  // The same strict schemas as the database writer: an invalid entry throws.
  const details = AUDIT_ACTIONS[entry.action].details.parse(entry.details);
  s.audit.push({
    id: crypto.randomUUID(),
    eventId: entry.eventId,
    actorId: entry.actorId,
    action: entry.action,
    details,
    createdAt: entry.now,
    entityId: entry.entityId ?? null,
  });
}

/** Stand-in for listEventsForUser. */
export function sampleListEvents(userId: string): EventListItem[] {
  const s = store();
  return s.events
    .flatMap((event) => {
      const role = roleOf(s, event.id, userId);
      return role ? [toListItem(event, role)] : [];
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Stand-in for getEventForMember: null for unknown events and for non-members alike. */
export function sampleGetEventForMember(eventId: string, userId: string): EventDetails | null {
  const s = store();
  const event = s.events.find((e) => e.id === eventId);
  const role = event ? roleOf(s, eventId, userId) : null;
  return event && role ? toDetails(event, role) : null;
}

/** Stand-in for createEvent: next reference number, creator as OWNER, "event.created" entry. */
export function sampleCreateEvent(args: {
  event: NewEvent;
  creatorId: string;
  now: Date;
}): CreatedEvent {
  const s = store();
  const year = manilaYear(args.now);
  const prefix = `EVT-${year}-`;
  const last = s.events
    .filter((e) => e.reference.startsWith(prefix))
    .reduce((max, e) => Math.max(max, Number(e.reference.slice(prefix.length))), 0);
  const created: SampleEvent = {
    id: crypto.randomUUID(),
    reference: formatEventReference(year, last + 1),
    ...args.event,
    status: "DRAFT",
    createdAt: args.now,
    updatedAt: args.now,
  };
  if (!s.users.has(args.creatorId)) s.users.set(args.creatorId, DEMO_USER.displayName);
  s.events.push(created);
  s.members.push({ eventId: created.id, userId: args.creatorId, role: "OWNER" });
  addAudit(s, {
    eventId: created.id,
    actorId: args.creatorId,
    action: "event.created",
    details: { reference: created.reference, name: created.name },
    now: args.now,
  });
  return { id: created.id, reference: created.reference };
}

/** Stand-in for updateEvent: role re-check, stale-version check, "event.updated" entry. */
export function sampleUpdateEvent(args: {
  eventId: string;
  editorId: string;
  version: Date;
  details: NewEvent;
  now?: Date;
}): UpdateEventResult {
  const s = store();
  const event = s.events.find((e) => e.id === args.eventId);
  const role = event ? roleOf(s, args.eventId, args.editorId) : null;
  if (!event || !role || !rolesAllowed("event.edit").includes(role)) {
    return { ok: false, reason: "not-found" };
  }
  if (event.updatedAt.getTime() !== args.version.getTime()) return { ok: false, reason: "stale" };

  const changes = eventChanges(event, args.details);
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max((args.now ?? new Date()).getTime(), event.updatedAt.getTime() + 1));
  if (Object.keys(changes).length > 0) {
    addAudit(s, {
      eventId: event.id,
      actorId: args.editorId,
      action: "event.updated",
      details: { changes },
      now,
    });
  }
  Object.assign(event, args.details, { updatedAt: now });
  return { ok: true };
}

/** Stand-in for deleteEvent: only roles allowed to delete; its members and activity go too. */
export function sampleDeleteEvent(args: { eventId: string; userId: string }): DeleteEventResult {
  const s = store();
  const role = roleOf(s, args.eventId, args.userId);
  if (!role || !rolesAllowed("event.delete").includes(role)) return { ok: false };
  s.events = s.events.filter((e) => e.id !== args.eventId);
  s.members = s.members.filter((m) => m.eventId !== args.eventId);
  s.audit = s.audit.filter((a) => a.eventId !== args.eventId);
  s.attendees = s.attendees.filter((a) => a.eventId !== args.eventId);
  s.requirements = s.requirements.filter((r) => r.eventId !== args.eventId);
  s.resources = s.resources.filter((r) => r.eventId !== args.eventId);
  s.suppliers = s.suppliers.filter((x) => x.eventId !== args.eventId);
  s.quotes = s.quotes.filter((x) => x.eventId !== args.eventId);
  s.payments = s.payments.filter((x) => x.eventId !== args.eventId);
  return { ok: true };
}

/** Stand-in for listAttendees: this event's attendees, by name, then number. Copies. */
export function sampleListAttendees(eventId: string): SampleAttendee[] {
  return store()
    .attendees.filter((a) => a.eventId === eventId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.number - b.number)
    .map((a) => ({
      id: a.id,
      number: a.number,
      name: a.name,
      email: a.email,
      phone: a.phone,
      category: a.category,
      rsvpStatus: a.rsvpStatus,
      plusOnes: a.plusOnes,
      dietaryNeeds: a.dietaryNeeds,
      notes: a.notes,
      updatedAt: new Date(a.updatedAt),
    }));
}

/** Stand-in for getAttendee: only if it belongs to this event. Null otherwise. A copy. */
export function sampleGetAttendee(eventId: string, attendeeId: string): SampleAttendee | null {
  return sampleListAttendees(eventId).find((a) => a.id === attendeeId) ?? null;
}

/**
 * Stand-in for updateAttendee: attendees.manage re-checked here, stale versions refused (D-032),
 * and an attendee.updated entry. `changes` is the audit diff the caller computed with the attendees
 * context's rules; it is validated by the audit registry like every entry.
 */
export function sampleUpdateAttendee(args: {
  eventId: string;
  attendeeId: string;
  editorId: string;
  version: Date;
  details: SampleAttendeeInput;
  changes: Record<string, unknown>;
  now: Date;
}): { ok: true } | { ok: false; reason: "stale" | "not-found" } {
  const s = store();
  const attendee = s.attendees.find((a) => a.id === args.attendeeId && a.eventId === args.eventId);
  const role = roleOf(s, args.eventId, args.editorId);
  if (!attendee || !role || !rolesAllowed("attendees.manage").includes(role)) {
    return { ok: false, reason: "not-found" };
  }
  if (attendee.updatedAt.getTime() !== args.version.getTime())
    return { ok: false, reason: "stale" };
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max(args.now.getTime(), attendee.updatedAt.getTime() + 1));
  if (Object.keys(args.changes).length > 0) {
    addAudit(s, {
      eventId: args.eventId,
      actorId: args.editorId,
      action: "attendee.updated",
      details: {
        reference: `ATT-${String(attendee.number).padStart(4, "0")}`,
        changes: args.changes,
      },
      now,
    });
  }
  Object.assign(attendee, args.details, { updatedAt: now });
  return { ok: true };
}

/** Stand-in for deleteAttendee: attendees.manage re-checked, only in its own event, an entry kept. */
export function sampleDeleteAttendee(args: {
  eventId: string;
  attendeeId: string;
  userId: string;
  now: Date;
}): { ok: true; reference: string } | { ok: false } {
  const s = store();
  const attendee = s.attendees.find((a) => a.id === args.attendeeId && a.eventId === args.eventId);
  const role = roleOf(s, args.eventId, args.userId);
  if (!attendee || !role || !rolesAllowed("attendees.manage").includes(role)) return { ok: false };
  const reference = `ATT-${String(attendee.number).padStart(4, "0")}`;
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.userId,
    action: "attendee.deleted",
    details: { reference, name: attendee.name },
    now: args.now,
  });
  s.attendees = s.attendees.filter((a) => a !== attendee);
  // Like the composite foreign key's cascade (D-056): the attendee's requirements go with them.
  s.requirements = s.requirements.filter((r) => r.attendeeId !== attendee.id);
  return { ok: true, reference };
}

/**
 * Stand-in for createAttendee: members with attendees.manage only (re-checked here, like the
 * database), the event's next ATT number, and an attendee.created entry.
 */
export function sampleCreateAttendee(args: {
  eventId: string;
  creatorId: string;
  attendee: SampleAttendeeInput;
  now: Date;
}): { ok: true; attendee: { id: string; reference: string } } | { ok: false } {
  const s = store();
  const role = roleOf(s, args.eventId, args.creatorId);
  if (!s.events.some((e) => e.id === args.eventId) || !role) return { ok: false };
  if (!rolesAllowed("attendees.manage").includes(role)) return { ok: false };

  // Only counts up, so a removed attendee's number is never given out again (D-042).
  const number = (s.lastAttendeeNumber.get(args.eventId) ?? 0) + 1;
  s.lastAttendeeNumber.set(args.eventId, number);
  const reference = `ATT-${String(number).padStart(4, "0")}`;
  const id = crypto.randomUUID();
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.creatorId,
    action: "attendee.created",
    details: { reference, name: args.attendee.name },
    now: args.now,
  });
  s.attendees.push({ ...args.attendee, id, eventId: args.eventId, number, updatedAt: args.now });
  return { ok: true, attendee: { id, reference } };
}

/**
 * Stand-in for importAttendees (B2-18, D-052): members with import.run only, the next N numbers,
 * every attendee added, and one attendees.imported entry. All or nothing.
 */
export function sampleImportAttendees(args: {
  eventId: string;
  importerId: string;
  attendees: SampleAttendeeInput[];
  skipped: number;
  now: Date;
}): { ok: true; count: number; first: string; last: string } | { ok: false } {
  const s = store();
  const role = roleOf(s, args.eventId, args.importerId);
  const count = args.attendees.length;
  if (!s.events.some((e) => e.id === args.eventId) || !role || count === 0) return { ok: false };
  if (!rolesAllowed("import.run").includes(role)) return { ok: false };

  const start = (s.lastAttendeeNumber.get(args.eventId) ?? 0) + 1;
  const ref = (n: number) => `ATT-${String(n).padStart(4, "0")}`;
  const first = ref(start);
  const last = ref(start + count - 1);
  // The entry is checked before anything changes, so a refused entry leaves the store untouched.
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.importerId,
    action: "attendees.imported",
    details: { count, first, last, skipped: args.skipped },
    now: args.now,
  });
  args.attendees.forEach((attendee, i) => {
    s.attendees.push({
      ...attendee,
      id: crypto.randomUUID(),
      eventId: args.eventId,
      number: start + i,
      updatedAt: args.now,
    });
  });
  s.lastAttendeeNumber.set(args.eventId, start + count - 1);
  return { ok: true, count, first, last };
}

/**
 * Stand-in for exportAttendees (B2-19, D-053): members with attendees.export only (re-checked
 * here), the event's attendees in ID order, and an attendees.exported entry.
 */
export function sampleExportAttendees(args: {
  eventId: string;
  userId: string;
  now: Date;
}): SampleAttendee[] | null {
  const s = store();
  const role = roleOf(s, args.eventId, args.userId);
  if (!role || !rolesAllowed("attendees.export").includes(role)) return null;
  const attendees = s.attendees
    .filter((a) => a.eventId === args.eventId)
    .sort((a, b) => a.number - b.number)
    .map((a) => ({ ...a }));
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.userId,
    action: "attendees.exported",
    details: { count: attendees.length },
    now: args.now,
  });
  return attendees;
}

// ───────────────────────── Accessibility (B3-03) ─────────────────────────

const attendeeReference = (number: number) => `ATT-${String(number).padStart(4, "0")}`;

function mayManageAccessibility(s: SampleStore, eventId: string, userId: string): boolean {
  const role = roleOf(s, eventId, userId);
  return role !== null && rolesAllowed("accessibility.manage").includes(role);
}

function copyRequirement(r: StoredRequirement): SampleRequirement {
  return {
    id: r.id,
    attendeeId: r.attendeeId,
    type: r.type,
    priority: r.priority,
    note: r.note,
    updatedAt: new Date(r.updatedAt),
  };
}

/** Stand-in for listing an attendee's requirements: this event and attendee only. Copies. */
export function sampleListRequirements(eventId: string, attendeeId: string): SampleRequirement[] {
  return store()
    .requirements.filter((r) => r.eventId === eventId && r.attendeeId === attendeeId)
    .map(copyRequirement);
}

/** Stand-in for creating a requirement: accessibility.manage re-checked, one per type, audited. */
export function sampleCreateRequirement(args: {
  eventId: string;
  attendeeId: string;
  actorId: string;
  input: SampleRequirementInput;
  now: Date;
}): { ok: true; id: string } | { ok: false; reason: "not-found" | "duplicate" } {
  const s = store();
  const attendee = s.attendees.find((a) => a.id === args.attendeeId && a.eventId === args.eventId);
  if (!attendee || !mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (
    s.requirements.some(
      (r) =>
        r.eventId === args.eventId &&
        r.attendeeId === args.attendeeId &&
        r.type === args.input.type,
    )
  ) {
    return { ok: false, reason: "duplicate" };
  }
  const id = crypto.randomUUID();
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_requirement.created",
    details: {
      reference: attendeeReference(attendee.number),
      type: args.input.type,
      priority: args.input.priority,
    },
    now: args.now,
  });
  s.requirements.push({
    ...args.input,
    id,
    eventId: args.eventId,
    attendeeId: args.attendeeId,
    updatedAt: args.now,
  });
  return { ok: true, id };
}

/** Stand-in for updating a requirement: accessibility.manage re-checked, stale saves refused. */
export function sampleUpdateRequirement(args: {
  eventId: string;
  attendeeId: string;
  requirementId: string;
  actorId: string;
  version: Date;
  input: SampleRequirementInput;
  changes: Record<string, unknown>;
  now: Date;
}): { ok: true } | { ok: false; reason: "not-found" | "stale" | "duplicate" } {
  const s = store();
  const requirement = s.requirements.find(
    (r) =>
      r.id === args.requirementId && r.eventId === args.eventId && r.attendeeId === args.attendeeId,
  );
  const attendee = s.attendees.find((a) => a.id === args.attendeeId && a.eventId === args.eventId);
  if (!requirement || !attendee || !mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (requirement.updatedAt.getTime() !== args.version.getTime()) {
    return { ok: false, reason: "stale" };
  }
  if (
    s.requirements.some(
      (r) => r !== requirement && r.attendeeId === args.attendeeId && r.type === args.input.type,
    )
  ) {
    return { ok: false, reason: "duplicate" };
  }
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max(args.now.getTime(), requirement.updatedAt.getTime() + 1));
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_requirement.updated",
    details: {
      reference: attendeeReference(attendee.number),
      type: args.input.type,
      changes: args.changes,
    },
    now,
  });
  Object.assign(requirement, args.input, { updatedAt: now });
  return { ok: true };
}

/** Stand-in for removing a requirement: accessibility.manage re-checked, an entry kept. */
export function sampleDeleteRequirement(args: {
  eventId: string;
  attendeeId: string;
  requirementId: string;
  actorId: string;
  now: Date;
}): { ok: true; type: AccessibilityRequirementType } | { ok: false; reason: "not-found" } {
  const s = store();
  const requirement = s.requirements.find(
    (r) =>
      r.id === args.requirementId && r.eventId === args.eventId && r.attendeeId === args.attendeeId,
  );
  const attendee = s.attendees.find((a) => a.id === args.attendeeId && a.eventId === args.eventId);
  if (!requirement || !attendee || !mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_requirement.deleted",
    details: { reference: attendeeReference(attendee.number), type: requirement.type },
    now: args.now,
  });
  s.requirements = s.requirements.filter((r) => r !== requirement);
  return { ok: true, type: requirement.type };
}

/** Stand-in for listing every requirement in the event with its guest, for readiness (B3-10). */
export function sampleListEventRequirements(eventId: string): {
  id: string;
  type: AccessibilityRequirementType;
  priority: RequirementPriority;
  attendee: {
    id: string;
    number: number;
    name: string;
    rsvpStatus: SampleAttendeeInput["rsvpStatus"];
  };
}[] {
  const s = store();
  return s.requirements.flatMap((r) => {
    if (r.eventId !== eventId) return [];
    const attendee = s.attendees.find((a) => a.id === r.attendeeId && a.eventId === eventId);
    if (!attendee) return [];
    return [
      {
        id: r.id,
        type: r.type,
        priority: r.priority,
        attendee: {
          id: attendee.id,
          number: attendee.number,
          name: attendee.name,
          rsvpStatus: attendee.rsvpStatus,
        },
      },
    ];
  });
}

/** Stand-in for listing the event's resources (B3-05). Copies. */
export function sampleListResources(eventId: string): SampleResource[] {
  return store()
    .resources.filter((r) => r.eventId === eventId)
    .map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      quantity: r.quantity,
      note: r.note,
      updatedAt: new Date(r.updatedAt),
    }));
}

/** Stand-in for setting up a resource: accessibility.manage re-checked, one per type, audited. */
export function sampleCreateResource(args: {
  eventId: string;
  type: AccessibilityResourceType;
  actorId: string;
  input: SampleResourceInput;
  now: Date;
}): { ok: true } | { ok: false; reason: "not-found" | "exists" } {
  const s = store();
  if (!s.events.some((e) => e.id === args.eventId)) return { ok: false, reason: "not-found" };
  if (!mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (s.resources.some((r) => r.eventId === args.eventId && r.type === args.type)) {
    return { ok: false, reason: "exists" };
  }
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_resource.created",
    details: { type: args.type, status: args.input.status, quantity: args.input.quantity },
    now: args.now,
  });
  s.resources.push({
    ...args.input,
    id: crypto.randomUUID(),
    eventId: args.eventId,
    type: args.type,
    updatedAt: args.now,
  });
  return { ok: true };
}

/** Stand-in for editing a resource: accessibility.manage re-checked, stale saves refused. */
export function sampleUpdateResource(args: {
  eventId: string;
  type: AccessibilityResourceType;
  actorId: string;
  version: Date;
  input: SampleResourceInput;
  changes: Record<string, unknown>;
  now: Date;
}): { ok: true } | { ok: false; reason: "not-found" | "stale" } {
  const s = store();
  const resource = s.resources.find((r) => r.eventId === args.eventId && r.type === args.type);
  if (!resource || !mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (resource.updatedAt.getTime() !== args.version.getTime()) {
    return { ok: false, reason: "stale" };
  }
  const now = new Date(Math.max(args.now.getTime(), resource.updatedAt.getTime() + 1));
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_resource.updated",
    details: { type: args.type, changes: args.changes },
    now,
  });
  Object.assign(resource, args.input, { updatedAt: now });
  return { ok: true };
}

/** Stand-in for removing a resource: accessibility.manage re-checked, an entry kept. */
export function sampleDeleteResource(args: {
  eventId: string;
  type: AccessibilityResourceType;
  actorId: string;
  now: Date;
}): { ok: true } | { ok: false; reason: "not-found" } {
  const s = store();
  const resource = s.resources.find((r) => r.eventId === args.eventId && r.type === args.type);
  if (!resource || !mayManageAccessibility(s, args.eventId, args.actorId)) {
    return { ok: false, reason: "not-found" };
  }
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.actorId,
    action: "accessibility_resource.deleted",
    details: { type: args.type },
    now: args.now,
  });
  s.resources = s.resources.filter((r) => r !== resource);
  return { ok: true };
}

// ───────────────────────── Suppliers (B4-03, D-068) ─────────────────────────

const supplierReference = (number: number) => `SUP-${String(number).padStart(4, "0")}`;

function mayManageSuppliers(s: SampleStore, eventId: string, userId: string): boolean {
  const role = roleOf(s, eventId, userId);
  return role !== null && rolesAllowed("suppliers.manage").includes(role);
}

function copySupplier(x: StoredSupplier): SampleSupplier {
  return {
    id: x.id,
    number: x.number,
    name: x.name,
    category: x.category,
    categoryDetail: x.categoryDetail,
    contactName: x.contactName,
    email: x.email,
    phone: x.phone,
    notes: x.notes,
    updatedAt: new Date(x.updatedAt),
  };
}

/** Stand-in for listing an event's suppliers: this event only, by name, then number. Copies. */
export function sampleListSuppliers(eventId: string): SampleSupplier[] {
  return store()
    .suppliers.filter((x) => x.eventId === eventId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.number - b.number)
    .map(copySupplier);
}

/** Stand-in for getSupplier: only if it belongs to this event. Null otherwise. A copy. */
export function sampleGetSupplier(eventId: string, supplierId: string): SampleSupplier | null {
  const found = store().suppliers.find((x) => x.id === supplierId && x.eventId === eventId);
  return found ? copySupplier(found) : null;
}

/**
 * Stand-in for updateSupplier: suppliers.manage re-checked here, stale versions refused (D-032),
 * and a supplier.updated entry. `changes` is the audit diff the caller computed with the suppliers
 * context's rules; it is validated by the audit registry like every entry.
 */
export function sampleUpdateSupplier(args: {
  eventId: string;
  supplierId: string;
  editorId: string;
  version: Date;
  details: SampleSupplierInput;
  changes: Record<string, unknown>;
  now: Date;
}): { ok: true } | { ok: false; reason: "stale" | "not-found" } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  if (!supplier || !mayManageSuppliers(s, args.eventId, args.editorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (supplier.updatedAt.getTime() !== args.version.getTime())
    return { ok: false, reason: "stale" };
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max(args.now.getTime(), supplier.updatedAt.getTime() + 1));
  if (Object.keys(args.changes).length > 0) {
    addAudit(s, {
      eventId: args.eventId,
      actorId: args.editorId,
      entityId: supplier.id,
      action: "supplier.updated",
      details: { reference: supplierReference(supplier.number), changes: args.changes },
      now,
    });
  }
  const { name, category, categoryDetail, contactName, email, phone, notes } = args.details;
  Object.assign(supplier, {
    name,
    category,
    categoryDetail,
    contactName,
    email,
    phone,
    notes,
    updatedAt: now,
  });
  return { ok: true };
}

/**
 * Stand-in for deleteSupplier (B4-05, D-072): members with suppliers.manage only, inside the event
 * only. The audit entry keeps the readable ID and name; the number is never reused.
 */
export function sampleDeleteSupplier(args: {
  eventId: string;
  supplierId: string;
  userId: string;
  now: Date;
}): { ok: true; reference: string } | { ok: false } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  if (!supplier || !mayManageSuppliers(s, args.eventId, args.userId)) return { ok: false };
  const reference = supplierReference(supplier.number);
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.userId,
    entityId: supplier.id,
    action: "supplier.deleted",
    details: { reference, name: supplier.name },
    now: args.now,
  });
  s.suppliers = s.suppliers.filter((x) => x !== supplier);
  // Like the composite foreign key's cascade (D-072, D-075): the supplier's quotes go with it.
  s.quotes = s.quotes.filter((q) => q.supplierId !== supplier.id);
  s.payments = s.payments.filter((p) => p.supplierId !== supplier.id);
  return { ok: true, reference };
}

/**
 * Stand-in for createSupplier: members with suppliers.manage only (re-checked here, like the
 * database), the event's next SUP number, and a supplier.created entry.
 */
export function sampleCreateSupplier(args: {
  eventId: string;
  creatorId: string;
  supplier: SampleSupplierInput;
  now: Date;
}): { ok: true; supplier: { id: string; reference: string } } | { ok: false } {
  const s = store();
  if (!s.events.some((e) => e.id === args.eventId)) return { ok: false };
  if (!mayManageSuppliers(s, args.eventId, args.creatorId)) return { ok: false };
  // Only counts up, so a removed supplier's number is never given out again (D-068).
  const number = (s.lastSupplierNumber.get(args.eventId) ?? 0) + 1;
  s.lastSupplierNumber.set(args.eventId, number);
  const reference = supplierReference(number);
  const id = crypto.randomUUID();
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.creatorId,
    entityId: id,
    action: "supplier.created",
    details: {
      reference,
      name: args.supplier.name,
      category: args.supplier.category,
      categoryDetail: args.supplier.categoryDetail,
    },
    now: args.now,
  });
  s.suppliers.push({ ...args.supplier, id, eventId: args.eventId, number, updatedAt: args.now });
  return { ok: true, supplier: { id, reference } };
}

// ───────────────────────── Quotes (B4-09, D-075, D-076) ─────────────────────────

const quoteReference = (number: number) => `QUO-${String(number).padStart(4, "0")}`;

function copyQuote(q: StoredQuote): SampleQuote {
  return {
    id: q.id,
    supplierId: q.supplierId,
    number: q.number,
    amount: q.amount,
    status: q.status,
    description: q.description,
    statusChangedAt: new Date(q.statusChangedAt),
    createdAt: new Date(q.createdAt),
    updatedAt: new Date(q.updatedAt),
  };
}

/** Stand-in for listSupplierQuotes: this event's supplier only, by number. Copies. */
export function sampleListQuotes(eventId: string, supplierId: string): SampleQuote[] {
  return store()
    .quotes.filter((q) => q.eventId === eventId && q.supplierId === supplierId)
    .sort((a, b) => a.number - b.number)
    .map(copyQuote);
}

/** Stand-in for getQuote: only if it belongs to this supplier of this event. A copy. */
export function sampleGetQuote(
  eventId: string,
  supplierId: string,
  quoteId: string,
): SampleQuote | null {
  const found = store().quotes.find(
    (q) => q.id === quoteId && q.eventId === eventId && q.supplierId === supplierId,
  );
  return found ? copyQuote(found) : null;
}

/** The supplier's Accepted quote other than `exceptId`, as its readable ID, or null (D-076). */
function sampleAcceptedQuote(s: SampleStore, supplierId: string, exceptId?: string) {
  const accepted = s.quotes.find(
    (q) => q.supplierId === supplierId && q.status === "ACCEPTED" && q.id !== exceptId,
  );
  return accepted ? quoteReference(accepted.number) : null;
}

/**
 * Stand-in for createQuote: suppliers.manage re-checked here, this event's supplier only, at most
 * one Accepted quote per supplier (D-076), the event's next QUO number, and a quote.created entry.
 */
export function sampleCreateQuote(args: {
  eventId: string;
  supplierId: string;
  creatorId: string;
  quote: SampleQuoteInput;
  now: Date;
}):
  | { ok: true; quote: { id: string; reference: string } }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "another-accepted"; reference: string } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  if (!supplier || !mayManageSuppliers(s, args.eventId, args.creatorId)) {
    return { ok: false, reason: "not-found" };
  }
  const accepted = args.quote.status === "ACCEPTED" ? sampleAcceptedQuote(s, supplier.id) : null;
  if (accepted) return { ok: false, reason: "another-accepted", reference: accepted };
  // Only counts up, so a number is never given out again (D-075).
  const number = (s.lastQuoteNumber.get(args.eventId) ?? 0) + 1;
  s.lastQuoteNumber.set(args.eventId, number);
  const reference = quoteReference(number);
  const id = crypto.randomUUID();
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.creatorId,
    entityId: id,
    action: "quote.created",
    details: {
      reference,
      supplierReference: supplierReference(supplier.number),
      amount: args.quote.amount,
      status: args.quote.status,
      description: args.quote.description,
    },
    now: args.now,
  });
  s.quotes.push({
    ...args.quote,
    id,
    eventId: args.eventId,
    supplierId: supplier.id,
    number,
    statusChangedAt: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });
  return { ok: true, quote: { id, reference } };
}

/**
 * Stand-in for updateQuote: suppliers.manage re-checked here, this supplier's quote in this event
 * only, stale versions refused (D-032), at most one Accepted quote per supplier (D-076), and a
 * quote.updated entry when something changed. `changes` is the audit diff the caller computed with
 * the suppliers context's rules.
 */
export function sampleUpdateQuote(args: {
  eventId: string;
  supplierId: string;
  quoteId: string;
  editorId: string;
  version: Date;
  quote: SampleQuoteInput;
  changes: Record<string, unknown>;
  now: Date;
}):
  | { ok: true; changed: boolean; reference: string }
  | { ok: false; reason: "not-found" | "stale" }
  | { ok: false; reason: "another-accepted"; reference: string } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  const quote = s.quotes.find(
    (q) => q.id === args.quoteId && q.eventId === args.eventId && q.supplierId === args.supplierId,
  );
  if (!supplier || !quote || !mayManageSuppliers(s, args.eventId, args.editorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (quote.updatedAt.getTime() !== args.version.getTime()) return { ok: false, reason: "stale" };
  const reference = quoteReference(quote.number);
  if (Object.keys(args.changes).length === 0) return { ok: true, changed: false, reference };
  const statusChanged = quote.status !== args.quote.status;
  if (statusChanged && args.quote.status === "ACCEPTED") {
    const accepted = sampleAcceptedQuote(s, supplier.id, quote.id);
    if (accepted) return { ok: false, reason: "another-accepted", reference: accepted };
  }
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max(args.now.getTime(), quote.updatedAt.getTime() + 1));
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.editorId,
    entityId: quote.id,
    action: "quote.updated",
    details: {
      reference,
      supplierReference: supplierReference(supplier.number),
      changes: args.changes,
    },
    now,
  });
  Object.assign(quote, {
    amount: args.quote.amount,
    status: args.quote.status,
    description: args.quote.description,
    updatedAt: now,
    ...(statusChanged ? { statusChangedAt: now } : {}),
  });
  return { ok: true, changed: true, reference };
}

// ───────────────────────── Payments (B4-14, D-077) ─────────────────────────

const paymentReference = (number: number) => `PAY-${String(number).padStart(4, "0")}`;

function copyPayment(p: StoredPayment): SamplePayment {
  return {
    id: p.id,
    supplierId: p.supplierId,
    number: p.number,
    kind: p.kind,
    amount: p.amount,
    dueDate: p.dueDate,
    status: p.status,
    paidOn: p.paidOn,
    description: p.description,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
}

/** Stand-in for listSupplierPayments: this event's supplier only, by due date then number. */
export function sampleListPayments(eventId: string, supplierId: string): SamplePayment[] {
  return store()
    .payments.filter((p) => p.eventId === eventId && p.supplierId === supplierId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number)
    .map(copyPayment);
}

/** Every payment of the event's suppliers (for the supplier list, B4-16). Copies. */
export function sampleListEventPayments(eventId: string): SamplePayment[] {
  return store()
    .payments.filter((p) => p.eventId === eventId)
    .map(copyPayment);
}

/** Stand-in for getPayment: only if it belongs to this supplier of this event. A copy. */
export function sampleGetPayment(
  eventId: string,
  supplierId: string,
  paymentId: string,
): SamplePayment | null {
  const found = store().payments.find(
    (p) => p.id === paymentId && p.eventId === eventId && p.supplierId === supplierId,
  );
  return found ? copyPayment(found) : null;
}

/**
 * Stand-in for createPayment: suppliers.manage re-checked here, this event's supplier only, the
 * event's next PAY number, and a payment.created entry.
 */
export function sampleCreatePayment(args: {
  eventId: string;
  supplierId: string;
  creatorId: string;
  payment: SamplePaymentInput;
  now: Date;
}): { ok: true; payment: { id: string; reference: string } } | { ok: false; reason: "not-found" } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  if (!supplier || !mayManageSuppliers(s, args.eventId, args.creatorId)) {
    return { ok: false, reason: "not-found" };
  }
  const number = (s.lastPaymentNumber.get(args.eventId) ?? 0) + 1;
  s.lastPaymentNumber.set(args.eventId, number);
  const reference = paymentReference(number);
  const id = crypto.randomUUID();
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.creatorId,
    entityId: id,
    action: "payment.created",
    details: { reference, supplierReference: supplierReference(supplier.number), ...args.payment },
    now: args.now,
  });
  s.payments.push({
    ...args.payment,
    id,
    eventId: args.eventId,
    supplierId: supplier.id,
    number,
    createdAt: args.now,
    updatedAt: args.now,
  });
  return { ok: true, payment: { id, reference } };
}

/**
 * Stand-in for updatePayment: suppliers.manage re-checked here, this supplier's payment in this
 * event only, stale versions refused (D-032), and a payment.updated entry when something changed.
 * `changes` is the audit diff the caller computed with the suppliers context's rules.
 */
export function sampleUpdatePayment(args: {
  eventId: string;
  supplierId: string;
  paymentId: string;
  editorId: string;
  version: Date;
  payment: SamplePaymentInput;
  changes: Record<string, unknown>;
  now: Date;
}):
  { ok: true; changed: boolean; reference: string } | { ok: false; reason: "not-found" | "stale" } {
  const s = store();
  const supplier = s.suppliers.find((x) => x.id === args.supplierId && x.eventId === args.eventId);
  const payment = s.payments.find(
    (p) =>
      p.id === args.paymentId && p.eventId === args.eventId && p.supplierId === args.supplierId,
  );
  if (!supplier || !payment || !mayManageSuppliers(s, args.eventId, args.editorId)) {
    return { ok: false, reason: "not-found" };
  }
  if (payment.updatedAt.getTime() !== args.version.getTime()) return { ok: false, reason: "stale" };
  const reference = paymentReference(payment.number);
  if (Object.keys(args.changes).length === 0) return { ok: true, changed: false, reference };
  // Never the same millisecond as the version the form holds, so the next save is not "stale".
  const now = new Date(Math.max(args.now.getTime(), payment.updatedAt.getTime() + 1));
  addAudit(s, {
    eventId: args.eventId,
    actorId: args.editorId,
    entityId: payment.id,
    action: "payment.updated",
    details: {
      reference,
      supplierReference: supplierReference(supplier.number),
      changes: args.changes,
    },
    now,
  });
  Object.assign(payment, { ...args.payment, updatedAt: now });
  return { ok: true, changed: true, reference };
}

/** Stand-in for listAuditEntries. Not an access check: callers authorize first. */
export function sampleListAuditEntries(
  eventId: string,
  limit = 100,
  entityIds?: readonly string[],
): AuditEntryView[] {
  const s = store();
  return s.audit
    .filter((a) => a.eventId === eventId)
    .filter((a) => !entityIds || (a.entityId != null && entityIds.includes(a.entityId)))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      createdAt: new Date(a.createdAt),
      actorName: s.users.get(a.actorId) ?? null,
      action: a.action,
      details: a.details,
    }));
}