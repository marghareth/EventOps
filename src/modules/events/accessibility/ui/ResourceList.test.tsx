// src/modules/events/accessibility/ui/ResourceList.test.tsx
// The event's resources (B3-05): all six types with their status in words (and "Not set up"), the
// seat count, notes as text, and set-up or edit links only for managers.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ResourceRecord } from "../application/ports";
import { RESOURCE_TYPES, type ResourceType } from "../domain/resource";
import { ResourceList } from "./ResourceList";
import { ResourceNotice } from "./ResourceNotice";

const at = new Date("2026-10-13T00:00:00Z");
const record = (type: ResourceType, extra: Partial<ResourceRecord>): ResourceRecord => ({
  id: type,
  type,
  status: "AVAILABLE",
  quantity: null,
  note: null,
  updatedAt: at,
  ...extra,
});
const resources = RESOURCE_TYPES.map((type) => ({
  type,
  resource:
    type === "ACCESSIBLE_SEATS"
      ? record(type, { quantity: 8, note: "Front left" })
      : type === "CAPTIONING"
        ? record(type, { status: "ARRANGING" })
        : type === "SIGN_LANGUAGE"
          ? record(type, { status: "NOT_AVAILABLE" })
          : null,
}));

const renderList = (canManage: boolean) =>
  render(
    <ResourceList
      basePath="/events/e1/accessibility"
      resources={resources}
      canManage={canManage}
    />,
  );

describe("ResourceList", () => {
  it("shows every type with its status in words, the seat count and the note", () => {
    renderList(false);
    // B3-06: headed as what the event provides, apart from guests' needs.
    expect(screen.getByRole("region", { name: "What the event provides" })).toBeVisible();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent("Accessible seats");
    expect(items[0]).toHaveTextContent("Status: Available");
    expect(items[0]).toHaveTextContent("8 seats");
    expect(items[0]).toHaveTextContent("Note: Front left");
    expect(items[1]).toHaveTextContent("Status: Not set up");
    expect(items[4]).toHaveTextContent("Status: Being arranged");
    expect(items[5]).toHaveTextContent("Status: Not available");
    expect(screen.getByText(/3 of 6 set up\./)).toBeVisible();
  });

  it("gives managers Edit for set-up types and Set up for the others", () => {
    renderList(true);
    expect(screen.getByRole("link", { name: "Edit Accessible seats" })).toHaveAttribute(
      "href",
      "/events/e1/accessibility/accessible-seats/edit",
    );
    expect(screen.getByRole("link", { name: "Set up Ramp or elevator" })).toHaveAttribute(
      "href",
      "/events/e1/accessibility/ramp-or-elevator/edit",
    );
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });

  it("offers a Viewer no changes, and says who can make them", () => {
    renderList(false);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Owners and Coordinators can change resources.")).toBeVisible();
  });

  it("says when nothing is set up yet", () => {
    render(
      <ResourceList
        basePath="/events/e1/accessibility"
        resources={RESOURCE_TYPES.map((type) => ({ type, resource: null }))}
        canManage
      />,
    );
    expect(screen.getByText(/None of the six resources is set up yet\./)).toBeVisible();
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("Not set up", { exact: false }),
    ).toBeVisible();
  });
});

describe("ResourceNotice", () => {
  it.each([
    ["saved", "Resource saved", "Captioning is up to date."],
    ["removed", "Resource removed", "Captioning is not set up any more."],
  ] as const)("confirms %s and can be dismissed", async (kind, title, text) => {
    render(<ResourceNotice kind={kind} type="CAPTIONING" />);
    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.getByRole("status")).toHaveTextContent(text);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });
});