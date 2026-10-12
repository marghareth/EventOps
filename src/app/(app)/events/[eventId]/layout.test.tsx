// src/app/(app)/events/[eventId]/layout.test.tsx
// Event workspace layout (B1-04): runs the access check and shows the event's identity.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));

const { default: EventLayout } = await import("./layout");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const event = {
  id: ID,
  reference: "EVT-2026-0001",
  name: "Santos wedding",
  venue: "Cebu",
  description: null,
  startsAt: new Date("2026-12-12T08:00:00Z"),
  endsAt: null,
  status: "PLANNING",
  capacity: 200,
  expectedAttendees: 180,
  role: "COORDINATOR",
};

async function renderLayout() {
  render(
    await EventLayout({ children: "section content", params: Promise.resolve({ eventId: ID }) }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("events/[eventId] layout", () => {
  it("checks access for the event in the URL and shows its identity above the section", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "ok", event } });
    await renderLayout();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    const header = screen.getByRole("region", { name: "Current event" });
    for (const text of ["EVT-2026-0001", "Santos wedding", "Planning", "Coordinator"]) {
      expect(header).toHaveTextContent(text);
    }
    expect(header).toHaveTextContent("Sat, Dec 12, 2026 · 4:00 PM PHT · Cebu");
    expect(screen.getByText("section content")).toBeInTheDocument();
  });

  it("renders nothing of the section when access is refused", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(
      EventLayout({ children: "section content", params: Promise.resolve({ eventId: ID }) }),
    ).rejects.toMatchObject({ notFound: true });
  });

  it("explains demo mode without a database and still shows the section", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "no-database" } });
    await renderLayout();
    expect(screen.getByText("No database connected")).toBeInTheDocument();
    expect(screen.getByText("section content")).toBeInTheDocument();
  });
});