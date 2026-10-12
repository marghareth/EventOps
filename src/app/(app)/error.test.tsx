// src/app/(app)/error.test.tsx
// In-shell error screen (B1-15, D-040): safe message, retry, a way back, never the raw error.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { default: AppError } = await import("./error");

describe("(app) error screen", () => {
  const error = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"), {
    digest: "4117094623",
  });

  it("shows a safe heading, an alert, the reference and a way back", () => {
    render(<AppError error={error} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load this page" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Reference: 4117094623")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my events" })).toHaveAttribute(
      "href",
      "/events",
    );
  });

  it("never shows the error message", () => {
    render(<AppError error={error} reset={() => {}} />);
    expect(document.body).not.toHaveTextContent(/ECONNREFUSED|hunter2|5432/);
  });

  it("tries again with fresh server data, not just a re-render", async () => {
    const reset = vi.fn();
    render(<AppError error={error} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it("adds no second main landmark (it renders inside the shell's main)", () => {
    render(<AppError error={error} reset={() => {}} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});