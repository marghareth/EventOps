// src/modules/events/attendees/actions.test.ts
// @vitest-environment node
// Attendee server actions and the guest-list read (B2-01) with authorization, the database and
// Next.js mocked: each authorizes first, uses only the authorized IDs, validates, and fails safely.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENDEE_MESSAGES, initialAttendeeFormState } from "./form-state";

const authorizeEvent = vi.fn();
const createAttendee = vi.fn();
const updateAttendee = vi.fn();
const deleteAttendee = vi.fn();
const listAttendees = vi.fn();
const sampleCreateAttendee = vi.fn();
const sampleListAttendees = vi.fn();
const sampleGetAttendee = vi.fn();
const sampleDeleteAttendee = vi.fn();
const sampleUpdateAttendee = vi.fn();
const getAttendee = vi.fn();
const revalidatePath = vi.fn();
let sampleData = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({ isSampleDataMode: () => sampleData }));
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
  sampleCreateAttendee: (...args: unknown[]) => sampleCreateAttendee(...args),
  sampleListAttendees: (...args: unknown[]) => sampleListAttendees(...args),
  sampleGetAttendee: (...args: unknown[]) => sampleGetAttendee(...args),
  sampleDeleteAttendee: (...args: unknown[]) => sampleDeleteAttendee(...args),
  sampleUpdateAttendee: (...args: unknown[]) => sampleUpdateAttendee(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("./create-attendee", () => ({
  createAttendee: (...args: unknown[]) => createAttendee(...args),
}));
vi.mock("./update-attendee", () => ({
  updateAttendee: (...args: unknown[]) => updateAttendee(...args),
}));
vi.mock("./delete-attendee", () => ({
  deleteAttendee: (...args: unknown[]) => deleteAttendee(...args),
}));
vi.mock("./queries", () => ({
  listAttendees: (...args: unknown[]) => listAttendees(...args),
  getAttendee: (...args: unknown[]) => getAttendee(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { createAttendeeAction, updateAttendeeAction, deleteAttendeeAction } =
  await import("./actions");
const { getAttendeeForEditing, getEventAttendees } = await import("./read");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const ATTENDEE = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const VERSION = "2026-10-12T04:00:00.000Z";
const user = { id: "user-1", email: "mika@example.com" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const valid = { name: "Maria Santos", rsvpStatus: "CONFIRMED", plusOnes: "1" };

const allow = () =>
  authorizeEvent.mockResolvedValue({ ok: true, user, event: { id: EVENT, role: "COORDINATOR" } });
const refuse = (reason: "forbidden" | "not-found") =>
  authorizeEvent.mockResolvedValue({ ok: false, reason });

/** The action's answer, or where it redirected to (redirect() throws in Next.js). */
async function create(fields: Record<string, string> = valid) {
  try {
    return await createAttendeeAction(EVENT, initialAttendeeFormState, form(fields));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}
/** The edit action's answer, or where it redirected to. */
async function update(
  fields: Record<string, string> = { ...valid, version: VERSION },
  id = ATTENDEE,
) {
  try {
    return await updateAttendeeAction(EVENT, id, initialAttendeeFormState, form(fields));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

/** The attendee as stored before the edit (differs from `valid` in RSVP and plus-ones). */
const stored = {
  id: ATTENDEE,
  number: 3,
  name: "Maria Santos",
  email: null,
  phone: null,
  category: null,
  rsvpStatus: "PENDING",
  plusOnes: 0,
  dietaryNeeds: null,
  notes: null,
  updatedAt: new Date(VERSION),
};
/** The remove action's answer, or where it redirected to. */
async function remove(id = ATTENDEE) {
  try {
    return await deleteAttendeeAction(EVENT, id);
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  sampleData = false;
  allow();
  createAttendee.mockResolvedValue({ ok: true, attendee: { id: ATTENDEE, reference: "ATT-0001" } });
  updateAttendee.mockResolvedValue({ ok: true });
  deleteAttendee.mockResolvedValue({ ok: true, reference: "ATT-0003" });
  getAttendee.mockResolvedValue(stored);
});

describe("every attendee action authorizes with attendees.manage first", () => {
  it.each([
    ["create", () => create()],
    ["update", () => update()],
    ["delete", () => remove()],
  ])("%s", async (_label, run) => {
    await run();
    expect(authorizeEvent).toHaveBeenCalledWith(
      EVENT,
      "attendees.manage",
      `/events/${EVENT}/attendees`,
    );
  });

  it.each([
    ["forbidden", ATTENDEE_MESSAGES.forbidden],
    ["not-found", ATTENDEE_MESSAGES.eventNotFound],
  ] as const)("refuses when %s and touches nothing", async (reason, message) => {
    refuse(reason);
    expect(await create()).toMatchObject({ status: "error", message });
    expect(await update()).toMatchObject({ status: "error", message });
    expect(await remove()).toMatchObject({ status: "error", message });
    expect(createAttendee).not.toHaveBeenCalled();
    expect(updateAttendee).not.toHaveBeenCalled();
    expect(deleteAttendee).not.toHaveBeenCalled();
  });
});

describe("createAttendeeAction", () => {
  it("saves the validated attendee with the session's user, then opens the list (B2-02)", async () => {
    expect(await create()).toEqual({ redirect: `/events/${EVENT}/attendees?added=ATT-0001` });
    expect(createAttendee).toHaveBeenCalledWith("db", {
      eventId: EVENT,
      creatorId: "user-1",
      attendee: {
        name: "Maria Santos",
        email: null,
        phone: null,
        category: null,
        rsvpStatus: "CONFIRMED",
        plusOnes: 1,
        dietaryNeeds: null,
        notes: null,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}/attendees`);
  });

  it("ignores IDs, roles and numbers sent in the form", async () => {
    await create({ ...valid, eventId: "other", creatorId: "x", role: "OWNER", number: "9" });
    const saved = createAttendee.mock.calls[0][1];
    expect(saved).toMatchObject({ eventId: EVENT, creatorId: "user-1" });
    expect(Object.keys(saved.attendee)).not.toEqual(expect.arrayContaining(["number", "role"]));
  });

  it("returns field errors and keeps what was typed", async () => {
    const result = await create({ name: " ", plusOnes: "12", email: "nope" });
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        name: "Enter the attendee's name.",
        plusOnes: "Plus-ones must be a whole number from 0 to 10.",
        email: "Enter an email like name@example.com.",
      },
      values: { name: " ", plusOnes: "12", email: "nope" },
    });
    expect(createAttendee).not.toHaveBeenCalled();
  });

  it("treats a database refusal (role changed in between) as forbidden", async () => {
    createAttendee.mockResolvedValue({ ok: false });
    expect(await create()).toMatchObject({ message: ATTENDEE_MESSAGES.forbidden });
  });

  it("shows a safe message when saving fails", async () => {
    createAttendee.mockRejectedValue(
      new Error('violates check constraint "attendees_x" password=1'),
    );
    const result = await create();
    expect(result).toMatchObject({ status: "error", message: ATTENDEE_MESSAGES.saveFailed });
    expect(JSON.stringify(result)).not.toMatch(/constraint|password/);
  });
});

describe("updateAttendeeAction", () => {
  it("saves with the stored version and the session's user, then opens the list (B2-03)", async () => {
    expect(await update()).toEqual({ redirect: `/events/${EVENT}/attendees?saved=ATT-0003` });
    expect(getAttendee).toHaveBeenCalledWith("db", EVENT, ATTENDEE);
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}/attendees`);
    expect(updateAttendee).toHaveBeenCalledWith(
      "db",
      expect.objectContaining({
        eventId: EVENT,
        attendeeId: ATTENDEE,
        editorId: "user-1",
        version: new Date(VERSION),
      }),
    );
  });

  it.each(["not-a-uuid", "' OR 1=1 --", ""])("refuses the attendee ID %j", async (id) => {
    expect(await update(undefined, id)).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect(updateAttendee).not.toHaveBeenCalled();
  });

  it("refuses a missing or broken version as stale", async () => {
    expect(await update(valid)).toMatchObject({ message: ATTENDEE_MESSAGES.stale });
    expect(await update({ ...valid, version: "yesterday" })).toMatchObject({
      message: ATTENDEE_MESSAGES.stale,
    });
    expect(updateAttendee).not.toHaveBeenCalled();
  });

  it.each([
    ["stale", ATTENDEE_MESSAGES.stale],
    ["not-found", ATTENDEE_MESSAGES.attendeeNotFound],
  ] as const)("explains a %s result", async (reason, message) => {
    updateAttendee.mockResolvedValue({ ok: false, reason });
    expect(await update()).toMatchObject({ status: "error", message });
  });

  it("says when nothing changed, and saves nothing", async () => {
    getAttendee.mockResolvedValue({ ...stored, rsvpStatus: "CONFIRMED", plusOnes: 1 });
    expect(await update()).toEqual({ status: "success", message: ATTENDEE_MESSAGES.unchanged });
    expect(updateAttendee).not.toHaveBeenCalled();
  });

  it("finds nothing for an attendee outside the authorized event, and saves nothing", async () => {
    getAttendee.mockResolvedValue(null);
    expect(await update()).toMatchObject({ message: ATTENDEE_MESSAGES.attendeeNotFound });
    expect(updateAttendee).not.toHaveBeenCalled();
  });

  it("ignores event and attendee IDs sent in the form", async () => {
    await update({ ...valid, version: VERSION, eventId: "other", attendeeId: "x", id: "y" });
    expect(getAttendee).toHaveBeenCalledWith("db", EVENT, ATTENDEE);
    expect(updateAttendee).toHaveBeenCalledWith(
      "db",
      expect.objectContaining({ eventId: EVENT, attendeeId: ATTENDEE }),
    );
  });

  it("shows a safe message when saving fails", async () => {
    updateAttendee.mockRejectedValue(new Error('violates check constraint "x" host=10.0.0.5'));
    const result = await update();
    expect(result).toMatchObject({ status: "error", message: ATTENDEE_MESSAGES.saveFailed });
    expect(JSON.stringify(result)).not.toMatch(/constraint|10\.0/);
  });
});

describe("deleteAttendeeAction", () => {
  it("removes the attendee as the session's user, then opens the list (B2-04)", async () => {
    expect(await remove()).toEqual({ redirect: `/events/${EVENT}/attendees?removed=ATT-0003` });
    expect(deleteAttendee).toHaveBeenCalledWith("db", {
      eventId: EVENT,
      attendeeId: ATTENDEE,
      userId: "user-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}/attendees`);
  });

  it("refuses a malformed ID and explains a missing attendee", async () => {
    expect(await remove("nope")).toMatchObject({ message: ATTENDEE_MESSAGES.attendeeNotFound });
    deleteAttendee.mockResolvedValue({ ok: false });
    expect(await remove()).toMatchObject({ message: ATTENDEE_MESSAGES.attendeeNotFound });
  });

  it("shows a safe message when removing fails", async () => {
    deleteAttendee.mockRejectedValue(new Error("connect ECONNREFUSED"));
    expect(await remove()).toEqual({ status: "error", message: ATTENDEE_MESSAGES.deleteFailed });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a second removal (already gone) as not available", async () => {
    deleteAttendee.mockResolvedValue({ ok: false });
    expect(await remove()).toEqual({
      status: "error",
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("sample data mode (D-041)", () => {
  it("adds to the sample store after the same checks, not to the database (B2-02)", async () => {
    sampleData = true;
    sampleCreateAttendee.mockReturnValue({
      ok: true,
      attendee: { id: ATTENDEE, reference: "ATT-0009" },
    });
    expect(await create()).toEqual({ redirect: `/events/${EVENT}/attendees?added=ATT-0009` });
    expect(sampleCreateAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT, creatorId: "user-1", now: expect.any(Date) }),
    );
    expect(createAttendee).not.toHaveBeenCalled();
  });

  it("with sample data, a refused role still adds nothing", async () => {
    sampleData = true;
    refuse("forbidden");
    expect(await create()).toMatchObject({ message: ATTENDEE_MESSAGES.forbidden });
    expect(sampleCreateAttendee).not.toHaveBeenCalled();
  });

  it("edits in the sample store with the computed changes, not the database (B2-03)", async () => {
    sampleData = true;
    sampleGetAttendee.mockReturnValue(stored);
    sampleUpdateAttendee.mockReturnValue({ ok: true });
    expect(await update()).toEqual({ redirect: `/events/${EVENT}/attendees?saved=ATT-0003` });
    expect(sampleGetAttendee).toHaveBeenCalledWith(EVENT, ATTENDEE);
    expect(sampleUpdateAttendee).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: EVENT,
        attendeeId: ATTENDEE,
        editorId: "user-1",
        changes: {
          rsvpStatus: { from: "PENDING", to: "CONFIRMED" },
          plusOnes: { from: 0, to: 1 },
        },
      }),
    );
    expect(updateAttendee).not.toHaveBeenCalled();
    expect(getAttendee).not.toHaveBeenCalled();
  });

  it("removes from the sample store after the same checks (B2-04)", async () => {
    sampleData = true;
    sampleDeleteAttendee.mockReturnValue({ ok: true, reference: "ATT-0002" });
    expect(await remove()).toEqual({ redirect: `/events/${EVENT}/attendees?removed=ATT-0002` });
    expect(sampleDeleteAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT, attendeeId: ATTENDEE, userId: "user-1" }),
    );
    expect(deleteAttendee).not.toHaveBeenCalled();
  });

  it("reads the sample guest list", async () => {
    sampleData = true;
    sampleListAttendees.mockReturnValue([{ id: "s1" }]);
    expect(await getEventAttendees(EVENT)).toEqual({ ok: true, attendees: [{ id: "s1" }] });
    expect(sampleListAttendees).toHaveBeenCalledWith(EVENT);
    expect(listAttendees).not.toHaveBeenCalled();
  });
});

describe("getEventAttendees", () => {
  it("lets any member read: authorizes with event.view, then lists the authorized event", async () => {
    listAttendees.mockResolvedValue([{ id: ATTENDEE }]);
    expect(await getEventAttendees(EVENT)).toEqual({ ok: true, attendees: [{ id: ATTENDEE }] });
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "event.view", `/events/${EVENT}/attendees`);
    expect(listAttendees).toHaveBeenCalledWith("db", EVENT);
  });

  it("reads nothing for a non-member", async () => {
    refuse("not-found");
    expect(await getEventAttendees(EVENT)).toEqual({ ok: false, reason: "not-found" });
    expect(listAttendees).not.toHaveBeenCalled();
  });
});

describe("getAttendeeForEditing (B2-03)", () => {
  it("authorizes with attendees.manage and loads only from the authorized event", async () => {
    expect(await getAttendeeForEditing(EVENT, ATTENDEE)).toEqual({ ok: true, attendee: stored });
    expect(authorizeEvent).toHaveBeenCalledWith(
      EVENT,
      "attendees.manage",
      `/events/${EVENT}/attendees`,
    );
    expect(getAttendee).toHaveBeenCalledWith("db", EVENT, ATTENDEE);
  });

  it("refuses a role that may not edit, loading nothing", async () => {
    refuse("forbidden");
    expect(await getAttendeeForEditing(EVENT, ATTENDEE)).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(getAttendee).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed ID", "nope", undefined],
    ["another event's attendee", ATTENDEE, null],
  ])("treats %s as not found", async (_label, id, found) => {
    if (found === null) getAttendee.mockResolvedValue(null);
    expect(await getAttendeeForEditing(EVENT, id)).toEqual({ ok: false, reason: "not-found" });
  });
});