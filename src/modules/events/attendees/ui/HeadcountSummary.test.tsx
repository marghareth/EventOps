// src/modules/events/attendees/ui/HeadcountSummary.test.tsx
// The guest list headcount summary (B2-05, D-046): numbers written out as text, clearly labelled.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectedHeadcount } from "../headcount";
import { HeadcountSummary } from "./HeadcountSummary";

describe("HeadcountSummary", () => {
  it("shows the expected headcount with how it was made, then not-yet-confirmed and declined", () => {
    const headcount = expectedHeadcount([
      { rsvpStatus: "CONFIRMED", plusOnes: 3 },
      { rsvpStatus: "CONFIRMED", plusOnes: 0 },
      { rsvpStatus: "PENDING", plusOnes: 1 },
      { rsvpStatus: "MAYBE", plusOnes: 0 },
      { rsvpStatus: "DECLINED", plusOnes: 2 },
    ]);
    render(<HeadcountSummary headcount={headcount} />);
    const region = screen.getByRole("region", { name: "Headcount from the guest list" });
    const items = within(region)
      .getAllByRole("term")
      .map((dt) => dt.textContent);
    expect(items).toEqual(["Expected headcount", "Not yet confirmed", "Declined"]);
    expect(region).toHaveTextContent("Expected headcount5");
    expect(region).toHaveTextContent("2 confirmed + 3 plus-ones, from the guest list");
    expect(region).toHaveTextContent("2 attendees, 3 people with plus-ones. Not counted yet.");
    expect(region).toHaveTextContent("Declined1Not counted.");
  });

  it("uses singular words for one", () => {
    render(
      <HeadcountSummary
        headcount={expectedHeadcount([
          { rsvpStatus: "CONFIRMED", plusOnes: 1 },
          { rsvpStatus: "PENDING", plusOnes: 0 },
        ])}
      />,
    );
    expect(screen.getByText("1 confirmed + 1 plus-one, from the guest list")).toBeVisible();
    expect(screen.getByText(/1 attendee, 1 person with/)).toBeVisible();
  });
});