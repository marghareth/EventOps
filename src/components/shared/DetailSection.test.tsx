// src/components/shared/DetailSection.test.tsx
// A detail page section (B2-13): a region named by its level-2 heading, with its content.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailSection } from "./DetailSection";

describe("DetailSection", () => {
  it("is a region labelled by its heading", () => {
    render(
      <DetailSection id="attendee-notes" title="Notes">
        <p>Bring a high chair</p>
      </DetailSection>,
    );
    const region = screen.getByRole("region", { name: "Notes" });
    expect(screen.getByRole("heading", { level: 2, name: "Notes" })).toHaveAttribute(
      "id",
      "attendee-notes-heading",
    );
    expect(region).toHaveTextContent("Bring a high chair");
  });
});