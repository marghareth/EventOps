// src/modules/events/budget/ui/BudgetList.test.tsx
// The budget list (B5-F07 to B5-F09): event totals, remaining, status and the over-budget warning
// come from the domain summary; people who cannot manage the budget see no write controls.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CategoryWithItems } from "../application/ports";

vi.mock("../actions", () => ({
  deleteCategoryAction: vi.fn(async () => ({ status: "idle" })),
  deleteItemAction: vi.fn(async () => ({ status: "idle" })),
}));

const { BudgetList } = await import("./BudgetList");

const updatedAt = new Date("2026-10-16T00:00:00Z");
const category = (
  id: string,
  name: string,
  allocation: string,
  committed: string,
): CategoryWithItems => ({
  id,
  name,
  allocation,
  updatedAt,
  items: [
    {
      id: `${id}-item`,
      number: 1,
      categoryId: id,
      name: "Deposit",
      estimated: "999.00",
      committed,
      paid: "10.00",
      notes: null,
      updatedAt,
    },
  ],
});

const render_ = (categories: CategoryWithItems[], canManage = true) =>
  render(
    <BudgetList
      eventId="e1"
      categories={categories}
      basePath="/events/e1/budget"
      canManage={canManage}
    />,
  );

describe("BudgetList", () => {
  it("shows the event totals and the remaining amount with a Within budget status", () => {
    render_([category("c1", "Venue", "1000.00", "400.00")]);
    const totals = screen.getByRole("region", { name: "Event totals" });
    expect(within(totals).getByText("Remaining")).toBeVisible();
    expect(within(totals).getByText("₱600.00")).toBeVisible();
    expect(within(totals).getByText("Within budget")).toBeVisible();
    expect(screen.queryByText(/Over budget/)).toBeNull();
  });

  it("shows Over by, the Over budget status and the warning with its reason", () => {
    render_([category("c1", "Catering", "100.00", "150.00")]);
    const totals = screen.getByRole("region", { name: "Event totals" });
    expect(within(totals).getByText("Over by")).toBeVisible();
    expect(within(totals).getByText("Over budget")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Catering is over budget: ₱150.00 is committed and its allocation is ₱100.00, ₱50.00 more.",
    );
    // A negative remaining is never shown.
    expect(screen.queryByText(/-₱|₱-/)).toBeNull();
  });

  it("does not warn because estimated is above the allocation", () => {
    render_([category("c1", "Venue", "100.00", "0.00")]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows no write controls to someone who cannot manage the budget", () => {
    render_([category("c1", "Venue", "1000.00", "400.00")], false);
    expect(screen.queryByText("Add item")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("lists a category's items as a named list, not a table that scrolls sideways (B5-F16)", () => {
    const { container } = render_([category("c1", "Venue", "1000.00", "400.00")]);
    const list = screen.getByRole("list", { name: "Budget items in Venue" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("BUD-0001")).toBeVisible();
    expect(within(item).getByText("Deposit")).toBeVisible();
    expect(within(item).getByText("₱999.00")).toBeInTheDocument();
    expect(within(item).getByText("₱400.00")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelector(".overflow-x-auto")).toBeNull();
  });

  it("names every amount of an item, so the columns need no table headers (B5-F16)", () => {
    render_([category("c1", "Venue", "1000.00", "400.00")]);
    const item = within(screen.getByRole("list", { name: "Budget items in Venue" })).getByRole(
      "listitem",
    );
    for (const label of ["Estimated", "Committed", "Paid"]) {
      expect(within(item).getByText(label)).toBeInTheDocument();
    }
  });

  it("shows the category total after its items (B5-F16)", () => {
    render_([category("c1", "Venue", "1000.00", "400.00")]);
    expect(screen.getByText("Category total")).toBeVisible();
  });

  it("says so when the event has categories but no items yet (B5-F15)", () => {
    const empty: CategoryWithItems = { ...category("c1", "Venue", "1000.00", "0.00"), items: [] };
    render_([empty]);
    const totals = screen.getByRole("region", { name: "Event totals" });
    expect(
      within(totals).getByText(/No budget items yet, so every total is ₱0\.00\./),
    ).toBeVisible();
    expect(within(totals).getByText(/Use “Add item”/)).toBeVisible();
    expect(screen.getByText(/No items in this category yet\./)).toBeVisible();
  });

  it("does not point a Viewer at controls they do not have (B5-F15)", () => {
    const empty: CategoryWithItems = { ...category("c1", "Venue", "1000.00", "0.00"), items: [] };
    render_([empty], false);
    expect(screen.getByText(/No budget items yet/)).toBeVisible();
    expect(screen.queryByText(/Use “Add item”/)).toBeNull();
  });

  it("does not show the empty note once an item exists", () => {
    render_([category("c1", "Venue", "1000.00", "400.00")]);
    expect(screen.queryByText(/No budget items yet/)).toBeNull();
  });
});