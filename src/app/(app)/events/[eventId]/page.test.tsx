// src/app/(app)/events/[eventId]/page.test.tsx
// Event overview (B1-04): checks access itself, shows the details and the section tiles. B8 (D-107):
// the dashboard with Event Health status and score, summaries, the attention list (top 5, Critical
// first, with a link to the Critical view) and recent activity only when the read returns it. The
// Batch 3 accessibility alert is replaced by the health attention list.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetails } from "@/modules/events/public";

type MemberRole = EventDetails["role"];

const requireEventAccess = vi.fn();
const getEventHealth = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({ createEventAction: vi.fn() }));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));
vi.mock("@/modules/events/health/queries", () => ({
  getEventHealth: (...args: unknown[]) => getEventHealth(...args),
}));

const { default: EventOverviewPage } = await import("./page");
const { evaluateHealth } = await import("@/modules/events/health/domain/score");
const { dashboardSummary } = await import("@/modules/events/health/domain/summary");
type HealthState = import("@/modules/events/health/domain/health-state").HealthState;

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
  getEventHealth.mockResolvedValue(healthFor(EMPTY_STATE, { status: "hidden" }));
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

  it("no longer shows the placeholder section tiles (D-118)", async () => {
    await renderPage();
    expect(screen.queryByRole("region", { name: "Sections" })).toBeNull();
    expect(screen.queryByText("Not set up yet")).toBeNull();
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
describe("event overview: the health dashboard (B8-F11 to B8-F13, D-107)", () => {
  it("asks for health with recent activity", async () => {
    await renderPage();
    expect(getEventHealth).toHaveBeenCalledWith(ID, { withActivity: true });
  });

  it("shows status, score, summaries and the attention list, Critical first, with a Critical link", async () => {
    getEventHealth.mockResolvedValue(healthFor(TROUBLED, { status: "hidden" }));
    await renderPage();
    const health = screen.getByRole("region", { name: "Event health" });
    expect(health).toHaveTextContent("At risk");
    expect(health).toHaveTextContent("health score");
    expect(within(health).getByRole("list", { name: "Event summary" })).toHaveTextContent(
      "Suppliers0 of 1suppliers confirmed",
    );
    const attention = within(
      screen.getByRole("region", { name: "Needs your attention" }),
    ).getByRole("list", { name: "Needs your attention" });
    const items = within(attention).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Critical");
    expect(items[0]).toHaveTextContent("1 payment is overdue");
    expect(within(items[0]!).getByRole("link", { name: /^Open Suppliers/ })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers`,
    );
    expect(screen.getByRole("link", { name: "View 2 critical issues" })).toHaveAttribute(
      "href",
      `/events/${ID}/health?show=critical`,
    );
  });

  it("names each fix link's issue, and puts the Critical link before the list (B10-F17)", async () => {
    getEventHealth.mockResolvedValue(healthFor(TROUBLED, { status: "hidden" }));
    await renderPage();
    const region = screen.getByRole("region", { name: "Needs your attention" });
    const items = within(region).getAllByRole("listitem");
    expect(within(items[0]!).getByRole("link", { name: /^Open Suppliers/ })).toHaveAccessibleName(
      expect.stringContaining("1 payment is overdue"),
    );
    const critical = within(region).getByRole("link", { name: "View 2 critical issues" });
    const list = within(region).getByRole("list", { name: "Needs your attention" });
    expect(critical.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lists at most five issues and links to the rest", async () => {
    getEventHealth.mockResolvedValue(healthFor(MANY_ISSUES, { status: "hidden" }));
    await renderPage();
    const attention = screen.getByRole("list", { name: "Needs your attention" });
    expect(within(attention).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /^See all \d+ issues$/ })).toHaveAttribute(
      "href",
      `/events/${ID}/health`,
    );
  });

  it("says so when there is nothing to check yet", async () => {
    await renderPage();
    expect(screen.getByText("Nothing to check yet")).toBeVisible();
    expect(screen.getByText("Nothing to check yet.")).toBeVisible();
  });

  it("shows recent activity when the read returns it, and nothing when hidden", async () => {
    getEventHealth.mockResolvedValue(
      healthFor(EMPTY_STATE, {
        status: "ok",
        entries: [
          {
            id: "1",
            summary: "Added the task Confirm florist (TSK-0001)",
            who: "Mika",
            when: "Oct 20, 2026, 8:00 AM PHT",
          },
        ],
      }),
    );
    const { unmount } = render(
      await EventOverviewPage({
        params: Promise.resolve({ eventId: ID }),
        searchParams: Promise.resolve({}),
      }),
    );
    const recent = screen.getByRole("region", { name: "Recent activity" });
    expect(recent).toHaveTextContent("Added the task Confirm florist (TSK-0001)");
    expect(recent).toHaveTextContent("Mika · Oct 20, 2026, 8:00 AM PHT");
    unmount();
    getEventHealth.mockResolvedValue(healthFor(EMPTY_STATE, { status: "hidden" }));
    await renderPage();
    expect(screen.queryByRole("region", { name: "Recent activity" })).toBeNull();
  });

  it("no longer shows the Batch 3 accessibility alert", async () => {
    getEventHealth.mockResolvedValue(healthFor(TROUBLED, { status: "hidden" }));
    await renderPage();
    expect(screen.queryByRole("region", { name: "Accessibility alert" })).toBeNull();
  });

  it("says so when health can't be read, and keeps the page", async () => {
    getEventHealth.mockRejectedValue(new Error("database down"));
    await renderPage();
    expect(screen.getByText("We couldn't check the event's health")).toBeVisible();
    expect(screen.getByRole("region", { name: "Event details" })).toBeInTheDocument();
  });
});

const EMPTY_STATE: HealthState = {
  expectedAttendees: 0,
  capacity: null,
  attendees: [],
  confirmedHeadcount: 0,
  suppliers: [],
  budget: { hasCategories: false, allocatedText: "₱0.00", remainingText: "₱0.00", warnings: [] },
  accessibility: { status: "NO_REQUIRED_NEEDS", alerts: [] },
  tasks: [],
};

const TROUBLED: HealthState = {
  ...EMPTY_STATE,
  attendees: [{ reference: "ATT-0001", name: "Ana", rsvpStatus: "PENDING", hasContact: true }],
  suppliers: [
    {
      reference: "SUP-0001",
      name: "Casa Verde",
      confirmed: false,
      overduePayments: 1,
      hasContact: true,
    },
  ],
  tasks: [
    {
      reference: "TSK-0001",
      title: "Confirm florist",
      priority: "HIGH",
      done: false,
      overdue: true,
      assigned: true,
    },
  ],
};

const MANY_ISSUES: HealthState = {
  ...TROUBLED,
  capacity: 1,
  confirmedHeadcount: 0,
  expectedAttendees: 0,
  attendees: [{ reference: "ATT-0001", name: "Ana", rsvpStatus: "PENDING", hasContact: false }],
  suppliers: [
    {
      reference: "SUP-0001",
      name: "Casa Verde",
      confirmed: false,
      overduePayments: 1,
      hasContact: false,
    },
  ],
};

function healthFor(state: HealthState, activity: unknown) {
  return {
    ok: true,
    health: { ...evaluateHealth(state), summary: dashboardSummary(state, "No required needs") },
    activity,
  };
}