// src/app/(app)/events/[eventId]/access-coverage.test.tsx
// Every page under /events/<id> checks membership itself (D-027, B1-07), not only the event layout.
// This walks every page file, so a new page that forgets the check fails here.
/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

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

type Page = (props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string>>;
}) => Promise<unknown>;

const pages = import.meta.glob<{ default: Page }>("./**/page.tsx");
const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

describe("event pages check membership themselves", () => {
  it("finds the overview, settings and every section page", () => {
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(14);
  });

  it.each(Object.keys(pages).sort())("%s refuses a non-member", async (path) => {
    requireEventAccess.mockReset();
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    const { default: Page } = await pages[path]();
    await expect(
      Page({ params: Promise.resolve({ eventId: ID }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ notFound: true });
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
  });
});

// A loading screen is a Suspense boundary: placed above the event layout, it lets the page start
// streaming with status 200 before the access check runs, so a refused event would no longer get a
// real 404 (D-027, D-040). Loading screens belong in (list) or inside [eventId] only.
describe("no loading screen above the event layout", () => {
  const loadings = Object.keys(
    import.meta.glob([
      "/src/app/**/loading.tsx",
      "/src/app/**/loading.ts",
      "/src/app/**/loading.jsx",
    ]),
  );

  it("finds the loading screens that do exist", () => {
    expect(loadings).toContain("/src/app/(app)/events/[eventId]/loading.tsx");
  });

  it.each(loadings.sort())("%s sits below the event layout or in the list group", (path) => {
    expect(
      path.startsWith("/src/app/(app)/events/[eventId]/") ||
        path.startsWith("/src/app/(app)/events/(list)/"),
    ).toBe(true);
  });
});