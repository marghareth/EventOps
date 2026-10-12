<!-- docs/DECISIONS.md -->

# Decision log

Decisions that shape EventOps' architecture, data and behaviour. PROJECT_RULES section 2 sets the
authority order: the human technical lead decides, and this file records the decision.

Status values:

- **Approved**: the technical lead chose this.
- **Proposed**: written down so it is not a silent assumption. Needs the technical lead's sign-off.
  The code may already follow it; if it is rejected, the code changes.
- **Superseded**: replaced by a later entry.

| ID    | Title                                                     | Status   | Date       |
| ----- | --------------------------------------------------------- | -------- | ---------- |
| D-001 | Module layout and import boundaries                       | Proposed | 2026-10-09 |
| D-002 | Cross-event integrity with composite foreign keys         | Proposed | 2026-10-09 |
| D-003 | Supplier records are the source of truth for money        | Approved | 2026-10-09 |
| D-004 | Deleting an event purges its audit log                    | Approved | 2026-10-09 |
| D-005 | Event reference numbers come from a per-year counter      | Proposed | 2026-10-09 |
| D-006 | Upper-case documentation file names                       | Approved | 2026-10-09 |
| D-007 | Exact dependency versions in package.json                 | Proposed | 2026-10-09 |
| D-008 | B0-08 initial schema covers users and events only         | Approved | 2026-10-09 |
| D-009 | The Supabase user mirror is `User` (table `users`)        | Approved | 2026-10-09 |
| D-010 | CHECK constraints on events                               | Approved | 2026-10-09 |
| D-011 | An event's creator cannot be deleted                      | Approved | 2026-10-09 |
| D-012 | B0-09 includes minimal sign-in and sign-up pages          | Approved | 2026-10-09 |
| D-013 | Server checks verify the user with getUser()              | Approved | 2026-10-09 |
| D-014 | Email confirmation is required                            | Approved | 2026-10-09 |
| D-015 | Passwords have at least 8 characters                      | Approved | 2026-10-09 |
| D-016 | The users row is created at sign-in, not by a trigger     | Proposed | 2026-10-09 |
| D-017 | Public routes, landing page and sign-out scope            | Proposed | 2026-10-09 |
| D-018 | Event context placeholder reads only the URL              | Approved | 2026-10-10 |
| D-019 | Placeholder pages and API routes until each feature task  | Approved | 2026-10-10 |
| D-020 | Inline SVG icons instead of the lucide-react package      | Approved | 2026-10-10 |
| D-021 | Navigation: desktop sidebar, mobile drawer                | Approved | 2026-10-10 |
| D-022 | Every event has an OWNER, enforced by a database trigger  | Approved | 2026-10-11 |
| D-023 | Length limits on event text                               | Approved | 2026-10-11 |
| D-024 | Dev-only demo sign-in                                     | Approved | 2026-10-11 |
| D-025 | Creating an event: who, time zone, and what is required   | Approved | 2026-10-11 |
| D-026 | The event list: membership only, grouped, plus an API     | Approved | 2026-10-11 |
| D-027 | Event workspace access: members only, others see 404      | Approved | 2026-10-11 |
| D-031 | Permission matrix, first row: editing an event            | Approved | 2026-10-11 |
| D-032 | Editing an event: fields, stale saves, audit later        | Approved | 2026-10-11 |
| D-033 | Deleting an event: Owner only, typed confirmation         | Approved | 2026-10-11 |
| D-034 | Event membership: model and enforcement, management later | Approved | 2026-10-12 |
| D-035 | The full event permission matrix                          | Approved | 2026-10-12 |
| D-036 | One authorization pattern for every event operation       | Approved | 2026-10-12 |

---

## D-001 Module layout and import boundaries

**Status:** Proposed. This records the layout already in the repository, so it is not a new
design, but it has not been formally signed off.

**Context.** EventOps is a modular monolith (PROJECT_RULES section 5). The repository puts every
bounded context under `src/modules/events/`.

**Decision.**

- The `events` context owns the top-level files of `src/modules/events/`. Every other context is a
  sub-folder: `members`, `audit`, `attendees`, `suppliers`, `tasks`, `checkin`, `volunteers`,
  `timeline`, `accessibility`, `budget`, `impact`, `health`, `import`.
- Layered contexts (`accessibility`, `budget`, `impact`, `health`, `import`) split into `domain/`
  (pure rules), `application/` (use cases and ports), `infrastructure/` (Prisma, storage, AI) and
  optional `ui/`. `domain/` must not read the clock, randomness or the network.
- Another context is reached only through its `public.ts`: `@/modules/events/public` or
  `@/modules/events/<context>/public`. Inside a context, imports are relative. Relative imports into
  a sibling context are not allowed.
- Upstream contexts (`events`, `members`, `audit`, `attendees`, `suppliers`, `tasks`, `checkin`,
  `volunteers`, `timeline`) must not import the downstream ones (`impact`, `health`, `import`).
- `eslint.config.mjs` enforces all of this. Import cycle detection (`import/no-cycle`) is not
  enabled yet.

**Consequences.** A new context folder gets only the baseline "public.ts only" rule until it is
added to a list in `eslint.config.mjs`.

**Open questions for the technical lead.**

- `checkin`, `volunteers` and `timeline` were added to the upstream list so their files are
  linted. Their scope is still an open question (see the open items at the end of this file).
- `accessibility` and `budget` are layered but not in the upstream list, so nothing stops them from
  importing `impact` or `health`. Should they be treated as upstream too?

---

## D-002 Cross-event integrity with composite foreign keys

**Status:** Proposed. Chosen while fixing the cross-event isolation gap. The delete behaviour
change below needs sign-off.

**Context.** Prisma connects to Postgres directly and bypasses Supabase row-level security, so the
application was the only guard against a row in one event pointing at a row in another event (for
example, a task in event B assigned to a member of event A).

**Decision.**

- Every link between two event-owned rows is a composite foreign key on `(eventId, <ref>)` that
  references `(eventId, id)` on the parent. Each parent has `@@unique([eventId, id])`. This covers
  accessibility requirement → attendee or volunteer, supplier payment → supplier, budget line →
  supplier, task → assignee member, task → related supplier, volunteer → role, and impact item →
  impact event.
- Optional links (budget line → supplier, task → assignee, task → supplier, volunteer → role) use
  `ON DELETE NO ACTION`, not `SET NULL`. Prisma cannot set only part of a composite key to null, and
  `eventId` must stay set.
- Deleting a supplier, removing a member or deleting a volunteer role must therefore clear the
  links first, in the same transaction. Behaviour for the user stays the same as `SET NULL` (the
  link disappears), but the use case does it explicitly.
- Deleting a whole event still cascades. `NO ACTION` is checked at the end of the statement, so the
  cascade removes parents and children together.

**Schema state.** Since D-008, the only event-owned table is `event_members`, which already has
`@@unique([eventId, id])`. The links listed above are added by the batch tasks that create those
tables, and each of those tasks follows this decision.

**Evidence.** An earlier full-schema draft migration (since replaced, see D-008) was applied to
PostgreSQL 16 and tested. Every cross-event insert was rejected, a linked supplier or role could not
be deleted directly, unlink-then-delete worked, and deleting an event left no rows behind.

**Consequences.** Delete use cases for suppliers, members and volunteer roles must unlink first.
Who may delete each of these is set by the permission matrix, which is not yet documented.

---

## D-003 Supplier records are the source of truth for money

**Status:** Approved by the technical lead on 2026-10-09.

**Context.** Money paid to a supplier could be recorded in three places (`Supplier.paymentStatus`,
`SupplierPayment` rows and `BudgetItem.paidAmount`), and money committed in two
(`Supplier.quoteAmount` and `BudgetItem.committedAmount`). PROJECT_RULES section 6 forbids
independently editable derived totals.

**Decision.**

- **Paid** to a supplier = the sum of its `SupplierPayment` rows. Nothing else stores it.
- **Committed** to a supplier = `quoteAmount` while `quoteStatus` is `ACCEPTED`, otherwise zero.
- **Payment status** is computed, not stored. `Supplier.paymentStatus` and the `PaymentStatus`
  database enum were removed.
- A budget line linked to a supplier takes its committed and paid amounts from that supplier and
  stores none itself (`committedAmount` and `paidAmount` are NULL). A budget line with no supplier
  stores both amounts. CHECK constraint `budget_items_amount_source` enforces this.
- A supplier links to at most one budget line (`@@unique([eventId, supplierId])`), so its money is
  counted once.
- Before a supplier is deleted, its budget line is unlinked and the supplier's committed and paid
  totals are copied onto the line, in the same transaction. Its `SupplierPayment` rows are deleted
  with it (cascade).

**Schema state.** Since D-008, the supplier and budget tables are not in the schema yet. The
supplier and budget tasks create them following this decision.

**Not decided yet.** The exact rule that maps a paid amount to a status (for example unpaid,
deposit paid, partially paid, paid) is a financial rule. It must be defined in the approved budget
domain contract before it is implemented (PROJECT_RULES section 6.1).

---

## D-004 Deleting an event purges its audit log

**Status:** Approved by the technical lead on 2026-10-09.

**Context.** `AuditLog` is append-only, but its foreign key to `events` cascades, so deleting an
event erases its history. PROJECT_RULES section 6 requires deletion behaviour to be decided, not
left to chance.

**Decision.** Keep the cascade. The audit log is append-only while the event exists. Deleting an
event permanently removes the event and everything that belongs to it: attendees, accessibility
data, suppliers, payments, budget, tasks, volunteers, timeline, impact history, import sessions and
the audit log.

**Why.** It matches the design system's delete dialog ("You can't undo this"), and it limits how
long guest personal data is kept.

**Consequences.**

- After deletion, there is no record in EventOps that the event existed.
- The delete action must use the destructive confirmation dialog and state that it cannot be undone.
- Who may delete an event is set by the permission matrix: Owners only (D-033).
- Since D-008, only `event_members` hangs off `events` (cascade). The audit table and the others
  are added by later tasks, each with an `ON DELETE CASCADE` foreign key to `events`.
- **Implemented in B1-06 and reconfirmed by the technical lead on 2026-10-11** (cascade, not
  archiving). A database test fails if any foreign key to `events` is not `ON DELETE CASCADE`.

---

## D-005 Event reference numbers come from a per-year counter

**Status:** Proposed.

**Context.** Attendee and supplier numbers have per-event counters, but readable event IDs such as
`EVT-2026-0001` had none, so two events created at the same time could get the same number.

**Decision.**

- Table `event_reference_counters` holds one row per year with the last number issued.
- The create-event use case, inside the same transaction as the event insert, runs an atomic upsert:
  `INSERT ... ON CONFLICT (year) DO UPDATE SET "lastNumber" = "lastNumber" + 1 RETURNING "lastNumber"`.
- The year is the creation year in Asia/Manila (the target users' time zone).
- The format is `EVT-<year>-<number>`, with the number zero-padded to at least 4 digits.
- `Event.reference` stays unique as a final safety net.

**Evidence.** 40 concurrent sessions against PostgreSQL 16 received 40 distinct numbers, 1 to 40.
The B0-08 database tests (`npm run test:db`) repeat this with 25 concurrent requests through the
Prisma client.

**Consequences.** Because the counter row stays locked until commit, a rolled-back event creation
releases its number, so there are no gaps. Event creation is serialised per year, which is fine at
the expected volume.

**Implemented in B1-02** (`src/modules/events/create-event.ts`). Database tests confirm consecutive
numbers, distinct numbers for 5 concurrent creations, and no gap after a failed creation.

---

## D-006 Upper-case documentation file names

**Status:** Approved (requested by the technical lead on 2026-10-09).

**Decision.** Documentation files use the upper-case names PROJECT_RULES section 16 lists, for
example `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md`. Multi-word names use underscores
(`docs/CONTEXT_MAP.md`, `docs/IMPACT_RULES.md`).

---

## D-007 Exact dependency versions in package.json

**Status:** Proposed. The changelog claimed exact pins while `package.json` used `latest` and `^`
ranges. The fix made the code match the claim instead of the other way round; the technical lead
should confirm that direction.

**Decision.** Every dependency in `package.json` is pinned to an exact version, equal to the version
in `package-lock.json`. Upgrades and new packages need approval (PROJECT_RULES section 15).

---

## D-008 B0-08 initial schema covers users and events only

**Status:** Approved by the technical lead on 2026-10-09.

**Context.** The review fixes produced a draft schema and migration with all 20 tables. Task B0-08
(Database Foundation) scopes the initial database to User, Event and EventMember, and
PROJECT_RULES section 6 says every schema change must be justified by the task.

**Decision.**

- The schema and the initial migration contain only `users`, `events`, `event_members` and
  `event_reference_counters` (needed for event references, D-005).
- The draft migration `20261009141000_init` is replaced by `20261009143000_init`. This assumes the
  draft was never applied to a shared or production database.
- `Event.nextAttendeeNumber`, `Event.nextSupplierNumber`, the event assumptions and every other
  table are added by the batch tasks that need them, following D-002 to D-005. The full draft stays
  in Git history as a reference.

---

## D-009 The Supabase user mirror is `User` (table `users`)

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** The model that mirrors a Supabase Auth user is `User`, stored in `public.users`
(previously drafted as `Profile` / `profiles`). Its `id` equals the `auth.users` id. There is no
foreign key to the `auth` schema, because Prisma does not manage it; the sign-in task creates the
row on first sign-in.

---

## D-010 CHECK constraints on events

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** The database rejects:

| Constraint                         | Rule                                                    |
| ---------------------------------- | ------------------------------------------------------- |
| `events_name_not_blank`            | The name must contain at least one non-space character. |
| `events_capacity_positive`         | Capacity is either not set or greater than 0.           |
| `events_expected_attendees_nonneg` | Expected attendees cannot be negative.                  |
| `events_ends_not_before_start`     | The end time is either not set or not before the start. |

The application still validates the same rules with Zod, to show friendly form errors.

---

## D-011 An event's creator cannot be deleted

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** `events.createdById` is a foreign key to `users.id` with `ON DELETE RESTRICT`. A user
who created events cannot be deleted until those events are deleted or, if a later task allows it,
reassigned. Deleting a user removes their memberships (cascade). User deletion is not a Tier 1
feature.

---

## D-012 B0-09 includes minimal sign-in and sign-up pages

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** B0-09 ships plain, working `/login` and `/sign-up` pages and a sign-out button, built
from the existing design-system components, so the auth flow can be used and tested. The Tier 1
"Supabase Auth: sign up, log in, log out" task polishes the user-facing experience.

---

## D-013 Server checks verify the user with getUser()

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.**

- `requireUser()` and `getCurrentUser()` call Supabase `auth.getUser()`, which asks Supabase Auth on
  every call. A signed-out, banned or deleted user is rejected immediately, at the cost of one
  network round trip per protected request.
- The proxy only refreshes the session and redirects, so it uses `auth.getClaims()`, which verifies
  the token signature locally when the project uses asymmetric signing keys. The proxy is never the
  security check.
- If Supabase cannot be reached, the server check throws instead of treating the user as signed out.

---

## D-014 Email confirmation is required

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** New accounts must confirm their email before signing in (Supabase setting "Confirm
email" on). The code also works with it off. Supabase's built-in email sender is rate-limited, so
custom SMTP is needed before the demo. See docs/SECURITY.md, "Required Supabase dashboard settings".

---

## D-015 Passwords have at least 8 characters

**Status:** Approved by the technical lead on 2026-10-09.

**Decision.** New passwords need 8 to 72 characters (72 is Supabase's maximum). The sign-up form
checks it with Zod, and the Supabase project must have the same minimum. Sign-in accepts any
non-empty password, so the rule applies only when a password is created.

---

## D-016 The users row is created at sign-in, not by a trigger

**Status:** Proposed.

**Context.** `public.users` mirrors Supabase Auth users (D-009). Supabase usually suggests a database
trigger on `auth.users`, but the local and CI test databases have no `auth` schema, so a trigger in
the Prisma migrations would fail there.

**Decision.** The app upserts the `users` row after every successful sign-in and email confirmation
(`syncUserRecord`). The first sign-in creates it with the sign-up name; later sign-ins update the
email and keep the stored name. If the row cannot be saved, the sign-in is undone and the user sees
an error.

**Consequences.** A user who exists in Supabase but has never signed in through the app has no
`users` row. A new Supabase account that reuses the email of a deleted one is rejected until the old
`users` row is removed (unique email).

---

## D-017 Public routes, landing page and sign-out scope

**Status:** Proposed.

**Decision.**

- Public without signing in: `/`, `/login`, `/sign-up` and `/auth/*`. Everything else requires a
  session. API routes answer 401 themselves; the proxy does not redirect them.
- After signing in, the user goes to the `next` path if it is safe, otherwise `/events`.
- Sign-out ends only the current browser's session (`scope: "local"`); other devices stay signed in.

---

## D-018 Event context placeholder reads only the URL

**Status:** Approved by the technical lead on 2026-10-10.

**Decision.** Inside `/events/[eventId]/...`, the shell shows the event ID from the URL, a "Switch
event" link and the event's sidebar sections. It loads no event data, because loading an event
before the membership and role check exists would break PROJECT_RULES section 7.
`events/[eventId]/layout.tsx` rejects malformed IDs (not a UUID) with the not-found page, but this
is input hygiene, **not** an access check. The event-workspace task replaces the placeholder with
the event name and the membership check.

**Done in B1-04 (D-027).** The workspace header now shows the event's identity after the access
check, and the top bar shows only "Switch event", never the raw ID.

---

## D-019 Placeholder pages and API routes until each feature task

**Status:** Approved by the technical lead on 2026-10-10.

**Context.** Empty `page.tsx` and `route.ts` files crashed their routes and failed `npm run build`.

**Decision.**

- Every route that has no feature yet renders `PagePlaceholder` ("Not built yet"). Tier 2 pages
  (check-in, event day, volunteers, timeline) say they are Tier 2 and are not linked in the
  navigation.
- Placeholder API routes answer 401 to signed-out callers and 501 Not Implemented to signed-in
  callers, and never return data.
- Each feature task replaces its own placeholder.

---

## D-020 Inline SVG icons instead of the lucide-react package

**Status:** Approved by the technical lead on 2026-10-10.

**Decision.** Shell icons are inline SVG paths copied from Lucide (ISC License) in
`src/components/layout/NavIcon.tsx`, like the existing `StateIcon`. No new dependency
(PROJECT_RULES section 15). The license notice is in `THIRD-PARTY-LICENSES.md`.

---

## D-021 Navigation: desktop sidebar, mobile drawer

**Status:** Approved by the technical lead on 2026-10-10.

**Decision.**

- From the `md` breakpoint (768 px) the sidebar is always visible on the left. Below it, a "Menu"
  button in the header opens the same sidebar in a drawer built on the native `<dialog>`.
- Outside an event the sidebar shows "My events" and "New event". Inside an event it shows the Tier
  1 sections: Overview, Attendees, Accessibility, Suppliers, Budget, Tasks, Impact, Import,
  Activity, Settings.
- The current page is marked with `aria-current="page"`, a bar and bold text, not color alone.

---

## D-022 Every event has an OWNER, enforced by a database trigger

**Status:** Approved by the technical lead on 2026-10-11.

**Context.** B1-01 requires that an event belongs to its owner through the membership model.
Nothing stopped an event from having no members, or from losing its last OWNER (open item 8).

**Decision.**

- Deferred constraint triggers check, at commit, that an inserted event has an `OWNER` membership
  and that updating or deleting a membership never leaves an event without one.
- The create-event use case (B1-02) inserts the event and the creator's `OWNER` membership in one
  transaction, for example as a nested Prisma create.
- Deleting a whole event is allowed. Deleting a user who is an event's last `OWNER` is blocked.
- The migration stops if existing data already breaks the rule.
- Errors start with `events_must_have_owner:` (Postgres code 23514); the app maps them to a safe
  message.

**Evidence.** 10 database tests. Dropping either trigger makes exactly the matching tests fail.

**Consequences.** Resolves open item 8 at the data level. Who may add or remove owners is still a
permission-matrix question (open item 7).

---

## D-023 Length limits on event text

**Status:** Approved by the technical lead on 2026-10-11.

**Decision.** `events.name` is `varchar(120)`, `venue` `varchar(200)` and `description`
`varchar(5000)`, counted in characters. Forms (B1-02) validate the same limits with Zod for friendly
messages; the database is the backstop. Too-long values fail with Prisma error `P2000`.

---

## D-024 Dev-only demo sign-in

**Status:** Approved by the technical lead on 2026-10-11.

**Context.** The technical lead needs to view signed-in pages on `localhost` before a Supabase
project is connected.

**Decision.**

- `DEV_DEMO_AUTH=true` in `.env.local` makes `npm run dev` treat every request as a fixed demo user
  (`demo@eventops.local`, "Demo Coordinator"). The proxy skips Supabase, the sign-in and sign-up
  forms validate input and then continue, and sign-out goes to the home page.
- It is on only when `NODE_ENV` is `development`, which only `next dev` sets. `next start`, Vercel
  and tests ignore it, and `next build` refuses to run while it is set (`next.config.ts`).
- A "Demo sign-in is on" banner shows on every page while it is on.
- No Supabase or database settings are needed to view the shell. Pages that read event data will
  need a database once they exist.

**Evidence.** Unit tests for every combination of flag and environment, and for the build guard. A
browser run with no Supabase or database settings, and a real production build attempt with the
flag set, which fails as intended.

---

## D-025 Creating an event: who, time zone, and what is required

**Status:** Approved by the technical lead on 2026-10-11 (B1-02 plan).

**Decision.**

- Any signed-in user may create an event. Creating one is not an event-scoped operation, so it
  needs no membership; the creator becomes the event's `OWNER` in the same transaction (D-022).
- Required: name, date and start time. Optional: end time, venue, description, venue capacity and
  expected attendees (default 0). New events start as `DRAFT`; the form has no status field, and
  the server ignores any extra fields such as a creator, role or status.
- Dates and times are entered in Philippine time (Asia/Manila, UTC+8, no daylight saving) and
  stored in UTC. The form says so.
- The end time is on the same day as the start and can't be before it. Editing keeps the same rule
  (D-032); multi-day events need a separate decision.
- On success the user is sent to `/events/<id>?created=<reference>`, which shows an "Event created"
  notice. The reference in the URL is only displayed, and only if it is well formed.
- Database errors show a generic message ("We couldn't save the event. Try again in a moment.") and
  keep what the user typed; no internal detail reaches the browser.
- In demo sign-in (D-024) creation works when `DATABASE_URL` is set: the demo user's `users` row is
  created first. Without a database the form says so instead of failing.

---

## D-026 The event list: membership only, grouped, plus an API

**Status:** Approved by the technical lead on 2026-10-11 (B1-03 plan).

**Decision.**

- "My events" (`/events`) and `GET /api/events` return only events the signed-in user has an
  `event_members` row for, with the user's own role. Every role (Owner, Coordinator, Viewer) sees
  its events. The user ID comes from the server session; the route takes no parameters.
- Each listed event carries an allow-list of fields: id, reference, name, venue, start, end,
  status, expected attendees and the user's role. Description, capacity and creator are not listed.
- Cards in a responsive grid (one column on phones), grouped into "Upcoming", soonest first, and
  "Past", most recent first. An event stays upcoming for the whole of its last day in Philippine
  time (its end, or its start when it has no end). Status does not move an event between groups.
- No paging or search. Recorded as debt: fine for the expected few dozen events per coordinator.
- `GET /api/events` answers 401 when signed out, 503 when sign-in or (demo) the database is
  unavailable, 500 with a generic message on database errors, and sends `Cache-Control: private,
no-store`.

**Evidence.** Database tests: another user's events are never listed, a removed member stops
seeing the event, two members of one event each see their own role. A browser run with another
user's private event in the database: it appears in neither the page nor the API response.

---

## D-027 Event workspace access: members only, others see 404

**Status:** Approved by the technical lead on 2026-10-11 (B1-04 plan).

**Decision.**

- `requireEventAccess(eventId)` in `src/modules/events/access.ts` is the access check for
  everything under an event. It takes the user from the session and loads the event in one query
  filtered by that user's membership. It is cached per request, so the layout, the page and later
  modules share the query.
- Every page, server action and route handler under an event calls it itself. A check in the
  layout alone does not protect a page, because Next.js renders layouts and pages in parallel.
- An event the user is not a member of is treated exactly like an unknown event or a malformed ID:
  the not-found page (HTTP 404) and, in the API, the same `404 {"error":"Event not found."}`. Nobody
  can tell whether an event ID exists. No separate "no access" page.
- Membership only. Role permissions wait for the permission matrix (open item 7); the check
  returns the member's role for that.
- The workspace header (event number, name, date and time, venue, status, your role) shows above
  every section. The overview shows the event's details and tiles for the Tier 1 sections, each
  marked "Not set up yet". No module data.
- `GET /api/events/<id>` returns the same fields as the overview plus the role, with
  `Cache-Control: private, no-store`.
- The My events page's loading and error files live in the `(list)` route group, so their
  loading boundary does not wrap event pages. Otherwise Next.js starts streaming before the access
  check and a refused event is sent with HTTP 200 instead of 404.
- Demo sign-in without a database shows a "No database connected" notice in the workspace and
  still renders the placeholder sections.

**Evidence.** Database tests: a non-member and an unknown ID both get nothing, each member gets
their own role, a removed member loses access. A browser run: another user's event and its
sections, an unknown ID and a malformed ID all return HTTP 404 with no event data in the page; the
API answers identically for all three.

---

## D-031 Permission matrix, first row: editing an event

**Status:** Approved by the technical lead on 2026-10-11 (B1-05 plan). Partly resolves open item 7.
D-028 to D-030 are held for B3-05, which is written but not applied.

**Decision.** `src/modules/events/permissions.ts` holds the matrix; `can(role, permission)` answers
it and `rolesAllowed(permission)` lists the roles. Rows are added only when the technical lead
approves them.

| Permission   | Owner | Coordinator | Viewer |
| ------------ | ----- | ----------- | ------ |
| `event.edit` | Yes   | Yes         | No     |

Every member may read the event's details. Pages hide controls a role cannot use, but the server
action checks the role itself every time, and the edit's database update checks it again.

---

## D-032 Editing an event: fields, stale saves, audit later

**Status:** Approved by the technical lead on 2026-10-11 (B1-05 plan).

**Decision.**

- Event details are edited on the event's Settings page (`/events/<id>/settings`). The overview
  links to it for roles that may edit.
- Editable: name, date, start and end time, venue, description, capacity and expected attendees,
  with the same validation as Create Event (one shared schema). Same-day only, as in D-025.
- Not editable here: status (its rules are a separate decision), reference, creator and members.
  The server ignores any such fields in the request.
- Stale saves are refused. The form carries the event's `updatedAt` from when it was opened; the
  update applies only if it still matches, in the same statement that checks membership and role.
  Otherwise: "This event changed since you opened it", with the user's input kept.
- A save that changes nothing writes nothing.
- After a save the whole event workspace is refreshed, so the header, overview and form show the
  new values at once.
- Audit: the criterion applies "once that system is available". There is no audit log yet (B3-05
  is not applied), so the update records nothing; `update-event.ts` marks where the entry goes.
- The Settings page has its own loading and error screens. They sit below the event layout, so
  refused events still answer with HTTP 404 (checked).

---

## D-033 Deleting an event: Owner only, typed confirmation

**Status:** Approved by the technical lead on 2026-10-11 (B1-06 plan).

**Decision.**

- Permission matrix row (D-031): `event.delete` is Owner only. Coordinators can edit but not
  delete; Viewers can do neither. Any Owner may delete, if an event has several.
- Deletion is permanent and removes everything that belongs to the event (D-004, reconfirmed). No
  archive or restore.
- The "Delete event" section sits at the bottom of the event's Settings page and is shown only to
  Owners. Its destructive dialog names the event and says it can't be undone; Delete stays disabled
  until the event number (for example `EVT-2026-0001`) is typed. Cancel deletes nothing.
- The server action checks membership, the role and the typed number itself. The database delete
  repeats the membership and role check in the same statement, so a role change in between deletes
  nothing.
- On success the user lands on My events with an "Event deleted" notice. The deleted event's pages
  and API answer 404 like any unknown event (D-027).
- Errors: refused or already deleted gives "This event isn't available"; a database failure says
  nothing was removed. Both keep the dialog open.
- No audit entry: the event's audit log is deleted with it (D-004), and no audit log exists yet.

---

## D-034 Event membership: model and enforcement, management later

**Status:** Approved by the technical lead on 2026-10-12 (B1-07 plan).

**Decision.**

- The membership model is `EventMember` (B0-08): one row per user per event, with exactly one role
  from `member_role` (Owner, Coordinator, Viewer). Every event keeps at least one Owner (D-022).
- Membership is checked on the server for every event page, action and API route (D-027). Since
  B1-07 this includes the placeholder section pages, and a test walks every page under
  `/events/<id>` so a new page without the check fails.
- B1-07 adds no schema and no UI. Adding members, changing roles and removing members (and who may
  do it) are a separate task. Until then, members other than the creator exist only in seeded or
  test data.

---

## D-035 The full event permission matrix

**Status:** Approved by the technical lead on 2026-10-12 (B1-08 plan). Resolves open item 7.

**Decision.** The complete Tier 1 permission matrix is in [PERMISSIONS.md](PERMISSIONS.md) and in
`src/modules/events/permissions.ts`; a test fails if they differ. In short:

- **Owner:** everything, including the two Owner-only permissions: deleting the event
  (`event.delete`, D-033) and managing members (`members.manage`).
- **Coordinator:** everything else: event details and status, attendees (including CSV export of
  guest data), import, accessibility, suppliers and payments, budget, tasks, impact assumptions, and
  the activity log.
- **Viewer:** read-only (`event.view` only). No exports and no activity log.

Rows D-031 (`event.edit`) and D-033 (`event.delete`) are part of this matrix. Each feature task
enforces its row on the server and in the database, and adds action and database tests for every
role; PERMISSIONS.md lists which boundaries are tested so far.

---

## D-036 One authorization pattern for every event operation

**Status:** Approved by the technical lead on 2026-10-12 (B1-09 plan).

**Decision.**

- Every event operation authorizes through one helper in `src/modules/events/authorize.ts`:
  `authorizeEvent` for server actions, `authorizeEventRequest` for API route handlers, and
  `requireEventAccess` for pages. Each verifies sign-in, takes the user from the server session,
  checks membership and checks the role against the permission matrix (D-035), in that order.
- Non-members get the same answer as an unknown event (404, D-027). A member whose role lacks the
  permission gets 403 from the API and a role message in the UI.
- Single-statement writes also filter by the allowed roles in the database, so a role change
  between the check and the write changes nothing.
- Guard tests fail if an event page or server action skips the check. `authorization.db.test.ts`
  proves the required security matrix end to end against a real database.
- The pattern and checklist are in SECURITY.md, "How to authorize an event operation".

---

## Open items needing a decision

These were found during review. Each one is a conflict between sources or a product question, so
PROJECT_RULES says to stop and ask rather than choose.

1. **QR check-in.** The repository has `checkin/qr.ts` and a check-in page (both empty). PROJECT_RULES
   section 2.2 says the Tier 1 additions do not authorise QR check-in.
2. **Transport and volunteer impacts.** The repository has `transport-capacity` and
   `volunteer-coverage` impact rules (empty), and the earlier draft schema had `vehicleCapacity`
   and `attendeesPerVolunteer` assumptions. PROJECT_RULES section 10 says not to build these before
   approval. The brand book's 180 → 220 example includes them.
3. **Tier 2 scaffolding before Tier 1 acceptance.** Empty volunteers, timeline and event-day pages
   and modules already exist in the repository.
4. **Plus-ones in the live attendance count.** The earlier draft modelled check-in as a single
   `Attendee.checkedInAt` timestamp, so how plus-ones count is not defined. PROJECT_RULES section 6.2 requires this before implementation.
5. **Commit type for security work.** PROJECT_RULES section 17 suggests `security(B4-19): ...`, but
   `commitlint.config.mjs` follows the hackathon convention and rejects the `security` type.
6. **Payment status rule.** See D-003, "Not decided yet".
7. ~~**Permission matrix.**~~ Resolved by D-035 (see PERMISSIONS.md).
8. ~~**Last owner.**~~ Resolved at the data level by D-022: the database blocks removing, demoting or
   deleting an event's last `OWNER`.