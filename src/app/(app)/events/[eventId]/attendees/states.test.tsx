// src/app/(app)/events/[eventId]/attendees/states.test.tsx
// Guest list loading and error screens (B2-09, D-040): they name what is loading or failed, never
// show internal error details, and Try again fetches fresh server data before re-rendering.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: Loading } = await import("./loading");
const { default: AttendeesError } = await import("./error");

describe("attendees loading screen", () => {
  it("announces what is loading, politely", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading attendees…");
  });
});

describe("attendees error screen", () => {
  it("says what failed as the page heading, without the error's own text", () => {
    render(
      <AttendeesError
        error={new Error('relation "attendees" does not exist at 10.0.0.5:5432')}
        reset={vi.fn()}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load attendees" }),
    ).toBeVisible();
    expect(alert).toHaveTextContent("Something went wrong on our side. Try again in a moment.");
    expect(alert).not.toHaveTextContent(/relation|10\.0\.0\.5|5432/);
  });

  it("shows the safe digest as a reference", () => {
    render(
      <AttendeesError
        error={Object.assign(new Error("x"), { digest: "123456" })}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByText("Reference: 123456")).toBeVisible();
  });

  it("Try again refreshes server data and resets the screen", async () => {
    const reset = vi.fn();
    render(<AttendeesError error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});