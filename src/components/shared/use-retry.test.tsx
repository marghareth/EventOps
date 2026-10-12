// src/components/shared/use-retry.test.tsx
// Try again on error screens refetches from the server, then clears the error (B1-15, D-040).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => calls.push("refresh") }) }));

const { useRetry } = await import("./use-retry");

function Retry({ reset }: { reset: () => void }) {
  const retry = useRetry(reset);
  return <button onClick={retry}>Try again</button>;
}

describe("useRetry", () => {
  it("refreshes server data and then resets the error boundary", async () => {
    calls.length = 0;
    render(<Retry reset={() => calls.push("reset")} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(calls).toEqual(["refresh", "reset"]);
  });
});