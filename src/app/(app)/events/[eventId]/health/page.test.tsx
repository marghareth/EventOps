// src/app/(app)/events/[eventId]/health/page.test.tsx
// The Health page and the Critical Alert View (B8-F01, B8-F09, B8-F10, B8-F14, B8-F15, B8-F17,
// B8-F19; D-105 to D-107): access checked by the page, no recent activity asked for, every check
// grouped by area with its explanation, the issues Critical first, the "Critical only" view with why
// each is critical and where to fix it, and the empty, nothing-critical and unavailable states.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventHealth = vi.fn();

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
vi.mock("@/modules/events/health/queries", () => ({
  getEventHealth: (...args: unknown[]) => getEventHealth(...args),
}));

const { default: HealthPage } = await import("./page");
const { evaluateHealth } = await import("@/modules/events/health/domain/score");
const { dashboardSummary } = await import("@/modules/events/health/domain/summary");
type HealthState = import("@/modules/events/health/domain/health-state").HealthState;

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

const EMPTY: HealthState = {
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
  ...EMPTY,
  attendees: [{ reference: "ATT-0001", name: "Ana", rsvpStatus: "PENDING", hasContact: true }],
  suppliers: [
    {
      reference: "SUP-0001",
      name: "Casa Verde",
      confirmed: true,
      overduePayments: 2,
      hasContact: true,
    },
  ],
  tasks: [
    {
      reference: "TSK-0001",
      title: "Book chairs",
      priority: "LOW",
      done: false,
      overdue: true,
      assigned: true,
    },
  ],
};
const ATTENTION_ONLY: HealthState = {
  ...TROUBLED,
  suppliers: [
    {
      reference: "SUP-0001",
      name: "Casa Verde",
      confirmed: true,
      overduePayments: 0,
      hasContact: true,
    },
  ],
};

const resolve = (state: HealthState) =>
  getEventHealth.mockResolvedValue({
    ok: true,
    health: { ...evaluateHealth(state), summary: dashboardSummary(state, "No required needs") },
    activity: { status: "hidden" },
  });

const render_ = async (query: Record<string, string> = {}) =>
  render(
    await HealthPage({
      params: Promise.resolve({ eventId: EVENT }),
      searchParams: Promise.resolve(query),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: EVENT, name: "Santos wedding", role: "VIEWER" } },
  });
});

describe("the Health page", () => {
  it("checks access itself and reads health without recent activity", async () => {
    resolve(TROUBLED);
    await render_();
    expect(requireEventAccess).toHaveBeenCalledWith(EVENT);
    expect(getEventHealth).toHaveBeenCalledWith(EVENT, { withActivity: false });
  });

  it("shows the status, the issues Critical first, and every check by area with why", async () => {
    resolve(TROUBLED);
    await render_();
    expect(screen.getByRole("heading", { level: 1, name: "Event health" })).toBeVisible();
    expect(screen.getByText("At risk")).toBeVisible();
    const issues = within(screen.getByRole("list", { name: "Health issues" })).getAllByRole(
      "listitem",
    );
    expect(issues.map((i) => i.querySelector("h3")?.textContent)).toEqual([
      "2 payments are overdue",
      "1 guest hasn't replied yet",
      "1 task is overdue",
    ]);
    expect(issues[0]).toHaveTextContent("Check: No supplier payment is overdue");
    expect(issues[0]).toHaveTextContent("SUP-0001");
    for (const area of ["Attendees", "Suppliers", "Budget", "Accessibility", "Tasks"]) {
      expect(screen.getByRole("region", { name: area })).toBeVisible();
    }
    expect(screen.getByRole("region", { name: "Budget" })).toHaveTextContent("Not checked");
    expect(screen.getByRole("link", { name: "All checks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows only Critical issues in the Critical view, each with why and where to fix it", async () => {
    resolve(TROUBLED);
    await render_({ show: "critical" });
    expect(screen.getByRole("heading", { level: 1, name: "Critical issues" })).toBeVisible();
    const items = within(screen.getByRole("list", { name: "Critical issues" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Critical");
    expect(items[0]).toHaveTextContent("Unpaid payments are past their due date");
    expect(within(items[0]!).getByRole("link", { name: "Open Suppliers" })).toHaveAttribute(
      "href",
      `/events/${EVENT}/suppliers`,
    );
    expect(screen.getByRole("link", { name: "Critical only (1)" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("region", { name: "Every check" })).toBeNull();
  });

  it("says there is nothing critical, and how many need attention", async () => {
    resolve(ATTENTION_ONLY);
    await render_({ show: "critical" });
    expect(screen.getByText("No critical issues")).toBeVisible();
    expect(
      screen.getByText("Nothing is Critical right now. 2 checks need attention."),
    ).toBeVisible();
  });

  it("says there is nothing to check yet for a new event", async () => {
    resolve(EMPTY);
    await render_();
    expect(screen.getByText("Nothing to check yet")).toBeVisible();
    expect(
      screen.getByText("Nothing to check yet. Add guests, suppliers, a budget or tasks."),
    ).toBeVisible();
  });

  it("shows a safe error when the data can't be read", async () => {
    getEventHealth.mockResolvedValue({ ok: false, reason: "unavailable" });
    await render_();
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't check the event's health" }),
    ).toBeVisible();
  });
});