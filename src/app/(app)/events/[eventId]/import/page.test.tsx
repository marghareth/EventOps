// src/app/(app)/events/[eventId]/import/page.test.tsx
// CSV import page (B2-14, D-052): checks access itself, gives the import steps to roles with
// import.run (Owner, Coordinator) bound to the event in the URL, and refuses Viewers and non-members.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const importStepAction = vi.fn();

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
vi.mock("@/modules/events/attendees/import-actions", () => ({
  importStepAction: Object.assign((...args: unknown[]) => importStepAction(...args), {
    bind: (_this: unknown, eventId: string) => () => importStepAction(eventId),
  }),
}));

const { default: ImportPage } = await import("./page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const access = (role: "OWNER" | "COORDINATOR" | "VIEWER") =>
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: ID, name: "Santos wedding", role } },
  });
const renderPage = async () =>
  render(await ImportPage({ params: Promise.resolve({ eventId: ID }) }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Import page (B2-14)", () => {
  it.each(["OWNER", "COORDINATOR"] as const)("gives a %s the import steps", async (role) => {
    access(role);
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Import attendees" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "1. Choose a CSV file" })).toBeVisible();
    expect(screen.getByLabelText("CSV file")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the guest list" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
  });

  it("refuses a Viewer, even when they type the URL", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(screen.queryByLabelText("CSV file")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to attendees" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
  });

  it("shows nothing to a non-member (not found)", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderPage()).rejects.toMatchObject({ notFound: true });
  });
});