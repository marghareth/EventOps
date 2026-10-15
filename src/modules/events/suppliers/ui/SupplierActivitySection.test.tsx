// src/modules/events/suppliers/ui/SupplierActivitySection.test.tsx
// A supplier's recent Activity (B4-07, D-074): entries worded by the audit context, newest first as
// given, with who and when; a meaningful empty state; a link to the event's full Activity.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupplierActivitySection } from "./SupplierActivitySection";

const at = new Date("2026-10-14T04:00:00Z");

describe("SupplierActivitySection", () => {
  it("lists the supplier's entries with who and when", () => {
    render(
      <SupplierActivitySection
        activityHref="/events/e1/activity"
        limit={10}
        entries={[
          {
            id: "a2",
            createdAt: at,
            actorName: null,
            action: "supplier.updated",
            details: { reference: "SUP-0001", changes: { phone: { changed: true } } },
          },
          {
            id: "a1",
            createdAt: at,
            actorName: "Mika",
            action: "supplier.created",
            details: {
              reference: "SUP-0001",
              name: "Garden Kitchen",
              category: "CATERING",
              categoryDetail: null,
            },
          },
        ]}
      />,
    );
    const section = screen.getByRole("region", { name: "Recent activity" });
    const [edit, add] = Array.from(section.querySelectorAll("ol > li"));
    expect(edit).toHaveTextContent("Former member");
    expect(edit).toHaveTextContent("Edited the supplier SUP-0001");
    expect(edit).toHaveTextContent("Phone changed");
    expect(add).toHaveTextContent("Mika");
    expect(add).toHaveTextContent("Added the supplier Garden Kitchen (SUP-0001): Catering");
    expect(section).toHaveTextContent("Showing up to the latest 10.");
    expect(within(section).getByRole("link", { name: "See all event activity" })).toHaveAttribute(
      "href",
      "/events/e1/activity",
    );
  });

  it("says when nothing has been recorded", () => {
    render(<SupplierActivitySection activityHref="/events/e1/activity" limit={10} entries={[]} />);
    expect(screen.getByText("No changes recorded for this supplier yet.")).toBeVisible();
  });
});