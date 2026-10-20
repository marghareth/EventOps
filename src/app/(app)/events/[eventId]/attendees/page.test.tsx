// src/app/(app)/events/[eventId]/attendees/page.test.tsx
// Guest list, Add attendee (B2-02) and Edit attendee (B2-03) pages: access checked by each page,
// add and edit only for roles that may manage attendees, the empty state, and the notices. Attendee
// details (B2-07) for every member.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventAttendees = vi.fn();
const createAttendeeAction = vi.fn();
const getAttendeeForEditing = vi.fn();
const getAttendeeDetails = vi.fn();
const getAttendeeAccessibility = vi.fn();

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
  getAttendeeDetails: (...args: unknown[]) => getAttendeeDetails(...args),
}));
vi.mock("@/modules/events/accessibility/queries", () => ({
  getAttendeeAccessibility: (...args: unknown[]) => getAttendeeAccessibility(...args),
  getAccessibilityAlerts: async () => ({
    ok: true,
    status: "READY",
    event: null,
    alerts: [],
    canManage: false,
  }),
  getNewRequirementContext: vi.fn(),
  getRequirementForEditing: vi.fn(),
}));
vi.mock("@/modules/events/accessibility/actions", () => ({
  createRequirementAction: vi.fn(),
  updateRequirementAction: vi.fn(),
  deleteRequirementAction: vi.fn(),
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
const { default: AttendeePage } = await import("./[attendeeId]/page");

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

/** The page's notice: the status region with text (the export button keeps an empty one ready). */
const shownNotice = () => {
  const filled = screen.getAllByRole("status").filter((el) => el.textContent?.trim());
  expect(filled).toHaveLength(1);
  return filled[0];
};

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
  getAttendeeAccessibility.mockResolvedValue({
    ok: true,
    requirements: [],
    showNotes: false,
    canManage: false,
  });
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

  it("shows the expected headcount from the guest list to every member (B2-05, D-046)", async () => {
    access("VIEWER");
    await renderList();
    const summary = screen.getByRole("region", { name: "Headcount from the guest list" });
    // Ana: Confirmed +1 → 2. Ben: Pending → not yet confirmed.
    expect(summary).toHaveTextContent("Expected headcount2");
    expect(summary).toHaveTextContent("1 confirmed + 1 plus-one, from the guest list");
    expect(summary).toHaveTextContent("1 attendee, 1 person with plus-ones. Not counted yet.");
  });

  it("shows dietary needs to a Viewer when the server loaded them (B2-06, D-047)", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({
      ok: true,
      showDietaryNeeds: true,
      attendees: [{ ...guests[0], dietaryNeeds: "Vegetarian; no nuts" }, guests[1]],
    });
    await renderList();
    expect(screen.getByRole("columnheader", { name: "Dietary needs" })).toBeInTheDocument();
    expect(screen.getByText("Vegetarian; no nuts")).toBeInTheDocument();
    expect(screen.getByText("Not recorded", { selector: "span" })).toHaveClass("sr-only");
  });

  it("has no dietary column when the server says the reader may not see it", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({ ok: true, showDietaryNeeds: false, attendees: guests });
    await renderList();
    expect(screen.queryByRole("columnheader", { name: "Dietary needs" })).not.toBeInTheDocument();
  });

  it("shows no headcount summary for an empty guest list", async () => {
    access("OWNER");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: [] });
    await renderList();
    expect(screen.queryByRole("region", { name: "Headcount from the guest list" })).toBeNull();
  });

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("shows Export CSV to a %s: %s (B2-19)", async (role, shown) => {
    access(role);
    await renderList();
    const link = screen.queryByRole("link", { name: "Export CSV" });
    if (shown) {
      expect(link).toHaveAttribute("href", `/api/events/${ID}/attendees/export`);
      expect(link).toHaveAttribute("download");
    } else expect(link).not.toBeInTheDocument();
  });

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("shows Import spreadsheet to a %s: %s (B2-14)", async (role, shown) => {
    access(role);
    await renderList();
    const link = screen.queryByRole("link", { name: "Import spreadsheet" });
    if (shown) expect(link).toHaveAttribute("href", `/events/${ID}/import`);
    else expect(link).not.toBeInTheDocument();
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
    const notice = shownNotice();
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
  it.each(["OWNER", "COORDINATOR", "VIEWER"] as const)(
    "links names to their details page for every member: %s (B2-07)",
    async (role) => {
      access(role);
      await renderList();
      expect(screen.getByRole("link", { name: "Ana Reyes" })).toHaveAttribute(
        "href",
        `/events/${ID}/attendees/a1`,
      );
    },
  );

  it("confirms a removal by number only (B2-04)", async () => {
    access("OWNER");
    await renderList({ removed: "ATT-0009" });
    const notice = shownNotice();
    expect(notice).toHaveTextContent("Attendee removed");
    expect(notice).toHaveTextContent("ATT-0009 is no longer on the guest list.");
  });

  it("ignores a forged removed value", async () => {
    access("OWNER");
    await renderList({ removed: "Maria <script>" });
    expect(screen.queryByText("Attendee removed")).not.toBeInTheDocument();
  });

  it("confirms saved changes by name, taken from the list", async () => {
    access("OWNER");
    await renderList({ saved: "ATT-0001" });
    const notice = shownNotice();
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
      expect(screen.getAllByText("ATT-0003")[0]).toBeVisible();
      // B2-04: Remove attendee sits below the form, behind a confirmation.
      expect(screen.getByRole("region", { name: "Remove attendee" })).toBeInTheDocument();
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

describe("Attendee details page (B2-07, D-048)", () => {
  const ATTENDEE = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
  const shown = {
    id: ATTENDEE,
    number: 3,
    name: "Carla Santos",
    rsvpStatus: "PENDING",
    plusOnes: 2,
    category: "Family",
    dietaryNeeds: null,
  };
  const renderDetails = async () =>
    render(await AttendeePage({ params: Promise.resolve({ eventId: ID, attendeeId: ATTENDEE }) }));

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("opens for a %s; Edit attendee shown: %s", async (role, editable) => {
    access(role);
    getAttendeeDetails.mockResolvedValue({
      ok: true,
      attendee: editable
        ? { ...shown, email: null, phone: null, notes: "Bring a high chair" }
        : shown,
      fields: { dietaryNeeds: true, private: editable },
    });
    await renderDetails();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getAttendeeDetails).toHaveBeenCalledWith(ID, ATTENDEE);
    expect(screen.getByRole("heading", { level: 1, name: "Carla Santos" })).toBeVisible();
    expect(screen.getByText("ATT-0003")).toBeVisible();
    expect(screen.getByText("Pending")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the guest list" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
    const edit = screen.queryByRole("link", { name: "Edit attendee" });
    if (editable) {
      expect(edit).toHaveAttribute("href", `/events/${ID}/attendees/${ATTENDEE}/edit`);
      expect(screen.getByRole("region", { name: "Notes" })).toHaveTextContent("Bring a high chair");
    } else {
      expect(edit).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Notes" })).not.toBeInTheDocument();
    }
  });

  it.each([
    ["OWNER", ["Details", "Notes", "Accessibility"]],
    ["VIEWER", ["Details", "Accessibility"]],
  ] as const)("composes its sections in order for a %s (B2-13, B3-04)", async (role, sections) => {
    access(role);
    const privateFields = role !== "VIEWER";
    getAttendeeDetails.mockResolvedValue({
      ok: true,
      attendee: privateFields ? { ...shown, email: null, phone: null, notes: null } : shown,
      fields: { dietaryNeeds: true, private: privateFields },
    });
    await renderDetails();
    const names = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-labelledby"))
      .map((id) => document.getElementById(id!)?.textContent);
    expect(names).toEqual(sections);
    // The Accessibility section comes from its own module's read (D-051), for this attendee.
    expect(getAttendeeAccessibility).toHaveBeenCalledWith(ID, ATTENDEE);
  });

  it("is not found for an unknown attendee or another event's attendee", async () => {
    access("OWNER");
    getAttendeeDetails.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderDetails()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("is not found for a non-member, without loading the attendee", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderDetails()).rejects.toMatchObject({ notFound: true });
    expect(getAttendeeDetails).not.toHaveBeenCalled();
  });
});

describe("RSVP filter on the guest list (B2-08, D-049)", () => {
  const four = [
    ...guests,
    {
      id: "a3",
      number: 3,
      name: "Carla Santos",
      rsvpStatus: "CONFIRMED",
      plusOnes: 2,
      category: null,
    },
    { id: "a4", number: 4, name: "Diego Tan", rsvpStatus: "DECLINED", plusOnes: 0, category: null },
  ];
  const names = () => screen.getAllByRole("rowheader").map((th) => th.textContent);

  beforeEach(() => {
    getEventAttendees.mockResolvedValue({ ok: true, attendees: four });
  });

  it.each(["OWNER", "COORDINATOR", "VIEWER"] as const)(
    "filters the table for a %s, keeping the headcount for the whole list",
    async (role) => {
      access(role);
      await renderList({ rsvp: "confirmed" });
      expect(names()).toEqual(["Ana Reyes", "Carla Santos"]);
      expect(screen.getByText("2 of 4 attendees, Confirmed")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Confirmed (2)" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      // Ana 1+1, Carla 1+2: the summary is the event's, not the filter's.
      const summary = screen.getByRole("region", { name: "Headcount from the guest list" });
      expect(summary).toHaveTextContent("Expected headcount5");
    },
  );

  it("shows everyone without a filter, or with an unknown value", async () => {
    access("OWNER");
    for (const rsvp of [undefined, "ATTENDING", "<script>"]) {
      await renderList(rsvp ? { rsvp } : {});
      expect(names()).toHaveLength(4);
      expect(screen.getByText("4 attendees")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "All (4)" })).toHaveAttribute("aria-current", "true");
      document.body.innerHTML = "";
    }
  });

  it("says when nobody has that RSVP and offers to show everyone", async () => {
    access("VIEWER");
    await renderList({ rsvp: "maybe" });
    expect(screen.getByRole("heading", { name: "No Maybe attendees" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show everyone" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("0 of 4 attendees, Maybe")).toBeInTheDocument();
  });

  it("has no filter on an empty guest list", async () => {
    access("OWNER");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: [] });
    await renderList({ rsvp: "confirmed" });
    expect(screen.queryByRole("navigation", { name: "Filter by RSVP" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No attendees yet" })).toBeInTheDocument();
  });
});

describe("guest list acceptance (B2-09)", () => {
  const list = [
    { ...guests[0], dietaryNeeds: "Vegetarian" },
    { ...guests[1], dietaryNeeds: null },
  ];

  it("gives an Owner the full list: columns, details links and Add attendee", async () => {
    access("OWNER");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: list, showDietaryNeeds: true });
    await renderList();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "ID",
      "Name",
      "RSVP",
      "Plus-ones",
      "Category",
      "Dietary needs",
    ]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent(/ATT-0001.*Ana Reyes.*Confirmed.*1.*Vegetarian/);
    expect(rows[1]).toHaveTextContent(/ATT-0002.*Ben Lim.*Pending.*0.*Family.*Not recorded/);
    expect(screen.getByRole("link", { name: "Ben Lim" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees/a2`,
    );
    expect(screen.getByRole("link", { name: "Add attendee" })).toBeVisible();
  });

  it("gives a Viewer the same list to read, with details links but no Add", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({ ok: true, attendees: list, showDietaryNeeds: true });
    await renderList();
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Ana Reyes" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add attendee" })).not.toBeInTheDocument();
  });

  it("asks the server only for this event's guest list", async () => {
    access("COORDINATOR");
    await renderList();
    expect(getEventAttendees).toHaveBeenCalledTimes(1);
    expect(getEventAttendees).toHaveBeenCalledWith(ID);
  });
});

describe("search, filters and sorting (B2-10, B2-11, B2-12; D-050)", () => {
  const list = [
    {
      id: "a1",
      number: 1,
      name: "Ana Reyes",
      rsvpStatus: "CONFIRMED",
      plusOnes: 1,
      category: "Family",
      dietaryNeeds: "Vegetarian",
      email: "ana@example.com",
      phone: "0917 111 2222",
    },
    {
      id: "a2",
      number: 2,
      name: "Ben Lim",
      rsvpStatus: "PENDING",
      plusOnes: 0,
      category: "Friends",
      dietaryNeeds: null,
      email: null,
      phone: null,
    },
    {
      id: "a3",
      number: 3,
      name: "José Peña",
      rsvpStatus: "MAYBE",
      plusOnes: 3,
      category: "Family",
      dietaryNeeds: null,
      email: "jose@example.com",
      phone: null,
    },
  ];
  /** A row without the given fields, as a role that doesn't receive them gets it. */
  const without = (row: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
  const viewerList = list.map((row) => without(row, ["email", "phone"]));
  const names = () => screen.queryAllByRole("rowheader").map((th) => th.textContent);

  beforeEach(() => {
    getEventAttendees.mockResolvedValue({ ok: true, attendees: list, showDietaryNeeds: true });
  });

  it("searches by name ignoring accents, and counts the matches", async () => {
    access("COORDINATOR");
    await renderList({ q: "pena" });
    expect(names()).toEqual(["José Peña"]);
    expect(screen.getByText("1 of 3 attendees match")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("pena");
    // The headcount summary still covers everyone: Ana 1 + 1.
    expect(screen.getByRole("region", { name: "Headcount from the guest list" })).toHaveTextContent(
      "Expected headcount2",
    );
  });

  it("lets an Owner or Coordinator search by email; a Viewer's rows carry no email", async () => {
    access("OWNER");
    await renderList({ q: "jose@" });
    expect(names()).toEqual(["José Peña"]);
    document.body.innerHTML = "";

    access("VIEWER");
    getEventAttendees.mockResolvedValue({
      ok: true,
      attendees: viewerList,
      showDietaryNeeds: true,
    });
    await renderList({ q: "jose@" });
    expect(names()).toEqual([]);
    expect(screen.getByRole("heading", { name: "No attendees match" })).toBeInTheDocument();
  });

  it("combines filters with AND and keeps them in the RSVP links", async () => {
    access("OWNER");
    await renderList({ category: "family", plusones: "yes", sort: "id", dir: "desc" });
    expect(names()).toEqual(["José Peña", "Ana Reyes"]);
    expect(screen.getByRole("link", { name: "Maybe (1)" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees?rsvp=maybe&category=Family&plusones=yes&sort=id&dir=desc`,
    );
    expect(screen.getByRole("link", { name: "All (3)" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees?category=Family&plusones=yes&sort=id&dir=desc`,
    );
  });

  it("filters by dietary needs", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({
      ok: true,
      attendees: viewerList,
      showDietaryNeeds: true,
    });
    await renderList({ dietary: "no" });
    expect(names()).toEqual(["Ben Lim", "José Peña"]);
  });

  it("ignores the dietary filter when the reader can't see dietary needs", async () => {
    access("VIEWER");
    getEventAttendees.mockResolvedValue({
      ok: true,
      attendees: viewerList.map((row) => without(row, ["dietaryNeeds"])),
      showDietaryNeeds: false,
    });
    await renderList({ dietary: "yes" });
    expect(names()).toHaveLength(3);
    expect(screen.queryByRole("combobox", { name: "Dietary needs" })).not.toBeInTheDocument();
  });

  it("sorts, marks the sorted column, and offers Clear all", async () => {
    access("OWNER");
    await renderList({ sort: "rsvp", dir: "desc" });
    expect(names()).toEqual(["José Peña", "Ben Lim", "Ana Reyes"]);
    expect(screen.getByRole("columnheader", { name: "RSVP" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByText("3 attendees")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
  });

  it("says what was searched when nothing matches, and offers to clear it", async () => {
    access("OWNER");
    await renderList({ q: "zzz", rsvp: "confirmed" });
    expect(screen.getByRole("heading", { name: "No attendees match" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Search: “zzz” · RSVP: Confirmed. Change the search or filters, or clear them.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search and filters" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("ignores junk in the address and shows everyone by name", async () => {
    access("OWNER");
    await renderList({
      q: "   ",
      sort: "drop table",
      dir: "sideways",
      category: "<script>",
      plusones: "lots",
    });
    expect(names()).toEqual(["Ana Reyes", "Ben Lim", "José Peña"]);
    expect(screen.getByText("3 attendees")).toBeInTheDocument();
  });
});