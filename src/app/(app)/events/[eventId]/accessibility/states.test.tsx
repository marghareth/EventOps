// src/app/(app)/events/[eventId]/accessibility/states.test.tsx
// Accessibility loading and error screens (B3-06, D-040): they name what is loading or failed,
// never show internal error details, and Try again fetches fresh server data.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: Loading } = await import("./loading");
const { default: AccessibilityError } = await import("./error");

describe("accessibility loading screen", () => {
  it("announces what is loading, politely", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading accessibility…");
  });
});

describe("accessibility error screen", () => {
  it("says what failed without the error's own text, and retries with fresh data", async () => {
    const reset = vi.fn();
    render(
      <AccessibilityError
        error={Object.assign(new Error("relation accessibility_resources at 10.0.0.5"), {
          digest: "abc123",
        })}
        reset={reset}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load accessibility" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).not.toHaveTextContent(/relation|10\.0\.0\.5/);
    expect(screen.getByText(/abc123/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refresh).toHaveBeenCalled();
  });
});