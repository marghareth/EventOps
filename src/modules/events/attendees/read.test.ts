// src/modules/events/attendees/read.test.ts
// @vitest-environment node
// The guest list and attendee details reads (B2-01, B2-06, B2-07): it authorizes with event.view, and loads dietary needs only
// for roles with attendees.dietary (D-047), from the database or sample data. Contact details and
// notes are never part of a guest-list row.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authorizeEvent = vi.fn();
const can = vi.fn();
const listGuestList = vi.fn();
const sampleListAttendees = vi.fn();
const sampleGetAttendee = vi.fn();
const queryAttendeeDetails = vi.fn();
let sampleMode = false;

vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({ isSampleDataMode: () => sampleMode }));
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
  can: (...args: unknown[]) => can(...args),
  sampleGetAttendee: (...args: unknown[]) => sampleGetAttendee(...args),
  sampleListAttendees: (...args: unknown[]) => sampleListAttendees(...args),
}));
vi.mock("./queries", async (original) => ({
  ...(await original<typeof import("./queries")>()),
  listGuestList: (...args: unknown[]) => listGuestList(...args),
  getAttendeeDetails: (...args: unknown[]) => queryAttendeeDetails(...args),
}));

const { getAttendeeDetails, getEventAttendees } = await import("./read");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const full = {
  id: "a1",
  number: 1,
  name: "Ana Reyes",
  email: "ana@example.com",
  phone: "0917 123 4567",
  category: "Family",
  rsvpStatus: "CONFIRMED",
  plusOnes: 1,
  dietaryNeeds: "Vegetarian",
  notes: "Private note",
  updatedAt: new Date("2026-10-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  sampleMode = false;
  authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT, role: "VIEWER" } });
  listGuestList.mockResolvedValue([]);
  sampleListAttendees.mockReturnValue([full]);
});

describe("getEventAttendees", () => {
  it("authorizes with event.view for the event in the URL", async () => {
    can.mockReturnValue(true);
    await getEventAttendees(EVENT);
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "event.view", `/events/${EVENT}/attendees`);
  });

  it.each(["not-found", "forbidden"] as const)(
    "passes on a refusal (%s) and loads nothing",
    async (reason) => {
      authorizeEvent.mockResolvedValue({ ok: false, reason });
      expect(await getEventAttendees(EVENT)).toEqual({ ok: false, reason });
      expect(listGuestList).not.toHaveBeenCalled();
      expect(sampleListAttendees).not.toHaveBeenCalled();
    },
  );

  it("asks the matrix with the member's stored role, and loads dietary needs when allowed", async () => {
    can.mockReturnValue(true);
    expect(await getEventAttendees(EVENT)).toEqual({
      ok: true,
      attendees: [],
      showDietaryNeeds: true,
    });
    expect(can).toHaveBeenCalledWith("VIEWER", "attendees.dietary");
    expect(listGuestList).toHaveBeenCalledWith("db", EVENT, { dietaryNeeds: true, contact: true });
    expect(can).toHaveBeenCalledWith("VIEWER", "attendees.private");
  });

  it("does not load dietary needs for a role without attendees.dietary", async () => {
    can.mockReturnValue(false);
    expect(await getEventAttendees(EVENT)).toMatchObject({ ok: true, showDietaryNeeds: false });
    expect(listGuestList).toHaveBeenCalledWith("db", EVENT, {
      dietaryNeeds: false,
      contact: false,
    });
  });

  it("loads email and phone for searching only with attendees.private (B2-10, D-050)", async () => {
    can.mockImplementation(
      (_role: string, permission: string) => permission !== "attendees.private",
    );
    await getEventAttendees(EVENT);
    expect(listGuestList).toHaveBeenCalledWith("db", EVENT, { dietaryNeeds: true, contact: false });
  });

  it("cuts sample data down to guest-list rows, with optional fields only when allowed", async () => {
    sampleMode = true;
    can.mockReturnValue(true);
    expect(await getEventAttendees(EVENT)).toEqual({
      ok: true,
      showDietaryNeeds: true,
      attendees: [
        {
          id: "a1",
          number: 1,
          name: "Ana Reyes",
          category: "Family",
          rsvpStatus: "CONFIRMED",
          plusOnes: 1,
          dietaryNeeds: "Vegetarian",
          email: "ana@example.com",
          phone: "0917 123 4567",
        },
      ],
    });
    expect(JSON.stringify(await getEventAttendees(EVENT))).not.toMatch(/Private note/);
    expect(sampleListAttendees).toHaveBeenCalledWith(EVENT);

    can.mockReturnValue(false);
    const hidden = await getEventAttendees(EVENT);
    expect(JSON.stringify(hidden)).not.toMatch(/Vegetarian|ana@example|0917|Private note/);
    expect(listGuestList).not.toHaveBeenCalled();
  });
});

describe("getAttendeeDetails (B2-07, D-048)", () => {
  const ATTENDEE = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
  /** The matrix as approved, so each role gets its own fields. */
  const matrix = (role: string, permission: string) =>
    permission === "attendees.dietary" || (permission === "attendees.private" && role !== "VIEWER");

  beforeEach(() => {
    can.mockImplementation(matrix);
    queryAttendeeDetails.mockResolvedValue({ id: ATTENDEE, name: "Ana Reyes" });
  });

  it("authorizes with event.view and finds the attendee only inside the authorized event", async () => {
    authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT, role: "COORDINATOR" } });
    expect(await getAttendeeDetails(EVENT, ATTENDEE)).toEqual({
      ok: true,
      attendee: { id: ATTENDEE, name: "Ana Reyes" },
      fields: { dietaryNeeds: true, private: true },
    });
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "event.view", `/events/${EVENT}/attendees`);
    expect(queryAttendeeDetails).toHaveBeenCalledWith("db", EVENT, ATTENDEE, {
      dietaryNeeds: true,
      private: true,
    });
  });

  it("does not load contact details or notes for a Viewer", async () => {
    expect(await getAttendeeDetails(EVENT, ATTENDEE)).toMatchObject({
      ok: true,
      fields: { dietaryNeeds: true, private: false },
    });
    expect(can).toHaveBeenCalledWith("VIEWER", "attendees.private");
    expect(queryAttendeeDetails).toHaveBeenCalledWith("db", EVENT, ATTENDEE, {
      dietaryNeeds: true,
      private: false,
    });
  });

  it.each(["not-an-id", "", "../edit"])(
    "is not found for the malformed ID %j, loading nothing",
    async (id) => {
      expect(await getAttendeeDetails(EVENT, id)).toEqual({ ok: false, reason: "not-found" });
      expect(queryAttendeeDetails).not.toHaveBeenCalled();
    },
  );

  it("is not found for an unknown attendee or another event's attendee", async () => {
    queryAttendeeDetails.mockResolvedValue(null);
    expect(await getAttendeeDetails(EVENT, ATTENDEE)).toEqual({ ok: false, reason: "not-found" });
  });

  it("passes on a refusal and loads nothing", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "not-found" });
    expect(await getAttendeeDetails(EVENT, ATTENDEE)).toEqual({ ok: false, reason: "not-found" });
    expect(queryAttendeeDetails).not.toHaveBeenCalled();
  });

  it("cuts sample data down to what the role may see", async () => {
    sampleMode = true;
    sampleGetAttendee.mockReturnValue(full);
    const asViewer = await getAttendeeDetails(EVENT, ATTENDEE);
    expect(sampleGetAttendee).toHaveBeenCalledWith(EVENT, ATTENDEE);
    expect(JSON.stringify(asViewer)).not.toMatch(/ana@example|0917|Private note/);
    expect(asViewer).toMatchObject({ ok: true, attendee: { dietaryNeeds: "Vegetarian" } });

    authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT, role: "OWNER" } });
    expect(await getAttendeeDetails(EVENT, ATTENDEE)).toMatchObject({
      ok: true,
      attendee: { email: "ana@example.com", phone: "0917 123 4567", notes: "Private note" },
    });
    expect(queryAttendeeDetails).not.toHaveBeenCalled();
  });
});