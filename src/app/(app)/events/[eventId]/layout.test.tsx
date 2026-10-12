// src/app/(app)/events/[eventId]/layout.test.tsx
// @vitest-environment node
// Event context placeholder: rejects malformed IDs and loads no event data (D-018).
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

const { default: EventLayout } = await import("./layout");

describe("events/[eventId] layout", () => {
  it("renders the section for a valid event ID", async () => {
    const element = await EventLayout({
      children: "section",
      params: Promise.resolve({ eventId: "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a" }),
    });
    expect(element.props.children).toBe("section");
  });

  it.each(["new-thing", "1", "' OR 1=1 --", "3f2c1b8e-9a4d-4c1e-8b2a"])(
    "shows not found for a malformed ID: %s",
    async (eventId) => {
      await expect(
        EventLayout({ children: "section", params: Promise.resolve({ eventId }) }),
      ).rejects.toMatchObject({ notFound: true });
    },
  );
});