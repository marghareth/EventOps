// src/components/layout/navigation.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eventIdFromPath, isCurrent, navigationFor } from "./navigation";

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

describe("eventIdFromPath", () => {
  it.each([
    [`/events/${ID}`, ID],
    [`/events/${ID}/attendees`, ID],
    [`/events/${ID}/budget/items/7`, ID],
  ])("reads the event ID from %s", (path, expected) => {
    expect(eventIdFromPath(path)).toBe(expected);
  });

  it.each(["/events", "/events/", "/events/new", "/", "/login", "/eventsx/1"])(
    "returns null outside an event: %s",
    (path) => {
      expect(eventIdFromPath(path)).toBeNull();
    },
  );

  it("returns null for a malformed percent-encoding instead of throwing", () => {
    expect(eventIdFromPath("/events/%E0%A4%A")).toBeNull();
  });
});

describe("navigationFor", () => {
  it("shows the global links outside an event", () => {
    const nav = navigationFor("/events");
    expect(nav.kind).toBe("global");
    expect(nav.items.map((item) => item.label)).toEqual(["My events", "New event"]);
  });

  it("shows the eleven Tier 1 sections inside an event, in order", () => {
    const nav = navigationFor(`/events/${ID}/budget`);
    expect(nav.kind).toBe("event");
    expect(nav.items.map((item) => item.label)).toEqual([
      "Overview",
      "Health",
      "Attendees",
      "Accessibility",
      "Suppliers",
      "Budget",
      "Tasks",
      "Impact",
      "Import",
      "Activity",
      "Settings",
    ]);
    expect(nav.items[0].href).toBe(`/events/${ID}`);
    expect(nav.items[1].href).toBe(`/events/${ID}/health`);
    expect(nav.items[2].href).toBe(`/events/${ID}/attendees`);
  });

  it("never links Tier 2 sections", () => {
    const hrefs = navigationFor(`/events/${ID}`).items.map((item) => item.href);
    for (const tier2 of ["check-in", "event-day", "volunteers", "timeline"]) {
      expect(hrefs.some((href) => href.endsWith(`/${tier2}`))).toBe(false);
    }
  });

  it("encodes the event ID in links", () => {
    const nav = navigationFor("/events/a%2Fb");
    expect(nav.items[0].href).toBe("/events/a%2Fb");
  });
});

describe("isCurrent", () => {
  const nav = navigationFor(`/events/${ID}`);
  const overview = nav.items[0];
  const attendees = nav.items.find((item) => item.label === "Attendees")!;

  it("marks Overview only on the exact event path", () => {
    expect(isCurrent(overview, `/events/${ID}`)).toBe(true);
    expect(isCurrent(overview, `/events/${ID}/`)).toBe(true);
    expect(isCurrent(overview, `/events/${ID}/attendees`)).toBe(false);
  });

  it("marks a section on its own path and the pages below it", () => {
    expect(isCurrent(attendees, `/events/${ID}/attendees`)).toBe(true);
    expect(isCurrent(attendees, `/events/${ID}/attendees/ATT-0184`)).toBe(true);
    expect(isCurrent(attendees, `/events/${ID}/attendees-old`)).toBe(false);
  });

  it("keeps My events and New event apart", () => {
    const [myEvents, newEvent] = navigationFor("/events").items;
    expect(isCurrent(myEvents, "/events")).toBe(true);
    expect(isCurrent(myEvents, "/events/new")).toBe(false);
    expect(isCurrent(newEvent, "/events/new")).toBe(true);
  });
});