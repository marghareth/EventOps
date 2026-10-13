// src/modules/events/attendees/read.test.ts
// @vitest-environment node
// The guest list read (B2-01, B2-06): it authorizes with event.view, and loads dietary needs only
// for roles with attendees.dietary (D-047), from the database or sample data. Contact details and
// notes are never part of a guest-list row.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authorizeEvent = vi.fn();
const can = vi.fn();
const listGuestList = vi.fn();
const sampleListAttendees = vi.fn();
let sampleMode = false;

vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({ isSampleDataMode: () => sampleMode }));
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
  can: (...args: unknown[]) => can(...args),
  sampleGetAttendee: vi.fn(),
  sampleListAttendees: (...args: unknown[]) => sampleListAttendees(...args),
}));
vi.mock("./queries", async (original) => ({
  ...(await original<typeof import("./queries")>()),
  listGuestList: (...args: unknown[]) => listGuestList(...args),
}));

const { getEventAttendees } = await import("./read");

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
    expect(listGuestList).toHaveBeenCalledWith("db", EVENT, { dietaryNeeds: true });
  });

  it("does not load dietary needs for a role without attendees.dietary", async () => {
    can.mockReturnValue(false);
    expect(await getEventAttendees(EVENT)).toMatchObject({ ok: true, showDietaryNeeds: false });
    expect(listGuestList).toHaveBeenCalledWith("db", EVENT, { dietaryNeeds: false });
  });

  it("cuts sample data down to guest-list rows, with dietary needs only when allowed", async () => {
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
        },
      ],
    });
    expect(sampleListAttendees).toHaveBeenCalledWith(EVENT);

    can.mockReturnValue(false);
    const hidden = await getEventAttendees(EVENT);
    expect(JSON.stringify(hidden)).not.toMatch(/Vegetarian|ana@example|0917|Private note/);
    expect(listGuestList).not.toHaveBeenCalled();
  });
});