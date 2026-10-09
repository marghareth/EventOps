// src/lib/auth-rules.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AUTH_MESSAGES,
  DEFAULT_SIGNED_IN_PATH,
  authErrorMessage,
  decideProxyAction,
  displayNameFor,
  fieldErrorsFrom,
  isExistingAccountError,
  isPublicPath,
  loginPageError,
  loginUrlFor,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "./auth-rules";

describe("safeNextPath", () => {
  it.each([
    ["/events", "/events"],
    ["/events/123?tab=budget#top", "/events/123?tab=budget#top"],
    ["/", "/"],
  ])("keeps the in-app path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash host", "/\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "events"],
    ["a tab inside the path", "/\t/evil.example"],
    ["a newline", "/events\nSet-Cookie: x"],
    ["the login page", "/login"],
    ["the sign-up page", "/sign-up?next=/events"],
    ["the confirm route", "/auth/confirm?code=x"],
    ["an empty string", ""],
    ["a non-string", 42],
    ["null", null],
    ["a very long path", `/${"a".repeat(3000)}`],
  ])("falls back for %s", (_label, input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.example", "/home")).toBe("/home");
  });

  it("keeps an encoded backslash as a same-site path", () => {
    // Browsers do not decode %5C when resolving a redirect, so this stays a path on this site.
    expect(safeNextPath("/%5Cevil.example")).toBe("/%5Cevil.example");
  });
});

describe("loginUrlFor", () => {
  it("adds an encoded next path", () => {
    expect(loginUrlFor("/events/1?tab=a")).toBe("/login?next=%2Fevents%2F1%3Ftab%3Da");
  });

  it("drops an unsafe next path", () => {
    expect(loginUrlFor("https://evil.example")).toBe("/login");
  });

  it("returns the bare login path without a next path", () => {
    expect(loginUrlFor()).toBe("/login");
  });
});

describe("isPublicPath", () => {
  it.each(["/", "/login", "/sign-up", "/auth/confirm", "/auth"])("%s is public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/events", "/events/1", "/login/extra", "/authors", "/sign-up-now"])(
    "%s is protected",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("decideProxyAction", () => {
  it("sends a signed-out visitor of a protected page to login with next", () => {
    expect(decideProxyAction("/events/1", "?tab=budget", false)).toEqual({
      kind: "redirect",
      to: "/login?next=%2Fevents%2F1%3Ftab%3Dbudget",
    });
  });

  it("lets a signed-out visitor open public pages", () => {
    expect(decideProxyAction("/login", "", false)).toEqual({ kind: "continue" });
    expect(decideProxyAction("/", "", false)).toEqual({ kind: "continue" });
  });

  it("never redirects API routes; they answer 401 themselves", () => {
    expect(decideProxyAction("/api/events/1", "", false)).toEqual({ kind: "continue" });
  });

  it("sends a signed-in visitor of login to the safe next path", () => {
    expect(decideProxyAction("/login", "?next=%2Fevents%2F9", true)).toEqual({
      kind: "redirect",
      to: "/events/9",
    });
  });

  it("ignores an unsafe next path for a signed-in visitor", () => {
    expect(decideProxyAction("/sign-up", "?next=https://evil.example", true)).toEqual({
      kind: "redirect",
      to: DEFAULT_SIGNED_IN_PATH,
    });
  });

  it("lets a signed-in user through to protected pages", () => {
    expect(decideProxyAction("/events", "", true)).toEqual({ kind: "continue" });
  });
});

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", AUTH_MESSAGES.invalidCredentials],
    ["user_not_found", AUTH_MESSAGES.invalidCredentials],
    ["email_not_confirmed", AUTH_MESSAGES.emailNotConfirmed],
    ["over_request_rate_limit", AUTH_MESSAGES.rateLimited],
    ["over_email_send_rate_limit", AUTH_MESSAGES.rateLimited],
    ["weak_password", AUTH_MESSAGES.weakPassword],
    ["email_address_invalid", AUTH_MESSAGES.invalidEmail],
    ["signup_disabled", AUTH_MESSAGES.signUpDisabled],
    ["otp_expired", AUTH_MESSAGES.linkInvalid],
  ])("maps %s to a safe message", (code, message) => {
    expect(authErrorMessage({ code, status: 400 })).toBe(message);
  });

  it("treats HTTP 429 as rate limiting", () => {
    expect(authErrorMessage({ code: "something_new", status: 429 })).toBe(
      AUTH_MESSAGES.rateLimited,
    );
  });

  it("treats server and network failures as unavailable", () => {
    expect(authErrorMessage({ status: 503 })).toBe(AUTH_MESSAGES.unavailable);
    expect(authErrorMessage({})).toBe(AUTH_MESSAGES.unavailable);
  });

  it("falls back to a generic message for unknown client errors", () => {
    expect(authErrorMessage({ code: "unknown_code", status: 400 })).toBe(AUTH_MESSAGES.generic);
  });

  it("uses the same message for a wrong email and a wrong password", () => {
    expect(authErrorMessage({ code: "user_not_found", status: 400 })).toBe(
      authErrorMessage({ code: "invalid_credentials", status: 400 }),
    );
  });
});

describe("isExistingAccountError", () => {
  it("recognises an existing account", () => {
    expect(isExistingAccountError({ code: "user_already_exists" })).toBe(true);
    expect(isExistingAccountError({ code: "email_exists" })).toBe(true);
    expect(isExistingAccountError({ code: "weak_password" })).toBe(false);
    expect(isExistingAccountError(null)).toBe(false);
  });
});

describe("loginPageError", () => {
  it("maps known keys and ignores everything else", () => {
    expect(loginPageError("confirm")).toBe(AUTH_MESSAGES.linkInvalid);
    expect(loginPageError("<script>alert(1)</script>")).toBeNull();
    expect(loginPageError("toString")).toBeNull();
    expect(loginPageError(undefined)).toBeNull();
  });
});

describe("signUpSchema", () => {
  const valid = { displayName: "Mika", email: "Mika@Example.com ", password: "12345678" };

  it("accepts valid input and normalises the email", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      displayName: "Mika",
      email: "mika@example.com",
      password: "12345678",
    });
  });

  it.each([
    ["a 7-character password", { password: "1234567" }, "password"],
    ["a 73-character password", { password: "a".repeat(73) }, "password"],
    ["a blank name", { displayName: "   " }, "displayName"],
    ["a 101-character name", { displayName: "a".repeat(101) }, "displayName"],
    ["an invalid email", { email: "not-an-email" }, "email"],
    ["an empty email", { email: "" }, "email"],
  ])("rejects %s", (_label, override, field) => {
    const result = signUpSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrorsFrom(result.error))).toContain(field);
  });

  it("accepts exactly 8 and 72 characters", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(8) }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password, so older short passwords can still sign in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("reports one message per field", () => {
    const result = signInSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFrom(result.error)).toEqual({
        email: "Enter your email address.",
        password: "Enter your password.",
      });
    }
  });
});

describe("displayNameFor", () => {
  it("prefers the sign-up name", () => {
    expect(displayNameFor({ email: "m@x.co", user_metadata: { display_name: "  Mika  " } })).toBe(
      "Mika",
    );
  });

  it("falls back to the email name, then a placeholder", () => {
    expect(displayNameFor({ email: "mika.santos@x.co", user_metadata: {} })).toBe("mika.santos");
    expect(displayNameFor({ email: null, user_metadata: null })).toBe("EventOps user");
  });

  it("caps the length", () => {
    expect(displayNameFor({ user_metadata: { display_name: "a".repeat(150) } })).toHaveLength(100);
  });
});