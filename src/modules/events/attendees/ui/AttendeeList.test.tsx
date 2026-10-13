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

describe("AttendeeList links (B2-07)", () => {
  it("links each name to its details page", () => {
    render(<AttendeeList attendees={attendees} detailsHref={(id) => `/details/${id}`} />);
    expect(screen.getByRole("link", { name: "Ana Reyes" })).toHaveAttribute("href", "/details/a1");
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Guest list, by name. Select a name to see that attendee's details.",
    );
  });

  it("shows plain names without a details link", () => {
    render(<AttendeeList attendees={attendees} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("AttendeeList dietary needs (B2-06, D-047)", () => {
  const withDietary = [
    { ...attendees[0], dietaryNeeds: "Vegetarian; no nuts" },
    { ...attendees[1], dietaryNeeds: null },
  ];

  it("adds a Dietary needs column when the reader may see it", () => {
    render(<AttendeeList attendees={withDietary} showDietaryNeeds />);
    expect(screen.getAllByRole("columnheader").at(-1)).toHaveTextContent("Dietary needs");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent(/Family\s*Vegetarian; no nuts$/);
  });

  it("says 'Not recorded' to screen readers for an empty entry, never 'None'", () => {
    render(<AttendeeList attendees={withDietary} showDietaryNeeds />);
    const cells = within(screen.getAllByRole("row")[2]).getAllByRole("cell");
    expect(within(cells.at(-1)!).getByText("Not recorded")).toHaveClass("sr-only");
    expect(within(cells.at(-1)!).getByText("—")).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves the column out, text included, when the reader may not see it", () => {
    render(<AttendeeList attendees={withDietary} />);
    expect(screen.queryByRole("columnheader", { name: "Dietary needs" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vegetarian/)).not.toBeInTheDocument();
  });
});

describe("AttendeeList sorting (B2-12, D-050)", () => {
  it("marks only the sorted column and says the sort in the caption", () => {
    render(
      <AttendeeList
        attendees={attendees}
        sort={{ column: "plusones", direction: "descending", label: "Plus-ones" }}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(
      headers
        .filter((th) => th.hasAttribute("aria-sort"))
        .map((th) => [th.textContent, th.getAttribute("aria-sort")]),
    ).toEqual([["Plus-ones", "descending"]]);
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Guest list, sorted by Plus-ones, descending",
    );
  });

  it("keeps the plain caption for the default sort", () => {
    render(
      <AttendeeList
        attendees={attendees}
        sort={{ column: "name", direction: "ascending", label: "Name" }}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getByRole("table")).toHaveAccessibleName("Guest list, by name");
  });

  it("shows rows in the order given; it never sorts by itself", () => {
    render(<AttendeeList attendees={[attendees[1], attendees[0]]} />);
    expect(screen.getAllByRole("rowheader").map((th) => th.textContent)).toEqual([
      "Ben Lim",
      "Ana Reyes",
    ]);
  });
});