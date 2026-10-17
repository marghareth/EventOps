// src/app/(app)/events/[eventId]/budget/states.test.tsx
// Budget loading and error screens (B5-F15, D-040): they name what is loading or failed, never
// show internal error details, and Try again fetches fresh server data before re-rendering.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: BudgetLoading } = await import("./loading");
const { default: BudgetError } = await import("./error");

describe("the budget loading screen", () => {
  it("announces what is loading, politely", () => {
    render(<BudgetLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the budget…");
  });
});

describe("the budget error screen", () => {
  it("says what failed as the page heading, without the error's own text", () => {
    render(
      <BudgetError
        error={new Error('relation "budget_items" does not exist at 10.0.0.5:5432')}
        reset={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load the budget" }),
    ).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong on our side.");
    expect(alert).not.toHaveTextContent(/relation|budget_items|10\.0\.0\.5|5432/);
  });

  it("shows the safe digest as a reference", () => {
    render(
      <BudgetError error={Object.assign(new Error("x"), { digest: "123456" })} reset={vi.fn()} />,
    );
    expect(screen.getByText("Reference: 123456")).toBeVisible();
  });

  it("Try again refreshes server data and resets the screen", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    render(<BudgetError error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});