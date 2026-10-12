// src/app/(app)/events/[eventId]/page.test.tsx
// Event overview (B1-04): checks access itself, shows the details and the section tiles.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));

const { default: EventOverviewPage } = await import("./page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const event = {
  id: ID,
  reference: "EVT-2026-0001",
  name: "Santos wedding",
  venue: null,
  description: "Garden ceremony,\nthen dinner.",
  startsAt: new Date("2026-12-12T08:00:00Z"),
  endsAt: new Date("2026-12-12T14:00:00Z"),
  status: "DRAFT",
  capacity: null,
  expectedAttendees: 1,
  role: "OWNER",
};

async function renderPage(created?: string) {
  render(
    await EventOverviewPage({
      params: Promise.resolve({ eventId: ID }),
      searchParams: Promise.resolve(created ? { created } : {}),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "ok", event } });
});

describe("event overview", () => {
  it("checks access itself and shows the event's details", async () => {
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Event details" });
    for (const text of [
      "Sat, Dec 12, 2026 · 4:00 PM – 10:00 PM PHT",
      "1 expected attendee",
      "Garden ceremony,",
    ]) {
      expect(details).toHaveTextContent(text);
    }
    expect(within(details).getAllByText("Not set")).toHaveLength(2); // venue and capacity
  });

  it("links a tile to every Tier 1 section, each marked as not set up", async () => {
    await renderPage();
    const tiles = within(screen.getByRole("region", { name: "Sections" })).getAllByRole("link");
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual(
      [
        "attendees",
        "accessibility",
        "suppliers",
        "budget",
        "tasks",
        "impact",
        "import",
        "activity",
        "settings",
      ].map((segment) => `/events/${ID}/${segment}`),
    );
    expect(tiles[0]).toHaveTextContent("AttendeesNot set up yet");
  });

  it("shows the Event created notice only for a well-formed reference", async () => {
    await renderPage("EVT-2026-0001");
    expect(screen.getByText("Event created")).toBeInTheDocument();
  });

  it("ignores a forged reference", async () => {
    await renderPage("<img src=x>");
    expect(screen.queryByText("Event created")).not.toBeInTheDocument();
  });

  it("skips the details in demo mode without a database", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "no-database" } });
    await renderPage();
    expect(screen.queryByRole("region", { name: "Event details" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sections" })).toBeInTheDocument();
  });
});