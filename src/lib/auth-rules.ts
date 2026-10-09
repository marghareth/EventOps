// src/lib/auth-rules.ts
// Pure authentication rules shared by the proxy, server actions, routes and tests. No framework,
// network or database code here, so every rule is unit-testable.
import { z } from "zod";

/** Where a signed-in user lands when no safe `next` path is given. */
export const DEFAULT_SIGNED_IN_PATH = "/events";
export const LOGIN_PATH = "/login";
export const SIGN_UP_PATH = "/sign-up";

// Decision D-015: minimum 8 characters. Supabase rejects passwords longer than 72 characters.
export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const DISPLAY_NAME_MAX_LENGTH = 100;

// ───────────────────────────── Input validation ─────────────────────────────

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "Email address is too long.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email,
  // Any non-empty password: the length rule applies when the password is created, not at sign-in.
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(PASSWORD_MAX_LENGTH, "Password is too long."),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(DISPLAY_NAME_MAX_LENGTH, `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`),
});

/** First error message per field, for showing next to each form control. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in result)) result[field] = issue.message;
  }
  return result;
}

/** Email-link types the confirm route accepts. Others (recovery, invite, ...) are out of scope. */
export const confirmTypeSchema = z.enum(["signup", "email"]);

// ───────────────────────────── Routes and redirects ─────────────────────────────

/** Pages anyone can open without signing in. Everything else requires a session. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === LOGIN_PATH ||
    pathname === SIGN_UP_PATH ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

/** Sign-in and sign-up pages, which a signed-in user does not need. */
function isAuthPagePath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === SIGN_UP_PATH;
}

/** API routes answer 401 themselves; the proxy never redirects them to a page. */
function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

const PLACEHOLDER_ORIGIN = "http://eventops.invalid";

/**
 * Returns `value` only if it is a path inside this app, otherwise the default. Blocks open
 * redirects such as "https://evil.example", "//evil.example", "/\\evil.example" and
 * "javascript:...", and never sends the user back to the sign-in pages.
 */
export function safeNextPath(value: unknown, fallback: string = DEFAULT_SIGNED_IN_PATH): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters and backslashes can be read as a different host by some browsers.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (isAuthPagePath(url.pathname) || url.pathname.startsWith("/auth/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Login URL that returns the user to `nextPath` afterwards. */
export function loginUrlFor(nextPath?: string): string {
  if (!nextPath) return LOGIN_PATH;
  const safe = safeNextPath(nextPath, "");
  return safe ? `${LOGIN_PATH}?next=${encodeURIComponent(safe)}` : LOGIN_PATH;
}

export type ProxyDecision = { kind: "continue" } | { kind: "redirect"; to: string };

/**
 * What the proxy does with a request. This is a convenience redirect only: pages, server actions
 * and route handlers still check the user themselves (requireUser / getCurrentUser).
 */
export function decideProxyAction(
  pathname: string,
  search: string,
  hasSession: boolean,
): ProxyDecision {
  if (isApiPath(pathname)) return { kind: "continue" };
  if (!hasSession && !isPublicPath(pathname)) {
    return { kind: "redirect", to: loginUrlFor(`${pathname}${search}`) };
  }
  if (hasSession && isAuthPagePath(pathname)) {
    const next = new URLSearchParams(search).get("next");
    return { kind: "redirect", to: safeNextPath(next) };
  }
  return { kind: "continue" };
}

// ───────────────────────────── Error messages ─────────────────────────────

/** Minimal shape of a Supabase AuthError; avoids importing the SDK into pure code. */
export type AuthErrorLike = { code?: string | null; status?: number | null };

export const AUTH_MESSAGES = {
  invalidCredentials: "Email or password is incorrect.",
  emailNotConfirmed: "Confirm your email first. Check your inbox for the link we sent.",
  rateLimited: "Too many attempts. Wait a few minutes, then try again.",
  weakPassword: "Choose a stronger password.",
  invalidEmail: "Enter a valid email address.",
  signUpDisabled: "New accounts can't be created right now.",
  linkInvalid: "That link is invalid or has expired. Sign in, or sign up again to get a new link.",
  unavailable: "We couldn't reach the sign-in service. Try again in a moment.",
  generic: "Something went wrong. Try again.",
} as const;

/**
 * Turns a Supabase auth error into a safe message. Never returns the raw error text, and never
 * reveals whether an account exists (wrong email and wrong password read the same).
 */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  switch (error?.code) {
    case "invalid_credentials":
    case "user_not_found":
      return AUTH_MESSAGES.invalidCredentials;
    case "email_not_confirmed":
      return AUTH_MESSAGES.emailNotConfirmed;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return AUTH_MESSAGES.rateLimited;
    case "weak_password":
      return AUTH_MESSAGES.weakPassword;
    case "email_address_invalid":
    case "validation_failed":
      return AUTH_MESSAGES.invalidEmail;
    case "signup_disabled":
    case "email_provider_disabled":
      return AUTH_MESSAGES.signUpDisabled;
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return AUTH_MESSAGES.linkInvalid;
  }
  if (error?.status === 429) return AUTH_MESSAGES.rateLimited;
  if (error && (error.status === undefined || error.status === null || error.status >= 500)) {
    return AUTH_MESSAGES.unavailable;
  }
  return AUTH_MESSAGES.generic;
}

/**
 * Sign-up errors that must look like success, so the form never reveals that an email is
 * already registered. With email confirmation on, Supabase already behaves this way.
 */
export function isExistingAccountError(error: AuthErrorLike | null | undefined): boolean {
  return error?.code === "user_already_exists" || error?.code === "email_exists";
}

/** Error keys the login page accepts in `?error=`; anything else is ignored. */
const LOGIN_PAGE_ERRORS = {
  confirm: AUTH_MESSAGES.linkInvalid,
  unavailable: AUTH_MESSAGES.unavailable,
} as const;

export function loginPageError(key: unknown): string | null {
  return typeof key === "string" && Object.hasOwn(LOGIN_PAGE_ERRORS, key)
    ? LOGIN_PAGE_ERRORS[key as keyof typeof LOGIN_PAGE_ERRORS]
    : null;
}

// ───────────────────────────── User record ─────────────────────────────

/** Name stored on the users row: the sign-up name, else the part of the email before "@". */
export function displayNameFor(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const fromMetadata = user.user_metadata?.display_name;
  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  }
  const local = (user.email ?? "").split("@")[0]?.trim();
  return (local || "EventOps user").slice(0, DISPLAY_NAME_MAX_LENGTH);
}