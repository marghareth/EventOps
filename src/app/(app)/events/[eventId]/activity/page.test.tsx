// src/app/(app)/events/[eventId]/activity/page.test.tsx
// Activity page (B1-11): membership checked by the page, the role by getEventActivity.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventActivity = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/activity", () => ({
  getEventActivity: (...args: unknown[]) => getEventActivity(...args),
}));
vi.mock("@/modules/events/actions", () => ({}));
vi.mock("@/modules/events/queries", () => ({}));

const { default: ActivityPage } = await import("./page");
const { default: ActivityError } = await import("./error");
const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

async function renderPage() {
  render(await ActivityPage({ params: Promise.resolve({ eventId: ID }) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "ok", event: { id: ID } } });
});

describe("Activity page", () => {
  it("lists entries newest first with time, actor and what changed", async () => {
    getEventActivity.mockResolvedValue({
      ok: true,
      entries: [
        {
          id: "a2",
          createdAt: new Date("2026-10-12T01:00:00Z"),
          actorName: "Mika",
          action: "event.updated",
          details: { changes: { venue: { from: "Cebu", to: "Manila" } } },
        },
        {
          id: "a1",
          createdAt: new Date("2026-10-11T01:00:00Z"),
          actorName: null,
          action: "event.created",
          details: { reference: "EVT-2026-0001", name: "Gala" },
        },
      ],
    });
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getEventActivity).toHaveBeenCalledWith(ID);
    const [newest, oldest] = screen
      .getAllByRole("listitem")
      .filter((li) => li.closest("ol") && li.parentElement?.tagName === "OL");
    expect(newest).toHaveTextContent("Oct 12, 2026, 9:00 AM PHT · Mika");
    expect(within(newest).getByText("Edited the event details")).toBeInTheDocument();
    expect(newest).toHaveTextContent("Venue: “Cebu” → “Manila”");
    expect(oldest).toHaveTextContent("Former member");
    expect(oldest).toHaveTextContent("Created the event EVT-2026-0001");
  });

  it("tells a Viewer they don't have access, showing no entries", async () => {
    getEventActivity.mockResolvedValue({ ok: false, reason: "forbidden" });
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "You don't have access to this" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("has an empty state", async () => {
    getEventActivity.mockResolvedValue({ ok: true, entries: [] });
    await renderPage();
    expect(screen.getByRole("heading", { name: "No activity yet" })).toBeInTheDocument();
  });

  it("explains demo mode without a database", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "no-database" } });
    await renderPage();
    expect(screen.getByText("No database connected")).toBeInTheDocument();
    expect(getEventActivity).not.toHaveBeenCalled();
  });

  it("has an error state that never shows the error text", () => {
    render(<ActivityError error={new Error("relation audit_logs")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load activity");
    expect(screen.queryByText(/relation/)).not.toBeInTheDocument();
  });
});