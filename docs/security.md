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

Without `DATABASE_URL`, demo sign-in also uses in-memory sample events (D-041). The sample store
keeps the same rules as the database code (members only, role re-checks, audited changes) and the
banner says the data is sample data. It is fenced by the same three rules.

Never set `DEV_DEMO_AUTH` in Vercel or any shared environment. Tests in `src/lib/demo-auth.test.ts`
cover every flag and environment combination and the build guard.

### Not built yet

Password reset, changing email or password, social sign-in, multi-factor authentication and account
deletion.

## How to authorize an event operation (B1-09, D-036)

This is the pattern for every event operation in every batch. Use the helpers in
`src/modules/events/authorize.ts` (exported from `@/modules/events/public`); never write the checks
by hand.

**Server action** (a form submit or button):

```ts
export async function saveTaskAction(eventId: string, _prev: State, formData: FormData) {
  const auth = await authorizeEvent(eventId, "tasks.manage", `/events/${eventId}/tasks`);
  if (!auth.ok) return { status: "error", message: MESSAGES[auth.reason] };
  // Only now read and validate the input. Use auth.user.id and auth.event.id from here on,
  // never a user, role or event ID taken from the form.
}
```

**Route handler** (`src/app/api/...`):

```ts
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeEventRequest((await params).eventId, "attendees.export");
  if (!auth.ok) return auth.response; // 401, 403, 404, 500 or 503, never cached
  return Response.json(data, { headers: auth.headers });
}
```

**Page** under `/events/<id>`: `const { access } = await requireEventAccess(eventId);`

**Checklist for every new event operation**

1. Pick the permission from [PERMISSIONS.md](PERMISSIONS.md). A new permission needs the technical
   lead's approval and a change to both the doc and `permissions.ts`.
2. Call the helper first, before reading the input you will act on.
3. Read and write only through the authorized event: filter every query by `auth.event.id`, and
   for single-statement writes also by the member's role (`rolesAllowed(permission)`).
4. Ignore any user, role, owner or event ID sent by the browser.
5. Add tests: each role allowed or refused (action and database), a member of another event, and
   the 404 for non-members.

**Guards that fail the build if this is skipped:**
`events/[eventId]/access-coverage.test.tsx` (every event page checks access) and
`action-coverage.test.ts` (every server action taking an event ID calls `authorizeEvent` before
touching the event). The end-to-end proof is `authorization.db.test.ts`.

## Audit log (B1-11, D-037)

- Meaningful changes are recorded with who, what, which record and when, in the same transaction as
  the change. Only actions in the audit registry can be written, each with a strict schema.
- Entries can't be changed or deleted through the application or a direct SQL statement (database
  trigger); they go only with their event.
- Personal data is kept out of the details; free text is never copied. See [AUDIT.md](AUDIT.md).
- Reading the log needs `audit.view` (Owner, Coordinator), checked by `getEventActivity` on the
  server. Tests: `audit/audit.db.test.ts`, `authorization.db.test.ts`.

## Event membership (B1-07, D-034)

Where each membership criterion is enforced and tested:

| Criterion                               | Enforced by                                                                 | Tested in                                                     |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Membership model exists                 | `EventMember` in `prisma/schema.prisma`                                     | `src/lib/db.db.test.ts`                                       |
| A user can belong to one or many events | One row per user per event                                                  | `members/membership.db.test.ts`                               |
| Scoped to a specific event              | Unique `(eventId, userId)`; queries filter by both                          | `members/membership.db.test.ts`, `queries.db.test.ts`         |
| Exactly one supported role              | `member_role` enum, NOT NULL, one row per user per event; one Owner minimum | `members/membership.db.test.ts`, `src/lib/db.db.test.ts`      |
| Checked server-side                     | `requireEventAccess` / `getEventAccess` on every event page, action, route  | `access.test.ts`, `events/[eventId]/access-coverage.test.tsx` |
| Knowing an event ID is not enough       | Non-members get the same 404 as unknown IDs (D-027)                         | `members/membership.db.test.ts`, API and page tests           |

## Attendees (Batch 2)

Every attendee operation authorizes on the server with `authorizeEvent` (actions, reads) or
`authorizeEventRequest` (the export route), from the stored role, then finds attendees only inside
the authorized event. A malformed ID, an unknown attendee and another event's attendee all look
the same: not found.

| Operation                               | Permission          | Owner | Coordinator | Viewer |
| --------------------------------------- | ------------------- | ----- | ----------- | ------ |
| Guest list, details, search, filter     | `event.view`        | Yes   | Yes         | Yes    |
| Dietary needs                           | `attendees.dietary` | Yes   | Yes         | Yes    |
| Email, phone, notes (shown or searched) | `attendees.private` | Yes   | Yes         | No     |
| Add, edit, RSVP, remove                 | `attendees.manage`  | Yes   | Yes         | No     |
| Import                                  | `import.run`        | Yes   | Yes         | No     |
| Export                                  | `attendees.export`  | Yes   | Yes         | No     |

- **Fields a role may not see are never loaded** for it, so they can't reach the browser.
- **Proof:** `attendees/authorization.db.test.ts` calls every operation directly, as each kind of
  caller, and checks that denials change nothing and leak nothing; it runs in CI (D-054).
- **Activity** never stores contact details, dietary needs or notes (`activity.db.test.ts`).

## CSV import (B2-14 to B2-18, D-052)

- **Who:** `import.run` (Owner, Coordinator), checked by the page and again by the server action at
  every step. Refused roles and non-members change nothing.
- **File checks:** a `.csv` name and a CSV media type, at most 500 KB, decoded as UTF-8 with errors
  refused, no NUL bytes; at most 2,000 rows, 50 columns and 5,000 characters per value. The file
  name is shown only, never used as a path, and the file is never stored.
- **Nothing trusted from the browser:** the file text travels between steps, and the server
  re-checks its size and re-parses, re-maps and re-validates it at every step. At confirm, the
  number the user saw must match the server's own count, or nothing is imported and the new
  numbers are shown.
- **Validation:** every row goes through the add form's schema (D-042); RSVP words come from a
  fixed list; a mapping may only name known attendee fields, each once. Rows that fail are never
  written.
- **Writes:** one transaction: numbers, attendees and one Activity entry, or nothing.
- **Cells are data:** values are stored as plain text and never evaluated. React escapes them when
  shown. Formula-looking cells are neutralized when written to CSV (rows needing correction now,
  the export later).
- **No AI** in this import. The AI import (Tier 1) will reuse the same review-before-saving steps.

## CSV export (B2-19, D-053)

- **Who:** `attendees.export` (Owner, Coordinator) through `authorizeEventRequest`: 401, 404 (never
  revealing whether an event exists) and 403 for Viewers. The query filters by the authorized
  event; another event's ID in the address gets 404.
- **Data:** every attendee field, which exporting roles already see. Each export is recorded in
  Activity (count only).
- **Formula injection:** cells starting with `=`, `+`, `-`, `@`, tab or carriage return get a
  leading apostrophe.
- **Headers:** `Content-Disposition: attachment` with a sanitized file name, `no-store`,
  `nosniff`.

## Event isolation

- **Event list (B1-03, D-026).** `listEventsForUser` in `src/modules/events/queries.ts` is the
  only query that lists events. It filters by the session user's membership and returns an
  allow-list of fields. `GET /api/events` and the My events page both use it. Tests:
  `queries.db.test.ts` (real database) and `src/app/api/events/route.test.ts`.
- **Single event (B1-04, D-027).** Everything under `/events/<id>` and `/api/events/<id>` goes
  through `requireEventAccess` or `getEventAccess` in `src/modules/events/access.ts`. Rules:
  - Every page, server action and route handler under an event calls it itself, before reading
    any event data. The layout's check does not protect pages (Next.js renders them in parallel).
  - Never look up event data by ID alone. Use the event the check returns, or filter by both
    `eventId` and the session user's membership.
  - Non-members get the same 404 as unknown events.
  - Do not add a `loading.tsx` above `events/[eventId]`: it makes refused events answer 200.
    `access-coverage.test.tsx` fails if one appears (D-040).
  - Tests: `access.test.ts`, `queries.db.test.ts`, `src/app/api/events/[eventId]/route.test.ts`.
- **Role permissions (D-035).** The full matrix is in [PERMISSIONS.md](PERMISSIONS.md), with
  the same values in `src/modules/events/permissions.ts` (a test keeps them identical). After the
  membership check, every write checks `can(role, permission)` with the role loaded from the
  database, and single-statement writes filter by `rolesAllowed(permission)` too. Hiding a control
  is not the check: tests call the server actions directly with refused roles. PERMISSIONS.md lists
  the role boundaries tested so far.