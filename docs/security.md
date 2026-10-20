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

## Import (B2-14 to B2-18, D-052; Batch 9, D-108 to D-112)

- **Who:** `import.run` (Owner, Coordinator), checked by the page and again by the server action at
  every step, for attendees and suppliers alike. The import re-checks the role inside its
  transaction. Refused roles and non-members change nothing; another event's ID in the address
  imports only into that event if the user may import there.
- **File checks:** a `.csv` name with a CSV media type (at most 500 KB, decoded as UTF-8 with errors
  refused, no NUL bytes) or an `.xlsx` name with an Excel media type (at most 750 KB). Excel files
  are read by our own reader: ZIP64, encrypted and unknown-compression parts refused, at most 20 MB
  unpacked in total (zip bombs) and 2,000 archive entries, sheet paths can't leave the package,
  values only (formulas, macros, links and images are never read or run). Either way at most 2,000
  rows, 50 columns and 5,000 characters per value. The file name is shown only, never used as a
  path, and the file is never stored.
- **Nothing trusted from the browser:** the file text (an Excel sheet converted to CSV text) travels
  between steps, and the server re-checks its size and re-parses, re-maps and re-validates it at
  every step. The import type and file type are read from fixed lists. At confirm, the number the
  user saw must match the server's own count, or nothing is imported and the new numbers are shown.
- **Validation:** every row goes through its list's add form schema (attendees D-042, suppliers
  D-070); a mapping may only name fields of the chosen list, each once. Rows that fail are never
  written. Money is never imported.
- **AI (D-111, D-112):** the open-weight model only suggests the matching. Its answer is untrusted:
  strict schema check, then the same mapping rules as the browser's, then the user's review; it
  never writes anything. It is sent headers, detected types and at most 3 sample values of 40
  characters per column, as JSON data with an instruction to treat it as data. The model server
  address is server configuration only (http or https), the request has a 20-second limit, no
  redirects, a capped response size, and is never logged. The Compose file binds Ollama to
  127.0.0.1 because Ollama has no authentication.
- **Writes:** one transaction: numbers, rows and one Activity entry, or nothing.
- **Cells are data:** values are stored as plain text and never evaluated. React escapes them when
  shown. Formula-looking cells are neutralized when written to a CSV download (rows needing
  correction, the export).

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

## Accessibility (Batch 3)

Attendees' accessibility needs can hold health details, so their free-text notes are protected
like attendee notes (D-058). Every operation authorizes on the server with `authorizeEvent`, from
the stored role, then works only inside the authorized event.

| Operation                                                     | Permission              | Owner | Coordinator | Viewer |
| ------------------------------------------------------------- | ----------------------- | ----- | ----------- | ------ |
| A guest's need types and priorities; readiness, gaps, alerts  | `event.view`            | Yes   | Yes         | Yes    |
| The notes on a guest's needs                                  | `accessibility.private` | Yes   | Yes         | No     |
| Add, edit, remove needs; set up, edit, remove event resources | `accessibility.manage`  | Yes   | Yes         | No     |

- **Notes are never loaded** for roles without `accessibility.private`, and never go into
  readiness, gaps, alerts or Activity (D-058, D-066).
- **Two checks for every write:** `authorizeEvent` turns refused callers away before any storage is
  opened, and the write itself re-checks the role in the same statement (`rolesAllowed`), so a role
  changed in between changes nothing.
- **No cross-event links:** a need's attendee must belong to the same event, enforced by a
  composite foreign key (D-002); another event's attendee, need or resource ID is "not found".
- **Calculated, never stored:** readiness, gaps and alerts are worked out on the server from the
  stored needs and resources on every read (D-062 to D-066); the browser never sends a status. No
  AI is involved.
- **Addresses carry only known values:** notices after a change are shown only for a known notice
  and a known type, with the label from the canonical definitions.
- **Proof:** `accessibility/authorization.db.test.ts` calls every operation directly as each kind
  of caller (including another event's owner) and checks denials change nothing; removing any of
  the checks above makes it fail (docs/TESTING.md, B3-13). `activity.db.test.ts` shows no note
  reaches Activity.

### Security review (B3-19, 2026-10-14)

A focused review of the accessibility context, at commit `c682f35` plus the two fixes below.

| Check                          | Result                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-event data access        | Every repository query filters by the authorized event's ID; a need's attendee must be in the same event (composite foreign key, D-002). Another event's IDs are "not found" in every read and write.                                                                                                                                                   |
| Server-side authorization      | All 6 pages, 6 reads and 5 server actions authorize on the server. Writes are refused before storage and re-checked in the write. Removing a check makes the tests fail (B3-13). Nothing relies on hiding a control.                                                                                                                                    |
| Input validation               | Every action validates with Zod: IDs as UUIDs, types and statuses against the canonical lists, seat counts 0 to 10,000, notes up to 500 characters, versions as ISO dates. **Fixed:** a note with a NUL character used to reach PostgreSQL, which refuses it, and the user saw a generic "couldn't save"; it is now refused with a clear field message. |
| Sensitive attendee information | Notes need `accessibility.private` and never reach readiness, gaps, alerts, Activity or any log. Need types and guest names are visible to every member by design (D-058, D-065). **Added:** a test that fails if a role could ever manage accessibility without seeing notes, because the edit form loads the note to keep it on save.                 |
| Activity and audit integrity   | Six registered actions, written in the same transaction as the change, with the actor from the server session; the audit table is append-only (database trigger, D-037); entries hold no notes (`activity.db.test.ts`). Reads and refused or unchanged saves record nothing.                                                                            |
| ID enumeration                 | Need and resource IDs are random UUIDs. Guest numbers (`ATT-0001`) are per event and shown only to its members. Resource addresses are the six public type names. Unknown, malformed and other-event IDs all give the same "not found".                                                                                                                 |
| Client/server trust boundary   | IDs and the resource type bound into actions come back from the browser, so each is validated and authorized again. The form's version is used only to refuse stale saves. Readiness, gaps, alerts and roles are never accepted from the browser. Notices in the address are shown only for known values.                                               |
| Error-message leakage          | Failures return fixed messages; database errors are caught and never shown. The error screens show only a reference, never `error.message`. Non-members can't tell an existing event from a missing one.                                                                                                                                                |

**Debt, not fixed here:**

- **No rate limiting** on server actions. This is project-wide and needs its own decision.
- **The same NUL gap exists in Batch 2's attendee text fields** (name, notes, dietary needs). A
  NUL there gives a generic save error, not a security hole. The fix belongs to the attendees
  context, in its own task.
- **CSRF protection for server actions** comes from Next.js's built-in Origin check and isn't tested
  separately.
- **Real Supabase sign-in** is still checked by hand (see "Manual check against the real Supabase
  project"); tests use the dev stand-in (D-024).

## Suppliers (Batch 4)

Suppliers are strictly event-specific (D-068). Every operation authorizes on the server with
`authorizeEvent`, from the stored role, and works only inside the authorized event.

| Operation                                                              | Permission         | Owner | Coordinator | Viewer |
| ---------------------------------------------------------------------- | ------------------ | ----- | ----------- | ------ |
| The supplier list, contact details and notes                           | `event.view`       | Yes   | Yes         | Yes    |
| The supplier list's quote and payment overview                         | `event.view`       | Yes   | Yes         | Yes    |
| Search the supplier list (`?q=`)                                       | `event.view`       | Yes   | Yes         | Yes    |
| Filter the supplier list (category, quote, payment status, overdue)    | `event.view`       | Yes   | Yes         | Yes    |
| A supplier's detail page (identity, contacts, notes)                   | `event.view`       | Yes   | Yes         | Yes    |
| A supplier's recent Activity on its detail page                        | `audit.view`       | Yes   | Yes         | No     |
| Add a supplier                                                         | `suppliers.manage` | Yes   | Yes         | No     |
| Open the edit form and edit a supplier                                 | `suppliers.manage` | Yes   | Yes         | No     |
| Remove a supplier                                                      | `suppliers.manage` | Yes   | Yes         | No     |
| Add a quote to a supplier                                              | `suppliers.manage` | Yes   | Yes         | No     |
| Open the quote edit form and edit a quote                              | `suppliers.manage` | Yes   | Yes         | No     |
| Open the add-payment and edit-payment forms; add and edit a payment    | `suppliers.manage` | Yes   | Yes         | No     |
| See a supplier's payments, payment status and due status (on its page) | `event.view`       | Yes   | Yes         | Yes    |
| See a supplier's quotes (on its detail page)                           | `event.view`       | Yes   | Yes         | Yes    |

- **Contact details are visible to every member** (D-068, option 3a): they are business contacts,
  and only contact person, phone and email are collected (D-073). The form says so. The supplier
  list shows only the contact person; phone, email and notes are on the detail page.
- **Two checks for every write:** `authorizeEvent` before anything is opened, and the database
  statement re-checks the role (while taking the next supplier number when adding; in the
  condition of the update or delete when editing or removing), so a refused user changes nothing.
- **Another event's supplier is "not found".** A supplier is looked up only inside the authorized
  event, so an ID from another event, an unknown ID and a malformed ID give the same answer and
  change nothing (D-071, D-072). Stale edits are refused (D-032). Removing is permanent, asks for
  confirmation first, and Activity keeps the readable ID and name.
- **Filters (D-083):** values must match fixed lists exactly; anything else is ignored. They run on
  the server over this event's authorized suppliers only.
- **Search (D-082):** runs on the server over the suppliers already authorized and loaded for the
  event; the text is cleaned (control characters removed, 100 characters at most) and only compared
  with stored text, never used to build a query.
- **Quotes (D-075, D-076):** a quote is added only to a supplier found inside the authorized event,
  locked for the transaction with the role re-checked in the same statement. Amounts are validated
  as strings and never rounded; a second Accepted quote is refused, also when two arrive together.
  A quote is edited only through its own supplier in its own event; any other combination is "not
  found" and changes nothing. Stale quote edits are refused (D-032).
- **Payments (D-077 to D-080):** the same pattern as quotes. Amounts and dates are validated on the
  server with today's date in Manila from the server's clock, so a paid date "in the future" can't be
  slipped past by a browser with a wrong clock. Payment and due statuses are calculated on the
  server for every read and never accepted from the browser. Status tracking only: no payment data
  beyond amounts and dates is collected.
- **The event comes from the address only.** An `eventId` in the form is ignored; the action uses
  the authorized event.
- **Activity** records the supplier's number, name and category (and, for edits, which other fields
  changed), never contact details or notes.
- **Proof:** `suppliers/authorization.db.test.ts` calls every operation directly as each kind of
  caller and checks that denials change nothing, and sends Event B's supplier through Event A's
  address for every caller. Its B4-19 block covers the seven required cases, and removing each of
  six server-side checks made at least one test fail (`docs/TESTING.md`).
  `suppliers/activity.db.test.ts` (B4-20) proves no contact detail reaches Activity. In the browser,
  `e2e/lifecycle/supplier-workflow.spec.ts` (B4-22) shows another event's look-alike suppliers are
  never found or filtered in, their addresses are "Page not found" either way, and a Viewer can
  open no supplier, quote or payment form.

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