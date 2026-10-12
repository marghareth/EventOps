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
// Changes live in memory only and reset when `npm run dev` restarts. Never used in a build:
// isSampleDataMode() needs NODE_ENV=development and `next build` refuses DEV_DEMO_AUTH=true.
import "server-only";
import type { EventStatus, MemberRole } from "@/generated/prisma/client";
import { DEMO_USER } from "@/lib/demo-auth";
import {
  AUDIT_ACTIONS,
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
type SampleStore = {
  users: Map<string, string>;
  events: SampleEvent[];
  members: SampleMember[];
  audit: SampleAudit[];
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
  };
}

// Kept on globalThis so every part of the dev server (pages, actions, route handlers) and hot
// reloads share one store.
const globalStore = globalThis as typeof globalThis & { __eventopsSampleData?: SampleStore };

function store(): SampleStore {
  globalStore.__eventopsSampleData ??= seed();
  return globalStore.__eventopsSampleData;
}

/** Back to the seeded samples. For tests. */
export function resetSampleData(): void {
  globalStore.__eventopsSampleData = seed();
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
  return { ok: true };
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