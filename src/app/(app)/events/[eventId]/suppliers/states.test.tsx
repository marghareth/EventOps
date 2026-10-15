// src/app/(app)/events/[eventId]/suppliers/states.test.tsx
// Supplier loading and error screens (B4-23, D-040), for the list and for one supplier's pages:
// they name what is loading or failed, never show internal error details, and Try again fetches
// fresh server data before re-rendering.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: ListLoading } = await import("./loading");
const { default: ListError } = await import("./error");
const { default: SupplierLoading } = await import("./[supplierId]/loading");
const { default: SupplierError } = await import("./[supplierId]/error");

describe.each([
  ["the supplier list", ListLoading, ListError, "Loading suppliers…", "Couldn't load suppliers"],
  [
    "a supplier's pages",
    SupplierLoading,
    SupplierError,
    "Loading the supplier…",
    "Couldn't load this supplier",
  ],
] as const)("%s", (_, Loading, ErrorScreen, loadingText, errorTitle) => {
  it("announces what is loading, politely", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent(loadingText);
  });

  it("says what failed as the page heading, without the error's own text", () => {
    render(
      <ErrorScreen
        error={new Error('relation "supplier_payments" does not exist at 10.0.0.5:5432')}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: errorTitle })).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong on our side. Try again in a moment.");
    expect(alert).not.toHaveTextContent(/relation|supplier_payments|10\.0\.0\.5|5432/);
  });

  it("shows the safe digest as a reference", () => {
    render(
      <ErrorScreen error={Object.assign(new Error("x"), { digest: "123456" })} reset={vi.fn()} />,
    );
    expect(screen.getByText("Reference: 123456")).toBeVisible();
  });

  it("Try again refreshes server data and resets the screen", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    render(<ErrorScreen error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});