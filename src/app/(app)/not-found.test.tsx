// src/app/(app)/not-found.test.tsx
// Not-found inside the app shell (B1-13): one <main> (the shell's), a way back to My events, and
// the shell stops offering the unavailable event's sections.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/events/3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a/budget";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { default: AppNotFound } = await import("./not-found");
const { EventContextProvider } = await import("@/components/layout/EventContext");
const { Sidebar } = await import("@/components/layout/Sidebar");

describe("in-shell not-found page", () => {
  it("adds no <main> of its own and links back to My events", () => {
    const { container } = render(<AppNotFound />);
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my events" })).toHaveAttribute(
      "href",
      "/events",
    );
  });

  it("makes the sidebar drop the unavailable event's sections", () => {
    pathname = "/events/3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a/budget";
    render(
      <EventContextProvider>
        <Sidebar />
        <main>
          <AppNotFound />
        </main>
      </EventContextProvider>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Budget/ })).not.toBeInTheDocument();
  });
});