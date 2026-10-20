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
| D-056 | Accessibility data model                                    | Approved | 2026-10-13 |
| D-057 | Accessibility requirement and resource definitions          | Approved | 2026-10-13 |
| D-058 | Who sees accessibility requirements                         | Approved | 2026-10-13 |
| D-059 | Managing accessibility requirements and their Activity      | Approved | 2026-10-13 |
| D-060 | Accessibility needs on the attendee page                    | Approved | 2026-10-13 |
| D-061 | Managing event accessibility resources                      | Approved | 2026-10-13 |
| D-062 | Accessibility readiness rules                               | Approved | 2026-10-13 |
| D-063 | Accessibility readiness status                              | Approved | 2026-10-13 |
| D-064 | Accessibility gap detection                                 | Approved | 2026-10-13 |
| D-065 | Accessibility readiness view                                | Approved | 2026-10-13 |
| D-066 | Accessibility alerts                                        | Approved | 2026-10-13 |
| D-067 | Batch 3 verification approach                               | Approved | 2026-10-14 |
| D-068 | Supplier data model                                         | Approved | 2026-10-14 |
| D-069 | Supplier categories                                         | Approved | 2026-10-14 |
| D-070 | Adding suppliers and the supplier list                      | Approved | 2026-10-14 |
| D-071 | Editing suppliers                                           | Approved | 2026-10-14 |
| D-072 | Removing suppliers and what happens to their records        | Approved | 2026-10-14 |
| D-073 | Supplier contact details                                    | Approved | 2026-10-14 |
| D-074 | Supplier detail page                                        | Approved | 2026-10-14 |
| D-075 | Supplier quotes and money                                   | Approved | 2026-10-14 |
| D-076 | Quote statuses and lifecycle                                | Approved | 2026-10-14 |
| D-077 | Supplier payment records                                    | Approved | 2026-10-14 |
| D-078 | Supplier payment status                                     | Approved | 2026-10-14 |
| D-079 | Payment due dates and overdue                               | Approved | 2026-10-14 |
| D-080 | Managing supplier payments                                  | Approved | 2026-10-14 |
| D-081 | The supplier list                                           | Approved | 2026-10-14 |
| D-082 | Supplier search                                             | Approved | 2026-10-14 |
| D-083 | Supplier filters                                            | Approved | 2026-10-14 |
| D-084 | Budget categories and allocations                           | Approved | 2026-10-16 |
| D-085 | Budget items                                                | Approved | 2026-10-16 |
| D-086 | Estimated, committed and paid totals                        | Approved | 2026-10-16 |
| D-087 | Total allocated                                             | Approved | 2026-10-16 |
| D-088 | Remaining budget and over-budget                            | Approved | 2026-10-16 |
| D-089 | Linking a budget item to a supplier (implements D-003)      | Approved | 2026-10-16 |
| D-090 | Over-budget warning                                         | Approved | 2026-10-16 |
| D-091 | Budget data is scoped to one event                          | Approved | 2026-10-16 |
| D-092 | Budget authorization and validation checkpoint              | Proposed | 2026-10-16 |
| D-093 | Budget activity wording, states and responsive layout       | Proposed | 2026-10-16 |
| D-094 | Tasks: creating and editing                                 | Proposed | 2026-10-17 |
| D-095 | Tasks: deleting, assigning and priority                     | Proposed | 2026-10-17 |
| D-096 | Tasks: status and due date                                  | Proposed | 2026-10-18 |
| D-097 | Tasks: the list and its filters                             | Proposed | 2026-10-18 |
| D-098 | Tasks: overdue detection                                    | Proposed | 2026-10-19 |
| D-099 | Tasks: event scope and authorization, verified              | Proposed | 2026-10-19 |
| D-100 | Tasks: validation, audit, states and phone layout, verified | Proposed | 2026-10-19 |

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
  _Amended 2026-10-14 by D-077 (approved):_ payment rows also record payments that are scheduled
  but not paid yet, so paid = the sum of the rows recorded as Paid.
- **Committed** to a supplier = `quoteAmount` while `quoteStatus` is `ACCEPTED`, otherwise zero.
  _Amended 2026-10-14 by D-075 (approved):_ quotes are their own rows, a supplier can have several
  and at most one is Accepted, so committed = the amount of the supplier's Accepted quote, otherwise
  zero. The meaning is unchanged.
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

**Decided 2026-10-14 by D-078 (approved).** The rule below is now defined; D-078 records it.

**Not decided yet (before D-078).** The exact rule that maps a paid amount to a status (for example unpaid,
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

## D-056 Accessibility data model

**Status:** Approved by the technical lead on 2026-10-13 (B3-01 to B3-05 plan, options 1a, 2a, 3a,
4b, 5a and sample data).

**Decision.**

- **Two tables, two meanings.** `accessibility_requirements` holds what an attendee needs;
  `accessibility_resources` holds what the event provides. Neither changes an existing table.
- **Requirements belong to an attendee** through a composite foreign key on `(eventId,
attendeeId)` to `attendees (eventId, id)` (D-002), so the database refuses a requirement that
  points at another event's attendee. They are deleted with the attendee (D-045) and the event
  (D-004).
- **Several needs, one row each (3a).** At most one requirement of each type per attendee
  (unique `(eventId, attendeeId, type)`). A requirement has a priority and an optional note of up to
  500 characters; an `OTHER` requirement must have a note (CHECK).
- **Resources (5a):** at most one row per type per event (unique `(eventId, type)`), with a status
  (`NOT_AVAILABLE`, `ARRANGING`, `AVAILABLE`) and an optional note. Accessible seats also have a
  count of 0 or more, and no other type has one (CHECK). No row means "Not set up".
- **Timestamps:** `createdAt`, and `updatedAt` as the edit version for stale-save checks (D-032).
- **Indexes:** the two unique keys above, `(eventId, id)` on both tables for later composite links,
  and `(eventId, type)` on requirements for counting needs across the event.
- **Not modelled:** seating assignment, transport and volunteer needs (Tier 2 and 3), readiness
  results (computed, never stored), and dietary needs (stay on the attendee, D-047).

**Migration.** `20261013120000_accessibility`. The Prisma schema engine could not be downloaded
where it was written, so its generated part was written by hand in the engine's format and checked
against PostgreSQL 16; CI's `prisma migrate deploy` and `prisma migrate status` are its first real
Prisma run.

**Evidence.** `accessibility/accessibility-tables.db.test.ts` (several needs, one per type,
cross-event link refused, CHECKs, cascades with attendee and event, indexes, timestamps);
`delete-event.db.test.ts` (every foreign key to `events` cascades); `db.db.test.ts` (expected
tables).

---

## D-057 Accessibility requirement and resource definitions

**Status:** Approved by the technical lead on 2026-10-13 (B3-02, options 1a and 2a).

**Decision.**

- **One canonical source.** `accessibility/domain/requirement-type.ts` defines the requirement
  types and priorities; `accessibility/domain/resource.ts` defines the resource types and
  statuses. Each value has a label and a one-sentence description. Forms, server validation, pages
  and the Activity feed use these; the database enums and the audit registry's copies are kept
  equal by tests.
- **Types (1a):** Mobility assistance, Accessible seating, Step-free entry, Accessible restroom,
  Sign-language interpretation, Captioning and Other (the note must say what is needed). Dietary
  needs stay on the attendee (D-047); volunteer accommodation waits for volunteers (Tier 2).
- **Priority per requirement (2a):** Required (the default; readiness counts it), Preferred (shown,
  never makes the event "not ready"), For information (context for staff, never counted).
- **Resources (5a):** Accessible seats (with a count), Accessible entrance, Ramp or elevator,
  Accessible restroom, Captioning, Sign-language interpreter. Status Not available, Being arranged
  or Available; no record means Not set up.
- **Validation:** `accessibility/schema.ts` (Zod), used by both the forms and the server actions.
  Invalid types, priorities and statuses are refused with a plain message; limits match the
  database (note 500, seats 0 to 10,000; the seat maximum is a sanity limit).
- **Wording:** labels describe the need, not the person ("Accessible seating", not "disabled
  guest").

**Not decided here.** How resources satisfy requirements and how readiness is calculated: the
readiness task.

**Evidence.** `accessibility/definitions.test.ts` (lists equal to the database enums),
`accessibility/domain/definitions.test.ts` (every value defined, change helpers) and
`accessibility/schema.test.ts` (valid and invalid input).

---

## D-058 Who sees accessibility requirements

**Status:** Approved by the technical lead on 2026-10-13 (B3-03, option 4b). Adds one row to the
permission matrix (D-035).

**Context.** An accessibility requirement's type tells staff what to arrange; its note can hold
health details ("Uses a power wheelchair", "Epilepsy: avoid strobe lights"). Viewers are often
clients, venues or caterers.

**Decision.**

- **Every member** (event.view) sees an attendee's requirement types and priorities, so a venue or
  caterer added as a Viewer can plan.
- **Notes need `accessibility.private`**, a new permission row for Owner and Coordinator. Reads
  load the note only for roles with it, so a Viewer's page never receives it; the page says who can
  see notes.
- **Changes need `accessibility.manage`** (Owner, Coordinator, unchanged from D-035).

**Alternatives not chosen.** Everything to every member (4a) exposes health details to read-only
users. Owners and Coordinators only (4c) hides what venues and caterers need to plan.

**Evidence.** `permissions.test.ts` (code equals PERMISSIONS.md); `accessibility/authorization.db.test.ts`
(the Viewer reads needs but never notes, and the response never contains the note text).

---

## D-059 Managing accessibility requirements and their Activity

**Status:** Approved by the technical lead on 2026-10-13 (B3-03, plan item 6).

**Decision.**

- **Add, edit, remove** an attendee's requirements through server actions that authorize first with
  `authorizeEvent(eventId, "accessibility.manage")` (D-036) and validate with the shared schema
  (D-057). The repository re-checks the role in the same statement as each write, finds the attendee
  and requirement only inside the authorized event and for that attendee, and refuses a second
  requirement of the same type (also enforced by the unique key, so two requests at once can't both
  succeed).
- **Edits** refuse stale saves (D-032). A save that changes nothing writes and records nothing.
- **Remove** is permanent, behind the shared confirmation dialog.
- **Activity:** `accessibility_requirement.created` (attendee ID, type, priority),
  `.updated` (type and priority old → new, note as "changed"), `.deleted` (attendee ID, type). Never
  the note or the attendee's name. Removing an attendee removes their requirements without separate
  entries (`attendee.deleted` covers it).
- **Architecture (D-001):** use cases in `accessibility/application/`, storage behind the
  `AccessibilityRepository` port, implemented with Prisma and with the dev-only sample store
  (D-041), chosen in `composition.ts`. The audit registry keeps its own copy of the requirement
  lists and labels; a test keeps them equal.

**Evidence.** `accessibility/requirements.db.test.ts` (save, list order, notes not loaded, duplicates
including concurrent, stale, unchanged, refused roles and events, cascade with the attendee);
`accessibility/authorization.db.test.ts` (seven callers × seven operations through the real actions
and reads, refusals change nothing); `accessibility/audit.test.ts`; `action-coverage.test.ts`.

---

## D-060 Accessibility needs on the attendee page

**Status:** Approved by the technical lead on 2026-10-13 (B3-04, plan item 7).

**Decision.**

- **Where:** an Accessibility section on the attendee details page, after Details and Notes (D-051),
  from the accessibility module's own read. Every member sees it, so needs are visible without
  leaving the attendee. Each need shows its label, its priority in words (never colour alone) and,
  for roles with `accessibility.private`, its note; Viewers are told who can see notes.
- **Add** at `/events/<id>/attendees/<attendeeId>/accessibility/new` and **edit** at
  `…/accessibility/<requirementId>/edit`, with **Remove** below the edit form behind the shared
  confirmation dialog. Plain forms: they work without JavaScript. Viewers get "You don't have
  access" without anything being loaded; unknown IDs or other attendees' and events' needs are
  "not found".
- **Form:** two radio groups (fieldset and legend) built from the canonical definitions, each choice
  with its description linked by `aria-describedby` (the accessible name is only the choice);
  types the guest already has are shown as "(already added)" and disabled; Required is chosen by
  default; a note field that says who can see it. Errors are listed in the summary and next to the
  field, from the server.
- **After a change:** back to the details page with a dismissible notice. Only a known notice kind
  and a known need type are read from the address; the label comes from the definitions.
- **States:** the event's loading screen covers loading; an empty state says nothing is recorded
  (with "Add accessibility need" for managers); a failed read shows an error inside the section and
  keeps the rest of the page; "every listed need is already recorded" on the add page.
- **Words:** "accessibility need" on screen; labels name the need, never the person.

**Found while building.** A constant exported from a `"use client"` file reaches server code only
as a client reference, so the notice list lives in a plain module (`accessibility/notices.ts`).

**Evidence.** `accessibility/ui/*.test.tsx`, `attendees/[attendeeId]/accessibility/pages.test.tsx`,
the updated section-order test in `attendees/page.test.tsx`, and
`e2e/lifecycle/accessibility-flow.spec.ts` (keyboard choice, add, edit, remove, Activity).

---

## D-061 Managing event accessibility resources

**Status:** Approved by the technical lead on 2026-10-13 (B3-05, option 5a).

**Decision.**

- **Where:** the event's Accessibility page (`/events/<id>/accessibility`) lists all six resource
  types in definition order, each with its status in words and an icon (never colour alone), the
  seat count for accessible seats, and any note. Every member sees the whole list: resources
  describe the venue, not a person. Types with no record show "Not set up".
- **Set up, edit, remove** at `/events/<id>/accessibility/<resource>/edit` (for example
  `accessible-seats`), for Owners and Coordinators (`accessibility.manage`). The type comes from
  the address, is checked against the six, and is bound to the server action; it is never read
  from the form. A form opened while the type was "Not set up" creates it and never overwrites one
  set up meanwhile; an edit refuses stale saves (D-032) and records nothing when nothing changed.
  Remove is permanent behind the shared confirmation dialog, and the type shows as "Not set up"
  again.
- **Minimum for readiness:** per type, a status; for accessible seats, a count. This is what the
  readiness task will compare with attendees' requirements; that comparison is not built here.
- **Activity:** `accessibility_resource.created` (type, status, seat count), `.updated` (status and
  seat count old → new, note as "changed"), `.deleted` (type).
- **Viewers** get "You don't have access" on the form page without anything being loaded, and the
  server actions refuse them.

**Evidence.** `accessibility/resources.db.test.ts` (set up, concurrent set-up, edit, stale,
unchanged, refused roles and events, remove, list order); the resource matrix in
`accessibility/authorization.db.test.ts` (five callers × five operations, unknown types refused);
`accessibility/audit.test.ts`; `accessibility/ui/Resource*.test.tsx`;
`accessibility/pages.test.tsx`; step 5 of `e2e/lifecycle/accessibility-flow.spec.ts`.

---

## D-062 Accessibility readiness rules

**Status:** Approved by the technical lead on 2026-10-13 (B3-06 to B3-10 plan, options 1a, 2a, 3a
and 6a). Written in DATA_MODEL.md ("Accessibility readiness") before implementation.

**Decision.**

- **Deterministic and pure.** `accessibility/domain/readiness.ts` takes the event's requirements
  (type, priority, guest number, name and RSVP; never notes) and resources (type, status, seat
  count) and returns, for every requirement, whether it decides readiness, is advice or is left
  out, which resources it depends on, and whether it is covered, being arranged, missing, short or
  to check by hand. No database, clock, network, AI or permission check; the same input gives the
  same result in the same order. Calculated on demand, never stored.
- **Counting (1a, 2a):** Required needs of guests who haven't declined decide readiness; Preferred
  needs are checked as advice; For information needs and declined guests' needs are left out.
- **Mapping (3a):** see DATA_MODEL.md. Step-free entry and mobility assistance need the
  accessible entrance, plus the ramp or elevator when it has been recorded.
- **Resource states:** Available covers; Being arranged doesn't yet; Not available and Not set up
  are missing. Two dependencies: the worse result.
- **Seats:** Required seating needs are covered only together (seats ≥ Required count), else all
  short; Preferred only after Required.
- **Other (6a):** "check by hand".

**Alternatives not chosen.** Counting Confirmed guests only (2b) could leave a Pending guest
without a seat. Always requiring a ramp (3b) flags single-level venues. Marking some seating needs
covered when seats run short would pick guests arbitrarily.

**Amended 2026-10-13 (B3-14, option 5a).** A requirement with a type or priority outside the
canonical lists is refused as invalid input, like two resources of one type, instead of being
guessed (an unknown priority would otherwise have counted as advice). The database and validation
can't produce one; the guard makes the rule explicit.

**Evidence.** `accessibility/domain/readiness.test.ts`, `accessibility/domain/scenarios.test.ts`.

---

## D-063 Accessibility readiness status

**Status:** Approved by the technical lead on 2026-10-13 (B3-06 to B3-10 plan, option 7a).
Written in DATA_MODEL.md ("Readiness status") before implementation.

**Decision.**

- **Four canonical statuses** in `accessibility/domain/readiness-status.ts`, each with a label, a
  plain description and a severity: No required needs (info), Not ready (critical), Almost ready
  (warning), Ready (success).
- **Derived, never stored.** `readinessStatus(coverage)` reads only the needs that decide (D-062),
  checked in this order: none → No required needs; any missing or short → Not ready; any being
  arranged or to check by hand → Almost ready; otherwise Ready. Preferred needs never change it.
  There is no column and no action to set it.
- **One source for UI and server:** pages and server reads both use the same function and labels.

**Wording.** The plan's label "No needs recorded" became **"No required needs"**, because the status
also applies when only Preferred needs exist; the rule is unchanged.

**Evidence.** `accessibility/domain/readiness-status.test.ts`.

---

## D-064 Accessibility gap detection

**Status:** Approved by the technical lead on 2026-10-13 (B3-06 to B3-10 plan, B3-09 rules).
Written in DATA_MODEL.md ("Gaps") before implementation.

**Decision.**

- **Explicit gaps** from the coverage (D-062), in `accessibility/domain/gaps.ts`: not set up, not
  available, being arranged (one per resource, listing every affected need), not enough seats (one
  for the event, with seats available and Required and Preferred seating needs), and check by hand
  (one per Other need).
- **Each gap names** the affected guests and needs (ID, name, type, priority), the resource and its
  state, the consequence for readiness (`not-ready`, `almost-ready` or `advice`) and a plain
  summary built from the canonical labels.
- **Covered needs never produce a gap**; several gaps coexist; the order is fixed (consequence,
  resource order with check by hand last, first guest number), so the same input gives the same
  gaps.
- **Pure:** no database, clock, AI or permission check. The guest ID text (`ATT-0001`) follows
  D-042's format.

**Evidence.** `accessibility/domain/gaps.test.ts`.

---

## D-065 Accessibility readiness view

**Status:** Approved by the technical lead on 2026-10-13 (B3-06 to B3-10 plan, B3-10 layout).

**Decision.**

- **One page answers the question.** The event's Accessibility page shows, in order: the
  readiness status with its plain meaning and the counts behind it; what's missing (each gap's
  sentence, consequence, affected guests linked to their pages, and for Owners and Coordinators a
  link to set up or edit the resource); what guests need (needs by type, Required and Preferred
  counts, guests linked, and how many are not counted and why); and what the event provides (the
  resources, B3-05).
- **One server read** (`getAccessibilityOverview`, replacing B3-05's resource-only read) authorizes
  with `event.view`, loads the event's requirements (with guest number, name and RSVP, never
  notes) and resources, and runs the domain rules (D-062 to D-064) on every request. Nothing about
  readiness is stored. Every member sees it: need types and guest names are already visible to
  every member (D-058).
- **States:** loading (route loading screen), error (inside the page and the route error
  screen), and empty states that never look like Ready ("No required needs", "Nothing to check
  yet", "No accessibility needs recorded").

**Evidence.** `accessibility/pages.test.tsx`, `accessibility/ui/ReadinessView.test.tsx`,
`accessibility/application/get-readiness.test.ts`, the readiness tests in
`accessibility/requirements.db.test.ts`, the overview row of the resource matrix in
`accessibility/authorization.db.test.ts`, and step 6 of `e2e/lifecycle/accessibility-flow.spec.ts`.

---

## D-066 Accessibility alerts

**Status:** Approved by the technical lead on 2026-10-13 (B3-11 to B3-15 plan, options 1a, 2a, 3a).
Written in DATA_MODEL.md ("Alerts") before implementation.

**Decision.**

- **Derived, not stored.** `accessibility/domain/alerts.ts` turns the readiness status (D-063) and
  the gaps (D-064) into alerts on every read. No table, no notifications, no email or SMS, no
  dismissing or snoozing, no alert history. This is not an alert engine (PROJECT_RULES 2.2); the
  Critical Alert View (Batch 8) can reuse the same function.
- **Which gaps alert.** Gaps that make the event Not ready are critical; gaps that keep it Almost
  ready (being arranged, check by hand) are warnings. Advice from Preferred needs never alerts,
  and a covered need has no gap, so it can never alert.
- **Each alert names its reason**: a headline ("Captioning is not set up"), the gap's sentence and
  what it means for readiness, the resource and the guests it affects.
- **Event-level alert.** While the status is Not ready or Almost ready, one alert for the event
  ("Accessibility: Not ready", "2 issues need attention") on the event Overview, listing up to
  three issues and linking to the Accessibility page.
- **Guest alerts.** The attendee page shows the alerts about that guest, above the Accessibility
  section. Owners and Coordinators get the link to set up or edit the resource; Viewers get a link
  to the Accessibility page.
- **Who sees them.** Every member (`event.view`), like the readiness view (D-065); never a note.
  The read (`getAccessibilityAlerts`) authorizes itself and works inside the authorized event, so
  another event's guest has no alerts.
- **Accessible, not interrupting.** Severity is a word and an icon, never color alone. Alerts are
  part of the page, so they don't use `role="alert"`. A failed read says "We couldn't check
  accessibility alerts" instead of showing nothing.

**Evidence.** `accessibility/domain/alerts.test.ts`, the alert tests in
`src/app/(app)/events/[eventId]/page.test.tsx` and
`attendees/[attendeeId]/accessibility/pages.test.tsx`, the alert rows of
`accessibility/authorization.db.test.ts`, `accessibility/integration.db.test.ts` (B3-15), and step 6
of `e2e/lifecycle/accessibility-flow.spec.ts`.

---

## D-067 Batch 3 verification approach

**Status:** Approved by the technical lead on 2026-10-14 (B3-16 to B3-20 plan, options 1a, 2a, 3a,
4b, 5a).

**Decision.**

- **Browser test data (1a).** The accessibility browser workflow builds its realistic event through
  the app: create the event, import a twelve-guest list with the CSV import, then add needs and
  resources through the pages. No test data is written straight to the database. The only direct
  step is changing the demo user's role, which stands in for member screens that don't exist yet
  (D-034).
- **Accessibility checks (2a).** No new dependency. The screens are scanned with axe-core
  (already installed by ESLint's accessibility plugin) from a script outside the repository, and
  checked by keyboard, with the results recorded in TESTING.md. The scan is not part of CI.
- **Formatting gate (3a).** Every file a batch touches must pass Prettier. The 255 older files that
  don't are recorded as debt, not reformatted in a feature batch.
- **CI evidence (4b).** The batch is pushed as its own branch to the GitHub repository, so CI can
  run the real `prisma migrate deploy` and the full job set; nothing is merged without review.
- **Documentation (5a).** ARCHITECTURE.md starts with the accessibility context.
  ACCEPTANCE_CRITERIA.md is created for Batch 3. The Batch 2 documents recorded as written by B2-25
  but missing from the repository are reported, not recreated.

**Evidence.** `e2e/lifecycle/accessibility-readiness.spec.ts`, TESTING.md (B3-16, B3-17),
ARCHITECTURE.md, ACCEPTANCE_CRITERIA.md.

---

## D-068 Supplier data model

**Status:** Approved by the technical lead on 2026-10-14 (B4-01 to B4-05 plan, options 1a, 3a, 4a).
Written in DATA_MODEL.md ("suppliers") with the migration.

**Decision.**

- **Strictly event-specific (1a).** A supplier belongs to exactly one event and is deleted with it
  (D-004). The same business used for two events is two rows. A directory shared between events
  needs an owner above events, which Tier 1 doesn't have; it belongs in ROADMAP.md.
- **Fields.** Required: name (120) and category (D-069). Optional: contact person (120), email
  (254, stored lower case), phone (32), notes (2,000). `createdAt`, and `updatedAt` as the edit
  version (D-032). Quotes, deposits, payments and due dates are added by later Batch 4 tasks,
  following D-003, not here.
- **Readable ID.** `SUP-0001`, numbered per event from `events.lastSupplierNumber`, incremented in
  the creating transaction and never reused, like attendees (D-042).
- **Duplicates allowed (4a).** Two suppliers in one event may share a name; the number tells them
  apart.
- **Who sees what (3a).** Every member sees every supplier field, including contact details, which
  are business contacts (`event.view`). Changes need `suppliers.manage` (Owner, Coordinator). No
  permission is added.
- **Integrity.** Unique `(eventId, number)`; unique `(eventId, id)` as the target of later composite
  foreign keys (D-002); indexes `(eventId, name)` and `(eventId, category)`; CHECK constraints for a
  non-blank name, a positive number, the category detail and non-blank optional text.

**Evidence.** `suppliers/suppliers-table.db.test.ts`, the expected-tables test in
`src/lib/db.db.test.ts`, and the cascade check in `delete-event.db.test.ts`.

---

## D-069 Supplier categories

**Status:** Approved by the technical lead on 2026-10-14 (B4-01 to B4-05 plan, option 2a, list as
proposed).

**Decision.**

- **Controlled values, not free text (2a).** Thirteen categories in one canonical list
  (`suppliers/categories.ts`), in this order: Venue, Catering, Cake and desserts, Photo and video,
  Sound and lights, Entertainment, Flowers and styling, Hair and makeup, Attire, Rentals,
  Transport, Printing and stationery, Other. Stored as the database enum `supplier_category`.
- **Other needs a description** of what the supplier provides (up to 60 characters), so a supplier
  that fits no category keeps its meaning. Other categories store none (CHECK).
- **One list everywhere.** The form, the server's Zod validation, labels in lists and Activity, the
  audit registry's copy and the database enum follow the canonical list; tests keep them equal.
  Values are accepted only exactly as listed.
- **Extensible.** A new category is one list entry plus a migration adding the enum value. Category
  sets per event type are the Tier 3 event templates, not built now.

**Alternatives not chosen.** Free text with suggestions (2b) would let one kind of supplier appear
under several spellings, which breaks grouping and later budget views.

**Evidence.** `suppliers/categories.test.ts`, the category CHECK in
`suppliers/suppliers-table.db.test.ts`.

---

## D-070 Adding suppliers and the supplier list

**Status:** Approved by the technical lead on 2026-10-14 (B4-01 to B4-05 plan).

**Decision.**

- **Required fields:** name and category (and, for Other, what the supplier provides, D-069).
  Contact person, phone, email and notes are optional; empty means none. The same Zod schema
  (`suppliers/schema.ts`) checks the form and, again, the server: trimming, limits matching the
  columns, email and phone formats, NUL characters refused.
- **Adding:** an "Add supplier" page for Owners and Coordinators (`suppliers.manage`); Viewers get
  "You don't have access", even by address. The server action authorizes with `authorizeEvent`,
  validates, and in one transaction takes the event's next supplier number (re-checking the role in
  the same statement), inserts the supplier and records `supplier.created`. The event comes only
  from the address; an `eventId` in the form is ignored.
- **The supplier list:** every member sees all suppliers of the event as cards (readable ID, name,
  category, contact person, phone and email as links, notes), by name then number, with loading,
  empty and error states. After adding, a notice names the new supplier from the stored list, never
  from the address. Search, filters and money columns come with later tasks.
- **Activity:** `supplier.created` keeps the readable ID, name and category; never contact details
  or notes.
- **Sample data:** the dev sample store (D-041) has four wedding suppliers and the same rules.

**Evidence.** `suppliers/schema.test.ts`, `suppliers/suppliers.db.test.ts`,
`suppliers/authorization.db.test.ts`, `suppliers/audit.test.ts`, `suppliers/ui/*.test.tsx`,
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`.

---

## D-071 Editing suppliers

**Status:** Approved by the technical lead on 2026-10-14 (B4-01 to B4-05 plan).

**Decision.**

- **Who:** Owners and Coordinators (`suppliers.manage`). The supplier list shows an "Edit" link
  on each card for them only. A Viewer who opens the edit address gets "You don't have access"
  and nothing is loaded; the server action refuses them too, and the database statement re-checks
  the role (`rolesAllowed`).
- **What can change:** name, category (with what an Other supplier provides), contact person,
  phone, email and notes, checked by the same schema as adding (D-070). The event and the readable
  ID never change: the update writes an explicit list of fields, and an `eventId` in the form is
  ignored.
- **Which supplier:** the event comes from the address and the supplier is looked up only inside
  it. An unknown supplier, a malformed ID or another event's supplier are all "not found", so a
  substituted ID tells the caller nothing.
- **Conflicts:** the form carries the supplier's `updatedAt`; a save made after someone else's is
  refused with "This supplier changed since you opened it" and changes nothing (as D-032 for
  events).
- **Activity:** `supplier.updated` with the readable ID and what changed. Name and category are
  recorded old → new; contact person, phone, email and notes only as "changed", never their
  values. A save that changes nothing says "No changes to save." and records nothing.
- After saving, the supplier list opens with a "Changes saved" notice naming the stored supplier.

**Evidence.** `suppliers/schema.test.ts` (`supplierChanges`), `suppliers/suppliers.db.test.ts`
("editing a supplier"), `suppliers/authorization.db.test.ts` (matrix rows "open the edit form" and
"edit a supplier", plus Event B's supplier in Event A's address for every caller),
`suppliers/audit.test.ts`, `suppliers/ui/SupplierForm.test.tsx` (edit mode),
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx` (Edit supplier page).

---

## D-072 Removing suppliers and what happens to their records

**Status:** Approved by the technical lead on 2026-10-14 (B4-05, option 5a: keep D-003 as
approved).

**Context.** B4-05 asks for an explicit choice between cascade, restrict and soft delete for a
supplier's quotes and payment or deposit records. D-003 (approved 2026-10-09) already decided the
money side, and D-002 says optional links must be cleared before the delete.

**Decision.**

- **Permanent delete, no soft delete.** Removing a supplier deletes its row. There is no archive
  or undo; the confirmation says so.
- **Who:** Owners and Coordinators (`suppliers.manage`), behind a confirmation dialog on the edit
  page. Viewers never see it; the server action and the database statement check the role again.
- **Only inside the event:** the delete is scoped to the authorized event. Another event's
  supplier, an unknown supplier and a malformed ID are all "not found" and nothing is removed.
- **Activity keeps the history:** a `supplier.deleted` entry keeps the readable ID and the name.
  Earlier entries about the supplier stay. Readable IDs are never reused (`lastSupplierNumber`
  only grows).
- **Related records, when their tables arrive** (none exist yet, so today only the supplier is
  removed). Each later task adds its step to the same transaction, before the delete:
  - Supplier payments and deposits: deleted with the supplier (cascade, D-003). They exist from
    B4-12 (D-077).
  - Quotes: _amended 2026-10-14 by D-075 (approved):_ quotes are their own rows and are deleted
    with the supplier (cascade). They exist from B4-08.
  - Budget line linked to the supplier: unlinked, and the supplier's committed and paid totals are
    copied onto it, so the budget keeps its totals (D-003).
  - Task links to the supplier: cleared, and the tasks stay (D-002).
- Not chosen: **restrict** (blocks removing a supplier the coordinator no longer uses, and D-003
  already keeps the budget totals) and **soft delete** (a hidden second state every list, count
  and impact rule would need to filter; not in scope).

**Evidence.** `suppliers/suppliers.db.test.ts` ("removing a supplier"),
`suppliers/authorization.db.test.ts` (matrix row "remove a supplier", Event B's supplier in Event
A's address), `suppliers/audit.test.ts`, `suppliers/ui/RemoveSupplierSection.test.tsx`,
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`, `e2e/lifecycle/supplier-flow.spec.ts`.

---

## D-073 Supplier contact details

**Status:** Approved by the technical lead on 2026-10-14 (B4-06 to B4-11 plan, option 5a).

**Decision.**

- **The contact fields are contact person, phone and email** (`SUPPLIER_CONTACT_FIELDS`), all
  optional, plus free-text notes. Nothing else personal is collected: no address, ID numbers,
  birthdays or social accounts. The form asks for the supplier's business contact details and says
  every member of the event can see them.
- **Validation** (one schema for the form and the server, D-070): contact person up to 120
  characters; phone with digits, spaces, dashes, brackets and one leading "+", 7 to 15 digits, up to
  32 characters; email in a valid format, stored in lower case, up to 254 characters; NUL
  characters refused; empty means none.
- **Event-scoped:** contacts are columns of the supplier, which belongs to one event (D-068), so
  they are read and written only through that event.
- **Where they show:** every member may see them (D-068, option 3a), on the supplier's detail page
  (B4-07). The supplier list shows only the contact person; phone, email and notes stay off the
  list.
- **Activity never holds their values:** edits record only that a contact field or the notes
  changed (D-071).

**Evidence.** `suppliers/schema.test.ts` (contact fields and formats),
`suppliers/suppliers.db.test.ts` ("contact details": event-scoped, never in Activity through add,
edit and remove), `suppliers/ui/SupplierForm.test.tsx`, `suppliers/authorization.db.test.ts`.

---

## D-074 Supplier detail page

**Status:** Approved by the technical lead on 2026-10-14 (B4-06 to B4-11 plan, option 6a).

**Decision.**

- **Where:** `/events/<id>/suppliers/<supplierId>`, opened from the supplier's name on the list.
- **What every member sees** (`event.view`): readable ID, name, category, and contacts (contact
  person, phone and email as links, notes; D-073). Quotes are added to this page by B4-09 as their
  own section.
- **What Owners and Coordinators also get:** Edit supplier (`suppliers.manage`) and the supplier's
  recent Activity (`audit.view`): the latest 10 entries about the supplier and, from B4-09, its
  quotes, with a link to the event's Activity. Viewers never get these entries (D-035); the read
  doesn't load them for a Viewer.
- **Deposits and payments** are not shown until the tasks that record them build their own
  section, so the page never suggests a status that isn't tracked. _Since B4-14 (D-080) they have
  their section._
- **Scope and states:** the supplier is found only inside the authorized event; an unknown
  supplier, a malformed ID or another event's supplier is "not found". The page has loading and
  error states, and plain wording for anything not recorded ("Not recorded", "No changes recorded
  for this supplier yet").
- The audit log read can be limited to given records (`entityId`), used here; callers still
  authorize first with `audit.view`.

**Evidence.** `suppliers/authorization.db.test.ts` (matrix row "open the supplier's details",
another event's supplier, Activity for Owners and Coordinators only and only about this supplier),
`suppliers/ui/SupplierContactSection.test.tsx`, `suppliers/ui/SupplierActivitySection.test.tsx`,
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`, `e2e/lifecycle/supplier-flow.spec.ts`.

---

## D-075 Supplier quotes and money

**Status:** Approved by the technical lead on 2026-10-14 (B4-06 to B4-11 plan, options 1a, 3a and
4a). Amends D-003 and D-072 in wording only.

**Context.** The frozen Tier 1 scope says "quote amount and status", and D-003 kept them as fields
of the supplier. B4-08 asks for quote records that can tell several quotes apart. The technical
lead chose separate quote rows with at most one Accepted per supplier.

**Decision.**

- **Quote rows** (`supplier_quotes`): a supplier can have several quotes. Each belongs to one
  supplier of one event through the composite key `(eventId, supplierId)` (D-002) and is deleted
  with its supplier (D-072) and its event (D-004).
- **Identity:** a readable ID per event, `QUO-0001`, from `events.lastQuoteNumber`, never reused,
  plus an optional description (up to 120 characters) such as "Package B, 200 guests".
- **Timestamps:** `createdAt`; `updatedAt`, which is also the edit version (stale saves are
  refused, D-032); `statusChangedAt`, set on create and on every status change.
- **Money:** Philippine pesos only, no currency column; `numeric(12, 2)`, exactly two decimals,
  more than ₱0.00 and at most ₱9,999,999,999.99. Amounts travel as strings, never JavaScript
  numbers. Input `120000`, `120,000` or `120,000.50` (optional "₱"); negative, zero, more than two
  decimals (never rounded), too large and ambiguous formats are refused with a clear message. Zero
  is refused because a quote is a price; a complimentary service needs no quote.
- **Committed money (D-003, unchanged meaning):** the amount of the supplier's Accepted quote,
  otherwise zero. At most one Accepted quote per supplier (D-076) keeps it counted once. No totals
  are computed in Batch 4's quote tasks.
- **Permissions:** `suppliers.manage` (Owner, Coordinator) adds and edits quotes, as the matrix
  already says. Every member sees quotes and amounts on the supplier's page.
- **Adding a quote (B4-09):** from the supplier's page ("Add quote", Owners and Coordinators). The
  server action authorizes with `authorizeEvent`, validates with the shared quote schema, and in
  one transaction locks the supplier (found only inside the event, with the role re-checked in the
  same statement), applies the one-Accepted rule (D-076), takes the next quote number, inserts the
  quote and records `quote.created`. The event and supplier come only from the address; IDs in the
  form are ignored. The supplier's page then shows a "Quote added" notice.
- **Editing a quote (B4-10):** an Edit link per quote on the supplier's page (Owners and
  Coordinators). Amount, status and description can change; the supplier, event and number never
  do. The same transaction shape as adding: the supplier is locked (found only inside the event,
  role re-checked), the quote is found only for that supplier, a stale save is refused (D-032), the
  one-Accepted rule applies (D-076), and a status change moves `statusChangedAt`. A save that
  changes nothing writes nothing and says "No changes to save."
- **Activity:** `quote.created` keeps the quote and supplier IDs, the amount, the status and the
  description; `quote.updated` keeps what changed, old → new. The supplier's page shows these
  entries with the supplier's own.

**Evidence.** `suppliers/money.test.ts`, `suppliers/supplier-quotes-table.db.test.ts`,
`suppliers/quote-schema.test.ts`, `suppliers/quotes.db.test.ts`, `suppliers/authorization.db.test.ts`
(matrix rows "add a quote", "open the quote edit form", "edit a quote"; another event's supplier
and quote; a quote under the wrong supplier), `suppliers/audit.test.ts`,
`suppliers/ui/QuoteForm.test.tsx`, `suppliers/ui/SupplierQuotesSection.test.tsx`,
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`, `e2e/lifecycle/supplier-flow.spec.ts`.

---

## D-076 Quote statuses and lifecycle

**Status:** Approved by the technical lead on 2026-10-14 (B4-06 to B4-11 plan, option 2a). Defined
before the quote screens were built.

**Decision.**

- **Three statuses**, one canonical list (`suppliers/quote-statuses.ts`) followed by the form, the
  server, the badge, the audit registry's copy and the database enum `quote_status`:

  | Value      | Label    | Meaning                                                         |
  | ---------- | -------- | --------------------------------------------------------------- |
  | `PENDING`  | Pending  | Received, no decision yet. The default for a new quote.         |
  | `ACCEPTED` | Accepted | Taken. Its amount is what is committed to the supplier (D-003). |
  | `DECLINED` | Declined | Not taken.                                                      |

- **Transitions:** Owners and Coordinators may set any status from any status, so a mistake can be
  corrected. Every change is recorded in Activity (old → new) and moves `statusChangedAt`.
- **At most one Accepted quote per supplier.** Accepting a quote, on create or edit, is refused
  while another quote of the same supplier is Accepted; the message names that quote ("QUO-0002 is
  already accepted for this supplier. Change it to Pending or Declined first."). Nothing changes on
  its own: other quotes are never declined automatically. The quote use cases check this in a
  transaction that locks the supplier row, so two accepts at the same moment can't both succeed.
- Not chosen: automatically declining the other quotes (option 2b); more statuses such as expired
  or withdrawn (not in scope).
- The badge shows the label with an icon, never color alone.

**Evidence.** `suppliers/quote-statuses.test.ts`, `suppliers/ui/QuoteStatusBadge.test.tsx`; status
changes persisted and the one-Accepted rule under concurrency in `suppliers/quotes.db.test.ts`
(B4-09, B4-10).

---

## D-077 Supplier payment records

**Status:** Approved by the technical lead on 2026-10-14 (B4-12 to B4-16 plan, option 1a). Amends
D-003 in wording only. _Timing:_ the code was written and committed before this approval (17:57
Manila time) and audited line by line after it; see the B4-12 to B4-16 completion report.

**Context.** Tier 1 tracks a supplier's deposit, payment status and due date. This is status
tracking, never payment processing: no gateway, online collection, receipts or accounting.

**Decision.**

- **One row per expected payment** (`supplier_payments`): a deposit or another payment (a balance
  or an instalment) that the organizer owes a supplier. A supplier can have several.
- **Fields:** a kind (`DEPOSIT` or `PAYMENT`); a readable ID per event, `PAY-0001`, from
  `events.lastPaymentNumber`, never reused; an optional description (up to 120 characters); an
  amount with the same money rules as quotes (D-075: pesos, `numeric(12, 2)`, more than ₱0.00,
  never rounded); a required due date; the recorded state, `UNPAID` or `PAID` with the date it was
  paid (`paidOn`, required for Paid and empty otherwise, CHECK); `createdAt`, and `updatedAt` as
  the edit version (D-032).
- **Dates** are calendar dates in Philippine time (D-025), stored as `DATE` with no time, from
  2000-01-01 to 2100-12-31 (CHECK). "Not in the future" for the paid date depends on today, so the
  application checks it (D-079).
- **Belongs to its supplier** in the same event through the composite key `(eventId, supplierId)`
  (D-002); deleted with the supplier (D-072) and the event (D-004).
- **Paid (D-003, amended):** the sum of the supplier's rows recorded as Paid. Whether an unpaid row
  is upcoming, due today or overdue is calculated, never stored (D-079).
- Not chosen: deposit fields on the supplier itself (option 1b), which would contradict D-003.

**Evidence.** `suppliers/supplier-payments-table.db.test.ts`.

---

## D-078 Supplier payment status

**Status:** Approved by the technical lead on 2026-10-14 (B4-12 to B4-16 plan, option 2a). This is
the paid-amount-to-status rule D-003 left open. _Timing:_ the code was written and committed
before this approval (17:57 Manila time) and audited line by line after it; see the B4-12 to B4-16
completion report.

**Decision.**

- **Inputs:** committed = the amount of the supplier's Accepted quote, or none (D-003, D-075); paid =
  the sum of its payments recorded as Paid (D-077). Unpaid rows don't count towards paid.
- **Statuses** (one canonical list, `suppliers/payment-status.ts`, used by the server and the badge):

  | Value               | Label             | When                                                                      |
  | ------------------- | ----------------- | ------------------------------------------------------------------------- |
  | `NO_ACCEPTED_QUOTE` | No accepted quote | No quote is Accepted, whatever has been paid: the amount owed is unknown. |
  | `UNPAID`            | Unpaid            | A quote is Accepted and nothing has been paid.                            |
  | `PARTIALLY_PAID`    | Partially paid    | More than ₱0.00 and less than the Accepted quote has been paid.           |
  | `PAID`              | Paid              | At least the Accepted quote has been paid.                                |

- **Paying more than the Accepted quote** is still Paid, with a note giving how much more
  ("₱0.01 more than the accepted quote").
- **Overdue is not a status here.** It is a separate flag from the due rules (D-079), shown beside
  the status, because a partly paid supplier can also be overdue.
- **Arithmetic:** whole centavos as BigInt from the canonical stored strings (`toCentavos`,
  `fromCentavos`); never floating point, never rounded. A non-canonical amount throws rather than
  being guessed. The status is calculated on the server from stored records for every read, never
  stored and never taken from the browser.

**Evidence.** `suppliers/payment-status.test.ts` (each status, one centavo short, exact and over,
unpaid rows ignored, floating-point traps, order independence), `suppliers/money.test.ts`
(centavos), `suppliers/ui/PaymentStatusBadge.test.tsx`.

---

## D-079 Payment due dates and overdue

**Status:** Approved by the technical lead on 2026-10-14 (B4-12 to B4-16 plan, options 3a and 4a).
_Timing:_ the code was written and committed before this approval (17:57 Manila time) and
audited line by line after it; see the B4-12 to B4-16 completion report.

**Decision.**

- **Calendar dates in Philippine time.** Due and paid dates are days, not instants: `DATE` columns,
  "YYYY-MM-DD" in code, shown as written ("Nov 15, 2026") with no time zone shift. "Today" is the
  current day in Asia/Manila (UTC+8 all year, no daylight saving; D-025): it changes at 16:00 UTC.
- **Today is worked out on the server once per request** (`manilaToday(new Date())`) and passed to
  the rules, so the rules never read a clock and tests fix the day. Nothing in the browser decides
  a due status.
- **Due status of one payment** (canonical list, `suppliers/payment-due.ts`, used by the server and
  the badge):

  | Value       | Label     | When                                                                  |
  | ----------- | --------- | --------------------------------------------------------------------- |
  | `PAID`      | Paid      | Recorded as paid. Never overdue, whether paid early, on time or late. |
  | `OVERDUE`   | Overdue   | Not paid, and the due date is before today.                           |
  | `DUE_TODAY` | Due today | Not paid, and due today.                                              |
  | `UPCOMING`  | Upcoming  | Not paid, and due on a later day.                                     |

- **A supplier's due summary:** how many of its payments are overdue, and its next unpaid payment
  (the earliest due date, so an overdue one comes first). The supplier list and page show it
  beside the payment status (D-078).
- **Date rules for input (D-077):** the due date is any real calendar date from 2000-01-01 to
  2100-12-31; a past due date is allowed and simply shows as Overdue. The paid date is required when
  the payment is Paid, must be a real date in the same range, and can't be after today in Manila.
  The database enforces the range and the paid-date rule; the application also enforces "not in the
  future".

**Evidence.** `suppliers/payment-due.test.ts` (each status; the day before, of and after; paid
payments never overdue; 23:59:59.999 and 00:00 in Manila; the new year and a leap day; impossible
dates refused; next due and overdue count; order independence),
`suppliers/ui/PaymentDueBadge.test.tsx`.

---

## D-080 Managing supplier payments

**Status:** Approved by the technical lead on 2026-10-14 (B4-12 to B4-16 plan, options 4a and 5a).
_Timing:_ the code was written and committed before this approval (17:57 Manila time) and
audited line by line after it; see the B4-12 to B4-16 completion report.

**Decision.**

- **Where:** a "Deposits and payments" section on the supplier's page shows the payment status
  against the Accepted quote (D-078), an overpaid note, the overdue count and each payment with its
  kind, description, amount, due date, paid date and due status (D-079). Every member sees it;
  Owners and Coordinators (`suppliers.manage`) get Add payment and an Edit link per payment.
- **Adding and editing:** kind, amount, due date, status (Not paid yet or Paid), the paid date for
  Paid, and an optional description. One schema checks the form and, authoritatively, the server,
  for today's date in Manila worked out on the server (D-079); no financial or date rule lives only
  in the browser. The use cases lock the supplier (found only inside the event, role re-checked in
  the same statement), take the next payment number, refuse stale edits (D-032) and record
  `payment.created` or `payment.updated` (business facts, old → new). A save that changes nothing
  writes nothing. The event, supplier and payment come only from the address.
- **Statuses are calculated on every read** on the server from stored records; nothing calculated
  is stored or taken from the browser.
- **Removing a payment** is not included (option 5a): the task asks for create and edit; a mistake
  is corrected by editing. Payments are removed with their supplier (D-072).
- **Not included (out of Tier 1):** payment gateways, online collection, payment processing,
  receipts and accounting integration.

**Evidence.** `suppliers/payment-schema.test.ts`, `suppliers/payments.db.test.ts`,
`suppliers/authorization.db.test.ts` (matrix rows for the add and edit forms and actions; another
event's supplier and payment; a payment under the wrong supplier; invalid amounts and dates on the
server), `suppliers/audit.test.ts`, `suppliers/ui/PaymentForm.test.tsx`,
`suppliers/ui/SupplierPaymentsSection.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`,
`e2e/lifecycle/supplier-flow.spec.ts`.

---

## D-081 The supplier list

**Status:** Approved by the technical lead on 2026-10-14 (B4-12 to B4-16 plan, option 6a). Part of
the code was written before this approval (17:57 Manila time) and finished and audited after it.

**Decision.**

- **One card per supplier**, for every member (`event.view`): readable ID, name (opening the
  supplier's page), category, contact person, and a short money overview:
  - **Quote:** "₱165,000.00 accepted", "None accepted, 2 pending" or "No quotes yet".
  - **Payment:** the payment status badge (D-078); with more than one overdue payment, "N overdue".
  - **Next due:** the earliest unpaid due date with its due badge (Overdue, Due today or Upcoming;
    D-079), or "Nothing due".
- **Same rules as the supplier's page:** the overview is calculated on the server, for every read,
  from stored quotes and payments and today's date in Manila (`supplier-overview.ts`, built on
  `payment-status.ts` and `payment-due.ts`). Nothing new is calculated for the list.
- **One database query** loads the event's suppliers with their quotes' and payments' amounts,
  statuses and due dates (filtered by the event at every level).
- **Not an overloaded dashboard:** no totals, charts or filters. Phone, email and notes stay off the
  list (D-073). Add supplier and the Edit links stay for Owners and Coordinators; loading, empty and
  error states are unchanged (D-070).

**Evidence.** `suppliers/supplier-overview.test.ts`, `suppliers/ui/SupplierList.test.tsx`,
`suppliers/authorization.db.test.ts` (each event's own overview, for every member),
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`, `e2e/lifecycle/supplier-flow.spec.ts`
(steps 5 and 8).

---

## D-082 Supplier search

**Status:** Approved by the technical lead on 2026-10-14 (B4-17 to B4-21 plan, option 1a).

**Decision.**

- **What it searches:** supplier name, contact person and what an Other supplier provides
  (partial, ignoring case and accents: "pena" finds "Peña"), and the readable ID ("SUP-0004",
  "sup4" or "4" find number 4; "sup-00" finds IDs starting that way). Email, phone and notes are
  not searched.
- **Server-safe:** the search runs on the server inside the authorized supplier read
  (`getEventSuppliers`), only over the suppliers already loaded for this event (D-081). The search
  text is only compared with stored text; it never builds a database query.
- **Input:** read from the address (`?q=`) only; control characters (including NUL) removed,
  trimmed, at most 100 characters; empty means no search; unknown parameters are ignored. A plain
  GET form, so it works without JavaScript and survives refresh, back and sharing.
- **Results:** "N of M suppliers match" while searching; no match gives "No suppliers match" with
  the search shown and "Clear search and filters", which restores the full list. With no suppliers
  at all, the search box is not shown and the "No suppliers yet" empty state stays.
- The supplier context keeps its own copy of the guest list's text folding so the two contexts stay
  independent (D-001).

**Evidence.** `suppliers/supplier-list-query.test.ts`, `suppliers/authorization.db.test.ts`
(another event's suppliers never found; non-members refused),
`src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`.

---

## D-083 Supplier filters

**Status:** Approved by the technical lead on 2026-10-14 (B4-17 to B4-21 plan, option 2a).

**Decision.**

- **Dimensions** (only what the domain model supports):
  - **Category:** the 13 canonical categories (D-069).
  - **Quote:** one value per supplier, so every supplier is in exactly one: "Quote accepted" (it
    has an Accepted quote), "Pending only" (none accepted, at least one Pending) and "No accepted
    or pending quote" (no quotes, or only Declined ones). The plan's "No quotes" was widened to
    include suppliers with only Declined quotes, which would otherwise match no option.
  - **Payment status:** No accepted quote, Unpaid, Partially paid, Paid (D-078).
  - **Overdue only:** suppliers with at least one overdue payment (D-079); a separate checkbox
    because overdue is a flag, not a payment status.
- **Composition:** search and every filter combine with AND. Values come from the address only
  (`category=VENUE&quote=accepted&payment=partially-paid&overdue=yes`) and must match a fixed list
  exactly; anything else is ignored (no filter). Empty selects send empty values, also ignored.
- **Server-side and event-scoped:** filtering runs on the server inside the authorized read, over
  this event's suppliers, using the same quote, payment and due rules as the list and the
  supplier's page (D-081). It cannot reach another event's suppliers.
- **Clearing:** "Clear search and filters" goes back to the plain list address and shows every
  supplier the reader may see. "N of M suppliers match" while narrowed; "No suppliers match" lists
  the active search and filters.
- **On a phone:** the state lives in the address (a plain GET form), so reload, back and sharing
  keep it; fields stack in one column with 44 px controls and nothing scrolls sideways. No
  sorting (not requested).

**Evidence.** `suppliers/supplier-list-query.test.ts` (parsing, address round trip, quote groups,
composition, clearing, wording), `suppliers/authorization.db.test.ts` (Event B's matching supplier
never shown; composition on stored data), `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`,
`e2e/lifecycle/supplier-flow.spec.ts` step 9 (375 px: reload, back, no match, clear).

---

## D-084 Budget categories and allocations

**Status:** Approved by the technical lead on 2026-10-16 (written retroactively; built in B5-F01, migration `20261015090000_budget`).

**Decision.**

- A **category** is a named group of budget items that belongs to exactly one event and is deleted
  with it (D-004).
- **Name:** 1 to 120 characters, trimmed, runs of inner spaces collapsed to one. Two categories of one
  event cannot differ only by letter case (unique index on `(eventId, lower(name))`).
- **Allocation:** the pesos set aside for the category. It is a planning number the user enters and is
  never derived from items. ₱0.00 or more, at most ₱9,999,999,999.99 (`Decimal(12,2)`), exact to the
  centavo. The parser refuses more than two decimals instead of rounding.
- **Removal:** only an empty category can be removed. A category with items is refused (use case check,
  backed by a `NO ACTION` foreign key).
- **Permissions:** every member reads (`event.view`); Owners and Coordinators write (`budget.manage`).
  The role is checked on the server and again in the write.
- **Concurrency:** a save carrying an older `updatedAt` is refused as stale (D-032). A save that
  changes nothing writes nothing.
- **Audit:** `budget_category.created`, `.updated` (changed fields only, old to new) and `.deleted`.

**Evidence.** `budget/schema.test.ts`, `budget/application/budget.use-cases.test.ts`,
`budget/domain/budget.money.test.ts`.

---

## D-085 Budget items

**Status:** Approved by the technical lead on 2026-10-16 (written retroactively; built in B5-F02). Amended by D-089 for items linked to a supplier.

**Decision.**

- An **item** is one planned cost, inside exactly one category of the same event (composite foreign
  key `(eventId, categoryId)`, `NO ACTION`).
- **Readable ID:** `BUD-0001`, issued per event from `events.lastBudgetItemNumber` in the same
  transaction as the insert, never reused.
- **Fields:** name 1 to 120 characters; **estimated** (required); **committed** and **paid** (optional,
  a blank field is stored as ₱0.00); notes up to 2,000 characters. All amounts are `Decimal(12,2)`,
  ₱0.00 or more.
- **Notes are never copied into the audit log.** The entry only says they changed.
- **Moving** an item to another category is allowed inside the same event only.
- **Removal** is permanent. Its number is not reused.
- **Today, committed and paid are typed in by the user.** D-089 changes this for linked items.
- Permissions, stale-save protection and audit follow D-084 (`budget_item.created`, `.updated`,
  `.deleted`).

**Evidence.** `budget/domain/budget.item.test.ts`, `budget/schema.test.ts`,
`budget/application/budget.use-cases.test.ts`.

---

## D-086 Estimated, committed and paid totals

**Status:** Approved by the technical lead on 2026-10-16 (written retroactively; built in B5-F03 to B5-F05).

**Decision.**

- The **total estimated**, **total committed** and **total paid** of a category, and of the whole
  event, are plain sums of the stored item amounts.
- Sums are done in whole centavos with `BigInt`, never floating point, so 0.10 + 0.20 is exactly 0.30
  (PROJECT_RULES section 6.1). An empty list is ₱0.00.
- Totals are **calculated on every read and never stored**.
- The screen says what these are: sums of entered amounts, **not a balance**. "Paid" is the actual cost
  recorded so far.

**Evidence.** `budget/domain/budget.totals.test.ts`.

---

## D-087 Total allocated

**Status:** Approved by the technical lead on 2026-10-16 (written retroactively; built in B5-F06).

**Decision.**

- The **total allocated** is the sum of all category allocations of the event, with the same exact
  centavo arithmetic as D-086, calculated on read and never stored.
- There is **no separate event budget field**. The event's budget is the total allocated.
- Allocations are set and changed only through the category form (D-084). There is no separate
  "set allocation" use case, so the empty `set-allocation.ts` stub should be deleted.

**Evidence.** `budget/domain/budget.totals.test.ts`, `budget/ui/BudgetList.tsx`.

---

## D-088 Remaining budget and over-budget

**Status:** Approved by the technical lead on 2026-10-16 (spent basis: committed; estimated above the
allocation: no warning). Built in B5-F07 and B5-F08. Replaces the open question BQ-06.

**Decision (recommended answers marked).**

1. **Spent basis: committed (approved).** An item "uses" its budget when it is committed, not only when paid.
   This matches the brand book's test example (budget ₱350,000, committed ₱370,000 gives OVER_BUDGET).
   Alternatives: estimated (a forecast, not a fact), paid (too late to warn).
2. **Remaining** = allocation minus total committed, for a category and for the event
   (total allocated minus total committed). The domain value is signed (for example `-20000.00`);
   screens never show a negative remaining and show "Over by ₱X" instead.
3. **Status** (two values only, no new ones):
   - `WITHIN_BUDGET`: committed is less than or equal to the allocation. Exactly equal is within, with
     ₱0.00 remaining.
   - `OVER_BUDGET`: committed is greater than the allocation. Shown as "Over by ₱X", never as a
     negative remaining.
4. **Zero allocation:** committed above ₱0.00 is `OVER_BUDGET`; committed of ₱0.00 is `WITHIN_BUDGET`.
5. **Event level** compares total committed with total allocated. One category can be over budget while
   the event is within it; each is reported on its own.
6. **Estimated above allocation is not a status or warning (approved).** The user may want it
   later; it would be its own decision.
7. **Severity:** `OVER_BUDGET` is shown as Critical, with an icon and the text "Over budget", never
   color alone. `WITHIN_BUDGET` is shown as Ready. The labels ("Within budget", "Over budget") live in
   `budget-summary.ts` and screens use them, so the wording is written once. Event Health may reuse
   this result later; it must not calculate it a second time. This defines a result only: it adds
   no alert surface (PROJECT_RULES section 2.2).
8. Pure, deterministic domain functions `summarizeBudget` and `summarizeEventBudget` in
   `budget/domain/budget-summary.ts`, reusing the D-086 and D-087 sums. **Never stored and never
   set by AI.** Signed centavo arithmetic in `BigInt`.

**Evidence.** `budget/domain/budget-summary.test.ts` (under, equal and over by one centavo; zero
allocation with and without commitments; the ₱350,000 and ₱370,000 example; empty category and empty
event; event within while a category is over; estimated above allocation raises nothing; amounts at
the column limit) and `budget/ui/BudgetStatusBadge.test.tsx`.

---

## D-089 Linking a budget item to a supplier (implements D-003)

**Status:** Approved by the technical lead on 2026-10-16 (unlinking copies the supplier amounts onto
the item). **Not built yet:** the schema and code arrive in a later task. Replaces the open question
BQ-07. Amends D-085.

**Decision.** D-003 stays as approved. In addition:

- **Schema:** `budget_items.supplierId` (nullable), composite foreign key `(eventId, supplierId)`, and
  `@@unique([eventId, supplierId])`, so a supplier links to at most one item and its money is counted
  once. `committedAmount` and `paidAmount` become nullable. CHECK `budget_items_amount_source`: a linked
  item stores both as NULL; an unlinked item stores both.
- **Linked amounts:** committed is the amount of the supplier's Accepted quote, otherwise ₱0.00. Paid is
  the sum of the supplier's payments recorded as Paid. Both come from the existing
  `supplierPaymentSummary` rule (D-078), never a second formula. That rule returns `committed: null`
  when no quote is Accepted; for the item this is stored and shown as ₱0.00. Estimated stays manual.
- **Paid may exceed committed.** D-078 allows payments with no Accepted quote and overpayment, so a
  linked or just-unlinked item can hold paid above committed. No check forbids it.
- **Display:** linked amounts are read-only and labeled "from supplier".
- **Linking** requires `budget.manage` and a supplier of the same event. The previous manual committed
  and paid values are replaced, and the audit entry records them (`budget_item.linked`).
- **Unlinking by the user** (`budget_item.unlinked`): the supplier-derived committed and paid amounts
  are copied onto the item in the same transaction, so totals do not jump. This extends the rule D-003
  already gives for supplier deletion.
- **Deleting a supplier:** its linked item is unlinked and the supplier's committed and paid amounts are
  copied onto the item, in the same transaction (D-003, unchanged).
- Totals (D-086) and the remaining rule (D-088) use the effective amounts, linked or typed.

**Migration note.** `committedAmount` and `paidAmount` become nullable, which changes every read of
them (`budget.totals.ts`, the item form). Existing rows are unlinked and keep their values, so
`DROP NOT NULL` needs no backfill.

**Required tests.** The CHECK constraint refuses both mixed states; one supplier cannot link to two
items; a supplier from another event is refused; Viewer and non-member are refused and change nothing;
Accepted quote, no Accepted quote, partial and full payment; unlink and supplier delete copy the same
amounts; centavo-exact sums; the audit entries.

---

## D-090 Over-budget warning

**Status:** Approved by the technical lead on 2026-10-16 (B5-F09). Presents the D-088 result; adds
no formula.

**Decision.**

- The budget page shows one warning when something is over budget, and nothing when nothing is.
  "Over" is exactly D-088: committed greater than the allocation, for the event (total committed
  against total allocated) and for each category on its own. Estimated or paid alone never warn.
- The warning lists **the reasons**, event first, then each over category in the order of the list.
  Each line names what is over, the committed amount, the limit it is judged against (the category
  allocation, "it has no allocation", or the event's total allocated) and the difference. Example:
  "Catering is over budget: ₱110,000.50 is committed and its allocation is ₱100,000.00, ₱10,000.50
  more." The text states the basis ("Judged on committed amounts, not estimates") and, when only
  categories are over, that the event as a whole is still within its total allocation.
- The wording is built in `budget-summary.ts` (`overBudgetWarnings`); the screen only displays it.
  Pure, never stored, never AI.
- It is an inline banner on the budget page (Critical severity: icon, "Over budget" text and a
  hidden "Error" label), announced politely (`role="status"`), not interrupting. It is not an alert
  engine, a notification or a Critical Alert View entry (PROJECT_RULES section 2.2). Event Health may
  reuse `overBudgetWarnings` in Batch 8 rather than calculate it again.

**Evidence.** `budget/domain/budget-summary.test.ts`, `budget/ui/OverBudgetWarning.test.tsx`,
`budget/ui/BudgetList.test.tsx`.

---

## D-091 Budget data is scoped to one event

**Status:** Approved by the technical lead on 2026-10-16 (B5-F10). Written down from what B5-F01 and
B5-F02 already do, plus the tests that prove it. Changes no behavior.

**Decision.**

- Every budget read and write names one event. The event ID that counts is the one returned by
  `authorizeEvent` (D-036), not the one the caller sent.
- Category and item lookups filter by event ID, so another event's record is "not found" and a
  refusal reveals nothing.
- Categories, items and summaries are listed and calculated only from the authorized event's
  records. A summary is never built from a cross-event query.
- The database backs the application up: a budget item's category is a composite foreign key
  `(eventId, categoryId)` (D-002), so an item cannot point at another event's category even if the
  application is bypassed. Item numbers come from the event's own counter.
- Every write re-checks, in its own statement, that the actor is a member whose role may manage the
  budget (D-035), and records its audit entry in the same transaction. Viewers and non-members are
  refused and change nothing.
- Deleting an event deletes its budget with it and touches no other event (D-004).

**Evidence.** `budget/queries.test.ts` (authorized ID used, refusal before storage, malformed and
foreign IDs) and `budget/budget-event-scope.db.test.ts` (reads, substituted IDs on every write, the
foreign-key backstop, non-member and viewer, per-event numbering, cascade; run with
`npm run test:db`).

---

## D-092 Budget authorization and validation checkpoint

**Status:** Proposed (B5-F11, B5-F12). Records what the budget already enforces and what is
deliberately not validated. Changes no behavior. Needs the technical lead's approval.

**Decision.**

- **Who may do what.** Every member (Owner, Coordinator, Viewer) reads the budget (`event.view`).
  Owners and Coordinators add, edit, move and delete categories and items and set allocations
  (`budget.manage`). Viewers change nothing and cannot open the edit forms. There is no Owner-only
  budget operation. Items follow the category permission; no new permission is added.
- **How it is enforced.** Each action and read authorizes first with `authorizeEvent` (D-036), uses
  only the event and user IDs it returns, and each write checks the role again in its own database
  statement (D-091). A non-member sees "not found", never a hint the event exists.
- **Validation on the server, every time.** Required: category name, item name, category of the item,
  allocation and estimated amount. Optional: committed and paid (blank is ₱0.00) and notes (blank is
  none). Names are trimmed and 1 to 120 characters; notes at most 2,000. Amounts are ₱0.00 to
  ₱9,999,999,999.99 with at most two decimals, never rounded for the user. A category ID must be a
  UUID and belong to the same event. Fields outside the form are ignored.
- **Not validated, on purpose.** No approved rule ties committed to estimated, or paid to committed
  (D-089 allows paid above committed). Over-budget is shown as a warning (D-088, D-090), not refused
  on save. A new rule would be its own decision.
- **Database backstop.** CHECK constraints (non-negative amounts, non-blank names and notes,
  positive item numbers), the case-insensitive unique category name and the composite foreign keys
  refuse invalid rows even if the application is bypassed (D-002, D-084, D-085).

**Evidence.** `budget/actions.test.ts`, `budget/schema.test.ts`, `budget/queries.test.ts`,
`budget/authorization.db.test.ts` (every caller against every operation, plus substituted IDs) and
`budget/budget-constraints.db.test.ts`. The two DB tests need `npm run test:db`.

---

## D-093 Budget activity wording, states and responsive layout

**Status:** Proposed (B5-F14, B5-F15, B5-F16). Changes no budget rule, formula, permission or data
model, and adds no audit action. Needs the technical lead's approval.

**Decision.**

- **Activity (B5-F14).** The six budget entries already written by D-084 and D-085
  (`budget_category.created`, `.updated`, `.deleted`, `budget_item.created`, `.updated`, `.deleted`)
  get plain-language lines on the Activity page, in `audit/describe.ts`, the same way supplier
  entries do (D-070, D-075). Before this, they showed "Made a change (details unavailable)".
  - Amounts are shown as pesos and changes as old → new, in the order of the audit schema:
    category, name, estimated, committed, paid, then notes.
  - **Notes are never copied** (D-085): the line only says "Notes changed".
  - A move to another category leads the summary ("Moved the budget item BUD-0002 to Catering"), as
    a quote's status change does (B4-20). Removal entries keep the readable ID and name.
  - Nothing new is written: no over-budget entry, no entry for reads, no entry for a save that
    changed nothing (D-037). Who can read Activity is unchanged (`audit.view`, D-035).
- **Error and empty states (B5-F15).** The budget and its add and edit pages get a loading screen
  and an error screen like the supplier pages (D-040): the error names what failed, never shows
  `error.message`, and offers Try again. After a failed save both forms list every problem at once
  in the shared error summary, which takes focus and links to each field; a failed request still
  says that nothing was saved. An event with categories but no items says that every total is
  ₱0.00. The existing "no categories" state is unchanged.
- **Responsive layout (B5-F16).** One markup serves every width. The items of a category are a list:
  stacked cards below 768 px, a grid of columns from 768 px, so the budget never scrolls sideways
  and a screen reader never meets an item twice. Every amount keeps its label in the page. Summaries
  wrap, form controls and buttons are at least 44 px tall, and form buttons fill the width on a
  phone, in the same order as the keyboard order.

**Evidence.** `budget/audit.test.ts` (what each entry may hold, how Activity words it, peso format
equal to `formatPesos`), `audit/actions.test.ts` (registry), `budget/ui/BudgetList.test.tsx`,
`budget/ui/BudgetForms.test.tsx`, `app/(app)/events/[eventId]/budget/states.test.tsx`. Not yet
checked in a browser at 375 and 1280 px.

---

## D-094 Tasks: creating and editing

**Status:** Proposed (B6-F01, B6-F02). Adds one table, one counter column and two audit actions.
Needs the technical lead's approval before it counts as approved, because it introduces a new
readable ID format and decides what a task holds today.

**Decision (recommended answers marked).**

1. **A task holds a title and a description, nothing else yet.** Assignee, due date, priority,
   status and the related supplier or area are separate features of this batch (B6-F03 onwards).
   Each adds its own columns, rules and migration, so this one adds none of them.
2. **Title is required, description is optional (recommended).** The feature text says "a title and
   description". A task is useful with a title alone, and forcing a description would invite filler.
   Alternative: require both.
3. **Limits.** Title 1 to 120 characters, trimmed (as a budget item name). Description at most 2,000
   characters, trimmed, line breaks kept; blank is stored as none (as budget notes).
4. **Readable ID: `TSK-0001` (recommended).** Issued per event from `events.lastTaskNumber` in the
   same transaction as the insert, never reused, same as ATT, SUP, QUO, PAY and BUD (D-042, D-085).
   Alternative: no readable ID. The brand book lists no task prefix, so this is new.
5. **Permissions.** Every member reads (`event.view`); Owners and Coordinators create and edit
   (`tasks.manage`, already in the matrix, D-035). Viewers change nothing and cannot open the forms.
   No permission is added or changed.
6. **Authorization and isolation.** As D-091 and D-092: every action and read authorizes first with
   `authorizeEvent` (D-036), uses only the event ID it returns, looks the task up inside that event
   (another event's task is "not found"), and the write checks the role again in its own statement.
7. **Editing.** A save carrying an older `updatedAt` is refused as stale (D-032). A save that
   changes nothing says so and writes nothing, not even an audit entry (D-037).
8. **Audit.** Two new actions. `task.created`: readable ID and title. `task.updated`: readable ID,
   current title, and only the changed fields: title old → new; the **description only as
   "changed"**, never its text (free text, like budget notes, D-085). Both are written in the same
   transaction as the change. No audit entry for reads. Activity words them in `audit/describe.ts`.
9. **Not in this decision.** Deleting a task, status, overdue detection (`overdue.ts` stays empty),
   assignment, impact rules and any alert. Each needs its own approval (PROJECT_RULES section 2.1).

**Schema.** `tasks` (id, eventId, number, title VARCHAR(120), description VARCHAR(2000) NULL,
createdAt, updatedAt) with `ON DELETE CASCADE` to events (D-004), unique `(eventId, number)` and
`(eventId, id)` (the target of later composite links, D-002), and CHECK constraints
`tasks_number_positive`, `tasks_title_not_blank`, `tasks_description_not_blank`,
`events_last_task_number_nonneg`. Migration `20261017090000_tasks`, hand-written like the budget
one: run `prisma migrate dev` once to confirm there is no drift.

**Evidence.** `tasks/domain/task.test.ts`, `tasks/schema.test.ts`,
`tasks/application/task.use-cases.test.ts`, `tasks/actions.test.ts` (authorization before storage,
IDs from authorization only, validation, stale, unchanged, safe failure), `tasks/queries.test.ts`,
`tasks/audit.test.ts`, `tasks/ui/*.test.tsx`, `app/(app)/events/[eventId]/tasks/states.test.tsx`.
**Not yet run:** a database test of the role re-check and event isolation, like
`budget-event-scope.db.test.ts`, and a browser check at 375 and 1280 px.

## D-095 Tasks: deleting, assigning and priority

**Status:** Proposed (B6-F03, B6-F04, B6-F05). Adds one enum, two columns, one foreign key, one
trigger and one audit action. Needs the technical lead's approval before it counts as approved,
because it decides deletion behaviour, who can be assigned, and a database trigger on memberships.

**Decision (recommended answers marked).**

1. **Deleting is permanent, after a confirmation (recommended).** Same as budget items (D-085),
   suppliers (D-072) and attendees. A task has no dependent rows yet, so there is nothing to cascade
   or block. Its `TSK-` number is never reused. Alternatives: archive or soft-delete. Nothing in the
   scope document asks for it, and it would need a status the task does not have yet.
2. **Delete permission is `tasks.manage`** (Owners and Coordinators), already in the matrix (D-035),
   which says "Create, assign and complete tasks". No permission is added or changed. Viewers see no
   Delete button and the action refuses them; the repository re-checks the role in the delete
   statement.
3. **Any member of the event can be assigned (recommended).** Owner, Coordinator and Viewer. The
   matrix does not say who may be assigned, only who may assign. Assignment is a label: it grants no
   permission, so a Viewer who is assigned a task still can't edit it. Alternative: Owners and
   Coordinators only, so a task is never assigned to someone who can't change it. **Technical lead:
   please confirm or choose the alternative.**
4. **Assignment links to the membership, not to the user.** `tasks.assigneeId` references
   `event_members(eventId, id)` with a composite foreign key (D-002), so the database refuses a member
   of another event. The server also looks the member up inside the authorized event first and shows
   "Choose a member of this event." on the field.
5. **Removing a member unassigns their tasks; it does not block the removal and does not delete the
   tasks (recommended).** Prisma can't set one column of a composite key to NULL, so the foreign key
   is NO ACTION and a database trigger (`event_members_unassign_tasks`, BEFORE DELETE on
   `event_members`) clears `assigneeId` and moves `updatedAt`. It covers removing a member, deleting a
   user and deleting an event. This changes what removing a member does to another table, so it is
   called out here. The members feature is not built yet (`members/actions.ts` is empty).
6. **Priority is `HIGH`, `MEDIUM` or `LOW`, required, `MEDIUM` by default (recommended).** The
   brief says only "priority". Three levels are enough to tell what to do first; no numeric scale
   and no "urgent" level. The default is in the domain (`DEFAULT_TASK_PRIORITY`), not in a column
   default. The migration adds the column with a temporary default so existing tasks become `MEDIUM`,
   then drops it. Alternative: optional priority (a task with none).
7. **Priority is shown as a word** ("High priority") on a tinted badge, never colour alone. The list
   stays in `TSK-` order: no sorting or filtering by priority or assignee is added here.
8. **Audit.** New action `task.deleted` (readable ID and title). `task.updated` gains `priority`
   old → new and `assignee` old → new **by display name** (none is null). `task.created` gains an
   optional priority and assignee, optional so entries written before this decision stay valid. The
   assignee's name is the one personal detail a task entry holds; the alternative is "Assignee
   changed" with no name. Activity words them in `audit/describe.ts`. All are written in the same
   transaction as the change.
9. **Editing keeps its rules (D-094):** a stale save is refused, and a save that changes nothing
   writes nothing, including when the assignee and priority are unchanged.
10. **Not in this decision.** Due date, status, related supplier or area, overdue detection, "my
    tasks", filtering or sorting, notifying the assignee, bulk delete, undo, and any impact rule or
    alert. Each needs its own approval (PROJECT_RULES section 2.1).

**Schema.** Enum `task_priority`; `tasks.priority` (NOT NULL), `tasks.assigneeId` (UUID, NULL),
index `(eventId, assigneeId)`, foreign key `tasks_eventId_assigneeId_fkey` to
`event_members(eventId, id)`, trigger function `eventops_unassign_tasks_of_member`. Migration
`20261017120000_task_priority_assignee`, hand-written: run `prisma migrate dev` once to confirm
there is no drift (Prisma does not diff the trigger).

**Evidence.** `tasks/domain/task.test.ts` (priorities equal the database enum and the audit copy,
diff), `tasks/schema.test.ts`, `tasks/application/task.use-cases.test.ts`, `tasks/actions.test.ts`,
`tasks/queries.test.ts`, `tasks/audit.test.ts`, `tasks/ui/*.test.tsx`, and
`tasks/tasks-event-scope.db.test.ts` (16 tests against PostgreSQL 18: event isolation, role re-check,
cross-event assignee refused by the application and by the database, unassign on member removal,
user removal and event deletion, number never reused). The migration was applied to a database that
already held a task: the task became `MEDIUM` with no assignee. **Not yet run:** a browser check at
375 and 1280 px, and `prisma migrate dev` for drift.

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
   Batch 7 (D-101) built the other five rules and left these two files empty and unregistered.
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

---
## D-096 Tasks: status and due date

**Status:** Proposed (B6-F06, B6-F07). Adds one enum, two columns and one CHECK. The status values and
the due-date form were chosen by the technical lead; everything else below needs approval.

**Decision.**

1. **Status values (chosen by the technical lead): `NOT_STARTED`, `IN_PROGRESS`, `DONE`.** Shown as
   "Not started", "In progress" and "Done". No other status (blocked, cancelled, late) exists.
   "Late" is not a status; it is derived from the due date by the separate overdue feature.
2. **Status is required and defaults to `NOT_STARTED` in the domain** (`DEFAULT_TASK_STATUS`), not as a
   column default. The migration adds the column with a temporary default so existing tasks become
   `NOT_STARTED`, then drops it.
3. **Status is changed from the edit form, like any other field.** There is no one-click "mark done"
   and no automatic change (for example Done when everything is finished). It follows the same rules
   as every task edit (D-094): a stale save is refused, an unchanged save writes nothing.
4. **Who can change it:** `tasks.manage` (Owners and Coordinators), as for every task write. The matrix
   (D-035) says "Create, assign and complete tasks". An assignee who is a Viewer **cannot** mark their
   own task done. **Technical lead: please confirm.**
5. **Due date (chosen by the technical lead): optional calendar date in Philippine time.** A
   PostgreSQL `DATE` (`tasks.dueDate`, NULL for no deadline), no time of day and no time zone, so
   the day cannot shift (D-025, D-079). The form uses a date field limited to 2000-01-01 to
   2100-12-31, and the server and a CHECK (`tasks_due_date_in_range`) enforce the same range, as for
   supplier due dates.
6. **A date in the past is allowed** when adding or editing. Importing or recording a task that is
   already late is legitimate, and refusing it would be a business rule nobody approved.
7. **Display.** The list shows status as a word on a bordered badge and "Due Nov 15, 2026" or "No
   due date". Nothing is coloured red or flagged late.
8. **Audit.** `task.updated` gains `status` old → new and `dueDate` old → new (none is null).
   `task.created` gains an optional status and due date, optional so older entries stay valid. Dates
   are stored as `YYYY-MM-DD` and worded by `audit/describe.ts`. Same transaction as the change.
9. **Known debt.** `tasks/domain/due-date.ts` repeats the due-date helpers that suppliers already
   have, because import boundaries (cross-context access only through `public.ts`, D-043) stop the
   task module from reaching supplier internals. Moving them to a shared place is a separate,
   approved refactor.
10. **Not in this decision.** Overdue detection or any "late" flag, filtering or sorting by status or
    due date, reminders or notifications, completed-at timestamps, a due time, recurring tasks,
    changing status automatically, and any impact rule, alert or Event Health input. Each needs its
    own approval (PROJECT_RULES section 2.1).

**Schema.** Enum `task_status`; `tasks.status` (NOT NULL), `tasks.dueDate` (DATE, NULL), CHECK
`tasks_due_date_in_range`. Migration `20261017150000_task_status_due_date`, hand-written: run
`prisma migrate dev` once to confirm there is no drift.

**Evidence.** `tasks/domain/task.test.ts`, `tasks/schema.test.ts` (every status, impossible dates,
leap day, range edges), `tasks/application/task.use-cases.test.ts`, `tasks/actions.test.ts`,
`tasks/audit.test.ts`, `tasks/ui/*.test.tsx`, and `tasks/tasks-event-scope.db.test.ts` (20 tests
against PostgreSQL 18, 4 new: defaults and creation entry, no day shift, one entry per change and
clearing, CHECK refuses dates outside the range with the application bypassed). The migration was
applied to a database that already held a task: it became `NOT_STARTED` with no due date, and the
CHECK refused 2101-01-01. **Not yet run:** a browser check at 375 and 1280 px, `prisma migrate dev`
for drift, and Playwright.

---
## D-097 Tasks: the list and its filters

**Status:** Proposed (B6-F08, B6-F09). No schema change, no migration and no new permission. The due
date options were chosen by the technical lead (has a date, no date, and a date range) as was
"one value per filter, with Unassigned".

**Decision.**

1. **B6-F08 needs no new build.** The task list was built in B6-F01 and already shows the selected
   event's tasks to every member (`event.view`), read on the server inside the authorized event. This
   task adds page tests that pin that behaviour (access check, event-scoped read, empty and refused
   states) and records it as satisfied.
2. **Filters follow the supplier filters (D-083).** Values come from the address only
   (`?status=in-progress&priority=high&assignee=unassigned&due=set&dueFrom=2026-11-01&dueTo=2026-11-30`),
   in a plain GET form, so they work without JavaScript and survive refresh, back and sharing. A
   value that is not on a fixed list, or a date that is not real or is outside 2000 to 2100, is
   ignored (no filter), never an error.
3. **Dimensions.** Status (Not started, In progress, Done); priority (High, Medium, Low); assignee
   (one member, or Unassigned); due date: "Has a due date", "No due date", "Due on or after" and "Due
   on or before" (both inclusive). Each is a single choice. Several values per filter are not offered.
4. **Combination: AND.** Contradictory filters (No due date plus a date range, or a range that ends
   before it starts) match nothing and say so, instead of guessing. A date range never matches a task
   with no due date.
5. **Assignee choices are the members who have a task in this event**, taken from the tasks already
   read. A Viewer sees the same choices and so learns no name they could not already see on the list.
   A member with no task is not listed. Two members with the same name are told apart as "Ana
   Reyes (1)" and "(2)". An assignee ID that is not among them is ignored.
6. **Server-side and event-scoped.** Filtering runs on the server over the tasks `getEventTasks` has
   already authorized, with pure functions (`tasks/task-list-query.ts`). It cannot reach another
   event's tasks or show more than the role may read. Order is unchanged (task number).
7. **States.** "N of M tasks match" while narrowed; "No tasks match" names the filters and offers
   "Clear filters"; no filters are shown when the event has no tasks. Fields stack in one column with
   44 px controls.
8. **Not in this decision.** An "Overdue" or "late" filter or flag (overdue detection is its own
   feature), text search, sorting, saved filters, several values per filter, counts per option,
   filtering by related supplier or area, and filter state kept across an edit (saving a task returns
   to the plain list, as before).

**Evidence.** `tasks/task-list-query.test.ts` (parsing, malformed and impossible values, inclusive date
edges, AND, contradictions, wording), `tasks/ui/TaskListControls.test.tsx`, and
`src/app/(app)/events/[eventId]/tasks/page.test.tsx`. Event isolation of the underlying read is
covered by `tasks/tasks-event-scope.db.test.ts` (D-094). **Not yet run:** a browser check at 375 and
1280 px, and Playwright.

---
## D-098 Tasks: overdue detection

**Status:** Proposed (B6-F10). No schema change, no migration, no new permission.

**Decision.**

1. **The rule.** A task is overdue when it is **not Done**, **has a due date**, and that day is
   **before today**. A task due today is not overdue yet; a Done task is never overdue, whenever it
   was due or finished; a task with no due date is never overdue. This is the same shape as the
   supplier payment rule (D-079). "Incomplete" is read as "not Done", so Not started and In progress
   both count (D-096). **Technical lead: please confirm.**
2. **Today is the Philippine day (Asia/Manila, UTC+8, no daylight saving; D-025).** The page works it
   out once per request with `manilaToday(new Date())` and passes it in, so the rule never reads a
   clock and tests fix the day. A task due on the 17th turns overdue at midnight on the 18th in
   Manila, which is 16:00 UTC on the 17th (pinned by a test on both sides of that instant).
3. **Identification only.** The rule is a pure function (`tasks/overdue.ts`, `isTaskOverdue`). It
   changes no data, writes no audit entry, sends no notification and is not stored: it is worked out
   when the list is shown, so it is never stale and cannot be edited by hand.
4. **Display.** An "Overdue" badge, a word with an icon in the critical colour, never colour alone,
   next to the due date on the list. The due date stays visible. The number of days late is not
   shown.
5. **Not in this decision.** An "Overdue only" filter (adding it to the D-097 filters needs approval),
   a count of overdue tasks, Event Health or alert use of the rule (the "Critical Alert View" and Event
   Health use their own approved contracts), reminders, "due today" or "due soon" badges, and
   automatic status changes.

**Known debt.** `manilaToday` is repeated in `tasks/domain/due-date.ts` for the same boundary reason
as the other due-date helpers (D-096, point 9).

**Evidence.** `tasks/overdue.test.ts` (boundaries, Done, no date, month and year edges, invalid
input, Philippine midnight, leap day), `tasks/ui/TaskList.test.tsx` (badge on the right tasks only),
and `src/app/(app)/events/[eventId]/tasks/page.test.tsx` (a fixed clock, Viewer, filtered list).
**Not yet run:** a browser check at 375 and 1280 px.

---
## D-099 Tasks: event scope and authorization, verified

**Status:** Proposed (B6-F11, B6-F12). **No behaviour changed and no migration.** Both features were
built with the earlier task work (D-002, D-035, D-036, D-094, D-095). This task checked that they are
complete against PROJECT_RULES sections 6 and 7, found no gap in the code, and added tests for the
cases that were not yet covered.

**What guarantees each point (and where it is tested).**

1. **A task belongs to exactly one event.** `tasks.eventId` is required, with a foreign key to
   `events` and deletion with the event (D-004); `(eventId, number)` and `(eventId, id)` are unique,
   and the assignee is a composite key `(eventId, assigneeId)` to `event_members(eventId, id)`
   (D-002, D-095). Every repository read and write filters by the event ID that authorization
   returned. Tested against PostgreSQL: a task with no event and a repeated number are refused;
   another event's task, or member, is "not found" through this event's ID for reading, editing and
   deleting; nothing changes in either event.
2. **Viewing:** every member reads (`event.view`); a non-member gets "not found", the same as an event
   that does not exist. Tested in `queries.test.ts`, `page.test.tsx` and the all-pages
   `access-coverage.test.tsx`.
3. **Modifying:** Owners and Coordinators only (`tasks.manage`, D-035). Viewers cannot create, edit or
   delete. Checked **three times:** the page, the server action (`authorizeEvent`, guarded for every
   action file by `action-coverage.test.ts`) and again inside the storage statement itself, so a role
   that changed after the check writes nothing. Tested: Viewer, member of another event, an Owner and
   a Coordinator allowed, and a Coordinator demoted to Viewer between the check and the write.
4. **Never trusting the client:** the event, task and assignee IDs from the form are verified inside
   the authorized event; the title, edit version and assignee are validated on the server; the
   numbers, times and totals shown are stored or derived values.
5. **Refusals change nothing and say little:** a refused write leaves rows, the task counter and
   Activity as they were (compared before and after in the database tests) and does not reveal
   whether the other event or task exists.

**Added in this task:** database tests (editing another event's task through this event's ID, a
member of another event creating or editing, Owner and Coordinator allowed, role re-checked at write
time, refused orphan and duplicate number) and the Add and Edit page tests
(`tasks/form-pages.test.tsx`). **Not changed:** the permission matrix; the matrix still says "Create,
assign and complete tasks" for Owners and Coordinators (D-035). An assigned Viewer still cannot mark
their own task Done (D-096, point 4); changing that would change the matrix and needs approval.

**Not yet run:** a browser check, Playwright, and the 3 `db.test` files blocked by the pre-existing
`createPrismaClient` problem.

---
## D-100 Tasks: validation, audit, states and phone layout, verified

**Status:** Proposed (B6-F13 to B6-F16). No schema change, no migration, no new permission. Like D-099,
these four were mostly built with the earlier task work; each was checked against PROJECT_RULES
(sections 8, 11, 12, 13) and the findings are below. Two small changes came out of the check.

**B6-F13 Validation.** Checked and complete on the server (the browser never decides): title 1 to 120
characters and not blank, description at most 2,000, priority and status from fixed lists, due date a
real day from 2000 to 2100 or empty, assignee a UUID that is then looked up inside the authorized
event and again by the database's composite key, edit version required. Unknown fields are ignored.
**Changed:** a NUL character in the title or description is now refused with "Remove the invisible
character this text contains, then try again." as on suppliers and accessibility (B3-19). Before, it
passed validation and failed in PostgreSQL as a vague "couldn't save". **Not changed:** a title may
still contain line breaks if posted by hand; D-094 says "trimmed" and inner spacing is stored as
typed.

**B6-F14 Audit and Activity.** Checked and complete: `task.created`, `task.updated` and `task.deleted`
are in the audit registry with strict details (free text only as "changed"), are written in the same
transaction as the change, are never written for an unchanged, refused or stale save, and are worded
by `audit/describe.ts` on Activity. Documented in `docs/audit.md`. **Added:** a database test that
stores real entries (Owner creates, Coordinator edits, Owner deletes) and checks who, the order and
the Activity wording. Removing a member unassigns their tasks without an entry (D-095, point 5).

**B6-F15 Error and empty states.** Checked and complete: empty list (differs for managers and
Viewers), no filter match with a way back, loading screen, error screen with a retry and no internal
details, field errors in a summary that links to each field, unchanged and stale saves, failed save
and failed delete ("Nothing was saved" / "Nothing was removed"), refused role and 404 for another
event's task. **Added:** a test for the Viewer's empty state. **Known limit:** if the browser cannot
reach the server at all while deleting, the error screen appears instead of an inline message. The
other delete buttons behave the same way.

**B6-F16 Responsive interface.** Rendered the real list, filtered, empty, Viewer, Add and error-state
pages to HTML with the project's compiled Tailwind and measured them in Chromium at 375 and 1280 px.
Result: no horizontal scroll, every button, link, field and select at least 44 px tall, long titles,
unbroken words and long names wrap, Edit and Delete stack full width on a phone and sit beside the
card on a desktop. **Changed:** on a phone the filter form was six stacked fields before the first
task; Status and Priority now share a row (a date field clipped when halved, so dates keep a full
row). **Not tested:** the running app inside its sidebar and header (not rendered here), real touch
devices, or a screen reader.

**Not yet run:** Playwright on the running app and `prisma migrate dev` for drift.

---

## D-101 Impact Detection: the engine, the change and the rules

**Status:** Approved by the technical lead on 2026-10-20 (B7 plan: "go on" to the recommended options
1a, 3a, 4a, 5a, 6a, 7 and 9). The per-rule severities are in `docs/impact-rules.md`. **Technical lead:
please confirm the catering severity** (point 4 below), which the plan did not state.

**Context.** Batch 7 (B7-F01 to B7-F18): "change one thing, see everything it affects". PROJECT_RULES
section 10 requires deterministic rules that never mutate data, never decide authorization, reuse
existing calculations and keep simulations apart from facts.

**Decision.**

1. **One kind of change (1a):** expected attendees, from the stored value to a proposed whole number
   from 0 to 1,000,000. The engine's shape allows other kinds later; each needs approval.
2. **A pure engine** (`impact/domain/run-impact.ts`) runs a fixed list of rules (`domain/registry.ts`):
   seating, catering, budget, accessibility, related tasks. Same input, same output, same order. It
   reads and writes nothing.
3. **Severity scale:** Critical, Needs attention, Info, Passed; overall = most serious; most serious
   first, then by area.
4. **Rules** as in `docs/impact-rules.md`: seating 3a; budget 5a (whole event and the chosen catering
   category, increase only); accessibility 4a (Batch 3 alerts unchanged plus a ratio estimate);
   related tasks 6a (fixed word list). **Catering, chosen while building:** an increase is Needs
   attention, a decrease or ₱0.00 is Info, no cost per head is Info. Critical is left to the budget
   rule, which knows the limits.
5. **Reuse through public interfaces (D-001).** The budget rule receives the budget's own
   `summarizeEventBudget`, `toCentavos`, `fromCentavos` and `formatPesos`; `budget/public.ts` now
   exports them (and `parsePesos`, so assumptions use the one peso rule). The event state is read
   through each context's own authorized read: `getEventBudget`, `getAccessibilityOverview`,
   `getAccessibilityAlerts`, `getEventTasks`. Nothing is recalculated in the impact context.
6. **Every item explains itself:** a reason with the numbers compared, the assumptions used, Estimate
   or From your records, the records involved (task IDs) and where to act.

**Not in this decision:** transport and volunteer rules (open item 2 stays open), applying a change
from the Impact page, Event Health, alerts.

---

## D-102 Impact assumptions

**Status:** Approved by the technical lead on 2026-10-20 (B7 plan, options 2a, 4a and 5a).

**Decision.**

1. **Three optional assumptions per event, none with a default (2a):** catering cost per head
   (`DECIMAL(12,2)`, 0 or more), accessible seats per 100 guests (`DECIMAL(5,2)`, 0 to 100), catering
   budget category (a budget category of the same event). A rule that needs a missing value reports
   Info and guesses nothing.
2. **Storage:** table `event_impact_assumptions`, one row per event (primary key `eventId`), deleted
   with the event. No row means nothing is set. CHECKs on both ranges.
3. **Cross-event safety (D-002):** the category is a composite foreign key
   `(eventId, cateringCategoryId)` → `budget_categories(eventId, id)`, NO ACTION. The trigger
   `budget_categories_clear_impact_catering` clears it (and moves `updatedAt`) before a category is
   deleted, so deleting a category is never blocked and the budget code is not changed. The server
   also looks the category up inside the event and says "Choose a budget category of this event, or
   none."
4. **Editing:** Owners and Coordinators (`impact.assumptions`, already in the matrix). Stale saves
   are refused (D-032); an unchanged save writes nothing. Viewers see them read-only.
5. **Seat estimate rounding:** people × ratio ÷ 100, rounded **up** to a whole seat, in integers.
6. **Audit:** `impact_assumptions.updated`, entity `event`, only the changed values; the category by
   name.

---

## D-103 Saved impact analyses and the `impact.record` permission

**Status:** Approved by the technical lead on 2026-10-20 (B7 plan, option 8a, including the new
permission).

**Decision.**

1. **Previewing saves nothing.** "Save to history" stores one analysis as a snapshot: the change,
   the assumptions as they read then (category by name), the overall severity, the counts and every
   item as shown. Validated by `impactSnapshotSchema` on write and again on read; a stored snapshot
   that doesn't fit is left out, never shown half-understood.
2. **Table `impact_analyses`:** readable ID `IMP-0001` per event from `events.lastImpactNumber`
   (issued with a role check in the same statement, never reused), `fromAttendees`, `toAttendees`,
   `overallSeverity` (enum `impact_severity`), `result` JSONB (a CHECK keeps it an object), who saved
   it (SET NULL if the user is deleted). Append-only by trigger, like the audit log (D-037); removed
   only with the event.
3. **The save never trusts the browser.** The action runs the analysis again from stored data. It is
   refused when the stored expected attendees or the assumptions' version differ from what the user
   saw ("changed since this analysis ran"), and when there is no change.
4. **Permission `impact.record`:** Owner and Coordinator. A permission-matrix change, approved with
   option 8a. Running a preview and reading the history need only `event.view`.
5. **Display:** newest first, the latest 20, each labelled "Simulation: not a change to the event".
6. **Audit:** `impact_analysis.created`, with the readable ID, from, to and overall severity.

---

## D-104 The Impact page

**Status:** Approved by the technical lead on 2026-10-20 (B7 plan, slice 3).

**Decision.**

1. **The proposal is in the address** (`/events/<id>/impact?to=220`), submitted by a plain GET form.
   The analysis is server-rendered, works without JavaScript, survives a reload and can be shared
   with another member, who sees it under their own permissions.
2. **Sections:** Try a change; Results (summary, then one card per item, then Save to history for
   Owners and Coordinators); Assumptions (form, or read-only for Viewers); Saved analyses.
3. **States:** loading and error screens (no internal details); invalid number as a field error
   with the typed value kept; "Nothing to analyze"; empty history; "Couldn't analyze this event" when
   a read fails; notices for saved assumptions, unchanged assumptions and a saved analysis (only known
   kinds and well-formed `IMP-` references from the address).
4. **Layout:** one column of cards at every width, 44 px controls, no sideways scroll (checked in
   Chromium at 375 and 1280 px).

---

## D-105 Event Health: the checks

**Status:** Approved by the technical lead on 2026-10-20 (B8 plan: "approve" to the 13 checks as
listed). By approving the task check (T1), the technical lead also confirms D-098 point 1:
"incomplete" means Not started or In progress.

**Context.** Batch 8 (B8-F01 to B8-F20). PROJECT_RULES section 5.4: reuse existing domain
calculations; never a second calculation for a new screen.

**Decision.**

1. **Thirteen fixed checks** across attendees (A1 to A5), suppliers (S1 to S3), budget (B1, B2),
   accessibility (X1) and tasks (T1, T2), as listed in `docs/health-rules.md`. Each counts once.
2. **Outcomes:** Critical, Needs attention, Passed, Not checked (nothing to check yet; left out of the
   score).
3. **A supplier is "confirmed" when it has an Accepted quote** (D-076).
4. **Reuse through public interfaces (D-001).** The reader calls each context's own authorized read
   and rule: `getAttendeeHealthFacts` and `expectedHeadcount` (attendees), `getEventSuppliers` with
   its overview (suppliers), `getEventBudget`, `summarizeEventBudget`, `overBudgetWarnings` and
   `formatPesos` (budget), `getAccessibilityOverview`, `getAccessibilityAlerts` and
   `READINESS_STATUS_DEFINITIONS` (accessibility), `getEventTasks`, `isTaskOverdue` and `manilaToday`
   (tasks). The budget, tasks and accessibility public files gained those exports; no rule changed.
5. **New attendee read `getAttendeeHealthFacts`** (`event.view`): returns each guest's number, name,
   RSVP, plus-ones and only **whether** they have an email or phone. Viewers can't see contact details
   (`attendees.private`), so no contact value ever leaves the attendees module this way.
6. **Never stored** (schema rule "Event health is computed on demand"). No migration.

---

## D-106 Event Health: score and status

**Status:** Approved by the technical lead on 2026-10-20 (B8 plan, options 3a and 4a).

**Decision.**

1. **Score (3a):** passed checks ÷ checks evaluated × 100, rounded down; Not checked left out. No
   score while nothing is evaluated.
2. **Status (4a):** At risk if any check is Critical; otherwise Needs attention if any needs
   attention; otherwise Ready. The score never decides the status. No status while nothing is
   evaluated ("Nothing to check yet").
3. **Issue order:** Critical first, then Needs attention; within each, the area order, then the check
   order.

---

## D-107 Dashboard, Health page and Critical Alert View

**Status:** Approved by the technical lead on 2026-10-20 (B8 plan, options 1a, 5a, 6a and point 7).

**Decision.**

1. **Overview is the dashboard (1a):** health status and score, a summary tile per area (confirmed of
   expected, suppliers confirmed, budget left, accessibility status, open and overdue tasks), "Needs
   your attention" with the top 5 issues and links to the rest and to the critical ones, and recent
   activity. If health can't be read, a warning says so and the rest of the page stays.
2. **Health page** (`/events/<id>/health`, linked in the sidebar after Overview): every issue and
   every check by area, with reasons.
3. **Critical Alert View (5a):** `?show=critical` on the Health page: only Critical issues from the
   current records, each with why and a link to its section. It uses Event Health's checks and the
   same severity look as Impact (B7). Impact simulations are not included (they are not facts).
   Nothing is stored, sent or dismissed; no QR, push, SMS or alert engine (PROJECT_RULES 2.2).
4. **The Batch 3 accessibility alert on the Overview is replaced** by the health attention list
   (point 7), so accessibility gaps appear once. `EventAccessibilityAlert` was removed; the guest
   page's alerts are unchanged. The Batch 3 browser test now looks for the gap in the attention list.
5. **Recent activity (6a):** the last 5 entries of the existing Activity feed, worded by
   `describeAuditEntry`, shown only to Owners and Coordinators (`audit.view`). Viewers don't see it.