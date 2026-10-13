// src/modules/events/attendees/ui/AttendeeDetailsView.test.tsx
// Attendee details (B2-07, D-048): only the fields the server loaded are shown, notes keep their
// line breaks and are shown as text, never as HTML, and empty values are said, not guessed.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttendeeDetailsView } from "./AttendeeDetailsView";

const base = {
  id: "a1",
  number: 8,
  name: "Hector Ramos",
  rsvpStatus: "CONFIRMED",
  plusOnes: 3,
  category: "Family",
} as const;
const everything = { dietaryNeeds: true, private: true };
const viewer = { dietaryNeeds: true, private: false };

const term = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

describe("AttendeeDetailsView", () => {
  it("shows every field to a role that may see them, with notes in their own section", () => {
    render(
      <AttendeeDetailsView
        fields={everything}
        attendee={{
          ...base,
          dietaryNeeds: "No pork",
          email: "hector@example.com",
          phone: "0917 123 4567",
          notes: "Bringing his three kids.\nNeeds two high chairs.",
        }}
      />,
    );
    expect(term("Plus-ones")).toHaveTextContent("3");
    expect(term("Category")).toHaveTextContent("Family");
    expect(term("Dietary needs")).toHaveTextContent("No pork");
    expect(term("Email")).toHaveTextContent("hector@example.com");
    expect(term("Phone")).toHaveTextContent("0917 123 4567");
    const notes = screen.getByRole("region", { name: "Notes" });
    const text = notes.querySelector("p")!;
    expect(text.textContent).toBe("Bringing his three kids.\nNeeds two high chairs.");
    expect(text).toHaveClass("whitespace-pre-wrap");
  });

  it("shows notes that look like HTML as plain text", () => {
    render(
      <AttendeeDetailsView
        fields={everything}
        attendee={{ ...base, notes: '<img src=x onerror="alert(1)"><b>VIP</b>' }}
      />,
    );
    const notes = screen.getByRole("region", { name: "Notes" });
    expect(notes).toHaveTextContent('<img src=x onerror="alert(1)"><b>VIP</b>');
    expect(notes.querySelector("img, b")).toBeNull();
  });

  it("says when there are no notes and when a field was not recorded", () => {
    render(
      <AttendeeDetailsView
        fields={everything}
        attendee={{
          ...base,
          category: null,
          dietaryNeeds: null,
          email: null,
          phone: null,
          notes: null,
        }}
      />,
    );
    expect(screen.getByRole("region", { name: "Notes" })).toHaveTextContent("No notes.");
    expect(term("Email")).toHaveTextContent("Not recorded");
    expect(term("Dietary needs")).toHaveTextContent("Not recorded");
  });

  it("shows a Viewer no contact details or notes, and says who can see them", () => {
    render(<AttendeeDetailsView fields={viewer} attendee={{ ...base, dietaryNeeds: "No pork" }} />);
    expect(screen.queryByRole("region", { name: "Notes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(term("Dietary needs")).toHaveTextContent("No pork");
    expect(
      screen.getByText("Contact details and notes are visible to Owners and Coordinators."),
    ).toBeVisible();
  });

  it("leaves dietary needs out when the reader may not see them", () => {
    render(
      <AttendeeDetailsView fields={{ dietaryNeeds: false, private: false }} attendee={base} />,
    );
    expect(screen.queryByText("Dietary needs")).not.toBeInTheDocument();
  });
});