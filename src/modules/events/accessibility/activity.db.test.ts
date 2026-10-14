// src/modules/events/accessibility/activity.db.test.ts
// Accessibility Activity (B3-12, D-037): adding, changing and removing a requirement and a resource
// each leave one readable entry in the event's existing Activity feed, in order, with the actor and
// the event recorded, and never the note. Reads (needs, forms, readiness, alerts) and refused or
// unchanged saves record nothing. Runs through the real server actions and reads against
// PostgreSQL; only the signed-in identity is mocked. The audit log and feed are the existing ones
// (no second mechanism).
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
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
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
  getAccessibilityAlerts,
  getResourceForEditing,
} = await import("./queries");
const { initialRequirementFormState, initialResourceFormState } = await import("./form-state");

const YEAR = 2084;
const userIds: string[] = [];
const NOTES = ["Near the aisle, close to an exit", "Uses a power wheelchair", "Ramp at gate 2"];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return { id, email: `${id}@example.test` };
}

async function setup() {
  const owner = await newUser();
  const { id: eventId } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: owner.id,
    now: new Date(`${YEAR}-01-01`),
  });
  const member = async (role: MemberRole) => {
    const user = await newUser();
    await db.eventMember.create({ data: { eventId, userId: user.id, role } });
    return user;
  };
  const coordinator = await member("COORDINATOR");
  const viewer = await member("VIEWER");
  const created = await createAttendee(db, {
    eventId,
    creatorId: owner.id,
    attendee: {
      name: "Maria Santos",
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
  return { eventId, owner, coordinator, viewer, attendeeId: created.attendee.id };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs a server action; a successful one redirects. Fails the test on anything else. */
async function succeeds(run: () => Promise<unknown>) {
  try {
    const result = await run();
    throw new Error(`expected a redirect, got ${JSON.stringify(result)}`);
  } catch (error) {
    const to = (error as { url?: string }).url;
    if (!to || to.startsWith("/login")) throw error;
  }
}

/** Runs a server action that should be refused or change nothing; never throws for a redirect. */
async function attempt(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (!(error as { url?: string }).url) throw error;
  }
}

const requirementVersion = async (id: string) =>
  (await db.accessibilityRequirement.findUniqueOrThrow({ where: { id } })).updatedAt.toISOString();
const seatsVersion = async (eventId: string) =>
  (
    await db.accessibilityResource.findFirstOrThrow({
      where: { eventId, type: "ACCESSIBLE_SEATS" },
    })
  ).updatedAt.toISOString();

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

describe("accessibility activity (B3-12)", () => {
  it("records each requirement and resource change in the feed, in order, with actor and event, never the note", async () => {
    const w = await setup();
    const { eventId, attendeeId } = w;

    // Requirement added (Owner), changed (Coordinator); resource added (Coordinator), changed
    // (Owner), removed (Coordinator); requirement removed (Owner).
    signedIn = w.owner;
    await succeeds(() =>
      createRequirementAction(
        eventId,
        attendeeId,
        initialRequirementFormState,
        form({ type: "ACCESSIBLE_SEATING", priority: "REQUIRED", note: NOTES[0] }),
      ),
    );
    const requirement = await db.accessibilityRequirement.findFirstOrThrow({ where: { eventId } });
    signedIn = w.coordinator;
    const v1 = await requirementVersion(requirement.id);
    await succeeds(() =>
      updateRequirementAction(
        eventId,
        attendeeId,
        requirement.id,
        initialRequirementFormState,
        form({ type: "ACCESSIBLE_SEATING", priority: "PREFERRED", note: NOTES[1], version: v1 }),
      ),
    );
    await succeeds(() =>
      saveResourceAction(
        eventId,
        "ACCESSIBLE_SEATS",
        initialResourceFormState,
        form({ status: "ARRANGING", quantity: "6", note: NOTES[2], version: "" }),
      ),
    );
    signedIn = w.owner;
    const v2 = await seatsVersion(eventId);
    await succeeds(() =>
      saveResourceAction(
        eventId,
        "ACCESSIBLE_SEATS",
        initialResourceFormState,
        form({ status: "AVAILABLE", quantity: "8", note: NOTES[2], version: v2 }),
      ),
    );
    signedIn = w.coordinator;
    await succeeds(() => deleteResourceAction(eventId, "ACCESSIBLE_SEATS"));
    signedIn = w.owner;
    await succeeds(() => deleteRequirementAction(eventId, attendeeId, requirement.id));

    // The existing feed still works, and shows the six entries after the earlier ones.
    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const oldestFirst = [...activity.entries].reverse();
    expect(oldestFirst.map((e) => e.action)).toEqual([
      "event.created",
      "attendee.created",
      "accessibility_requirement.created",
      "accessibility_requirement.updated",
      "accessibility_resource.created",
      "accessibility_resource.updated",
      "accessibility_resource.deleted",
      "accessibility_requirement.deleted",
    ]);
    expect(oldestFirst.slice(2).map((e) => describeAuditEntry(e))).toEqual([
      {
        summary: "Added an accessibility need for ATT-0001: Accessible seating (Required)",
        lines: [],
      },
      {
        summary: "Edited an accessibility need of ATT-0001: Accessible seating",
        lines: ["Priority: Required → Preferred", "Note changed"],
      },
      { summary: "Set up Accessible seats: Being arranged, 6 seats", lines: [] },
      {
        summary: "Edited Accessible seats",
        lines: ["Status: Being arranged → Available", "Seats: 6 → 8"],
      },
      { summary: "Removed Accessible seats", lines: [] },
      { summary: "Removed an accessibility need from ATT-0001: Accessible seating", lines: [] },
    ]);

    // Actor and event recorded on every entry, straight from the table.
    const stored = await db.auditLog.findMany({
      where: { eventId, action: { startsWith: "accessibility_" } },
      orderBy: { createdAt: "asc" },
    });
    expect(stored.map((e) => [e.action, e.actorId, e.eventId])).toEqual([
      ["accessibility_requirement.created", w.owner.id, eventId],
      ["accessibility_requirement.updated", w.coordinator.id, eventId],
      ["accessibility_resource.created", w.coordinator.id, eventId],
      ["accessibility_resource.updated", w.owner.id, eventId],
      ["accessibility_resource.deleted", w.coordinator.id, eventId],
      ["accessibility_requirement.deleted", w.owner.id, eventId],
    ]);

    // No note in any entry, in the table or in the feed.
    const everything = JSON.stringify([stored, activity]);
    for (const note of NOTES) expect(everything).not.toContain(note);
  });

  it("records nothing for reads, refused changes or saves that change nothing", async () => {
    const w = await setup();
    const { eventId, attendeeId } = w;
    signedIn = w.owner;
    await succeeds(() =>
      createRequirementAction(
        eventId,
        attendeeId,
        initialRequirementFormState,
        form({ type: "CAPTIONING", priority: "REQUIRED", note: "" }),
      ),
    );
    await succeeds(() =>
      saveResourceAction(
        eventId,
        "CAPTIONING",
        initialResourceFormState,
        form({ status: "ARRANGING", quantity: "", note: "", version: "" }),
      ),
    );
    const requirement = await db.accessibilityRequirement.findFirstOrThrow({ where: { eventId } });
    const before = await db.auditLog.count({ where: { eventId } });

    // Reads, by every role.
    for (const user of [w.owner, w.coordinator, w.viewer]) {
      signedIn = user;
      await getAttendeeAccessibility(eventId, attendeeId);
      await getNewRequirementContext(eventId, attendeeId);
      await getRequirementForEditing(eventId, attendeeId, requirement.id);
      await getAccessibilityOverview(eventId);
      await getAccessibilityAlerts(eventId);
      await getAccessibilityAlerts(eventId, { attendeeId });
      await getResourceForEditing(eventId, "captioning");
      await getEventActivity(eventId);
    }

    // Saves that change nothing.
    signedIn = w.owner;
    await attempt(async () =>
      updateRequirementAction(
        eventId,
        attendeeId,
        requirement.id,
        initialRequirementFormState,
        form({
          type: "CAPTIONING",
          priority: "REQUIRED",
          note: "",
          version: await requirementVersion(requirement.id),
        }),
      ),
    );
    const captioning = await db.accessibilityResource.findFirstOrThrow({ where: { eventId } });
    await attempt(() =>
      saveResourceAction(
        eventId,
        "CAPTIONING",
        initialResourceFormState,
        form({
          status: "ARRANGING",
          quantity: "",
          note: "",
          version: captioning.updatedAt.toISOString(),
        }),
      ),
    );

    // A Viewer's writes, refused.
    signedIn = w.viewer;
    await attempt(() =>
      createRequirementAction(
        eventId,
        attendeeId,
        initialRequirementFormState,
        form({ type: "SIGN_LANGUAGE", priority: "REQUIRED", note: "" }),
      ),
    );
    await attempt(() => deleteRequirementAction(eventId, attendeeId, requirement.id));
    await attempt(() =>
      saveResourceAction(
        eventId,
        "SIGN_LANGUAGE",
        initialResourceFormState,
        form({ status: "AVAILABLE", quantity: "", note: "", version: "" }),
      ),
    );
    await attempt(() => deleteResourceAction(eventId, "CAPTIONING"));

    expect(await db.auditLog.count({ where: { eventId } })).toBe(before);
    expect(await db.accessibilityRequirement.count({ where: { eventId } })).toBe(1);
    expect(await db.accessibilityResource.count({ where: { eventId } })).toBe(1);
  });
});