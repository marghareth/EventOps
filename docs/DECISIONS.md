<!-- docs/DECISIONS.md -->

# Decision log

Decisions that shape EventOps' architecture, data and behaviour. PROJECT_RULES section 2 sets the
authority order: the human technical lead decides, and this file records the decision.

Status values:

- **Approved**: the technical lead chose this.
- **Proposed**: written down so it is not a silent assumption. Needs the technical lead's sign-off.
  The code may already follow it; if it is rejected, the code changes.
- **Superseded**: replaced by a later entry.

| ID    | Title                                                       | Status   | Date       |
| ----- | ----------------------------------------------------------- | -------- | ---------- |
| D-001 | Module layout and import boundaries                         | Proposed | 2026-10-09 |
| D-002 | Cross-event integrity with composite foreign keys           | Proposed | 2026-10-09 |
| D-003 | Supplier records are the source of truth for money          | Approved | 2026-10-09 |
| D-004 | Deleting an event purges its audit log                      | Approved | 2026-10-09 |
| D-005 | Event reference numbers come from a per-year counter        | Proposed | 2026-10-09 |
| D-006 | Upper-case documentation file names                         | Approved | 2026-10-09 |
| D-007 | Exact dependency versions in package.json                   | Proposed | 2026-10-09 |
| D-008 | B0-08 initial schema covers users and events only           | Approved | 2026-10-09 |
| D-009 | The Supabase user mirror is `User` (table `users`)          | Approved | 2026-10-09 |
| D-010 | CHECK constraints on events                                 | Approved | 2026-10-09 |
| D-011 | An event's creator cannot be deleted                        | Approved | 2026-10-09 |
| D-012 | B0-09 includes minimal sign-in and sign-up pages            | Approved | 2026-10-09 |
| D-013 | Server checks verify the user with getUser()                | Approved | 2026-10-09 |
| D-014 | Email confirmation is required                              | Approved | 2026-10-09 |
| D-015 | Passwords have at least 8 characters                        | Approved | 2026-10-09 |
| D-016 | The users row is created at sign-in, not by a trigger       | Proposed | 2026-10-09 |
| D-017 | Public routes, landing page and sign-out scope              | Proposed | 2026-10-09 |
| D-018 | Event context placeholder reads only the URL                | Approved | 2026-10-10 |
| D-019 | Placeholder pages and API routes until each feature task    | Approved | 2026-10-10 |
| D-020 | Inline SVG icons instead of the lucide-react package        | Approved | 2026-10-10 |
| D-021 | Navigation: desktop sidebar, mobile drawer                  | Approved | 2026-10-10 |
| D-022 | Every event has an OWNER, enforced by a database trigger    | Approved | 2026-10-11 |
| D-023 | Length limits on event text                                 | Approved | 2026-10-11 |
| D-024 | Dev-only demo sign-in                                       | Approved | 2026-10-11 |
| D-025 | Creating an event: who, time zone, and what is required     | Approved | 2026-10-11 |
| D-026 | The event list: membership only, grouped, plus an API       | Approved | 2026-10-11 |
| D-027 | Event workspace access: members only, others see 404        | Approved | 2026-10-11 |
| D-031 | Permission matrix, first row: editing an event              | Approved | 2026-10-11 |
| D-032 | Editing an event: fields, stale saves, audit later          | Approved | 2026-10-11 |
| D-033 | Deleting an event: Owner only, typed confirmation           | Approved | 2026-10-11 |
| D-034 | Event membership: model and enforcement, management later   | Approved | 2026-10-12 |
| D-035 | The full event permission matrix                            | Approved | 2026-10-12 |
| D-036 | One authorization pattern for every event operation         | Approved | 2026-10-12 |
| D-037 | Audit log: controlled actions, written with each change     | Approved | 2026-10-12 |
| D-038 | Event context in the shell: URL first, confirmed by access  | Approved | 2026-10-12 |
| D-039 | Event lifecycle tested end to end at two levels             | Approved | 2026-10-12 |
| D-040 | Loading and error screens for the event foundation          | Approved | 2026-10-12 |
| D-041 | Dev-only sample data instead of "No database connected"     | Approved | 2026-10-12 |
| D-042 | Attendee data model                                         | Approved | 2026-10-12 |
| D-043 | Adding attendees: page, guest list and sample guests        | Approved | 2026-10-12 |
| D-044 | Editing attendees                                           | Approved | 2026-10-12 |
| D-045 | Removing attendees                                          | Approved | 2026-10-12 |
| D-046 | Plus-ones: a count, and the expected headcount rule         | Approved | 2026-10-13 |
| D-047 | Dietary needs: one free-text entry, visible to every member | Approved | 2026-10-13 |
| D-048 | Attendee notes and the attendee details page                | Approved | 2026-10-13 |
| D-049 | RSVP states, changes and the guest-list RSVP filter         | Approved | 2026-10-13 |
| D-050 | Guest list search, filters and sorting                      | Approved | 2026-10-13 |
| D-051 | Attendee details page as independent sections               | Approved | 2026-10-13 |
| D-052 | CSV import: steps, validation, duplicates and policy        | Approved | 2026-10-13 |
| D-053 | CSV export of the guest list                                | Approved | 2026-10-13 |
| D-054 | CI green: placeholder tests and knip scope                  | Approved | 2026-10-13 |
| D-055 | Browser lifecycle tests run in CI                           | Approved | 2026-10-13 |

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
- ~~Demo sign-in without a database shows a "No database connected" notice in the workspace and
  still renders the placeholder sections.~~ Replaced by D-041: it now shows sample events.

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
- Audit: since B1-11 every saved change records `event.updated` with the changed fields (D-037).
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

## D-037 Audit log: controlled actions, written with each change

**Status:** Approved by the technical lead on 2026-10-12 (B1-11 plan). Replaces the audit part of
B3-05's held D-029; B3-05 will use this log when it is applied.

**Decision.**

- Table `audit_logs`: event, actor, action, optional entity type and ID, validated details, time
  (migration `20261012090000_audit_log`).
- Only actions in the registry (`src/modules/events/audit/actions.ts`) can be written, each with a
  strict schema. B1 records `event.created` and `event.updated`. Deleting an event is not recorded,
  because D-004 deletes its log. Reads are never audited.
- `event.updated` stores only changed fields, old → new. The free-text description is marked as
  changed and never copied. Personal data is kept out of details (see AUDIT.md).
- Entries are written in the same transaction as the change; if the entry fails, the change fails.
- Append-only, enforced by a database trigger. Entries go with their event; a deleted user's
  entries stay with no actor.
- Owners and Coordinators read the log on the event's Activity page (`audit.view`, D-035), through
  `getEventActivity`, which authorizes itself. Latest 100 entries; filters and paging later.
- Full rules: [AUDIT.md](AUDIT.md).

---

## D-038 Event context in the shell: URL first, confirmed by access

**Status:** Approved by the technical lead on 2026-10-12 (B1-13 plan).

**Decision.**

- The event a page works on comes only from the URL (`/events/<id>/...`), so a refresh or a shared
  link keeps it, and links inside an event stay inside it. Leaving is only through "All events" or
  "Switch event". Nothing about the current event is stored in the browser.
- The shell (sidebar, top bar) learns the event's name only after the event layout's server-side
  access check passed (`ConfirmEvent` in `EventContext.tsx`). This is display only, never an
  access check.
- Not-found inside the app (`src/app/(app)/not-found.tsx`) renders inside the shell's single
  `<main>`, links back to My events, and makes the sidebar show the normal links instead of the
  unavailable event's sections.
- Browser tabs name the event: "Settings · Santos wedding · EventOps", from the same
  request-cached access check. Refused or unknown events add nothing to the title.
- The top bar shows the event name from tablet width up; on phones the workspace header shows it.
- `getCurrentUser` is cached per request, so the page, its layout and its title share one sign-in
  check. Never across requests or users.

---

## D-039 Event lifecycle tested end to end at two levels

**Status:** Approved by the technical lead on 2026-10-12 (B1-14 plan).

**Decision.**

- The event foundation's lifecycle (sign in, create, list, open, edit, activity, role changes,
  authorization, delete, gone) is tested as one continuous story at two levels:
  - `lifecycle.db.test.ts`: real server code and PostgreSQL, four real users, in CI.
  - `e2e/lifecycle/event-lifecycle.spec.ts`: real browser with dev demo sign-in, local only
    (`npm run test:e2e:lifecycle`).
- "Signed in" is mocked in the database test and is demo sign-in in the browser test; real
  Supabase sign-in stays a manual check (SECURITY.md).
- Role changes are applied directly in the database until member management exists (D-034).
- Both start from a known state: the database test cleans up after itself; the browser test resets
  the demo user's data first, and only in a database named for tests.
- Details: [TESTING.md](TESTING.md).

---

## D-040 Loading and error screens for the event foundation

**Status:** Approved by the technical lead on 2026-10-12 (B1-15 plan).

**Decision.**

- One error screen inside the app shell, `src/app/(app)/error.tsx`, catches failures in any
  signed-in page without its own error screen, including the event layout's access check. The
  sidebar and header stay. Failures of the shell itself (the signed-in check) still reach
  `src/app/error.tsx`. Error screens never show the error message, only the digest as a reference.
- "Try again" on every error screen fetches fresh server data and then resets the screen
  (`useRetry`). Resetting alone only re-rendered in the browser, so a server failure stayed on
  screen. We keep our own small hook rather than Next's `unstable_retry`, so a rename of that
  unstable API cannot silently break the buttons.
- Loading screens live in the `(list)` group or inside `events/[eventId]`, never above the event
  layout: a loading screen there lets the page start with status 200 before the access check, so a
  refused event would lose its real 404 (D-027). A test fails if one is added above it.
- Accessibility and layout were checked in a browser with axe-core used only in the sandbox; it is
  not a project dependency. Results: [QUALITY.md](QUALITY.md).

---

## D-041 Dev-only sample data instead of "No database connected"

**Status:** Approved by the technical lead on 2026-10-12 ("use mock data for now, to visualize").

**Context.** Without Supabase or a database, demo sign-in (D-024) could open the pages but showed
"No database connected" everywhere, so the signed-in side could not be reviewed by hand.

**Decision.**

- When demo sign-in is on **and** `DATABASE_URL` is not set (`isSampleDataMode()`), event data
  comes from an in-memory sample store, `src/modules/events/sample-data.ts`, instead of
  PostgreSQL. Setting `DATABASE_URL` switches it off; nothing else changes.
- The store holds six sample events. The demo user is Owner of three, Coordinator of one and
  Viewer of one, and is not a member of the sixth, so every role and the 404 for non-members can
  be checked by hand. Each event has sample activity.
- Only the data source is swapped, at the same points the database is used: the event list, the
  access check, the activity feed, and create, edit and delete. Pages, sign-in, the access check,
  the permission matrix, validation and the audit registry are the real code. The store repeats
  the database's own rules: members only, role re-checks on writes, stale saves refused, audit
  entries validated with the registry's schemas.
- Create, edit and delete work, in memory only. Everything resets when `npm run dev` restarts.
- The demo banner says "Demo sign-in and sample data are on" and that nothing is saved.
- The "No database connected" notices and the `no-database` result are removed: with demo sign-in
  there is now always data, either sample or real.
- It cannot reach production: it needs `NODE_ENV=development` (only `next dev`) and
  `DEV_DEMO_AUTH=true`, and `next build` refuses that flag (D-024).

**Not a substitute for the database.** Batch work keeps being built and tested against
PostgreSQL (database tests in CI, the browser lifecycle test). New features add their sample data
here only when the technical lead asks for it, so the store does not become a second application.

**Evidence.** `sample-data.test.ts` (members only, roles, stale saves, audit validity, reset), the
updated action, access and activity tests, and a browser walkthrough as Owner, Coordinator, Viewer
and non-member.

---

## D-042 Attendee data model

**Status:** Approved by the technical lead on 2026-10-12 (B2-01 plan).

**Decision.**

- **Scope of B2-01:** the `attendees` table and migration, validation, and create, edit and delete
  server actions with role checks and audit entries. The attendee screens are a later task.
- **Fields:** name (required, up to 120 characters), optional email and phone (format-checked),
  optional category (free text, up to 60), RSVP status, plus-ones, optional dietary needs (up to 500) and notes (up to 2,000), created and updated timestamps.
- **RSVP status:** `PENDING`, `CONFIRMED`, `DECLINED`, `MAYBE` (labels Pending, Confirmed, Declined,
  Maybe). New attendees are `PENDING`.
- **Plus-ones:** a count from 0 to 10 on the attendee, not named records. How plus-ones count toward
  the live attendance count stays open (open item 4).
- **Readable IDs:** `ATT-0001`, numbered per event from `events.lastAttendeeNumber` in the creating
  transaction; never reused.
- **Duplicates:** allowed. Families share emails and two guests can share a name.
- **Belongs to one event:** required `eventId`, deleted with the event (D-004), and
  `@@unique([eventId, id])` so later links to attendees can't cross events (D-002).
- **Who:** Owners and Coordinators add, edit and remove attendees (`attendees.manage`, D-035); every
  member can read them (`event.view`). Writes re-check the role in the database, and an attendee is
  only ever changed through its own event's ID.
- **Edits** refuse stale saves, like event edits (D-032).
- **Audit:** `attendee.created`, `attendee.updated`, `attendee.deleted`, written in the same
  transaction. Email, phone, dietary needs and notes are recorded only as "changed" (docs/AUDIT.md).
- **Sample data (D-041):** has no attendees yet; the actions say so instead of failing.

**Evidence.** `attendees/attendees.db.test.ts` (constraints, cascade, indexes, numbering under
concurrency, roles, cross-event attempts, stale saves, audit), `attendees/schema.test.ts`,
`attendees/actions.test.ts`, `audit/actions.test.ts` and the action authorization guard.

---

## D-043 Adding attendees: page, guest list and sample guests

**Status:** Approved by the technical lead on 2026-10-12 (B2-02 plan).

**Decision.**

- **Add attendee** is its own page, `/events/<id>/attendees/new`, like New event. Owners and
  Coordinators get the form; Viewers get "You don't have access", even from a typed URL; non-members
  get the usual 404. The action authorizes again (D-036), so the page is never the check.
- **After saving** the user returns to the guest list, which confirms "Attendee added: <name> is on
  the guest list as ATT-0001". Only a well-formed reference is read from the URL, and the name
  comes from the stored attendee, never from the URL.
- **The guest list** (`/events/<id>/attendees`) is a simple read-only table for every member: ID,
  name, RSVP (text and icon, not colour alone), plus-ones and category, by name, with an empty state.
  Search, filters, sorting, editing and removing are their own tasks.
- **Sample data (D-041)** now includes guests in the Owner, Coordinator and Viewer sample events (the
  Reyes Family Reunion stays empty to show the empty state). Adding works in memory with the same
  rules; editing and removing in sample data wait for their screens.
- **Client components** must not import values from a context's `public.ts` that also exports server
  code. The attendee form therefore uses the attendees context's own RSVP list; a test keeps it equal
  to the audit registry's copy and the database enum.

**Evidence.** Component, page and action tests; `attendees/create-flow.db.test.ts` (the real action
against PostgreSQL: saved to the current event, listed, in Activity; Viewer, non-member, forged
event ID, invalid data and signed-out all refused); a browser check with sample data at 375 and
1280 px (axe clean, keyboard submit, no sideways scroll).

---

## D-044 Editing attendees

**Status:** Approved by the technical lead on 2026-10-12 (B2-03 plan).

**Decision.**

- **Edit page** at `/events/<id>/attendees/<attendeeId>/edit`, reached from the attendee's name in
  the guest list. Names are links only for Owners and Coordinators (`attendees.manage`); Viewers see
  plain names and get "You don't have access" from a typed URL; non-members get the event 404.
- **The form** is the Add form with the stored values loaded; all eight fields can be changed. It
  sends the stored version, so a save after someone else's is refused as stale (D-032).
- **After saving** the user returns to the guest list with "Changes saved: <name> (ATT-0001) is up
  to date". If nothing changed, the form says "No changes to save" and records nothing.
- **Correct event:** the attendee is loaded and saved only inside the authorized event; another
  event's attendee, an unknown ID and a malformed ID are all "not found".
- **Not-found status:** the event's loading screen (D-040) starts the response before the attendee
  is looked up, so these not-found pages are sent with HTTP 200, marked `noindex`. They look the
  same and reveal nothing for every case. A refused event still gets a real 404 (checked in the
  event layout). Getting a 404 here would mean moving the loading screen, which is a separate
  decision.
- **No unsaved-changes warning**, like event Settings; a warning would be a shared pattern for all
  forms, added in its own task.
- **Audit:** `attendee.updated`, unchanged from D-042.
- **Sample data (D-041):** editing works in memory with the same checks and an Activity entry.

**Evidence.** Form edit-mode, page, action and read tests; `attendees/edit-flow.db.test.ts` (load,
save all fields, list, Activity wording without personal values, Viewer, non-member, another
event's attendee, invalid data, no-change and stale saves); a browser check with two tabs (stale)
and at 375 and 1280 px.

---

## D-045 Removing attendees

**Status:** Approved by the technical lead on 2026-10-12 (B2-04 plan).

**Decision.**

- **Permanent delete**, as D-042 set out: the attendee row and its personal data are removed. Only
  the `attendee.deleted` audit entry keeps the number and name. Numbers are never reused.
- **Where:** a "Remove attendee" section below the edit form (Owners and Coordinators only).
  Viewers never see it, and the server refuses them anyway (`attendees.manage`).
- **Confirmation:** the shared confirmation dialog, starting on Cancel: "Maria Santos (ATT-0003)
  will be removed from the guest list. You can't undo this." One click confirms; no typed
  confirmation (unlike deleting a whole event, D-033). Cancel and Escape remove nothing. The shared
  dialog does not close on a click outside it, and its busy label is "Working…".
- **After removing:** the guest list confirms "Attendee removed: ATT-0003 is no longer on the guest
  list". Only the well-formed number is read from the URL; the name is not shown, because the record
  is gone and a name in the URL can't be trusted.
- **Related records:** none link to attendees yet. When accessibility requirements arrive, their
  delete behaviour is decided with them (D-002).
- **Sample data (D-041):** removing works in memory with the same rules; sample numbers are never
  reused either.

**Evidence.** Dialog component tests (no removal without confirming, Cancel, Escape, working state,
error inside the dialog); action and page tests; `attendees/delete-flow.db.test.ts` (Owner and
Coordinator remove; gone from the list and the edit page; Activity; Viewer, non-member, signed-out,
lowered role and another event's attendee refused; second removal; numbers not reused); a browser
check at 375 and 1280 px.

---

## D-046 Plus-ones: a count, and the expected headcount rule

**Status:** Approved by the technical lead on 2026-10-13 (B2-05 plan). Recorded in DATA_MODEL.md
before implementation.

**Decision.**

- **Representation (confirms D-042):** plus-ones are a count from 0 to 10 on the attendee, not a
  yes/no flag and not separate guest records. 0 means no plus-one; setting it to 0 removes them.
- **Expected headcount from the guest list:** each `CONFIRMED` attendee counts as 1 + their
  plus-ones. `PENDING` and `MAYBE` attendees are shown separately as "not yet confirmed" (1 +
  plus-ones each) and do not count. `DECLINED` attendees count 0, plus-ones included. Calculated on
  demand by one pure function, never stored.
- **Separate from the planning number:** `events.expectedAttendees` is not changed by the guest
  list. Comparing the two belongs to Impact and Event Health.
- **Live attendance is not decided here:** how plus-ones count when guests arrive is decided with
  the Live Attendance Count task (open item 4 stays open for that part only).

**Alternatives not chosen.** A yes/no flag can't record a family of four. Separate guest records
need a new table and linking rules for little gain now. Counting Pending and Maybe, or counting
Maybe as half, would overstate or invent attendance.

---

## D-047 Dietary needs: one free-text entry, visible to every member

**Status:** Approved by the technical lead on 2026-10-13 (B2-06 plan, options 1a, 2a and 3).

**Decision.**

- **Representation (confirms D-042):** dietary needs stay one optional free-text field on the
  attendee (`dietaryNeeds`, up to 500 characters). Several needs go in the same entry, separated by
  semicolons, for example "Vegetarian; no nuts; halal". No fixed list, no separate table.
- **Removing:** clearing the field and saving removes them (stored as NULL). There is no separate
  remove action. Activity records only "Dietary needs changed", never the old or new text (D-042,
  AUDIT.md).
- **Who sees them:** a new permission row, `attendees.dietary`, allows Owner, Coordinator and
  Viewer. Every member sees a Dietary needs column on the guest list; only `attendees.manage` can
  change them. The server loads the field only for roles with `attendees.dietary`, so narrowing it
  later (for example to Owners and Coordinators) is a change to that one row.
- **Guest list loads less:** the guest-list read now selects only the columns the list shows (ID,
  name, RSVP, plus-ones, category and, when allowed, dietary needs). Email, phone and notes are
  loaded only by the edit form, which needs `attendees.manage`.
- **Empty is not "none":** an empty entry shows a dash, read to screen readers as "Not recorded",
  so it is not mistaken for "no restrictions".

**Alternatives not chosen.** A fixed list with "Other" (1b) would allow catering counts but needs a
new table and migration, and no acceptance criterion asks for counts. Limiting visibility to Owners
and Coordinators (2b) keeps possibly sensitive information (health or religion) to fewer people, but
a caterer or client added as a Viewer could not see what they need to plan meals.

**Not decided here.** Catering counts or a breakdown by need; whether accessibility requirements
(the brand book lists dietary requirements among them) read this field; dietary needs in CSV export
and import. Those tasks must follow the `attendees.dietary` row.

---

## D-048 Attendee notes and the attendee details page

**Status:** Approved by the technical lead on 2026-10-13 (B2-07 plan, options 1a, 2a and 3a).

**Decision.**

- **Representation (confirms D-042):** notes stay one optional free-text field on the attendee
  (`notes`, up to 2,000 characters, line breaks kept). Clearing it and saving removes them (NULL).
  No notes log, no author or date per note. Activity records only "Notes changed".
- **Attendee details page:** `/events/<id>/attendees/<attendeeId>`, read-only, opened from the
  name on the guest list by every member (`event.view`). It shows the readable ID, name, RSVP,
  plus-ones and category, dietary needs with `attendees.dietary`, and email, phone and notes with
  `attendees.private`. Owners and Coordinators also get "Edit attendee". An unknown, malformed or
  other event's attendee is not found, as on the edit page (D-044).
- **Who sees notes and contact details:** a new permission row, `attendees.private`, allows Owner
  and Coordinator. The details read loads email, phone and notes only for roles with it, so a
  Viewer's page never receives them; the page tells Viewers who can see them. The edit form
  (`attendees.manage`) still loads every field. This refines D-047's note that only the edit form
  loads them.
- **Display:** values are rendered as text, never HTML; notes keep their line breaks; an empty
  field shows a dash ("Not recorded" for screen readers) and empty notes say "No notes."

**Alternatives not chosen.** A notes log (1b) needs a new table and rules for editing other
people's notes. Using the edit form as the details view (2b) leaves Viewers with no way to open an
attendee. Showing notes to every member (3b) exposes guest-specific remarks (health, family,
security) to read-only users such as clients or suppliers.

**Not decided here.** Notes in CSV export (must follow `attendees.private`), searching notes, and
notes on plus-ones (they belong to the attendee, D-046).

---

## D-049 RSVP states, changes and the guest-list RSVP filter

**Status:** Approved by the technical lead on 2026-10-13 (B2-08 plan, options 1a, 2a and 3a).

**Decision.**

- **States (confirms D-042):** `PENDING` (no reply yet, the default), `CONFIRMED` (coming), `MAYBE`
  (replied, unsure) and `DECLINED` (not coming). The database enum, the form schema and the audit
  registry hold the same list; a test keeps them equal.
- **Changes:** any state may change to any other, by roles with `attendees.manage`, through the
  attendee form. A save that doesn't change the state records nothing. Each change is recorded in
  Activity as "RSVP: <from> → <to>".
- **Counting:** the expected headcount rule is D-046 (only Confirmed counts, as 1 + plus-ones).
- **Filter:** the guest list can be filtered to one state at a time with links above the table
  ("All (8) · Confirmed (4) · Pending (2) · Maybe (1) · Declined (1)"). The choice lives in the
  address (`?rsvp=confirmed`); an unknown value means no filter and never reaches the database. The
  page filters the guest list it has already authorized, so the filter can't show more than the
  role may see. The headcount summary always covers the whole guest list.
- **Scope:** name search, other filters and sorting stay with the backlog item "Search, filter,
  sort guest list", which may move filtering into the database query.

**Alternatives not chosen.** Restricting changes (1b) adds friction without a business rule behind
it. Choosing several states at once (2b) belongs with the full search and filter task. A headcount
that follows the filter (3b) would misstate the event's figure.

---

## D-050 Guest list search, filters and sorting

**Status:** Approved by the technical lead on 2026-10-13 (B2-10, B2-11 and B2-12 plan, options 0a,
1a, 2a, 3a and 4a). Built together as one change.

**Decision.**

- **Where:** the guest list page applies pure functions (`attendees/guest-list-query.ts`) to the
  guest list the server already authorized for the reader's role. Search, filters and sorting can
  therefore never show another event's attendees or a field the role doesn't receive, and they never
  change stored data. Sample data and the database behave the same. Moving this into the database
  query belongs with pagination.
- **Address:** every choice is in the address (`q`, `rsvp`, `category`, `dietary`, `plusones`,
  `sort`, `dir`), set by a plain GET form and the RSVP links, so it works without JavaScript and can
  be bookmarked. Unknown values are ignored. The search is cut to 100 characters.
- **Search (B2-10):** name (partial, ignoring case and accents) and attendee ID ("ATT-0008", "att8"
  or "8" find number 8 exactly) for every member. Email (partial) and phone (digits, at least 3)
  only for roles with `attendees.private`: the guest-list read now loads email and phone for those
  roles only, so a Viewer's rows don't carry them and can't match. Notes are never loaded for the
  list. This refines D-047's "the guest list loads only the columns it shows".
- **Filters (B2-11):** RSVP (D-049), Category (from this event's categories, ignoring case),
  Dietary needs recorded or not (only with `attendees.dietary`; blank counts as not recorded), and
  Plus-ones bringing or none. One value each; all combined with AND. "Clear all" resets search,
  filters and sort. The RSVP counts and the headcount summary always cover the whole guest list.
- **Sorting (B2-12):** Name (default), ID (order added), RSVP (Confirmed, Pending, Maybe,
  Declined), Plus-ones and Category, ascending or descending. Ties: name, then ID, always ascending.
  Attendees without a category come last in both directions. The sorted column header carries
  `aria-sort` and the table caption names the sort.
- **Empty result:** "No attendees match" lists the active search and filters and offers "Clear
  search and filters"; an RSVP-only empty result keeps D-049's "No Maybe attendees".

**Alternatives not chosen.** Three separate deliveries (0b) would rework the same files three
times. Name and ID search only (1b). RSVP and category filters only (2b). Database-side search
(3b) needs the `unaccent` extension and a migration. Clickable column headers (4b) are awkward in a
table that scrolls sideways on phones.

**Not in this change:** pagination, saved filters, filtering by notes or contact details, search as
you type, and exporting a filtered list.

---

## D-051 Attendee details page as independent sections

**Status:** Approved by the technical lead on 2026-10-13 (B2-13 plan).

**Decision.**

- The attendee details page (`/events/<id>/attendees/<attendeeId>`, D-048) is a list of
  independent sections, in order: Details, Notes, and from Batch 3 Accessibility.
- Each section gets its data from its own module's public read and decides what the role may see
  there. The attendees module provides `AttendeeDetailsSection` and `AttendeeNotesSection`; Batch 3
  adds an accessibility section and read in `modules/accessibility`, authorized the same way
  (`authorizeEvent`, then the attendee found only inside the event). No accessibility data, rules or
  queries go into the attendees module, and the attendees read is not widened for it.
- Sections share one frame, `components/shared/DetailSection` (a region named by its level-2
  heading), so another module can add a section without importing attendee UI.
- Nothing for accessibility is shown until Batch 3.

---

## D-052 CSV import: steps, validation, duplicates and policy

**Status:** Approved by the technical lead on 2026-10-13 (B2-14 to B2-18 plan, options 1a to 4a).
Built as one change.

**Decision.**

- **Steps:** upload → map columns → preview → confirm → result, on the event's Import page, for
  `import.run` (Owner, Coordinator). Nothing is stored before confirming: no attendees, no Activity
  entry and no uploaded file. The file text travels with the form; the server re-parses and
  re-checks it at every step and trusts nothing else the browser sends.
- **Parser:** our own RFC 4180 parser (`attendees/csv.ts`), no new dependency. Limits: 500 KB (so
  every step stays under the default 1 MB request size), 2,000 rows, 50 columns, 5,000 characters
  per value. UTF-8 only.
- **Mapping:** each column goes to one attendee field (Name, Email, Phone, RSVP, Plus-ones,
  Category, Dietary needs, Notes) or "Don't import". Name is required; each field at most once;
  unknown fields are refused. Common header names are suggested from a fixed list (not AI);
  EventOps' own export headers map back automatically. Unmapped columns are listed and ignored.
- **Validation:** every row goes through the add form's schema, so imported data follows the same
  rules (D-042). RSVP accepts the four states and a fixed list of words, ignoring case: yes,
  attending, going → Confirmed; no, not attending, regrets → Declined; tentative, unsure → Maybe;
  empty → Pending. Anything else, including a value with no letters such as "1", marks the row as
  needing correction. Plus-ones: empty → 0, otherwise 0 to 10.
- **Duplicates:** a row is a possible duplicate when an existing attendee or an earlier row in the
  file has the same name (ignoring case and accents) and the same email when both have one.
  Possible duplicates are skipped unless the user ticks "Import possible duplicates anyway".
- **Policy:** valid rows are imported; rows needing correction are not (they can be downloaded,
  fixed and imported later). There is no editing of cells in the app. The import is one
  transaction: all chosen rows or none. At confirm the server recomputes the preview; if the number
  to import differs from what the user saw (for example the guest list changed), nothing is
  imported and the new preview is shown.
- **Numbers and Activity:** new attendees continue the event's ATT numbers, in file order. One
  Activity entry per import (`attendees.imported`: count, first and last ID, rows not imported),
  never names.
- **Sample data:** the same steps work with sample data (D-041).

**Alternatives not chosen.** `papaparse` (1b) is a new dependency for what a tested parser of
about 100 lines does. Exact state names only (2b) would reject most real spreadsheets. Warning
about duplicates but importing them (3b) doubles a guest list imported twice. Blocking until every
row is valid (4b) holds back hundreds of good rows for one typo.

**Not in this change:** AI import, Excel (.xlsx) files, editing cells in the app, updating
existing attendees from a file, and import history beyond Activity.

---

## D-053 CSV export of the guest list

**Status:** Approved by the technical lead on 2026-10-13 (B2-19 plan, option 5a).

**Decision.**

- **Address:** `GET /api/events/<eventId>/attendees/export`, replacing the B0-10 placeholder at
  `/api/attendees/export` (which named no event). Authorized with `authorizeEventRequest(eventId,
"attendees.export")`: Owner and Coordinator. 401 signed out, 404 for unknown events, malformed
  IDs and non-members (never revealing which), 403 for Viewers. The query filters by the
  authorized event only.
- **Contents:** ID, Name, RSVP (in words), Plus-ones, Category, Dietary needs, Email, Phone, Notes,
  in ID order: every attendee field. Exporting roles already see all of them (`attendees.private`,
  `attendees.dietary`). The headers are the ones the import understands, so a file can be imported
  again.
- **Format:** UTF-8 with a byte-order mark (Excel shows accents correctly), CRLF line ends, RFC 4180
  quoting. Cells starting with `=`, `+`, `-`, `@`, tab or carriage return get a leading apostrophe
  so spreadsheets never run them (this also prefixes phone numbers like `+63…`). An empty guest list
  gives the header row only.
- **Download:** `Content-Disposition: attachment` with a file name like
  `EVT-2026-0001-attendees-2026-10-13.csv` (Manila date), `Cache-Control: no-store`,
  `X-Content-Type-Options: nosniff`. The guest list shows "Export CSV" to roles that may export:
  a real link, which with JavaScript downloads in the background and then confirms the file and
  count, or shows the server's message if the export fails (B2-22).
  It exports the whole guest list, not the current search or filter.
- **Activity:** each successful export is recorded in the same transaction as the read:
  `attendees.exported` with the count only, shown as "Exported the guest list as CSV (12
  attendees)". Refused attempts record nothing.

**Alternatives not chosen.** Leaving notes out (5b) would make the file incomplete for the roles
that already see notes, and break the import round trip.

**Note.** The export is a GET with a side effect (the Activity entry). A cross-site page could
start a download in a signed-in browser (SameSite=Lax cookies allow top-level GETs), but it can't
read the file; the only effect is an extra Activity entry.

---

## D-054 CI green: placeholder tests and knip scope

**Status:** Approved by the technical lead on 2026-10-13 (B2-20 plan, option 1a).

**Decision.**

- The seven empty test files from the scaffold (D-019) each hold one `it.todo` naming the feature
  whose task writes the real tests. Vitest reports them as to-do; `npm test` passes. No test was
  deleted.
- `knip.json` ignores the scaffold folders and files of features not built yet (listed one by one,
  so built code stays checked), allows `vite` (the `vite/client` type reference used by
  `access-coverage.test.tsx`, installed with Vitest), and ignores exports used in their own file.
  When a feature is built, its entry is removed from the list.
- Public interfaces export only what is used: unused re-exports were removed from the attendees
  and audit `public.ts` files. The events context's shared types are kept and marked `@public`.

**Why.** CI's check job was red on these scaffold files, so it couldn't show whether new work
broke anything.

---

## D-055 Browser lifecycle tests run in CI

**Status:** Approved by the technical lead on 2026-10-13 (B2-24 plan, option 2a).

**Decision.** CI has a third job, `e2e`: a PostgreSQL 17 service, `prisma migrate deploy` into a
database named `eventops_e2e`, `npx playwright install --with-deps chromium`, then
`npm run test:e2e:lifecycle` (the event lifecycle and the attendee flow). The app runs with
dev-only demo sign-in (D-024) and placeholder Supabase values, which demo sign-in never uses. On a
failure the Playwright report and traces are kept for 7 days. No new package: Playwright is already
a dev dependency; the job only downloads its Chromium.

**Why.** B2-24 requires the end-to-end flow to run in CI, and the lifecycle tests were local only.

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
   Since D-042, plus-ones are stored as a count (0 to 10) on each attendee, and D-046 set the
   expected headcount rule. Still open: how plus-ones count in the live attendance count on event
   day (decide with that task).
5. **Commit type for security work.** PROJECT_RULES section 17 suggests `security(B4-19): ...`, but
   `commitlint.config.mjs` follows the hackathon convention and rejects the `security` type.
6. **Payment status rule.** See D-003, "Not decided yet".
7. ~~**Permission matrix.**~~ Resolved by D-035 (see PERMISSIONS.md).
8. ~~**Last owner.**~~ Resolved at the data level by D-022: the database blocks removing, demoting or
   deleting an event's last `OWNER`.
9. **Event status changes.** D-035 lets Owners and Coordinators change status (`event.status`),
   but which changes are allowed (for example Completed back to Draft, or leaving Cancelled) is not
   decided, so there is no status control yet. Found while closing B1-10; needs its own task.
10. ~~**Errors inside an event lose the app shell.**~~ Resolved by D-040 (B1-15): an error screen
    inside the shell.