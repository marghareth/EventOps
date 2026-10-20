// src/app/(app)/events/[eventId]/states.test.tsx
// The event-level loading and error screens (B1-15, D-040; B10-F04, F06, D-115): they name what is
// loading or failed, never show internal error details, and Try again fetches fresh server data.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: EventLoading } = await import("./loading");
const { default: EventPageError } = await import("./error");

describe("the event loading screen", () => {
  it("announces what is loading, politely", () => {
    render(<EventLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading event");
  });
});

describe("the event error screen", () => {
  it("says what failed as the page heading, without the error's own text", () => {
    render(
      <EventPageError error={new Error("connect ECONNREFUSED 10.0.0.5:5432")} reset={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load this page" }),
    ).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("open another section from the menu");
    expect(alert).not.toHaveTextContent(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it("Try again refreshes server data and resets the screen", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    render(
      <EventPageError error={Object.assign(new Error("x"), { digest: "42" })} reset={reset} />,
    );
    expect(screen.getByText("Reference: 42")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});