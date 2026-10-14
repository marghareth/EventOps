// src/app/(app)/events/[eventId]/attendees/[attendeeId]/accessibility/pages.test.tsx
// Add and edit accessibility need pages (B3-04): access checked by each page, forms only for roles
// that may manage accessibility (a Viewer's request loads nothing), not found for unknown or other
// events' records, and the notice on the attendee details page read only from known values.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getNewRequirementContext = vi.fn();
const getRequirementForEditing = vi.fn();
const getAttendeeAccessibility = vi.fn();
const getAttendeeDetails = vi.fn();

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
  getEventAttendees: vi.fn(),
  getAttendeeForEditing: vi.fn(),
  getAttendeeDetails: (...args: unknown[]) => getAttendeeDetails(...args),
}));
vi.mock("@/modules/events/attendees/actions", () => ({
  createAttendeeAction: vi.fn(),
  updateAttendeeAction: vi.fn(),
  deleteAttendeeAction: vi.fn(),
}));
vi.mock("@/modules/events/accessibility/queries", () => ({
  getAttendeeAccessibility: (...args: unknown[]) => getAttendeeAccessibility(...args),
  getNewRequirementContext: (...args: unknown[]) => getNewRequirementContext(...args),
  getRequirementForEditing: (...args: unknown[]) => getRequirementForEditing(...args),
}));
vi.mock("@/modules/events/accessibility/actions", () => ({
  createRequirementAction: { bind: () => () => undefined },
  updateRequirementAction: { bind: () => () => undefined },
  deleteRequirementAction: { bind: () => () => undefined },
}));

const { default: NewRequirementPage } = await import("./new/page");
const { default: EditRequirementPage } = await import("./[requirementId]/edit/page");
const { default: AttendeePage } = await import("../../../page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const ATTENDEE = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const REQUIREMENT = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const maria = { id: ATTENDEE, number: 3, name: "Maria Santos" };
const access = (role: "OWNER" | "COORDINATOR" | "VIEWER") =>
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: ID, name: "Santos wedding", role } },
  });
const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Add accessibility need page", () => {
  const renderPage = async () =>
    render(
      await NewRequirementPage({ params: Promise.resolve({ eventId: ID, attendeeId: ATTENDEE }) }),
    );

  it.each(["OWNER", "COORDINATOR"] as const)("gives a %s the form", async (role) => {
    access(role);
    getNewRequirementContext.mockResolvedValue({
      ok: true,
      attendee: maria,
      takenTypes: ["CAPTIONING"],
    });
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getNewRequirementContext).toHaveBeenCalledWith(ID, ATTENDEE);
    expect(
      screen.getByRole("heading", { level: 1, name: "Add an accessibility need for Maria Santos" }),
    ).toBeVisible();
    expect(screen.getByText("ATT-0003")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Captioning \(already added\)/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees/${ATTENDEE}`,
    );
  });

  it("refuses a Viewer without loading the attendee", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getNewRequirementContext).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("is not found for an unknown or another event's attendee, and for a non-member", async () => {
    access("OWNER");
    getNewRequirementContext.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    requireEventAccess.mockRejectedValue(notFoundError);
    await expect(renderPage()).rejects.toMatchObject({ notFound: true });
  });

  it("says when every listed need is already recorded", async () => {
    access("OWNER");
    getNewRequirementContext.mockResolvedValue({
      ok: true,
      attendee: maria,
      takenTypes: [
        "MOBILITY_ASSISTANCE",
        "ACCESSIBLE_SEATING",
        "STEP_FREE_ENTRANCE",
        "ACCESSIBLE_RESTROOM",
        "SIGN_LANGUAGE",
        "CAPTIONING",
        "OTHER",
      ],
    });
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "Every listed need is already recorded" }),
    ).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("Edit accessibility need page", () => {
  const stored = {
    id: REQUIREMENT,
    attendeeId: ATTENDEE,
    type: "OTHER",
    priority: "PREFERRED",
    note: "Guide dog",
    updatedAt: new Date("2026-10-13T04:00:00.000Z"),
  };
  const renderPage = async () =>
    render(
      await EditRequirementPage({
        params: Promise.resolve({ eventId: ID, attendeeId: ATTENDEE, requirementId: REQUIREMENT }),
      }),
    );

  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives a %s the form with stored values, and Remove",
    async (role) => {
      access(role);
      getRequirementForEditing.mockResolvedValue({
        ok: true,
        attendee: maria,
        requirement: stored,
        takenTypes: [],
      });
      await renderPage();
      expect(getRequirementForEditing).toHaveBeenCalledWith(ID, ATTENDEE, REQUIREMENT);
      expect(
        screen.getByRole("heading", { level: 1, name: "Edit Other for Maria Santos" }),
      ).toBeVisible();
      expect(screen.getByRole("radio", { name: /^Other/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Preferred/ })).toBeChecked();
      expect(screen.getByLabelText("Note")).toHaveValue("Guide dog");
      expect(document.querySelector("input[name=version]")).toHaveValue("2026-10-13T04:00:00.000Z");
      expect(screen.getByRole("region", { name: "Remove this need" })).toBeInTheDocument();
    },
  );

  it("refuses a Viewer without loading the need", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getRequirementForEditing).not.toHaveBeenCalled();
  });

  it("is not found for an unknown need, or one of another attendee or event", async () => {
    access("COORDINATOR");
    getRequirementForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe("Attendee details page: accessibility (B3-04)", () => {
  const renderDetails = async (search: Record<string, string> = {}) =>
    render(
      await AttendeePage({
        params: Promise.resolve({ eventId: ID, attendeeId: ATTENDEE }),
        searchParams: Promise.resolve(search),
      }),
    );

  beforeEach(() => {
    access("OWNER");
    getAttendeeDetails.mockResolvedValue({
      ok: true,
      attendee: {
        id: ATTENDEE,
        number: 3,
        name: "Maria Santos",
        rsvpStatus: "CONFIRMED",
        plusOnes: 0,
        category: null,
        dietaryNeeds: null,
        email: null,
        phone: null,
        notes: null,
      },
      fields: { dietaryNeeds: true, private: true },
    });
    getAttendeeAccessibility.mockResolvedValue({
      ok: true,
      requirements: [],
      showNotes: true,
      canManage: true,
    });
  });

  it("confirms a change by the need's canonical label", async () => {
    await renderDetails({ accessibility: "added", need: "STEP_FREE_ENTRANCE" });
    const status = screen.getAllByRole("status").find((el) => el.textContent?.trim());
    expect(status).toHaveTextContent("Accessibility need added");
    expect(status).toHaveTextContent("Step-free entry is now on this guest's accessibility needs.");
  });

  it.each([
    { accessibility: "added", need: "<b>x</b>" },
    { accessibility: "hacked", need: "CAPTIONING" },
    { accessibility: "added", need: "captioning" },
  ])("ignores a forged notice %j", async (search) => {
    await renderDetails(search);
    expect(screen.queryByText(/Accessibility need/)).not.toBeInTheDocument();
  });

  it("keeps the rest of the page when the accessibility read fails", async () => {
    getAttendeeAccessibility.mockRejectedValue(new Error("database down"));
    await renderDetails();
    expect(screen.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Accessibility" })).toHaveTextContent(
      "We couldn't load accessibility needs.",
    );
  });
});