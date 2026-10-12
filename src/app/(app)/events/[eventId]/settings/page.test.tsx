// src/app/(app)/events/[eventId]/settings/page.test.tsx
// Settings page (B1-05): checks access itself; the edit form for Owners and Coordinators only.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
}));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));

const { default: SettingsPage } = await import("./page");
const { default: SettingsError } = await import("./error");

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
  updatedAt: new Date("2026-10-11T01:02:03.456Z"),
};

async function renderAs(role: string) {
  requireEventAccess.mockResolvedValue({
    user: {},
    access: { kind: "ok", event: { ...event, role } },
  });
  render(await SettingsPage({ params: Promise.resolve({ eventId: ID }) }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Settings page", () => {
  it.each(["OWNER", "COORDINATOR"])(
    "gives %s the edit form with the saved values",
    async (role) => {
      await renderAs(role);
      expect(requireEventAccess).toHaveBeenCalledWith(ID);
      expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Event name/)).toHaveValue("Santos wedding");
      expect(screen.getByLabelText(/^Start time/)).toHaveValue("16:00");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    },
  );

  it("shows a Viewer the details read-only", async () => {
    await renderAs("VIEWER");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Owners and Coordinators can edit them/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Event details" })).toHaveTextContent("Cebu");
  });

  it("explains demo mode without a database", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "no-database" } });
    render(await SettingsPage({ params: Promise.resolve({ eventId: ID }) }));
    expect(screen.getByText("No database connected")).toBeInTheDocument();
  });

  it("has an error state that never shows the error text", () => {
    const reset = vi.fn();
    render(<SettingsError error={new Error("connect ECONNREFUSED 10.0.0.5")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load event settings");
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });
});