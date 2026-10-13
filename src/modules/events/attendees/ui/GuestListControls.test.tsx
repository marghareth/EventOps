// src/modules/events/attendees/ui/GuestListControls.test.tsx
// The search, filter and sort form (B2-10, B2-11, B2-12; D-050): a labelled GET search form that
// shows the current choices, keeps the RSVP, and offers only the filters the role may use.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "../guest-list-query";
import { GuestListControls } from "./GuestListControls";

const LIST = "/events/e1/attendees";
const props = {
  listHref: LIST,
  query: DEFAULT_QUERY,
  categories: ["Family", "Friends"],
  dietaryVisible: true,
  contactSearch: true,
};

describe("GuestListControls", () => {
  it("is a GET search form back to the guest list, with every control labelled", () => {
    render(<GuestListControls {...props} />);
    const form = screen.getByRole("search", { name: "Search, filter and sort attendees" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", LIST);
    expect(screen.getByRole("searchbox", { name: "Search attendees" })).toHaveAttribute(
      "name",
      "q",
    );
    for (const label of ["Category", "Dietary needs", "Plus-ones", "Sort by", "Order"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("type", "submit");
  });

  it("explains what search covers for each role", () => {
    const { rerender } = render(<GuestListControls {...props} />);
    expect(screen.getByRole("searchbox")).toHaveAccessibleDescription(
      "Name, ID (like ATT-0008), email or phone.",
    );
    rerender(<GuestListControls {...props} contactSearch={false} />);
    expect(screen.getByRole("searchbox")).toHaveAccessibleDescription(
      "Name or ID (like ATT-0008).",
    );
  });

  it("shows the current choices and keeps the RSVP in a hidden field", () => {
    render(
      <GuestListControls
        {...props}
        query={{
          search: "ana",
          rsvp: "MAYBE",
          category: "Friends",
          dietary: "no",
          plusOnes: "yes",
          sort: "rsvp",
          dir: "desc",
        }}
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("ana");
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("Friends");
    expect(screen.getByRole("combobox", { name: "Dietary needs" })).toHaveValue("no");
    expect(screen.getByRole("combobox", { name: "Plus-ones" })).toHaveValue("yes");
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("rsvp");
    expect(screen.getByRole("combobox", { name: "Order" })).toHaveValue("desc");
    expect(document.querySelector("input[type=hidden][name=rsvp]")).toHaveValue("maybe");
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", LIST);
  });

  it("offers Clear all only when something differs from the default", () => {
    render(<GuestListControls {...props} />);
    expect(screen.queryByRole("link", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("leaves out the dietary filter without attendees.dietary, and Category with no categories", () => {
    render(<GuestListControls {...props} dietaryVisible={false} categories={[]} />);
    expect(screen.queryByRole("combobox", { name: "Dietary needs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
  });

  it("limits the search to 100 characters", () => {
    render(<GuestListControls {...props} />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("maxLength", "100");
  });
});