// src/app/(app)/events/page.test.tsx
// My events page (B1-03) with auth and the query mocked: list, empty, demo without a database,
// and the error state.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const getMyEvents = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: (...args: unknown[]) => requireUser(...args) }));
vi.mock("@/modules/events/queries", () => ({
  getMyEvents: (...args: unknown[]) => getMyEvents(...args),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));

const { default: EventsPage } = await import("./page");
const { default: EventsError } = await import("./error");

beforeEach(() => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
});

describe("My events page", () => {
  it("requires sign-in and lists the user's events", async () => {
    getMyEvents.mockResolvedValue({
      status: "ok",
      events: [
        {
          id: "e1",
          reference: "EVT-2099-0001",
          name: "Santos wedding",
          venue: null,
          startsAt: new Date("2099-12-12T08:00:00Z"),
          endsAt: null,
          status: "DRAFT",
          expectedAttendees: 0,
          role: "OWNER",
        },
      ],
    });
    render(await EventsPage());
    expect(requireUser).toHaveBeenCalledWith("/events");
    expect(getMyEvents).toHaveBeenCalledWith("user-1");
    expect(screen.getByRole("heading", { level: 1, name: "My events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Santos wedding" })).toHaveAttribute(
      "href",
      "/events/e1",
    );
  });

  it("shows an empty state that leads to Create Event", async () => {
    getMyEvents.mockResolvedValue({ status: "ok", events: [] });
    render(await EventsPage());
    expect(screen.getByRole("heading", { name: "No events yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an event" })).toHaveAttribute(
      "href",
      "/events/new",
    );
  });

  it("explains demo mode without a database", async () => {
    getMyEvents.mockResolvedValue({ status: "no-database" });
    render(await EventsPage());
    expect(screen.getByText("No database connected")).toBeInTheDocument();
  });
});

describe("My events error state", () => {
  it("shows a safe message, never the error text, and retries", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), {
      digest: "123",
    });
    render(<EventsError error={error} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your events");
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});