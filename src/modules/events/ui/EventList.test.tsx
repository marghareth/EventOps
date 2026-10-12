// src/modules/events/ui/EventList.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventListItem } from "../list";
import { EventList } from "./EventList";

const base: EventListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "EVT-2026-0001",
  name: "Santos wedding",
  venue: "Shangri-La Mactan, Cebu",
  startsAt: new Date("2026-12-12T08:00:00Z"),
  endsAt: new Date("2026-12-12T14:00:00Z"),
  status: "PLANNING",
  expectedAttendees: 180,
  role: "COORDINATOR",
};

describe("EventList", () => {
  it("shows identifying details and links each event to its workspace", () => {
    render(<EventList groups={{ upcoming: [base], past: [] }} />);
    const link = screen.getByRole("link", { name: "Santos wedding" });
    expect(link).toHaveAttribute("href", `/events/${base.id}`);
    const card = link.closest("article")!;
    for (const text of [
      "EVT-2026-0001",
      "Sat, Dec 12, 2026 · 4:00 PM – 10:00 PM PHT",
      "Shangri-La Mactan, Cebu",
      "180 expected attendees",
      "Planning",
      "Coordinator",
    ]) {
      expect(within(card).getByText(text)).toBeInTheDocument();
    }
  });

  it("labels the upcoming and past sections with counts and hides an empty one", () => {
    const past = { ...base, id: "p1", name: "Old event", status: "COMPLETED" as const };
    const { rerender } = render(<EventList groups={{ upcoming: [base], past: [past] }} />);
    expect(screen.getByRole("heading", { name: "Upcoming (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Past (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Past (1)" })).toHaveTextContent("Completed");

    rerender(<EventList groups={{ upcoming: [base], past: [] }} />);
    expect(screen.queryByRole("heading", { name: /Past/ })).not.toBeInTheDocument();
  });

  it("omits a missing venue and writes status as text", () => {
    render(
      <EventList
        groups={{ upcoming: [{ ...base, venue: null, status: "CANCELLED" }], past: [] }}
      />,
    );
    expect(screen.queryByText("Venue")).not.toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});