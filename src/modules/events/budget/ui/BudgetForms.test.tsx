// src/modules/events/budget/ui/BudgetForms.test.tsx
// The budget forms after a failed save (B5-F15, D-092): every problem is listed at once in a summary
// that takes focus, each line jumps to its field, the typed values stay, and a failed request says
// that nothing was saved.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryFormState, ItemFormState } from "../form-state";

const createCategoryAction = vi.fn<(...args: unknown[]) => Promise<CategoryFormState>>();
const createItemAction = vi.fn<(...args: unknown[]) => Promise<ItemFormState>>();
vi.mock("../actions", () => ({
  createCategoryAction: (...args: unknown[]) => createCategoryAction(...args),
  updateCategoryAction: vi.fn(),
  createItemAction: (...args: unknown[]) => createItemAction(...args),
  updateItemAction: vi.fn(),
}));

const { CategoryForm } = await import("./CategoryForm");
const { ItemForm } = await import("./ItemForm");

beforeEach(() => {
  createCategoryAction.mockReset();
  createItemAction.mockReset();
});

describe("CategoryForm", () => {
  it("lists every problem at once, focuses the summary and keeps what was typed", async () => {
    createCategoryAction.mockResolvedValue({
      status: "error",
      fieldErrors: { name: "Enter a category name.", allocation: "Enter an amount in pesos." },
      values: { name: "", allocation: "" },
    });
    render(<CategoryForm eventId="e1" cancelHref="/events/e1/budget" />);
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Enter a category name.");
    expect(summary).toHaveTextContent("Enter an amount in pesos.");
    expect(screen.getByLabelText("Category name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Allocation (₱)")).toHaveAttribute("aria-invalid", "true");
  });

  it("jumps from a summary line to its field", async () => {
    createCategoryAction.mockResolvedValue({
      status: "error",
      fieldErrors: { allocation: "Enter an amount in pesos." },
      values: { name: "Venue", allocation: "" },
    });
    render(<CategoryForm eventId="e1" cancelHref="/events/e1/budget" />);
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    await userEvent.click(await screen.findByRole("link", { name: "Enter an amount in pesos." }));
    expect(screen.getByLabelText("Allocation (₱)")).toHaveFocus();
    expect(screen.getByLabelText("Category name")).toHaveValue("Venue");
  });

  it("says nothing was saved when the request fails, with no field errors", async () => {
    createCategoryAction.mockResolvedValue({
      status: "error",
      message: "We couldn't save your changes. Nothing was saved. Try again in a moment.",
      values: { name: "Venue", allocation: "1000" },
    });
    render(<CategoryForm eventId="e1" cancelHref="/events/e1/budget" />);
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was saved");
    expect(screen.queryByRole("group", { name: "Fix these to continue" })).toBeNull();
    expect(screen.getByLabelText("Category name")).toHaveValue("Venue");
  });
});

describe("ItemForm", () => {
  const categories = [{ id: "c1", name: "Venue" }];

  it("lists every problem in the order of the fields", async () => {
    createItemAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        paid: "Amounts have at most two decimals.",
        categoryId: "Choose a category.",
        name: "Enter an item name.",
        estimated: "Enter an amount in pesos.",
      },
      values: { categoryId: "", name: "", estimated: "", committed: "", paid: "1.234", notes: "" },
    });
    render(<ItemForm eventId="e1" cancelHref="/events/e1/budget" categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveFocus();
    const lines = Array.from(summary.querySelectorAll("li")).map((li) => li.textContent);
    expect(lines).toEqual([
      "Choose a category.",
      "Enter an item name.",
      "Enter an amount in pesos.",
      "Amounts have at most two decimals.",
    ]);
    expect(screen.getByLabelText("Paid (₱)")).toHaveValue("1.234");
  });

  it("shows no summary before anything was submitted", () => {
    render(<ItemForm eventId="e1" cancelHref="/events/e1/budget" categories={categories} />);
    expect(screen.queryByRole("group", { name: "Fix these to continue" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/events/e1/budget",
    );
  });
});