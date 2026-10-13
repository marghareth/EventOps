// src/app/(app)/events/[eventId]/attendees/page.test.tsx
// Guest list, Add attendee (B2-02) and Edit attendee (B2-03) pages: access checked by each page,
// add and edit only for roles that may manage attendees, the empty state, and the notices.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventAttendees = vi.fn();
const createAttendeeAction = vi.fn();
const getAttendeeForEditing = vi.fn();

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
vi.mock("@/modules/events/attendees/read", () => ({
  getEventAttendees: (...args: unknown[]) => getEventAttendees(...args),
  getAttendeeForEditing: (...args: unknown[]) => getAttendeeForEditing(...args),
}));
vi.mock("@/modules/events/attendees/actions", () => ({
  createAttendeeAction: Object.assign((...args: unknown[]) => createAttendeeAction(...args), {
    bind: (_this: unknown, eventId: string) => {
      const bound = () => createAttendeeAction(eventId);
      return Object.assign(bound, { boundTo: eventId });
    },
  }),
  updateAttendeeAction: { bind: () => () => undefined },
  deleteAttendeeAction: vi.fn(),
}));

const { default: AttendeesPage } = await import("./page");
const { default: AddAttendeePage } = await import("./new/page");
const { default: EditAttendeePage } = await import("./[attendeeId]/edit/page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const access = (role: "OWNER" | "COORDINATOR" | "VIEWER") =>
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: ID, name: "Santos wedding", role } },
  });
const guests = [
  { id: "a1", number: 1, name: "Ana Reyes", rsvpStatus: "CONFIRMED", plusOnes: 1, category: null },
  { id: "a2", number: 2, name: "Ben Lim", rsvpStatus: "PENDING", plusOnes: 0, category: "Family" },
];

const renderList = async (search: Record<string, string> = {}) =>
  render(
    await AttendeesPage({
      params: Promise.resolve({ eventId: ID }),
      searchParams: Promise.resolve(search),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  getEventAttendees.mockResolvedValue({ ok: true, attendees: guests });
});

describe("Attendees page", () => {
  it("checks access for the event in the URL and lists the guests", async () => {
    access("VIEWER");
    await renderList();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getEventAttendees).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Attendees" })).toBeInTheDocument();
    expect(screen.getByText("2 attendees")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Ana Reyes" })).toBeInTheDocument();
  });

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("shows Add attendee to a %s: %s", async (role, shown) => {
    access(role);
    await renderList();
    const link = screen.queryByRole("link", { name: "Add attendee" });
    if (shown) expect(link).toHaveAttribute("href", `/events/${ID}/attendees/new`);
    else expect(link).not.toBeInTheDocument();
  });

  it("shows an empty state that leads to adding the first guest", async () => {
    access("COORDINATOR");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: [] });
    await renderList();
    expect(screen.getByRole("heading", { name: "No attendees yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add the first attendee" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees/new`,
    );
    expect(screen.getByText("0 attendees")).toBeInTheDocument();
  });

  it("tells a Viewer who can add guests, without offering the action", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: [] });
    await renderList();
    expect(screen.getByText("Owners and Coordinators can add guests to this event.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Add/ })).not.toBeInTheDocument();
  });

  it("confirms an added attendee by name, taken from the list, not the URL", async () => {
    access("OWNER");
    await renderList({ added: "ATT-0002" });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Attendee added");
    expect(notice).toHaveTextContent("Ben Lim is on the guest list as ATT-0002.");
  });

  it.each(["<b>Maria</b>", "ATT-1", "Maria Santos", "ATT-0001; DROP"])(
    "ignores a forged added value %j",
    async (added) => {
      access("OWNER");
      await renderList({ added });
      expect(screen.queryByText("Attendee added")).not.toBeInTheDocument();
    },
  );
});

describe("Add attendee page", () => {
  const renderAdd = async () =>
    render(await AddAttendeePage({ params: Promise.resolve({ eventId: ID }) }));

  it.each(["OWNER", "COORDINATOR"] as const)("gives a %s the form", async (role) => {
    access(role);
    await renderAdd();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Add an attendee" })).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
  });

  it("refuses a Viewer, even when they type the URL", async () => {
    access("VIEWER");
    await renderAdd();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to attendees" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
  });

  it("shows nothing of the form to a non-member (not found)", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderAdd()).rejects.toMatchObject({ notFound: true });
  });
});

describe("guest list after editing (B2-03)", () => {
  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("links names to their edit page for a %s: %s", async (role, linked) => {
    access(role);
    await renderList();
    const link = screen.queryByRole("link", { name: "Ana Reyes" });
    if (linked) expect(link).toHaveAttribute("href", `/events/${ID}/attendees/a1/edit`);
    else expect(link).not.toBeInTheDocument();
  });

  it("confirms saved changes by name, taken from the list", async () => {
    access("OWNER");
    await renderList({ saved: "ATT-0001" });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Changes saved");
    expect(notice).toHaveTextContent("Ana Reyes (ATT-0001) is up to date.");
  });
});

describe("Edit attendee page (B2-03)", () => {
  const ATTENDEE = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
  const stored = {
    id: ATTENDEE,
    number: 3,
    name: "Carla Santos",
    email: "carla@example.com",
    phone: null,
    category: "Family",
    rsvpStatus: "PENDING",
    plusOnes: 2,
    dietaryNeeds: null,
    notes: "Bring a high chair",
    updatedAt: new Date("2026-10-12T04:00:00.000Z"),
  };
  const renderEdit = async () =>
    render(
      await EditAttendeePage({ params: Promise.resolve({ eventId: ID, attendeeId: ATTENDEE }) }),
    );

  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives a %s the form with stored values",
    async (role) => {
      access(role);
      getAttendeeForEditing.mockResolvedValue({ ok: true, attendee: stored });
      await renderEdit();
      expect(requireEventAccess).toHaveBeenCalledWith(ID);
      expect(getAttendeeForEditing).toHaveBeenCalledWith(ID, ATTENDEE);
      expect(screen.getByRole("heading", { level: 1, name: "Edit Carla Santos" })).toBeVisible();
      expect(screen.getByText("ATT-0003")).toBeVisible();
      expect(screen.getByLabelText(/^Name/)).toHaveValue("Carla Santos");
      expect(screen.getByLabelText(/^Plus-ones/)).toHaveValue(2);
      expect(screen.getByLabelText(/^Notes/)).toHaveValue("Bring a high chair");
      expect(document.querySelector("input[name=version]")).toHaveValue("2026-10-12T04:00:00.000Z");
    },
  );

  it("refuses a Viewer without loading the attendee", async () => {
    access("VIEWER");
    await renderEdit();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getAttendeeForEditing).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });

  it("is not found for an unknown attendee or another event's attendee", async () => {
    access("OWNER");
    getAttendeeForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    // Next.js's own notFound(): the same 404 page as an unknown event (D-027).
    await expect(renderEdit()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("is not found for a non-member", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderEdit()).rejects.toMatchObject({ notFound: true });
    expect(getAttendeeForEditing).not.toHaveBeenCalled();
  });
});