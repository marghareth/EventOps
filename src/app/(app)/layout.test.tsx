// src/app/(app)/layout.test.tsx
// The (app) layout is the server-side guard for every protected page, independent of the proxy,
// and renders the application shell (B0-10). Runs the real requireUser() with a mocked session.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({ user: { findUnique } }) }));
vi.mock("../(auth)/actions", () => ({ signOutAction: async () => {} }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/events",
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { default: AppLayout } = await import("./layout");

const signedIn = { data: { user: { id: "u1", email: "mika@example.com" } }, error: null };

beforeEach(() => {
  getUser.mockReset();
  findUnique.mockReset();
});

describe("(app) layout", () => {
  it("redirects a signed-out visitor to sign in, even if the proxy was bypassed", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(AppLayout({ children: <p>secret page</p> })).rejects.toMatchObject({
      url: "/login",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("renders the page inside the main landmark that the skip link targets", async () => {
    getUser.mockResolvedValue(signedIn);
    findUnique.mockResolvedValue({ displayName: "Mika Santos" });
    render(await AppLayout({ children: <p>secret page</p> }));

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(within(main).getByText("secret page")).toBeInTheDocument();
  });

  it("shows the navigation, header and the user's menu with their stored name", async () => {
    getUser.mockResolvedValue(signedIn);
    findUnique.mockResolvedValue({ displayName: "Mika Santos" });
    render(await AppLayout({ children: <p>page</p> }));

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Account: Mika Santos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { displayName: true },
    });
  });

  it("keeps the brand link inside a landmark, the labelled sidebar (B1-15)", async () => {
    getUser.mockResolvedValue(signedIn);
    findUnique.mockResolvedValue({ displayName: "Mika Santos" });
    render(await AppLayout({ children: <p>page</p> }));
    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
    expect(within(sidebar).getByRole("link", { name: "EventOps" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(within(sidebar).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("falls back to the email name when the users row is missing", async () => {
    getUser.mockResolvedValue(signedIn);
    findUnique.mockResolvedValue(null);
    render(await AppLayout({ children: <p>page</p> }));
    expect(screen.getByRole("button", { name: "Account: mika" })).toBeInTheDocument();
  });

  it("shows no demo banner normally", async () => {
    getUser.mockResolvedValue(signedIn);
    findUnique.mockResolvedValue({ displayName: "Mika Santos" });
    render(await AppLayout({ children: <p>page</p> }));
    expect(screen.queryByText("Demo sign-in is on")).not.toBeInTheDocument();
  });

  it("in demo mode shows the demo user and a warning banner, with no Supabase or database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_DEMO_AUTH", "true");
    try {
      render(await AppLayout({ children: <p>page</p> }));
      expect(screen.getByText("Demo sign-in is on")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Account: Demo Coordinator" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open a sample event" })).toHaveAttribute(
        "href",
        "/events/00000000-0000-4000-8000-0000000000e1/attendees",
      );
      expect(getUser).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});