// src/app/(app)/layout.test.tsx
// The (app) layout is the server-side guard for every protected page, independent of the proxy.
// Runs the real requireUser() with a mocked Supabase session.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("../(auth)/actions", () => ({ signOutAction: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { default: AppLayout } = await import("./layout");

beforeEach(() => getUser.mockReset());

describe("(app) layout", () => {
  it("redirects a signed-out visitor to sign in, even if the proxy was bypassed", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(AppLayout({ children: <p>secret page</p> })).rejects.toMatchObject({
      url: "/login",
    });
  });

  it("renders the page, the signed-in email and a sign-out button for a signed-in user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "mika@example.com" } },
      error: null,
    });
    render(await AppLayout({ children: <p>secret page</p> }));
    expect(screen.getByText("secret page")).toBeInTheDocument();
    expect(screen.getByText("mika@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});