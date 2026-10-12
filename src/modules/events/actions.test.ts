// src/modules/events/actions.test.ts
// @vitest-environment node
// createEventAction with auth, the database and Next.js navigation mocked (B1-02).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_EVENT_MESSAGES, initialCreateEventState } from "./form-state";

const requireUser = vi.fn();
const ensureDemoUserRecord = vi.fn();
const createEvent = vi.fn();
let demo = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
  ensureDemoUserRecord: () => ensureDemoUserRecord(),
}));
vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({
  isDemoWithoutDatabase: () => demo && !process.env.DATABASE_URL,
}));
vi.mock("./create-event", () => ({ createEvent: (...args: unknown[]) => createEvent(...args) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { createEventAction } = await import("./actions");

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

  it("in demo mode without a database, explains how to connect one", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "");
    const { state } = await run(valid);
    expect(state).toMatchObject({ status: "error", message: CREATE_EVENT_MESSAGES.noDatabase });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("in demo mode with a database, creates the demo user's row first", async () => {
    demo = true;
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/eventops");
    expect(await run(valid)).toEqual({ redirect: "/events/event-1?created=EVT-2026-0001" });
    expect(ensureDemoUserRecord).toHaveBeenCalledOnce();
  });
});