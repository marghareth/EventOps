// src/app/(app)/events/[eventId]/accessibility/pages.test.tsx
// The event's Accessibility page and the resource form page (B3-05): access checked by each page,
// the list for every member, forms only for managers (a Viewer's request loads nothing), not found
// for an unknown resource segment, notices read only from known values, and the error state.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventResources = vi.fn();
const getResourceForEditing = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));
vi.mock("@/modules/events/accessibility/queries", () => ({
  getAttendeeAccessibility: vi.fn(),
  getNewRequirementContext: vi.fn(),
  getRequirementForEditing: vi.fn(),
  getEventResources: (...args: unknown[]) => getEventResources(...args),
  getResourceForEditing: (...args: unknown[]) => getResourceForEditing(...args),
}));
vi.mock("@/modules/events/accessibility/actions", () => ({
  createRequirementAction: vi.fn(),
  updateRequirementAction: vi.fn(),
  deleteRequirementAction: vi.fn(),
  saveResourceAction: { bind: () => () => undefined },
  deleteResourceAction: { bind: () => () => undefined },
}));

const { default: AccessibilityPage } = await import("./page");
const { default: EditResourcePage } = await import("./[resource]/edit/page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const TYPES = [
  "ACCESSIBLE_SEATS",
  "ACCESSIBLE_ENTRANCE",
  "RAMP_OR_ELEVATOR",
  "ACCESSIBLE_RESTROOM",
  "CAPTIONING",
  "SIGN_LANGUAGE",
] as const;
const seats = {
  id: "r1",
  type: "ACCESSIBLE_SEATS",
  status: "ARRANGING",
  quantity: 6,
  note: "By the stage",
  updatedAt: new Date("2026-10-13T04:00:00.000Z"),
};
const access = (role: "OWNER" | "COORDINATOR" | "VIEWER") =>
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: ID, name: "Santos wedding", role } },
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Accessibility page", () => {
  const renderPage = async (search: Record<string, string> = {}) =>
    render(
      await AccessibilityPage({
        params: Promise.resolve({ eventId: ID }),
        searchParams: Promise.resolve(search),
      }),
    );

  it.each([
    ["OWNER", true],
    ["VIEWER", false],
  ] as const)("lists the six resources for a %s; changes offered: %s", async (role, canManage) => {
    access(role);
    getEventResources.mockResolvedValue({
      ok: true,
      resources: TYPES.map((type) => ({
        type,
        resource: type === "ACCESSIBLE_SEATS" ? seats : null,
      })),
      canManage,
    });
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getEventResources).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("heading", { level: 1, name: "Accessibility" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryAllByRole("link", { name: /^(Edit|Set up) / })).toHaveLength(
      canManage ? 6 : 0,
    );
  });

  it("confirms a change by the resource's canonical label, ignoring forged values", async () => {
    access("OWNER");
    getEventResources.mockResolvedValue({
      ok: true,
      resources: TYPES.map((type) => ({ type, resource: null })),
      canManage: true,
    });
    await renderPage({ resource: "saved", type: "ACCESSIBLE_SEATS" });
    expect(screen.getByText("Accessible seats is up to date.")).toBeVisible();
    document.body.innerHTML = "";
    await renderPage({ resource: "saved", type: "<b>x</b>" });
    expect(screen.queryByText(/Resource saved/)).not.toBeInTheDocument();
  });

  it("shows an error state when the read fails", async () => {
    access("OWNER");
    getEventResources.mockRejectedValue(new Error("database down"));
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "We couldn't load the accessibility resources" }),
    ).toBeVisible();
  });

  it("is not found for a non-member", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderPage()).rejects.toMatchObject({ notFound: true });
    expect(getEventResources).not.toHaveBeenCalled();
  });
});

describe("Resource form page", () => {
  const renderPage = async (resource = "accessible-seats") =>
    render(await EditResourcePage({ params: Promise.resolve({ eventId: ID, resource }) }));

  it("offers a type that is Not set up for setting up", async () => {
    access("COORDINATOR");
    getResourceForEditing.mockResolvedValue({ ok: true, type: "RAMP_OR_ELEVATOR", resource: null });
    await renderPage("ramp-or-elevator");
    expect(getResourceForEditing).toHaveBeenCalledWith(ID, "ramp-or-elevator");
    expect(
      screen.getByRole("heading", { level: 1, name: "Set up Ramp or elevator" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Set up" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Remove this resource" })).not.toBeInTheDocument();
  });

  it("edits a set-up resource with its stored values, version and Remove", async () => {
    access("OWNER");
    getResourceForEditing.mockResolvedValue({
      ok: true,
      type: "ACCESSIBLE_SEATS",
      resource: seats,
    });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Edit Accessible seats" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Being arranged" })).toBeChecked();
    expect(screen.getByLabelText(/^Number of accessible seats/)).toHaveValue(6);
    expect(document.querySelector("input[name=version]")).toHaveValue("2026-10-13T04:00:00.000Z");
    expect(screen.getByRole("region", { name: "Remove this resource" })).toBeInTheDocument();
  });

  it("refuses a Viewer without loading anything", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getResourceForEditing).not.toHaveBeenCalled();
  });

  it("is not found for a resource that isn't one of the six", async () => {
    access("OWNER");
    getResourceForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage("shuttle-bus")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});