<!-- docs/DECISIONS.md -->

# Decision log

Decisions that shape EventOps' architecture, data and behaviour. PROJECT_RULES section 2 sets the
authority order: the human technical lead decides, and this file records the decision.

Status values:

- **Approved**: the technical lead chose this.
- **Proposed**: written down so it is not a silent assumption. Needs the technical lead's sign-off.
  The code may already follow it; if it is rejected, the code changes.
- **Superseded**: replaced by a later entry.

| ID    | Title                                                 | Status   | Date       |
| ----- | ----------------------------------------------------- | -------- | ---------- |
| D-001 | Module layout and import boundaries                   | Proposed | 2026-10-09 |
| D-002 | Cross-event integrity with composite foreign keys     | Proposed | 2026-10-09 |
| D-003 | Supplier records are the source of truth for money    | Approved | 2026-10-09 |
| D-004 | Deleting an event purges its audit log                | Approved | 2026-10-09 |
| D-005 | Event reference numbers come from a per-year counter  | Proposed | 2026-10-09 |
| D-006 | Upper-case documentation file names                   | Approved | 2026-10-09 |
| D-007 | Exact dependency versions in package.json             | Proposed | 2026-10-09 |
| D-008 | B0-08 initial schema covers users and events only     | Approved | 2026-10-09 |
| D-009 | The Supabase user mirror is `User` (table `users`)    | Approved | 2026-10-09 |
| D-010 | CHECK constraints on events                           | Approved | 2026-10-09 |
| D-011 | An event's creator cannot be deleted                  | Approved | 2026-10-09 |
| D-012 | B0-09 includes minimal sign-in and sign-up pages      | Approved | 2026-10-09 |
| D-013 | Server checks verify the user with getUser()          | Approved | 2026-10-09 |
| D-014 | Email confirmation is required                        | Approved | 2026-10-09 |
| D-015 | Passwords have at least 8 characters                  | Approved | 2026-10-09 |
| D-016 | The users row is created at sign-in, not by a trigger | Proposed | 2026-10-09 |
| D-017 | Public routes, landing page and sign-out scope        | Proposed | 2026-10-09 |

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
- Who may delete an event is set by the permission matrix, which is not yet documented.
- Since D-008, only `event_members` hangs off `events` (cascade). The audit table and the others
  are added by later tasks, each with an `ON DELETE CASCADE` foreign key to `events`.

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
7. **Permission matrix.** Owner, Coordinator and Viewer permissions are not documented. D-002,
   D-004 and D-011 depend on it.
8. **Last owner.** Nothing stops an event from losing its last Owner membership (for example when
   that user is deleted). Whether this must be blocked, and where, is a permission-matrix question.