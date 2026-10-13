// src/app/(app)/events/[eventId]/settings/page.test.tsx
// Settings page (B1-05): checks access itself; the edit form for Owners and Coordinators only.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetails } from "@/modules/events/public";

type MemberRole = EventDetails["role"];

const requireEventAccess = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));
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

async function renderAs(role: MemberRole) {
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
  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives %s the edit form with the saved values",
    async (role: MemberRole) => {
      await renderAs(role);
      expect(requireEventAccess).toHaveBeenCalledWith(ID);
      expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Event name/)).toHaveValue("Santos wedding");
      expect(screen.getByLabelText(/^Start time/)).toHaveValue("16:00");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    },
  );

  it.each([
    ["OWNER", true],
    ["COORDINATOR", false],
    ["VIEWER", false],
  ] as const)("shows %s the Delete event section: %s", async (role: MemberRole, shown: boolean) => {
    await renderAs(role);
    const section = screen.queryByRole("region", { name: "Delete event" });
    if (shown) expect(section).toBeInTheDocument();
    else expect(section).not.toBeInTheDocument();
  });

  it.each([
    ["OWNER", "Your role: Owner. Full event management"],
    ["COORDINATOR", "Your role: Coordinator. Day-to-day operations"],
    ["VIEWER", "Your role: Viewer. Read-only access"],
  ] as const)("tells a %s what their role allows", async (role: MemberRole, text: string) => {
    await renderAs(role);
    expect(screen.getByText(/^Your role:/).closest("p")).toHaveTextContent(text);
  });

  it("shows a Viewer the details read-only", async () => {
    await renderAs("VIEWER");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Owners and Coordinators can edit them/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Event details" })).toHaveTextContent("Cebu");
  });

  it("has an error state that never shows the error text", () => {
    const reset = vi.fn();
    render(<SettingsError error={new Error("connect ECONNREFUSED 10.0.0.5")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load event settings");
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });
});