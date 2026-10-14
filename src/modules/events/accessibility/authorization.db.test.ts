// src/modules/events/accessibility/authorization.db.test.ts
// Accessibility security checkpoint: requirements (B3-03, D-058), event resources (B3-05), readiness
// (B3-10) and alerts (B3-11); extended for B3-13. One matrix: every actor tries every
// requirement operation through the real server actions and reads (the way a crafted request would,
// with no page in between), against PostgreSQL. Allowed operations succeed; denied ones fail,
// change nothing in either event and add nothing to Activity.
//
//   User A ── Event A ── Attendee A ── Requirement A → allowed
//          └─ Event B ── Attendee B ── Requirement B → denied
//   User B (owner of Event B) on Event A → denied
//   Viewer of A      → reads the needs, readiness and alerts, not the notes; every write denied
//                      (D-035, D-058, D-065, D-066)
//   Coordinator of A → everything allowed
//   Signed out       → everything denied
//
// Owner-level: User A is Event A's Owner and may do everything. Accessibility has no Owner-only
// operation (docs/PERMISSIONS.md: accessibility.manage and accessibility.private are Owner and
// Coordinator), so "Coordinator attempting an Owner-only operation" has nothing to test here.
//
// The tests call the server boundary directly, so hiding a button proves nothing here; removing a
// server-side check makes them fail (checked by hand for B3-13, see docs/TESTING.md).
//
// Only the signed-in identity is mocked.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

let signedIn: { id: string; email: string } | null = null;
let db: PrismaClient;

vi.mock("@/lib/auth", () => ({
  AuthUnavailableError: class AuthUnavailableError extends Error {},
  getCurrentUser: async () => signedIn,
  requireUser: async (path: string) => {
    if (!signedIn) throw Object.assign(new Error("NEXT_REDIRECT"), { url: `/login?next=${path}` });
    return signedIn;
  },
  ensureDemoUserRecord: async () => {},
}));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getDb: () => db,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
/** How many times the storage layer was opened: a refusal at the boundary never opens it. */
let repositoryOpened = 0;
vi.mock("./composition", async (original) => {
  const real = await original<typeof import("./composition")>();
  return {
    accessibilityRepository: () => {
      repositoryOpened += 1;
      return real.accessibilityRepository();
    },
  };
});
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url: to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

const { createPrismaClient } = await import("@/lib/db");
const { createEvent } = await import("../create-event");
const { createAttendee } = await import("../attendees/create-attendee");
const {
  createRequirementAction,
  updateRequirementAction,
  deleteRequirementAction,
  saveResourceAction,
  deleteResourceAction,
} = await import("./actions");
const {
  getAttendeeAccessibility,
  getNewRequirementContext,
  getRequirementForEditing,
  getAccessibilityOverview,
  getResourceForEditing,
  getAccessibilityAlerts,
} = await import("./queries");
const { initialRequirementFormState, initialResourceFormState } = await import("./form-state");
const { ACCESSIBILITY_MESSAGES: MESSAGES } = await import("./form-state");

const YEAR = 2086;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return { id, email: `${id}@example.test` };
}

async function newEvent(ownerId: string) {
  const { id } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  return id;
}

/** An attendee with one requirement whose note is private. */
async function guestWithNeed(eventId: string, ownerId: string, label: string) {
  const created = await createAttendee(db, {
    eventId,
    creatorId: ownerId,
    attendee: {
      name: `Attendee ${label}`,
      email: null,
      phone: null,
      category: null,
      rsvpStatus: "CONFIRMED",
      plusOnes: 0,
      dietaryNeeds: null,
      notes: null,
    },
  });
  if (!created.ok) throw new Error("createAttendee refused");
  const requirement = await db.accessibilityRequirement.create({
    data: {
      eventId,
      attendeeId: created.attendee.id,
      type: "ACCESSIBLE_SEATING",
      priority: "REQUIRED",
      note: `Private note ${label}`,
    },
  });
  return { attendeeId: created.attendee.id, requirementId: requirement.id };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeAll(() => {
  db = createPrismaClient(url);
});
beforeEach(() => {
  signedIn = null;
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

type User = { id: string; email: string };
type World = {
  userA: User;
  userB: User;
  coordinator: User;
  viewer: User;
  eventA: string;
  eventB: string;
  a: { attendeeId: string; requirementId: string };
  b: { attendeeId: string; requirementId: string };
};

async function world(): Promise<World> {
  const userA = await newUser();
  const userB = await newUser();
  const coordinator = await newUser();
  const viewer = await newUser();
  const eventA = await newEvent(userA.id);
  const eventB = await newEvent(userB.id);
  const join = (userId: string, role: MemberRole) =>
    db.eventMember.create({ data: { eventId: eventA, userId, role } });
  await join(coordinator.id, "COORDINATOR");
  await join(viewer.id, "VIEWER");
  return {
    userA,
    userB,
    coordinator,
    viewer,
    eventA,
    eventB,
    a: await guestWithNeed(eventA, userA.id, "A"),
    b: await guestWithNeed(eventB, userB.id, "B"),
  };
}

/** Everything an operation could change, in both events. */
async function snapshot(w: Pick<World, "eventA" | "eventB">) {
  const where = { eventId: { in: [w.eventA, w.eventB] } };
  return {
    requirements: await db.accessibilityRequirement.findMany({ where, orderBy: { id: "asc" } }),
    resources: await db.accessibilityResource.findMany({ where, orderBy: { id: "asc" } }),
    audit: await db.auditLog.count({ where }),
  };
}

type Outcome = "allowed" | "denied";

/** Server actions redirect when they succeed; a redirect to sign-in is a refusal. */
async function action(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    await run();
    return "denied";
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url && !url.startsWith("/login")) return "allowed";
    if (url) return "denied";
    throw error;
  }
}

async function read(run: () => Promise<{ ok: boolean }>): Promise<Outcome> {
  try {
    return (await run()).ok ? "allowed" : "denied";
  } catch (error) {
    if ((error as { url?: string }).url?.startsWith("/login")) return "denied";
    throw error;
  }
}

const version = async (requirementId: string) =>
  (
    await db.accessibilityRequirement.findUnique({ where: { id: requirementId } })
  )?.updatedAt.toISOString() ?? new Date().toISOString();

type Target = [eventId: string, attendeeId: string, requirementId: string];

const OPERATIONS = {
  "read an attendee's needs": (...[e, a]: Target) => read(() => getAttendeeAccessibility(e, a)),
  "read the notes": async (...[e, a]: Target) => {
    try {
      const result = await getAttendeeAccessibility(e, a);
      if (!result.ok) return "denied";
      return result.showNotes && result.requirements.some((r) => typeof r.note === "string")
        ? "allowed"
        : "denied";
    } catch (error) {
      if ((error as { url?: string }).url?.startsWith("/login")) return "denied";
      throw error;
    }
  },
  // Allowed means alerts about this guest were disclosed (the guest has an uncovered need).
  "read the guest's alerts": async (...[e, a]: Target) => {
    try {
      const result = await getAccessibilityAlerts(e, { attendeeId: a });
      return result.ok && result.alerts.length > 0 ? "allowed" : "denied";
    } catch (error) {
      if ((error as { url?: string }).url?.startsWith("/login")) return "denied";
      throw error;
    }
  },
  "open the add form": (...[e, a]: Target) => read(() => getNewRequirementContext(e, a)),
  "open the edit form": (...[e, a, r]: Target) => read(() => getRequirementForEditing(e, a, r)),
  "add a requirement": (...[e, a]: Target) =>
    action(() =>
      createRequirementAction(
        e,
        a,
        initialRequirementFormState,
        form({ type: "CAPTIONING", priority: "PREFERRED", note: "" }),
      ),
    ),
  "edit a requirement": async (...[e, a, r]: Target) => {
    const v = await version(r);
    return action(() =>
      updateRequirementAction(
        e,
        a,
        r,
        initialRequirementFormState,
        form({
          type: "ACCESSIBLE_SEATING",
          priority: "INFORMATIONAL",
          note: "Changed",
          version: v,
        }),
      ),
    );
  },
  "remove a requirement": (...[e, a, r]: Target) => action(() => deleteRequirementAction(e, a, r)),
} satisfies Record<string, (...target: Target) => Promise<Outcome>>;

type Operation = keyof typeof OPERATIONS;
const ALL = Object.keys(OPERATIONS) as Operation[];

const ACTORS: {
  name: string;
  as: (w: World) => User | null;
  target: (w: World) => Target;
  allowed: Operation[];
}[] = [
  {
    name: "User A on Event A",
    as: (w) => w.userA,
    target: (w) => [w.eventA, w.a.attendeeId, w.a.requirementId],
    allowed: ALL,
  },
  {
    name: "Coordinator of A on Event A",
    as: (w) => w.coordinator,
    target: (w) => [w.eventA, w.a.attendeeId, w.a.requirementId],
    allowed: ALL,
  },
  {
    name: "Viewer of A on Event A",
    as: (w) => w.viewer,
    target: (w) => [w.eventA, w.a.attendeeId, w.a.requirementId],
    allowed: ["read an attendee's needs", "read the guest's alerts"],
  },
  {
    name: "User A on Event B",
    as: (w) => w.userA,
    target: (w) => [w.eventB, w.b.attendeeId, w.b.requirementId],
    allowed: [],
  },
  {
    name: "User B on Event A",
    as: (w) => w.userB,
    target: (w) => [w.eventA, w.a.attendeeId, w.a.requirementId],
    allowed: [],
  },
  // Event A in the address, Event B's attendee and requirement in the request: never found.
  {
    name: "User A on Event A with Attendee B",
    as: (w) => w.userA,
    target: (w) => [w.eventA, w.b.attendeeId, w.b.requirementId],
    allowed: [],
  },
  // Attendee A's page, but Requirement B's ID: only the attendee-level operations work.
  {
    name: "User A on Attendee A with Requirement B",
    as: (w) => w.userA,
    target: (w) => [w.eventA, w.a.attendeeId, w.b.requirementId],
    allowed: [
      "read an attendee's needs",
      "read the notes",
      "read the guest's alerts",
      "open the add form",
      "add a requirement",
    ],
  },
  {
    name: "Signed out on Event A",
    as: () => null,
    target: (w) => [w.eventA, w.a.attendeeId, w.a.requirementId],
    allowed: [],
  },
];

describe.each(ACTORS)("$name", ({ as, target, allowed }) => {
  it.each(ALL)("%s", async (operation) => {
    const w = await world();
    const expected: Outcome = allowed.includes(operation) ? "allowed" : "denied";
    const before = await snapshot(w);
    signedIn = as(w);
    expect(await OPERATIONS[operation](...target(w))).toBe(expected);
    signedIn = null;
    if (expected === "denied") {
      // A refusal changes nothing in either event and adds nothing to Activity.
      expect(await snapshot(w)).toEqual(before);
    }
  });
});

it("never sends a Viewer the notes, and tells the page so", async () => {
  const w = await world();
  signedIn = w.viewer;
  const result = await getAttendeeAccessibility(w.eventA, w.a.attendeeId);
  expect(result).toMatchObject({ ok: true, showNotes: false, canManage: false });
  expect(JSON.stringify(result)).not.toContain("Private note");
});

// ───────────────────────── Event resources (B3-05) ─────────────────────────

/** Both events with accessible seats set up; the actors of the requirement matrix. */
async function resourceWorld() {
  const w = await world();
  for (const eventId of [w.eventA, w.eventB]) {
    await db.accessibilityResource.create({
      data: { eventId, type: "ACCESSIBLE_SEATS", status: "ARRANGING", quantity: 4 },
    });
  }
  return w;
}

const seatsVersion = async (eventId: string) =>
  (
    await db.accessibilityResource.findFirst({ where: { eventId, type: "ACCESSIBLE_SEATS" } })
  )?.updatedAt.toISOString() ?? new Date().toISOString();

const RESOURCE_OPERATIONS = {
  "read the resources and readiness": (eventId: string) =>
    read(() => getAccessibilityOverview(eventId)),
  "read the alerts": (eventId: string) => read(() => getAccessibilityAlerts(eventId)),
  "open a resource form": (eventId: string) =>
    read(() => getResourceForEditing(eventId, "accessible-seats")),
  "set up a resource": (eventId: string) =>
    action(() =>
      saveResourceAction(
        eventId,
        "CAPTIONING",
        initialResourceFormState,
        form({ status: "AVAILABLE", quantity: "", note: "", version: "" }),
      ),
    ),
  "edit a resource": async (eventId: string) => {
    const v = await seatsVersion(eventId);
    return action(() =>
      saveResourceAction(
        eventId,
        "ACCESSIBLE_SEATS",
        initialResourceFormState,
        form({ status: "AVAILABLE", quantity: "9", note: "", version: v }),
      ),
    );
  },
  "remove a resource": (eventId: string) =>
    action(() => deleteResourceAction(eventId, "ACCESSIBLE_SEATS")),
} satisfies Record<string, (eventId: string) => Promise<Outcome>>;

type ResourceOperation = keyof typeof RESOURCE_OPERATIONS;
const ALL_RESOURCE = Object.keys(RESOURCE_OPERATIONS) as ResourceOperation[];

const RESOURCE_ACTORS: {
  name: string;
  as: (w: World) => User | null;
  event: (w: World) => string;
  allowed: ResourceOperation[];
}[] = [
  { name: "User A on Event A", as: (w) => w.userA, event: (w) => w.eventA, allowed: ALL_RESOURCE },
  {
    name: "Coordinator of A on Event A",
    as: (w) => w.coordinator,
    event: (w) => w.eventA,
    allowed: ALL_RESOURCE,
  },
  {
    name: "Viewer of A on Event A",
    as: (w) => w.viewer,
    event: (w) => w.eventA,
    allowed: ["read the resources and readiness", "read the alerts"],
  },
  { name: "User A on Event B", as: (w) => w.userA, event: (w) => w.eventB, allowed: [] },
  { name: "User B on Event A", as: (w) => w.userB, event: (w) => w.eventA, allowed: [] },
  { name: "Signed out on Event A", as: () => null, event: (w) => w.eventA, allowed: [] },
];

describe.each(RESOURCE_ACTORS)("resources: $name", ({ as, event, allowed }) => {
  it.each(ALL_RESOURCE)("%s", async (operation) => {
    const w = await resourceWorld();
    const expected: Outcome = allowed.includes(operation) ? "allowed" : "denied";
    const before = await snapshot(w);
    signedIn = as(w);
    expect(await RESOURCE_OPERATIONS[operation](event(w))).toBe(expected);
    signedIn = null;
    if (expected === "denied") expect(await snapshot(w)).toEqual(before);
  });
});

it("refuses a resource type that isn't one of the six, changing nothing", async () => {
  const w = await resourceWorld();
  signedIn = w.userA;
  const before = await snapshot(w);
  expect(
    await saveResourceAction(
      w.eventA,
      "SHUTTLE_BUS",
      initialResourceFormState,
      form({ status: "AVAILABLE", quantity: "", note: "", version: "" }),
    ),
  ).toMatchObject({ status: "error" });
  expect(await deleteResourceAction(w.eventA, "shuttle")).toMatchObject({ status: "error" });
  expect(await getResourceForEditing(w.eventA, "shuttle-bus")).toEqual({
    ok: false,
    reason: "not-found",
  });
  expect(await snapshot(w)).toEqual(before);
});

it("discloses no alert about another event's guest, and never a note in an alert", async () => {
  const w = await world();
  signedIn = w.userA;
  // Event A's address with Attendee B (Event B): the read works but says nothing about them.
  expect(await getAccessibilityAlerts(w.eventA, { attendeeId: w.b.attendeeId })).toMatchObject({
    ok: true,
    alerts: [],
  });
  const own = await getAccessibilityAlerts(w.eventA);
  expect(own).toMatchObject({ ok: true, status: "NOT_READY" });
  expect(JSON.stringify(own)).not.toContain("Private note");
  expect(JSON.stringify(own)).not.toContain(w.b.attendeeId);
  // A malformed guest ID is "not found", like every other read.
  expect(await getAccessibilityAlerts(w.eventA, { attendeeId: "not-a-uuid" })).toEqual({
    ok: false,
    reason: "not-found",
  });
});

// The storage layer also re-checks the role (defence in depth, D-036), so the matrix alone can't
// tell which layer refused. This pins the server boundary itself: refused callers are turned away
// by authorizeEvent before any storage is opened.
describe("refused at the server boundary, before storage (B3-13)", () => {
  const WRITES = {
    "add a requirement": (w: World) =>
      createRequirementAction(
        w.eventA,
        w.a.attendeeId,
        initialRequirementFormState,
        form({ type: "CAPTIONING", priority: "REQUIRED", note: "" }),
      ),
    "edit a requirement": async (w: World) =>
      updateRequirementAction(
        w.eventA,
        w.a.attendeeId,
        w.a.requirementId,
        initialRequirementFormState,
        form({
          type: "ACCESSIBLE_SEATING",
          priority: "PREFERRED",
          note: "",
          version: await version(w.a.requirementId),
        }),
      ),
    "remove a requirement": (w: World) =>
      deleteRequirementAction(w.eventA, w.a.attendeeId, w.a.requirementId),
    "set up a resource": (w: World) =>
      saveResourceAction(
        w.eventA,
        "CAPTIONING",
        initialResourceFormState,
        form({ status: "AVAILABLE", quantity: "", note: "", version: "" }),
      ),
    "remove a resource": (w: World) => deleteResourceAction(w.eventA, "ACCESSIBLE_SEATS"),
    "open the add form": (w: World) => getNewRequirementContext(w.eventA, w.a.attendeeId),
    "open a resource form": (w: World) => getResourceForEditing(w.eventA, "captioning"),
  } satisfies Record<string, (w: World) => Promise<unknown>>;

  const CALLERS = [
    ["the Viewer of A", (w: World) => w.viewer, MESSAGES.forbidden, "forbidden"],
    ["User B", (w: World) => w.userB, MESSAGES.eventNotFound, "not-found"],
  ] as const;

  describe.each(CALLERS)("as %s", (_name, as, message, reason) => {
    it.each(Object.keys(WRITES) as (keyof typeof WRITES)[])("%s", async (operation) => {
      const w = await world();
      const before = await snapshot(w);
      signedIn = as(w);
      repositoryOpened = 0;
      const result = await WRITES[operation](w);
      signedIn = null;
      expect(repositoryOpened).toBe(0);
      expect(result).toMatchObject(
        operation.startsWith("open") ? { ok: false, reason } : { status: "error", message },
      );
      expect(await snapshot(w)).toEqual(before);
    });
  });
});