<!-- docs/SECURITY.md -->

# Security design

How EventOps protects its data. To report a vulnerability, see the root [SECURITY.md](../SECURITY.md).
Decisions referenced as D-0xx are in [DECISIONS.md](DECISIONS.md).

Sections are added as each area is built. Event authorization (membership and roles) is not built
yet.

## Authentication (B0-09)

### How it works

| Piece                      | File                                             | Role                                                                                                                                                         |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase Auth              | Supabase project                                 | Stores accounts and passwords, sends confirmation emails, issues session tokens.                                                                             |
| Session cookies            | `@supabase/ssr`                                  | The session lives in HTTP cookies set by the server. No tokens in `localStorage`.                                                                            |
| Proxy                      | `src/proxy.ts`, `src/lib/supabase/middleware.ts` | Refreshes the session cookie on each request. Sends signed-out visitors of protected pages to `/login?next=...`. **Convenience only, not a security check.** |
| Server checks              | `src/lib/auth.ts`                                | `requireUser()` / `getCurrentUser()` verify the user with Supabase on every call (`getUser()`, D-013).                                                       |
| Protected pages            | `src/app/(app)/layout.tsx`                       | Calls `requireUser()` for every page under `(app)`.                                                                                                          |
| Sign-up, sign-in, sign-out | `src/app/(auth)/actions.ts`                      | Server actions. Inputs validated with Zod on the server.                                                                                                     |
| Email confirmation         | `src/app/auth/confirm/route.ts`                  | Verifies the email link, signs the user in, creates their `users` row (D-016).                                                                               |
| Rules                      | `src/lib/auth-rules.ts`                          | Pure, tested rules: validation, public routes, safe redirects, error messages.                                                                               |

### Rules for every new page, action and route

- **Pages** under `src/app/(app)/` are protected by the layout. A page outside `(app)` that shows
  private data must call `requireUser()` itself.
- **Server actions** must call `requireUser()` at the top, even when only called from protected
  pages. Server actions are public HTTP endpoints.
- **Route handlers** (`src/app/api/...`) must call `getCurrentUser()` and return 401 when it is
  null. The proxy deliberately does not redirect API routes.
- **Event pages:** `events/[eventId]/layout.tsx` only checks that the ID is a UUID. That is not an
  access check (D-018); event data must not be loaded there until the membership check exists.
- **Placeholder API routes** answer 401 when signed out and 501 when signed in (D-019).
- **Event data** additionally needs the membership and role check (later task). Signing in only
  proves who the user is, not what they may see.

### Protections in place

| Threat                                | Protection                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Proxy bypass                          | Every page, action and route verifies the user itself; the proxy only redirects. Tested in `src/app/(app)/layout.test.tsx`.                |
| Revoked or deleted accounts           | `getUser()` asks Supabase on every server check, so a signed-out, banned or deleted user is rejected immediately (D-013).                  |
| Supabase outage shown as "signed out" | `getCurrentUser()` throws `AuthUnavailableError` on network or 5xx errors, so the user sees an error page instead of a login loop.         |
| Open redirect via `?next=`            | `safeNextPath()` accepts only same-site paths; absolute, protocol-relative, backslash and control-character tricks fall back to `/events`. |
| Account enumeration                   | Wrong email and wrong password show the same message. Sign-up shows "check your email" for new and existing addresses alike.               |
| Raw error leakage                     | Supabase errors map to fixed messages (`authErrorMessage`). The login page shows only whitelisted `?error=` keys.                          |
| Cross-site request forgery            | Next.js checks the `Origin` header on every server action. Sign-out is a POST server action, never a GET link.                             |
| Session cookies cached by a CDN       | Responses that set auth cookies carry `Cache-Control: no-store` headers from `@supabase/ssr`, including redirects (`redirectWithSession`). |
| Brute force                           | Supabase Auth rate limits sign-in and sign-up per IP; the app shows a "too many attempts" message.                                         |
| Weak passwords                        | At least 8 characters (D-015), checked in the app and in Supabase.                                                                         |
| Unverified email addresses            | Email confirmation is required (D-014).                                                                                                    |

### Required Supabase dashboard settings

The code assumes these. Set them in the Supabase project before deploying.

1. **Authentication → Sign In / Providers → Email:** Email provider on, **Confirm email on**
   (D-014).
2. **Authentication → Sign In / Providers → Email → Minimum password length: 8** (D-015).
3. **Authentication → URL Configuration:**
   - Site URL: the production URL, for example `https://eventops.vercel.app`.
   - Redirect URLs: `http://localhost:3000/**`, the production URL with `/**`, and the Vercel
     preview pattern if previews should work.
4. **Authentication → Emails → Confirm signup:** point the link at the confirm route so it works on
   any device:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/events`.
   (The default template also works, but only in the browser that signed up.)
5. **Authentication → Emails → SMTP:** Supabase's built-in sender allows only a few emails per hour.
   Set up custom SMTP before the demo.

### Manual check against the real Supabase project

CI cannot sign in for real without Supabase credentials, so run this after deploying or changing
auth code. Record the date and result in the pull request.

1. Signed out, open `/events`. You land on `/login?next=%2Fevents`.
2. Sign up with a new address and an 8-character password. You see "Check your email".
3. Sign up again with the same address. You see the same "Check your email" message.
4. Open the confirmation link. You land on `/events`, signed in, and the header shows your email.
   In Supabase (Table Editor → `users`) a row exists with your name.
5. Sign out. You land on `/login`. Opening `/events` again sends you back to `/login`.
6. Sign in with a wrong password. You see "Email or password is incorrect."
7. Sign in correctly from `/login?next=%2Fevents%3Ftab%3Dbudget`. You land on `/events?tab=budget`.
8. Open `/login?next=https://example.com` and sign in. You land on `/events`, not example.com.
9. Open an old or edited confirmation link. You land on `/login` with "That link is invalid or has
   expired."

### Dev-only demo sign-in (D-024)

`DEV_DEMO_AUTH=true` lets `npm run dev` show signed-in pages without a Supabase project, as a fixed
demo user. It is an authentication bypass, so it is fenced in three ways:

1. It works only when `NODE_ENV` is `development`, which only `next dev` sets. `next start`,
   Vercel and the test runner ignore the flag.
2. `next build` fails if the flag is set (`next.config.ts`), so it cannot be deployed by mistake.
3. A "Demo sign-in is on" banner shows on every page while it is active.

Never set `DEV_DEMO_AUTH` in Vercel or any shared environment. Tests in `src/lib/demo-auth.test.ts`
cover every flag and environment combination and the build guard.

### Not built yet

Password reset, changing email or password, social sign-in, multi-factor authentication and account
deletion.

## Event isolation

- **Event list (B1-03, D-026).** `listEventsForUser` in `src/modules/events/queries.ts` is the
  only query that lists events. It filters by the session user's membership and returns an
  allow-list of fields. `GET /api/events` and the My events page both use it. Tests:
  `queries.db.test.ts` (real database) and `src/app/api/events/route.test.ts`.
- **Not built yet:** membership and role checks for a single event. The event workspace pages
  under `/events/<id>` are placeholders that read only the ID from the URL (D-018) and load no
  event data. The task that first loads an event's data must add the check.