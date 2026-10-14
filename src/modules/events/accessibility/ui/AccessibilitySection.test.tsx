// src/modules/events/accessibility/ui/AccessibilitySection.test.tsx
// The attendee's Accessibility section (B3-04): several needs readable at a glance with their
// priority in words, notes only when loaded (D-058), add and edit only for managers, and the empty
// and error states. Also the notice shown after a change.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RequirementRecord } from "../application/ports";
import { AccessibilityNotice } from "./AccessibilityNotice";
import { AccessibilitySection } from "./AccessibilitySection";

const HREF = "/events/e1/attendees/a1";
const at = new Date("2026-10-13T00:00:00Z");
const needs: RequirementRecord[] = [
  {
    id: "r1",
    attendeeId: "a1",
    type: "ACCESSIBLE_SEATING",
    priority: "REQUIRED",
    note: "Near an exit",
    updatedAt: at,
  },
  {
    id: "r2",
    attendeeId: "a1",
    type: "CAPTIONING",
    priority: "PREFERRED",
    note: null,
    updatedAt: at,
  },
];
// As a Viewer receives them: no note field at all (D-058).
const withoutNotes: RequirementRecord[] = needs.map((r) => ({
  id: r.id,
  attendeeId: r.attendeeId,
  type: r.type,
  priority: r.priority,
  updatedAt: r.updatedAt,
}));

function renderSection(data: Parameters<typeof AccessibilitySection>[0]["data"]) {
  render(<AccessibilitySection attendeeHref={HREF} attendeeName="Maria Santos" data={data} />);
  return screen.getByRole("region", { name: "Accessibility" });
}

describe("AccessibilitySection", () => {
  it("lists every need with its priority in words, and notes for Owners and Coordinators", () => {
    const region = renderSection({
      status: "ok",
      requirements: needs,
      showNotes: true,
      canManage: true,
    });
    expect(within(region).getByText("2 needs recorded.")).toBeVisible();
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[0]).getByRole("heading", { level: 3, name: "Accessible seating" }),
    ).toBeVisible();
    expect(items[0]).toHaveTextContent("Priority: Required");
    expect(items[0]).toHaveTextContent("Note: Near an exit");
    expect(items[1]).toHaveTextContent("Captioning");
    expect(items[1]).toHaveTextContent("Priority: Preferred");
    expect(items[1]).toHaveTextContent("No note.");
  });

  it("gives managers named edit links and an add link", () => {
    const region = renderSection({
      status: "ok",
      requirements: needs,
      showNotes: true,
      canManage: true,
    });
    expect(within(region).getByRole("link", { name: "Edit Accessible seating" })).toHaveAttribute(
      "href",
      `${HREF}/accessibility/r1/edit`,
    );
    expect(within(region).getByRole("link", { name: "Edit Captioning" })).toHaveAttribute(
      "href",
      `${HREF}/accessibility/r2/edit`,
    );
    expect(within(region).getByRole("link", { name: "Add accessibility need" })).toHaveAttribute(
      "href",
      `${HREF}/accessibility/new`,
    );
  });

  it("shows a Viewer the needs and who can see notes, with no notes and no changes", () => {
    const region = renderSection({
      status: "ok",
      requirements: withoutNotes,
      showNotes: false,
      canManage: false,
    });
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(region).not.toHaveTextContent("Near an exit");
    expect(region).not.toHaveTextContent("No note.");
    expect(region).toHaveTextContent(
      "Notes on accessibility needs are visible to Owners and Coordinators.",
    );
    expect(within(region).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when nothing is recorded, offering to add only to managers", () => {
    let region = renderSection({
      status: "ok",
      requirements: [],
      showNotes: true,
      canManage: true,
    });
    expect(region).toHaveTextContent("No accessibility needs recorded for Maria Santos.");
    expect(within(region).getByRole("link", { name: "Add accessibility need" })).toBeVisible();
    document.body.innerHTML = "";
    region = renderSection({ status: "ok", requirements: [], showNotes: false, canManage: false });
    expect(region).toHaveTextContent("No accessibility needs recorded for Maria Santos.");
    expect(within(region).queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers no add link once every type is recorded", () => {
    const types = [
      "MOBILITY_ASSISTANCE",
      "ACCESSIBLE_SEATING",
      "STEP_FREE_ENTRANCE",
      "ACCESSIBLE_RESTROOM",
      "SIGN_LANGUAGE",
      "CAPTIONING",
      "OTHER",
    ] as const;
    const region = renderSection({
      status: "ok",
      requirements: types.map((type, i) => ({ ...needs[0], id: `r${i}`, type })),
      showNotes: true,
      canManage: true,
    });
    expect(within(region).queryByRole("link", { name: "Add accessibility need" })).toBeNull();
  });

  it("explains a failed read in the section, as an alert", () => {
    const region = renderSection({ status: "error" });
    expect(within(region).getByRole("alert")).toHaveTextContent(
      "We couldn't load accessibility needs. Reload the page to try again.",
    );
  });

  it("renders a note as text, never as HTML", () => {
    const region = renderSection({
      status: "ok",
      requirements: [{ ...needs[0], note: "<img src=x onerror=alert(1)>" }],
      showNotes: true,
      canManage: false,
    });
    expect(region.querySelector("img")).toBeNull();
    expect(region).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});

describe("AccessibilityNotice", () => {
  it.each([
    ["added", "Accessibility need added", "Captioning is now on this guest's accessibility needs."],
    ["saved", "Changes saved", "Captioning is up to date."],
    [
      "removed",
      "Accessibility need removed",
      "Captioning is no longer on this guest's accessibility needs.",
    ],
  ] as const)(
    "confirms %s with the canonical label, and can be dismissed",
    async (kind, title, text) => {
      render(<AccessibilityNotice kind={kind} type="CAPTIONING" />);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(title);
      expect(status).toHaveTextContent(text);
      await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    },
  );
});