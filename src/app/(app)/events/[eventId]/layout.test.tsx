// src/app/(app)/events/[eventId]/layout.test.tsx
// Event workspace layout (B1-04): runs the access check and shows the event's identity.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventAccess = vi.fn();
const getCurrentUser = vi.fn();

vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: (...args: unknown[]) => getEventAccess(...args),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));

const { default: EventLayout, generateMetadata } = await import("./layout");
const { EventContextProvider, useConfirmedEvent } =
  await import("@/components/layout/EventContext");

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
});

describe("event context and tab title (B1-13)", () => {
  function ShowConfirmed() {
    const confirmed = useConfirmedEvent(ID);
    return <p>confirmed: {confirmed ? `${confirmed.name} ${confirmed.reference}` : "none"}</p>;
  }

  it("tells the shell which event it is, once access is confirmed", async () => {
    requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "ok", event } });
    render(
      <EventContextProvider>
        {await EventLayout({
          children: <ShowConfirmed />,
          params: Promise.resolve({ eventId: ID }),
        })}
      </EventContextProvider>,
    );
    expect(await screen.findByText("confirmed: Santos wedding EVT-2026-0001")).toBeInTheDocument();
  });

  const metadata = () => generateMetadata({ params: Promise.resolve({ eventId: ID }) });

  it("names the event in the browser tab for a member", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
    getEventAccess.mockResolvedValue({ kind: "ok", event });
    expect(await metadata()).toEqual({
      title: { template: "%s · Santos wedding · EventOps", default: "Santos wedding · EventOps" },
    });
    expect(getEventAccess).toHaveBeenCalledWith("user-1", ID);
  });

  it("names the event on the overview tab too", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
    getEventAccess.mockResolvedValue({ kind: "ok", event });
    const { generateMetadata: overviewMetadata } = await import("./page");
    expect(
      await overviewMetadata({
        params: Promise.resolve({ eventId: ID }),
        searchParams: Promise.resolve({}),
      }),
    ).toEqual({ title: { absolute: "Overview · Santos wedding · EventOps" } });
    getCurrentUser.mockResolvedValue(null);
    expect(
      await overviewMetadata({
        params: Promise.resolve({ eventId: ID }),
        searchParams: Promise.resolve({}),
      }),
    ).toEqual({ title: "Overview" });
  });

  it.each([
    ["signed out", () => getCurrentUser.mockResolvedValue(null)],
    [
      "not a member",
      () => {
        getCurrentUser.mockResolvedValue({ id: "user-2", email: "x@example.com" });
        getEventAccess.mockResolvedValue({ kind: "not-found" });
      },
    ],
    ["sign-in unavailable", () => getCurrentUser.mockRejectedValue(new Error("down"))],
  ])("adds nothing to the title when %s", async (_label: string, arrange: () => void) => {
    arrange();
    expect(await metadata()).toEqual({});
  });
});