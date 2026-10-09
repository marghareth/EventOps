// src/app/(auth)/actions.test.ts
// @vitest-environment node
// Server actions with a mocked Supabase client, user sync and Next.js navigation.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth-rules";
import { initialAuthFormState } from "./form-state";

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};
const syncUserRecord = vi.fn();
let origin: string | null = "https://eventops.example";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("@/lib/auth", () => ({ syncUserRecord: (...args: unknown[]) => syncUserRecord(...args) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(origin ? { origin } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { signInAction, signOutAction, signUpAction } = await import("./actions");

const user = { id: "u1", email: "mika@example.com", user_metadata: {} };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs an action and returns either its state or the URL it redirected to. */
async function run<T>(action: Promise<T>): Promise<{ state?: T; redirect?: string }> {
  try {
    return { state: await action };
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  origin = "https://eventops.example";
  auth.signOut.mockResolvedValue({ error: null });
  syncUserRecord.mockResolvedValue(undefined);
});

describe("signInAction", () => {
  it("returns field errors and does not call Supabase for invalid input", async () => {
    const result = await run(signInAction(initialAuthFormState, form({ email: "", password: "" })));
    expect(result.state).toMatchObject({
      status: "error",
      fieldErrors: { email: "Enter your email address.", password: "Enter your password." },
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows one safe message for wrong credentials and keeps the email, not the password", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" },
    });
    const result = await run(
      signInAction(initialAuthFormState, form({ email: "mika@example.com", password: "wrong" })),
    );
    expect(result.state).toEqual({
      status: "error",
      message: AUTH_MESSAGES.invalidCredentials,
      values: { email: "mika@example.com" },
    });
  });

  it("signs in, syncs the users row and redirects to the safe next path", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user, session: {} }, error: null });
    const result = await run(
      signInAction(
        initialAuthFormState,
        form({ email: " Mika@Example.com ", password: "secret", next: "/events/7" }),
      ),
    );
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "mika@example.com",
      password: "secret",
    });
    expect(syncUserRecord).toHaveBeenCalledWith(user);
    expect(result.redirect).toBe("/events/7");
  });

  it("ignores an off-site next path", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user, session: {} }, error: null });
    const result = await run(
      signInAction(
        initialAuthFormState,
        form({ email: "mika@example.com", password: "secret", next: "https://evil.example" }),
      ),
    );
    expect(result.redirect).toBe("/events");
  });

  it("signs back out and reports an error when the users row cannot be saved", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user, session: {} }, error: null });
    syncUserRecord.mockRejectedValue(new Error("db down"));
    const result = await run(
      signInAction(initialAuthFormState, form({ email: "mika@example.com", password: "secret" })),
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result.state).toMatchObject({ status: "error", message: AUTH_MESSAGES.unavailable });
  });
});

describe("signUpAction", () => {
  const valid = { displayName: "Mika", email: "mika@example.com", password: "12345678" };

  it("rejects a short password before calling Supabase", async () => {
    const result = await run(
      signUpAction(initialAuthFormState, form({ ...valid, password: "1234567" })),
    );
    expect(result.state).toMatchObject({
      status: "error",
      fieldErrors: { password: "Use at least 8 characters." },
      values: { email: "mika@example.com", displayName: "Mika" },
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("asks the user to check their email when confirmation is required", async () => {
    auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    const result = await run(
      signUpAction(initialAuthFormState, form({ ...valid, next: "/events/3" })),
    );
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "mika@example.com",
      password: "12345678",
      options: {
        emailRedirectTo: "https://eventops.example/auth/confirm?next=%2Fevents%2F3",
        data: { display_name: "Mika" },
      },
    });
    expect(result.state).toMatchObject({ status: "check-email" });
    expect(syncUserRecord).not.toHaveBeenCalled();
  });

  it("gives the same answer for an existing account, so emails cannot be probed", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists", status: 422 },
    });
    const result = await run(signUpAction(initialAuthFormState, form(valid)));
    expect(result.state).toMatchObject({ status: "check-email" });
  });

  it("shows a safe message for other Supabase errors", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    const result = await run(signUpAction(initialAuthFormState, form(valid)));
    expect(result.state).toMatchObject({ status: "error", message: AUTH_MESSAGES.rateLimited });
  });

  it("signs in straight away when confirmation is off", async () => {
    auth.signUp.mockResolvedValue({ data: { user, session: {} }, error: null });
    const result = await run(signUpAction(initialAuthFormState, form(valid)));
    expect(syncUserRecord).toHaveBeenCalledWith(user);
    expect(result.redirect).toBe("/events");
  });

  it("lets Supabase use its Site URL when the request has no Origin header", async () => {
    origin = null;
    auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    await run(signUpAction(initialAuthFormState, form(valid)));
    expect(auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBeUndefined();
  });
});

describe("signOutAction", () => {
  it("ends this browser's session and goes to login", async () => {
    const result = await run(signOutAction());
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result.redirect).toBe("/login");
  });
});