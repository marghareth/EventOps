// src/app/(app)/events/[eventId]/impact/page.test.tsx
// The Impact page (B7-F01, B7-F10 to B7-F12, B7-F14, B7-F17; D-101 to D-103): access checked by the
// page, the proposed number passed from the address to the authorized read, results with a summary,
// the save button and the assumptions form only for roles that may use them, the read-only
// assumptions for Viewers, the invalid, no-change, empty-history and unavailable states, and the
// notices shown only for known kinds and well-formed references.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getImpactWorkspace = vi.fn();

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
vi.mock("@/modules/events/impact/queries", () => ({
  HISTORY_LIMIT: 20,
  getImpactWorkspace: (...args: unknown[]) => getImpactWorkspace(...args),
}));
vi.mock("@/modules/events/impact/actions", () => ({
  saveAssumptionsAction: vi.fn(),
  saveAnalysisAction: vi.fn(),
}));

const { default: ImpactPage } = await import("./page");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const CATERING = "c0000000-0000-4000-8000-000000000001";

const result = {
  change: { kind: "EXPECTED_ATTENDEES", from: 180, to: 220 },
  noChange: false,
  overall: "CRITICAL",
  counts: { CRITICAL: 1, NEEDS_ATTENTION: 1, INFO: 0, PASSED: 0 },
  items: [
    {
      key: "seating-capacity",
      area: "SEATING",
      severity: "CRITICAL",
      title: "20 more people than the venue holds",
      reason: "220 expected attendees against a venue capacity of 200.",
      basis: "ESTIMATE",
      assumptions: [],
      fix: { target: "settings", label: "Review the venue capacity" },
      references: [],
    },
    {
      key: "catering-cost",
      area: "CATERING",
      severity: "NEEDS_ATTENTION",
      title: "Catering may increase by ₱12,000.00",
      reason: "40 more people expected.",
      basis: "ESTIMATE",
      assumptions: [{ label: "Catering cost per head", value: "₱300.00" }],
      fix: null,
      references: [],
    },
  ],
};

const workspace = (over: Record<string, unknown> = {}) => ({
  ok: true,
  event: { id: EVENT, expectedAttendees: 180, capacity: 200 },
  assumptions: {
    cateringCostPerHead: "300.00",
    accessibleSeatsPer100: null,
    cateringCategoryId: CATERING,
    cateringCategoryName: "Catering",
    version: "2026-10-20T01:00:00.000Z",
  },
  categories: [{ id: CATERING, name: "Catering" }],
  canEditAssumptions: true,
  canRecord: true,
  history: [],
  proposal: { status: "none" },
  ...over,
});

const render_ = async (query: Record<string, string> = {}) =>
  render(
    await ImpactPage({
      params: Promise.resolve({ eventId: EVENT }),
      searchParams: Promise.resolve(query),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: EVENT, name: "Santos wedding", role: "OWNER" } },
  });
});

describe("the Impact page", () => {
  it("passes the proposed number from the address to the authorized read", async () => {
    getImpactWorkspace.mockResolvedValue(workspace());
    await render_({ to: "220" });
    expect(requireEventAccess).toHaveBeenCalledWith(EVENT);
    expect(getImpactWorkspace).toHaveBeenCalledWith(EVENT, "220");
  });

  it("shows the form, the current number and no results before a change is tried", async () => {
    getImpactWorkspace.mockResolvedValue(workspace());
    await render_();
    expect(screen.getByRole("heading", { level: 1, name: "Impact" })).toBeVisible();
    expect(screen.getByLabelText(/Proposed expected attendees/)).toHaveValue("");
    expect(screen.getByText(/Now 180\./)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Results" })).toBeNull();
  });

  it("shows the summary, every impact with its reason and assumptions, and Save for managers", async () => {
    getImpactWorkspace.mockResolvedValue(workspace({ proposal: { status: "analyzed", result } }));
    await render_({ to: "220" });
    const status = screen.getAllByRole("status")[0]!;
    expect(status).toHaveTextContent("This change has critical impacts");
    expect(status).toHaveTextContent("180 → 220 (+40)");
    expect(status).toHaveTextContent("nothing about the event has changed");
    const list = screen.getByRole("list", { name: "Identified impacts" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Critical");
    expect(items[0]).toHaveTextContent("20 more people than the venue holds");
    expect(within(items[0]!).getByRole("link", { name: "Review the venue capacity" })).toHaveAttribute(
      "href",
      `/events/${EVENT}/settings`,
    );
    expect(items[1]).toHaveTextContent("Catering cost per head:₱300.00");
    expect(screen.getByRole("button", { name: "Save to history" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save assumptions" })).toBeVisible();
  });

  it("shows Viewers the results and read-only assumptions, with no Save buttons", async () => {
    getImpactWorkspace.mockResolvedValue(
      workspace({
        canEditAssumptions: false,
        canRecord: false,
        proposal: { status: "analyzed", result },
      }),
    );
    await render_({ to: "220" });
    expect(screen.getByRole("list", { name: "Identified impacts" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save to history" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save assumptions" })).toBeNull();
    const assumptions = screen.getByRole("region", { name: "Assumptions" });
    expect(assumptions).toHaveTextContent("Catering cost per head:₱300.00");
    expect(assumptions).toHaveTextContent("Catering budget category:Catering");
    expect(within(assumptions).queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Owners and Coordinators can change these.")).toBeVisible();
    expect(screen.getByText("Owners and Coordinators can save analyses here.")).toBeVisible();
  });

  it("shows an invalid number as a field error and keeps what was typed", async () => {
    getImpactWorkspace.mockResolvedValue(
      workspace({
        proposal: { status: "invalid", raw: "abc", message: "Enter a whole number from 0 to 1,000,000." },
      }),
    );
    await render_({ to: "abc" });
    const field = screen.getByLabelText(/Proposed expected attendees/);
    expect(field).toHaveValue("abc");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a whole number from 0 to 1,000,000.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Results" })).toBeNull();
  });

  it("says there is nothing to analyze for the current number, with no Save button", async () => {
    getImpactWorkspace.mockResolvedValue(
      workspace({
        proposal: {
          status: "analyzed",
          result: {
            ...result,
            change: { kind: "EXPECTED_ATTENDEES", from: 180, to: 180 },
            noChange: true,
            overall: null,
            items: [],
          },
        },
      }),
    );
    await render_({ to: "180" });
    expect(screen.getByText("Nothing to analyze")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save to history" })).toBeNull();
  });

  it("lists saved analyses, labelled as simulations", async () => {
    getImpactWorkspace.mockResolvedValue(
      workspace({
        history: [
          {
            reference: "IMP-0001",
            createdAt: new Date("2026-10-20T02:30:00Z"),
            createdByName: "Mika",
            snapshot: {
              version: 1,
              from: 180,
              to: 220,
              assumptions: {
                cateringCostPerHead: "300.00",
                accessibleSeatsPer100: null,
                cateringCategory: "Catering",
              },
              overall: "CRITICAL",
              counts: result.counts,
              items: result.items,
            },
          },
        ],
      }),
    );
    await render_();
    const saved = screen.getByRole("list", { name: "Saved analyses" });
    expect(saved).toHaveTextContent("IMP-0001");
    expect(saved).toHaveTextContent("Expected attendees 180 → 220");
    expect(saved).toHaveTextContent("Saved Oct 20, 2026, 10:30 AM PHT by Mika");
    expect(saved).toHaveTextContent("Simulation: not a change to the event.");
    expect(saved).toHaveTextContent("Cost per head: ₱300.00");
  });

  it("shows the empty history state", async () => {
    getImpactWorkspace.mockResolvedValue(workspace());
    await render_();
    expect(screen.getByText("No saved analyses yet")).toBeVisible();
  });

  it("shows a safe error when the event's data can't be read", async () => {
    getImpactWorkspace.mockResolvedValue({ ok: false, reason: "unavailable" });
    await render_({ to: "220" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't analyze this event" }),
    ).toBeVisible();
  });

  it("shows notices only for known kinds and well-formed references", async () => {
    getImpactWorkspace.mockResolvedValue(workspace());
    const { unmount } = await render_({ notice: "analysis-saved", ref: "IMP-0003" });
    expect(screen.getByText("Analysis IMP-0003 was saved to the history.")).toBeVisible();
    unmount();
    const second = await render_({ notice: "analysis-saved", ref: "<script>" });
    expect(screen.getByText("The analysis was saved to the history.")).toBeVisible();
    second.unmount();
    await render_({ notice: "something-else" });
    expect(screen.queryByText(/was saved to the history/)).toBeNull();
    expect(screen.queryByText("Assumptions saved.")).toBeNull();
  });
});