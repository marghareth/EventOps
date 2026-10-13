// src/modules/events/attendees/ui/AttendeeList.test.tsx
// The guest list table (B2-02): readable IDs, names as row headers, RSVP written as text.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttendeeList } from "./AttendeeList";

const attendees = [
  {
    id: "a1",
    number: 1,
    name: "Ana Reyes",
    rsvpStatus: "CONFIRMED",
    plusOnes: 1,
    category: "Family",
  },
  { id: "a2", number: 12, name: "Ben Lim", rsvpStatus: "MAYBE", plusOnes: 0, category: null },
] as const;

describe("AttendeeList", () => {
  it("is a captioned table in a keyboard-scrollable region", () => {
    render(<AttendeeList attendees={attendees} />);
    expect(screen.getByRole("table", { name: "Guest list, by name" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Guest list, by name" });
    expect(region).toHaveAttribute("tabIndex", "0");
    // Positioned, so hidden screen-reader text can't widen the page (found in the B2-02 check).
    expect(region).toHaveClass("relative", "overflow-x-auto");
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "ID",
      "Name",
      "RSVP",
      "Plus-ones",
      "Category",
    ]);
  });

  it("shows each attendee with ID, name as the row header, RSVP text, plus-ones and category", () => {
    render(<AttendeeList attendees={attendees} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("rowheader")).toHaveTextContent("Ana Reyes");
    expect(rows[0]).toHaveTextContent(/ATT-0001.*Ana Reyes.*Confirmed.*1.*Family/);
    expect(rows[1]).toHaveTextContent(/ATT-0012.*Ben Lim.*Maybe.*0/);
    expect(within(rows[1]).getByText("None")).toHaveClass("sr-only");
  });
});

describe("AttendeeList links (B2-03)", () => {
  it("links each name to its edit page when editing is allowed", () => {
    render(<AttendeeList attendees={attendees} editHref={(id) => `/edit/${id}`} />);
    expect(screen.getByRole("link", { name: "Ana Reyes" })).toHaveAttribute("href", "/edit/a1");
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Guest list, by name. Select a name to edit that attendee.",
    );
  });

  it("shows plain names without editing", () => {
    render(<AttendeeList attendees={attendees} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});