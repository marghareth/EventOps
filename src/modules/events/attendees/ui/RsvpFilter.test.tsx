// src/modules/events/attendees/ui/RsvpFilter.test.tsx
// RSVP filter links (B2-08, D-049): every state with its count, addresses that keep the choice,
// and the current choice marked for screen readers.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RsvpFilter } from "./RsvpFilter";

const counts = { PENDING: 2, CONFIRMED: 4, DECLINED: 1, MAYBE: 1 };
const BASE = "/events/e1/attendees";

describe("RsvpFilter", () => {
  it("is a labelled navigation with All and each state, with counts in text", () => {
    render(<RsvpFilter baseHref={BASE} current={null} counts={counts} total={8} />);
    const nav = screen.getByRole("navigation", { name: "Filter by RSVP" });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      [
        ["All (8)", BASE],
        ["Confirmed (4)", `${BASE}?rsvp=confirmed`],
        ["Pending (2)", `${BASE}?rsvp=pending`],
        ["Maybe (1)", `${BASE}?rsvp=maybe`],
        ["Declined (1)", `${BASE}?rsvp=declined`],
      ],
    );
  });

  it("marks All as current without a filter", () => {
    render(<RsvpFilter baseHref={BASE} current={null} counts={counts} total={8} />);
    expect(screen.getByRole("link", { name: "All (8)" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Confirmed (4)" })).not.toHaveAttribute("aria-current");
  });

  it("marks the chosen state as current, and only that one", () => {
    render(<RsvpFilter baseHref={BASE} current="DECLINED" counts={counts} total={8} />);
    const current = screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"));
    expect(current.map((a) => a.textContent)).toEqual(["Declined (1)"]);
  });

  it("uses 44px-high links that wrap rather than scroll", () => {
    render(<RsvpFilter baseHref={BASE} current={null} counts={counts} total={8} />);
    expect(screen.getByRole("link", { name: "All (8)" })).toHaveClass("min-h-11");
    expect(screen.getByRole("list")).toHaveClass("flex-wrap");
  });
});