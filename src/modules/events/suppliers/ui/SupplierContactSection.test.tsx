// src/modules/events/suppliers/ui/SupplierContactSection.test.tsx
// A supplier's contacts on its detail page (B4-07, D-073): phone and email as links, notes kept as
// typed, and plain wording for anything not recorded.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupplierContactSection } from "./SupplierContactSection";

describe("SupplierContactSection", () => {
  it("shows the contact person, phone and email as links, and the notes", () => {
    render(
      <SupplierContactSection
        supplier={{
          contactName: "Liza Tan",
          phone: "+63 917 555 0101",
          email: "liza@gardenkitchen.ph",
          notes: "Tasting on Nov 3\nBring the menu",
        }}
      />,
    );
    const section = screen.getByRole("region", { name: "Contact" });
    expect(section).toHaveTextContent("Contact personLiza Tan");
    expect(within(section).getByRole("link", { name: "+63 917 555 0101" })).toHaveAttribute(
      "href",
      "tel:+639175550101",
    );
    expect(within(section).getByRole("link", { name: "liza@gardenkitchen.ph" })).toHaveAttribute(
      "href",
      "mailto:liza@gardenkitchen.ph",
    );
    expect(within(section).getByText(/Tasting on Nov 3/)).toHaveTextContent(
      "Tasting on Nov 3 Bring the menu",
    );
  });

  it("says what isn't recorded, with no empty links", () => {
    render(
      <SupplierContactSection
        supplier={{ contactName: null, phone: null, email: null, notes: null }}
      />,
    );
    const section = screen.getByRole("region", { name: "Contact" });
    expect(within(section).getAllByText("Not recorded")).toHaveLength(3);
    expect(within(section).getByText("None")).toBeVisible();
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
  });
});