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
// Since B2-02 it also holds sample attendees: adding (B2-02) and editing (B2-03) work like the
// database (members with attendees.manage only, per-event ATT numbers, stale edits refused, audit
// entries).
// Changes live in memory only and reset when `npm run dev` restarts. Never used in a build:
// isSampleDataMode() needs NODE_ENV=development and `next build` refuses DEV_DEMO_AUTH=true.
import "server-only";
import type { EventStatus, MemberRole } from "@/generated/prisma/client";
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

type SampleStore = {
  users: Map<string, string>;
  events: SampleEvent[];
  members: SampleMember[];
  audit: SampleAudit[];
  attendees: StoredAttendee[];
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

  return {
    users: new Map([
      [me, DEMO_USER.displayName],
      [MIKA, "Mika Santos"],
      [PAOLO, "Paolo Reyes"],
    ]),
    events,
    members,
    audit,
    attendees: seedAttendees(),
  };
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
      ["Mon Garcia", "CONFIRMED", 1, { category: "Finance" }],
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
const globalStore = globalThis as typeof globalThis & { __eventopsSampleDataV2?: SampleStore };

function store(): SampleStore {
  globalStore.__eventopsSampleDataV2 ??= seed();
  return globalStore.__eventopsSampleDataV2;
}

/** Back to the seeded samples. For tests. */
export function resetSampleData(): void {
  globalStore.__eventopsSampleDataV2 = seed();
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
  entry: { eventId: string; actorId: string; action: A; details: unknown; now: Date },
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

  const number =
    s.attendees.reduce(
      (max, a) => (a.eventId === args.eventId ? Math.max(max, a.number) : max),
      0,
    ) + 1;
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

/** Stand-in for listAuditEntries. Not an access check: callers authorize first. */
export function sampleListAuditEntries(eventId: string, limit = 100): AuditEntryView[] {
  const s = store();
  return s.audit
    .filter((a) => a.eventId === eventId)
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