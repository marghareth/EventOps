// src/app/(app)/events/[eventId]/page.test.tsx
// Event overview (B1-04): checks access itself, shows the details and the section tiles. B3-11: the
// accessibility alert appears only while the event is Not ready or Almost ready.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetails } from "@/modules/events/public";

type MemberRole = EventDetails["role"];

const requireEventAccess = vi.fn();
const getAccessibilityAlerts = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));
vi.mock("@/modules/events/accessibility/queries", () => ({
  getAccessibilityAlerts: (...args: unknown[]) => getAccessibilityAlerts(...args),
}));
vi.mock("@/modules/events/accessibility/actions", () => ({}));

const { default: EventOverviewPage } = await import("./page");
const { deriveAlerts } = await import("@/modules/events/accessibility/domain/alerts");
const { detectGaps } = await import("@/modules/events/accessibility/domain/gaps");
const { assessCoverage } = await import("@/modules/events/accessibility/domain/readiness");
const { readinessStatus } = await import("@/modules/events/accessibility/domain/readiness-status");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const event = {
  id: ID,
  reference: "EVT-2026-0001",
  name: "Santos wedding",
  venue: null,
  description: "Garden ceremony,\nthen dinner.",
  startsAt: new Date("2026-12-12T08:00:00Z"),
  endsAt: new Date("2026-12-12T14:00:00Z"),
  status: "DRAFT",
  capacity: null,
  expectedAttendees: 1,
  role: "OWNER",
};

async function renderPage(created?: string) {
  render(
    await EventOverviewPage({
      params: Promise.resolve({ eventId: ID }),
      searchParams: Promise.resolve(created ? { created } : {}),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  requireEventAccess.mockResolvedValue({ user: {}, access: { kind: "ok", event } });
  getAccessibilityAlerts.mockResolvedValue({
    ok: true,
    status: "NO_REQUIRED_NEEDS",
    event: null,
    alerts: [],
    canManage: true,
  });
});

describe("event overview", () => {
  it("checks access itself and shows the event's details", async () => {
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Event details" });
    for (const text of [
      "Sat, Dec 12, 2026 · 4:00 PM – 10:00 PM PHT",
      "1 expected attendee",
      "Garden ceremony,",
    ]) {
      expect(details).toHaveTextContent(text);
    }
    expect(within(details).getAllByText("Not set")).toHaveLength(2); // venue and capacity
  });

  it("links a tile to every Tier 1 section, each marked as not set up", async () => {
    await renderPage();
    const tiles = within(screen.getByRole("region", { name: "Sections" })).getAllByRole("link");
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual(
      [
        "attendees",
        "accessibility",
        "suppliers",
        "budget",
        "tasks",
        "impact",
        "import",
        "activity",
        "settings",
      ].map((segment) => `/events/${ID}/${segment}`),
    );
    expect(tiles[0]).toHaveTextContent("AttendeesNot set up yet");
  });

  it("shows the Event created notice only for a well-formed reference", async () => {
    await renderPage("EVT-2026-0001");
    expect(screen.getByText("Event created")).toBeInTheDocument();
  });

  it("ignores a forged reference", async () => {
    await renderPage("<img src=x>");
    expect(screen.queryByText("Event created")).not.toBeInTheDocument();
  });

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("shows %s an Edit event link: %s", async (role: MemberRole, shown: boolean) => {
    requireEventAccess.mockResolvedValue({
      user: {},
      access: { kind: "ok", event: { ...event, role } },
    });
    await renderPage();
    const link = screen.queryByRole("link", { name: "Edit event" });
    if (shown) expect(link).toHaveAttribute("href", `/events/${ID}/settings`);
    else expect(link).not.toBeInTheDocument();
  });
});
describe("event overview: accessibility alert (B3-11, D-066)", () => {
  const guest = (n: number) => ({
    id: `a${n}`,
    number: n,
    name: `Guest ${n}`,
    rsvpStatus: "CONFIRMED" as const,
  });
  /** Alerts as the server builds them, from the real domain rules. */
  function alertsFor(
    types: (
      "CAPTIONING" | "SIGN_LANGUAGE" | "OTHER" | "STEP_FREE_ENTRANCE" | "ACCESSIBLE_RESTROOM"
    )[],
  ) {
    const coverage = assessCoverage({
      requirements: types.map((type, i) => ({
        id: `q${i}`,
        type,
        priority: "REQUIRED" as const,
        attendee: guest(i + 1),
      })),
      resources: [],
    });
    const status = readinessStatus(coverage);
    const alerts = deriveAlerts(status, detectGaps(coverage));
    return { ok: true, status, event: alerts.event, alerts: alerts.gaps, canManage: false };
  }

  it("shows the alert with its issues and a link to fix them when the event is Not ready", async () => {
    getAccessibilityAlerts.mockResolvedValue(alertsFor(["CAPTIONING", "OTHER"]));
    await renderPage();
    expect(getAccessibilityAlerts).toHaveBeenCalledWith(ID);
    const region = screen.getByRole("region", { name: "Accessibility alert" });
    expect(region).toHaveTextContent("Critical: Accessibility: Not ready");
    expect(region).toHaveTextContent("2 issues need attention.");
    expect(
      within(region)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Captioning is not set up", "A need to check by hand"]);
    expect(within(region).getByRole("link", { name: "Review accessibility" })).toHaveAttribute(
      "href",
      `/events/${ID}/accessibility`,
    );
    expect(within(region).queryByRole("alert")).toBeNull();
  });

  it("lists three issues and counts the rest", async () => {
    getAccessibilityAlerts.mockResolvedValue(
      alertsFor([
        "CAPTIONING",
        "SIGN_LANGUAGE",
        "STEP_FREE_ENTRANCE",
        "ACCESSIBLE_RESTROOM",
        "OTHER",
      ]),
    );
    await renderPage();
    const items = within(screen.getByRole("region", { name: "Accessibility alert" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(4);
    expect(items[3]).toHaveTextContent("and 2 more");
  });

  it.each(["READY", "NO_REQUIRED_NEEDS"] as const)(
    "shows no alert when the status is %s",
    async (status) => {
      getAccessibilityAlerts.mockResolvedValue({
        ok: true,
        status,
        event: null,
        alerts: [],
        canManage: true,
      });
      await renderPage();
      expect(screen.queryByRole("region", { name: "Accessibility alert" })).toBeNull();
      expect(screen.queryByText(/couldn't check accessibility/)).toBeNull();
    },
  );

  it("says so when the alert can't be read, and keeps the page", async () => {
    getAccessibilityAlerts.mockRejectedValue(new Error("database down"));
    await renderPage();
    expect(screen.getByText("We couldn't check accessibility alerts")).toBeVisible();
    expect(screen.getByRole("region", { name: "Event details" })).toBeInTheDocument();
  });
});