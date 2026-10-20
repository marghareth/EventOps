// src/app/(app)/events/[eventId]/impact/states.test.tsx
// Impact loading and error screens (B7-F17, D-040): they name what is loading or failed,
// never show internal error details, and Try again fetches fresh server data before re-rendering.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: ImpactLoading } = await import("./loading");
const { default: ImpactError } = await import("./error");

describe("the impact loading screen", () => {
  it("announces what is loading, politely", () => {
    render(<ImpactLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the impact analysis…");
  });
});

describe("the impact error screen", () => {
  it("says what failed as the page heading, without the error's own text", () => {
    render(
      <ImpactError
        error={new Error('relation "impact_analyses" does not exist at 10.0.0.5:5432')}
        reset={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load the impact analysis" }),
    ).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong on our side.");
    expect(alert).not.toHaveTextContent(/relation|10\.0\.0\.5|5432/);
  });

  it("shows the safe digest as a reference", () => {
    render(
      <ImpactError error={Object.assign(new Error("x"), { digest: "123456" })} reset={vi.fn()} />,
    );
    expect(screen.getByText("Reference: 123456")).toBeVisible();
  });

  it("Try again refreshes server data and resets the screen", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    render(<ImpactError error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});