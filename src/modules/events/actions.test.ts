// src/modules/events/actions.test.ts
// @vitest-environment node
// createEventAction with auth, the database and Next.js navigation mocked (B1-02).
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_EVENT_MESSAGES,
  DELETE_EVENT_MESSAGES,
  EDIT_EVENT_MESSAGES,
  initialCreateEventState,
  initialDeleteEventState,
  initialEditEventState,
} from "./form-state";
import type { MemberRole } from "@/generated/prisma/client";

const requireUser = vi.fn();
const ensureDemoUserRecord = vi.fn();
const createEvent = vi.fn();
const getEventAccess = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const revalidatePath = vi.fn();
const sampleCreateEvent = vi.fn();
const sampleUpdateEvent = vi.fn();
const sampleDeleteEvent = vi.fn();
let demo = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
  ensureDemoUserRecord: () => ensureDemoUserRecord(),
}));
vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({
  isSampleDataMode: () => demo && !process.env.DATABASE_URL,
}));
vi.mock("./sample-data", () => ({
  sampleCreateEvent: (...args: unknown[]) => sampleCreateEvent(...args),
  sampleUpdateEvent: (...args: unknown[]) => sampleUpdateEvent(...args),
  sampleDeleteEvent: (...args: unknown[]) => sampleDeleteEvent(...args),
}));
vi.mock("./create-event", () => ({ createEvent: (...args: unknown[]) => createEvent(...args) }));
vi.mock("./access", () => ({ getEventAccess: (...args: unknown[]) => getEventAccess(...args) }));
vi.mock("./delete-event", () => ({ deleteEvent: (...args: unknown[]) => deleteEvent(...args) }));
vi.mock("./update-event", () => ({ updateEvent: (...args: unknown[]) => updateEvent(...args) }));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { createEventAction, deleteEventAction, updateEventAction } = await import("./actions");

const valid = {
  name: "Santos wedding",
  date: "2026-12-12",
  startTime: "16:00",
  endTime: "22:00",
  venue: "Cebu",
  description: "",
  capacity: "200",
  expectedAttendees: "180",
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function run(fields: Record<string, string>) {
  try {
    return { state: await createEventAction(initialCreateEventState, form(fields)) };
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  demo = false;
  requireUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
  createEvent.mockResolvedValue({ id: "event-1", reference: "EVT-2026-0001" });
});

describe("createEventAction", () => {
  it("sends signed-out users to sign in and creates nothing", async () => {
    requireUser.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { url: "/login?next=%2Fevents%2Fnew" });
    });
    expect(await run(valid)).toEqual({ redirect: "/login?next=%2Fevents%2Fnew" });
    expect(requireUser).toHaveBeenCalledWith("/events/new");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("returns field errors, keeps the input and does not touch the database", async () => {
    const { state } = await run({ ...valid, name: " ", capacity: "0" });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: {
        name: "Enter the event name.",
        capacity: "Enter a whole number of 1 or more, up to 1,000,000.",
      },
      values: { name: " ", venue: "Cebu" },
    });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("creates the event for the signed-in user and opens its workspace", async () => {
    expect(await run(valid)).toEqual({ redirect: "/events/event-1?created=EVT-2026-0001" });
    expect(createEvent).toHaveBeenCalledWith("db", {
      event: {
        name: "Santos wedding",
        venue: "Cebu",
        description: null,
        startsAt: new Date("2026-12-12T08:00:00Z"),
        endsAt: new Date("2026-12-12T14:00:00Z"),
        capacity: 200,
        expectedAttendees: 180,
      },
      creatorId: "user-1",
      now: expect.any(Date),
    });
  });

  it("ignores fields the form does not have, such as a creator or role", async () => {
    await run({ ...valid, createdById: "someone-else", role: "OWNER", status: "ACTIVE" });
    const [, args] = createEvent.mock.calls[0];
    expect(args.creatorId).toBe("user-1");
    expect(Object.keys(args.event)).not.toContain("createdById");
    expect(Object.keys(args.event)).not.toContain("status");
  });

  it("shows a safe message and keeps the input when saving fails", async () => {
    createEvent.mockRejectedValue(new Error('relation "events" does not exist'));
    const { state } = await run(valid);
    expect(state).toEqual({
      status: "error",
      message: CREATE_EVENT_MESSAGES.saveFailed,
      values: valid,
    });
    expect(JSON.stringify(state)).not.toContain("relation");
  });

  it("with sample data (D-041), creates the event in the sample store, not the database", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    sampleCreateEvent.mockReturnValue({ id: "sample-1", reference: "EVT-2026-0007" });
    expect(await run(valid)).toEqual({ redirect: "/events/sample-1?created=EVT-2026-0007" });
    expect(sampleCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "user-1", event: expect.objectContaining({}) }),
    );
    expect(createEvent).not.toHaveBeenCalled();
    expect(ensureDemoUserRecord).not.toHaveBeenCalled();
  });

  it("with sample data, still validates first and keeps a safe message on failure", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    sampleCreateEvent.mockImplementation(() => {
      throw new Error("Invalid audit details");
    });
    const { state } = await run(valid);
    expect(state).toMatchObject({ status: "error", message: CREATE_EVENT_MESSAGES.saveFailed });
  });

  it("in demo mode with a database, creates the demo user's row first", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/eventops");
    expect(await run(valid)).toEqual({ redirect: "/events/event-1?created=EVT-2026-0001" });
    expect(ensureDemoUserRecord).toHaveBeenCalledOnce();
  });
});

describe("updateEventAction (B1-05)", () => {
  const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
  const VERSION = "2026-10-11T01:02:03.456Z";
  const stored = {
    id: EVENT,
    reference: "EVT-2026-0001",
    name: "Santos wedding",
    venue: "Cebu",
    description: null,
    startsAt: new Date("2026-12-12T08:00:00Z"),
    endsAt: new Date("2026-12-12T14:00:00Z"),
    status: "PLANNING",
    capacity: 200,
    expectedAttendees: 180,
    updatedAt: new Date(VERSION),
  };

  function member(role: "OWNER" | "COORDINATOR" | "VIEWER") {
    getEventAccess.mockResolvedValue({ kind: "ok", event: { ...stored, role } });
  }
  async function edit(fields: Record<string, string>) {
    const data = form({ ...valid, version: VERSION, ...fields });
    try {
      return { state: await updateEventAction(EVENT, initialEditEventState, data) };
    } catch (error) {
      const url = (error as { url?: string }).url;
      if (url) return { redirect: url };
      throw error;
    }
  }

  beforeEach(() => {
    member("COORDINATOR");
    updateEvent.mockResolvedValue({ ok: true });
  });

  it("lets a Coordinator save new details, then refreshes the workspace", async () => {
    const { state } = await edit({ name: "Santos–Lim wedding", expectedAttendees: "220" });
    expect(state).toEqual({ status: "success", message: EDIT_EVENT_MESSAGES.saved });
    expect(getEventAccess).toHaveBeenCalledWith("user-1", EVENT);
    expect(updateEvent).toHaveBeenCalledWith("db", {
      eventId: EVENT,
      editorId: "user-1",
      version: new Date(VERSION),
      details: {
        name: "Santos–Lim wedding",
        venue: "Cebu",
        description: null,
        startsAt: new Date("2026-12-12T08:00:00Z"),
        endsAt: new Date("2026-12-12T14:00:00Z"),
        capacity: 200,
        expectedAttendees: 220,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}`, "layout");
  });

  it("lets an Owner save too", async () => {
    member("OWNER");
    expect((await edit({ venue: "Manila" })).state?.status).toBe("success");
  });

  it("refuses a Viewer and changes nothing", async () => {
    member("VIEWER");
    expect((await edit({ venue: "Manila" })).state).toMatchObject({
      status: "error",
      message: EDIT_EVENT_MESSAGES.forbidden,
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("refuses a non-member exactly like a missing event", async () => {
    getEventAccess.mockResolvedValue({ kind: "not-found" });
    expect((await edit({ venue: "Manila" })).state).toMatchObject({
      message: EDIT_EVENT_MESSAGES.notFound,
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("sends signed-out users to sign in", async () => {
    requireUser.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { url: "/login" });
    });
    expect(await edit({})).toEqual({ redirect: "/login" });
    expect(requireUser).toHaveBeenCalledWith(`/events/${EVENT}/settings`);
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid changes, keeps the input, and saves nothing", async () => {
    const { state } = await edit({ name: "", capacity: "0" });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: {
        name: "Enter the event name.",
        capacity: "Enter a whole number of 1 or more, up to 1,000,000.",
      },
      values: { name: "", capacity: "0" },
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("rejects an end time before the start time", async () => {
    const { state } = await edit({ startTime: "23:00", endTime: "22:00" });
    expect(state).toMatchObject({
      fieldErrors: { endTime: "End time can't be before the start time." },
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("ignores fields the form does not have, such as status or reference", async () => {
    await edit({ venue: "Manila", status: "CANCELLED", reference: "EVT-1999-0001" });
    const { details } = updateEvent.mock.calls[0][1];
    expect(Object.keys(details).sort()).toEqual([
      "capacity",
      "description",
      "endsAt",
      "expectedAttendees",
      "name",
      "startsAt",
      "venue",
    ]);
  });

  it("refuses a stale save and keeps the input", async () => {
    updateEvent.mockResolvedValue({ ok: false, reason: "stale" });
    expect((await edit({ venue: "Manila" })).state).toMatchObject({
      status: "error",
      message: EDIT_EVENT_MESSAGES.stale,
      values: { venue: "Manila" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a missing or malformed version as stale", async () => {
    expect((await edit({ venue: "Manila", version: "yesterday" })).state).toMatchObject({
      message: EDIT_EVENT_MESSAGES.stale,
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("does not write when nothing changed", async () => {
    expect((await edit({})).state).toEqual({
      status: "success",
      message: EDIT_EVENT_MESSAGES.unchanged,
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("shows a safe message when saving fails", async () => {
    updateEvent.mockRejectedValue(new Error('new row violates check constraint "events_x"'));
    const { state } = await edit({ venue: "Manila" });
    expect(state).toMatchObject({ status: "error", message: EDIT_EVENT_MESSAGES.saveFailed });
    expect(JSON.stringify(state)).not.toContain("constraint");
  });

  it("with sample data (D-041), saves to the sample store after the same checks", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    sampleUpdateEvent.mockReturnValue({ ok: true });
    const { state } = await edit({ venue: "Manila" });
    expect(state).toEqual({ status: "success", message: EDIT_EVENT_MESSAGES.saved });
    expect(sampleUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT, editorId: "user-1", version: new Date(VERSION) }),
    );
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("with sample data, a Viewer is still refused before anything is saved", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    member("VIEWER");
    const { state } = await edit({ venue: "Manila" });
    expect(state).toMatchObject({ message: EDIT_EVENT_MESSAGES.forbidden });
    expect(sampleUpdateEvent).not.toHaveBeenCalled();
  });
});

describe("deleteEventAction (B1-06)", () => {
  const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
  const REFERENCE = "EVT-2026-0001";

  function member(role: "OWNER" | "COORDINATOR" | "VIEWER") {
    getEventAccess.mockResolvedValue({
      kind: "ok",
      event: { id: EVENT, reference: REFERENCE, name: "Santos wedding", role },
    });
  }
  async function remove(confirmation: string | null = REFERENCE) {
    const data = new FormData();
    if (confirmation !== null) data.set("confirmation", confirmation);
    try {
      return { state: await deleteEventAction(EVENT, initialDeleteEventState, data) };
    } catch (error) {
      const url = (error as { url?: string }).url;
      if (url) return { redirect: url };
      throw error;
    }
  }

  beforeEach(() => {
    member("OWNER");
    deleteEvent.mockResolvedValue({ ok: true });
  });

  it("lets the Owner delete after typing the event number, then opens My events", async () => {
    expect(await remove()).toEqual({ redirect: `/events?deleted=${REFERENCE}` });
    expect(deleteEvent).toHaveBeenCalledWith("db", { eventId: EVENT, userId: "user-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("accepts the number with surrounding spaces", async () => {
    expect(await remove(`  ${REFERENCE} `)).toEqual({ redirect: `/events?deleted=${REFERENCE}` });
  });

  it.each([["COORDINATOR"], ["VIEWER"]] as const)(
    "refuses a %s and deletes nothing",
    async (role: MemberRole) => {
      member(role);
      expect((await remove()).state).toEqual({
        status: "error",
        message: DELETE_EVENT_MESSAGES.forbidden,
      });
      expect(deleteEvent).not.toHaveBeenCalled();
    },
  );

  it("refuses a non-member exactly like a missing event", async () => {
    getEventAccess.mockResolvedValue({ kind: "not-found" });
    expect((await remove()).state).toMatchObject({ message: DELETE_EVENT_MESSAGES.notFound });
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it.each([["EVT-2026-0002"], ["evt-2026-0001"], [""], [null]])(
    "refuses a wrong confirmation (%j) and deletes nothing",
    async (typed: string | null) => {
      expect((await remove(typed)).state).toMatchObject({
        message: DELETE_EVENT_MESSAGES.confirmation,
      });
      expect(deleteEvent).not.toHaveBeenCalled();
    },
  );

  it("sends signed-out users to sign in", async () => {
    requireUser.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { url: "/login" });
    });
    expect(await remove()).toEqual({ redirect: "/login" });
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("reports an event that was already deleted or lost permission meanwhile", async () => {
    deleteEvent.mockResolvedValue({ ok: false });
    expect((await remove()).state).toMatchObject({ message: DELETE_EVENT_MESSAGES.notFound });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a safe message when the database fails", async () => {
    deleteEvent.mockRejectedValue(new Error('update or delete on table "events" violates'));
    const { state } = await remove();
    expect(state).toEqual({ status: "error", message: DELETE_EVENT_MESSAGES.failed });
  });

  it("with sample data (D-041), deletes from the sample store after the same checks", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    sampleDeleteEvent.mockReturnValue({ ok: true });
    expect(await remove()).toEqual({ redirect: `/events?deleted=${REFERENCE}` });
    expect(sampleDeleteEvent).toHaveBeenCalledWith({ eventId: EVENT, userId: "user-1" });
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("with sample data, a Coordinator still can't delete", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    member("COORDINATOR");
    expect((await remove()).state).toMatchObject({ message: DELETE_EVENT_MESSAGES.forbidden });
    expect(sampleDeleteEvent).not.toHaveBeenCalled();
  });
});

describe("role boundaries for every built protected operation (D-035)", () => {
  const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
  const VERSION = "2026-10-11T01:02:03.456Z";
  const event = {
    id: EVENT,
    reference: "EVT-2026-0001",
    name: "Santos wedding",
    venue: "Cebu",
    description: null,
    startsAt: new Date("2026-12-12T08:00:00Z"),
    endsAt: new Date("2026-12-12T14:00:00Z"),
    capacity: 200,
    expectedAttendees: 180,
    updatedAt: new Date(VERSION),
  };

  const operations = {
    "event.edit": async () => {
      const data = form({ ...valid, venue: "Manila", version: VERSION });
      return updateEventAction(EVENT, initialEditEventState, data);
    },
    "event.delete": async () => {
      const data = new FormData();
      data.set("confirmation", "EVT-2026-0001");
      try {
        return await deleteEventAction(EVENT, initialDeleteEventState, data);
      } catch (error) {
        if ((error as { url?: string }).url) return { status: "redirected" };
        throw error;
      }
    },
  } as const;

  it.each([
    ["event.edit", "OWNER", true],
    ["event.edit", "COORDINATOR", true],
    ["event.edit", "VIEWER", false],
    ["event.delete", "OWNER", true],
    ["event.delete", "COORDINATOR", false],
    ["event.delete", "VIEWER", false],
  ] as const)(
    "%s as %s: allowed %s",
    async (operation: keyof typeof operations, role: MemberRole, allowed: boolean) => {
      getEventAccess.mockResolvedValue({ kind: "ok", event: { ...event, role } });
      updateEvent.mockResolvedValue({ ok: true });
      deleteEvent.mockResolvedValue({ ok: true });

      const state = await operations[operation]();
      const write = operation === "event.edit" ? updateEvent : deleteEvent;
      if (allowed) {
        expect(write).toHaveBeenCalledOnce();
        expect(state.status).not.toBe("error");
      } else {
        expect(write).not.toHaveBeenCalled();
        expect(state.status).toBe("error");
      }
    },
  );
});
