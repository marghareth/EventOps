<!-- docs/DATA_MODEL.md -->

# Data model

The source of truth is `prisma/schema.prisma` plus the migrations in `prisma/migrations/`. This page
explains the rules the schema alone does not make obvious. Decisions are recorded in
[DECISIONS.md](DECISIONS.md).

**Status (B2-01):** the database has `users`, `events`, `event_members`,
`event_reference_counters`, `audit_logs` and `attendees`, created by migrations
`20261009143000_init` (B0-08), `20261011090000_event_ownership` (B1-01), `20261012090000_audit_log`
(B1-11) and `20261012120000_attendees` (B2-01). Other tables are added by their batch tasks (D-008).

## Connections

| Used by                              | Variable            | Connection                                                         |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| The app at runtime (`src/lib/db.ts`) | `DATABASE_URL`      | Supabase pooled connection (Supavisor transaction mode, port 6543) |
| The Prisma CLI (`prisma.config.ts`)  | `DIRECT_URL`        | Direct connection, port 5432, for migrations                       |
| Database tests (`npm run test:db`)   | `TEST_DATABASE_URL` | A separate, migrated test database                                 |

The app gets its client from `getDb()` in `src/lib/db.ts`, which is server-only. Prisma bypasses
Supabase row-level security, so every caller must authorize first.

## Tables

### `users` (model `User`, D-009)

Mirror of the Supabase Auth user, same `id`. Created on first sign-in.

| Column        | Type      | Rules                                                          |
| ------------- | --------- | -------------------------------------------------------------- |
| `id`          | uuid      | Primary key; equals `auth.users.id`. No FK to the auth schema. |
| `displayName` | text      | Required                                                       |
| `email`       | text      | Required, unique                                               |
| `createdAt`   | timestamp | Defaults to now                                                |

### `events` (model `Event`)

| Column                   | Type          | Rules                                                                                                                            |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | uuid          | Primary key, generated                                                                                                           |
| `reference`              | text          | Required, unique, for example `EVT-2026-0001` (D-005)                                                                            |
| `name`                   | varchar(120)  | Required, not blank (CHECK), at most 120 characters (D-023)                                                                      |
| `description`            | varchar(5000) | Optional, at most 5,000 characters (D-023)                                                                                       |
| `venue`                  | varchar(200)  | Optional, at most 200 characters (D-023)                                                                                         |
| `startsAt`               | timestamp     | Required                                                                                                                         |
| `endsAt`                 | timestamp     | Optional; not before `startsAt` (CHECK)                                                                                          |
| `capacity`               | integer       | Optional; greater than 0 when set (CHECK)                                                                                        |
| `expectedAttendees`      | integer       | Defaults to 0; not negative (CHECK). A planning number, not a count of records.                                                  |
| `status`                 | event_status  | `DRAFT` (default), `PLANNING`, `LIVE`, `COMPLETED`, `CANCELLED`                                                                  |
| `createdById`            | uuid          | Required; FK to `users.id`, ON DELETE RESTRICT (D-011)                                                                           |
| `createdAt`, `updatedAt` | timestamp     | `createdAt` set on insert. `updatedAt` set by Prisma on every update through the client; raw SQL updates must set it themselves. |

Indexes: `reference` (unique), `createdById`, `(status, startsAt)`.

**Ownership (D-022):** every event has at least one `OWNER` membership. See "Ownership trigger"
below. The creator (`createdById`) records who made the event; the `OWNER` memberships decide who
owns it.

### `event_members` (model `EventMember`)

| Column      | Type        | Rules                                |
| ----------- | ----------- | ------------------------------------ |
| `id`        | uuid        | Primary key, generated               |
| `eventId`   | uuid        | FK to `events.id`, ON DELETE CASCADE |
| `userId`    | uuid        | FK to `users.id`, ON DELETE CASCADE  |
| `role`      | member_role | `OWNER`, `COORDINATOR` or `VIEWER`   |
| `createdAt` | timestamp   | Defaults to now                      |

Indexes: `(eventId, userId)` unique (one membership per user per event), `(eventId, id)` unique
(target for composite foreign keys, D-002), `userId`.

### `event_reference_counters` (model `EventReferenceCounter`, D-005)

| Column       | Type      | Rules                                     |
| ------------ | --------- | ----------------------------------------- |
| `year`       | integer   | Primary key, creation year in Asia/Manila |
| `lastNumber` | integer   | Last number issued for that year          |
| `updatedAt`  | timestamp | Set automatically                         |

### `audit_logs` (model `AuditLog`, D-037)

Append-only record of meaningful changes inside an event. Rules and the list of actions:
[AUDIT.md](AUDIT.md).

| Column                   | Type              | Rules                                                             |
| ------------------------ | ----------------- | ----------------------------------------------------------------- |
| `id`                     | uuid              | Primary key                                                       |
| `eventId`                | uuid              | Required. Foreign key to `events`, cascade on delete (D-004)      |
| `actorId`                | uuid              | Foreign key to `users`, set to NULL if the user is deleted        |
| `action`                 | varchar(64)       | `<entity>.<verb>`, from the audit registry only                   |
| `entityType`, `entityId` | varchar(64), uuid | Both set or both NULL; no foreign key, so entries outlive records |
| `details`                | jsonb             | Validated against the action's schema on write and on read        |
| `createdAt`              | timestamp         | Set automatically                                                 |

Indexes: `(eventId, createdAt)`, `(eventId, entityType, entityId)`, `actorId`.

### `attendees` (model `Attendee`, B2-01, D-042)

A guest of exactly one event. It cannot exist without its event and is deleted with it (D-004).

| Column         | Type                    | Notes                                                                 |
| -------------- | ----------------------- | --------------------------------------------------------------------- |
| `id`           | uuid                    | Primary key                                                           |
| `eventId`      | uuid                    | Required. Foreign key to `events`, `ON DELETE CASCADE`                |
| `number`       | integer                 | Readable ID `ATT-0001`, per event, from `events.lastAttendeeNumber`   |
| `name`         | varchar(120)            | Required, not blank                                                   |
| `email`        | varchar(254), optional  | Stored trimmed and lower case                                         |
| `phone`        | varchar(32), optional   | Local or international format, 7 to 15 digits (checked by the app)    |
| `category`     | varchar(60), optional   | Free text, for example "Family"                                       |
| `rsvpStatus`   | enum `rsvp_status`      | `PENDING`, `CONFIRMED`, `DECLINED`, `MAYBE`. New attendees: `PENDING` |
| `plusOnes`     | integer                 | Guests coming with the attendee, 0 to 10                              |
| `dietaryNeeds` | varchar(500), optional  | Free text                                                             |
| `notes`        | varchar(2000), optional | Free text                                                             |
| `createdAt`    | timestamp               | Set automatically                                                     |
| `updatedAt`    | timestamp               | Set on every change; edits refuse stale saves with it (D-032, D-042)  |

Indexes: unique `(eventId, number)`, unique `(eventId, id)` (target of composite foreign keys,
D-002), `(eventId, name)` for the guest list, `(eventId, rsvpStatus)` for RSVP filters and counts.

- **Numbers** come from `events.lastAttendeeNumber`, incremented with raw SQL in the same
  transaction as the insert (so the event's `updatedAt`, its edit version, does not move). The
  statement also checks the creator's role. Numbers are never reused, even after a removal; a
  rolled-back addition releases its number.
- **Duplicates are allowed**: the same name or email can appear twice in an event.
- **Defaults are business rules** (RSVP `PENDING`, no plus-ones), so they are set by the domain,
  not by column defaults.
- **Plus-ones** are a count, not named records. See "Plus-ones and headcount" below (D-046).

## Plus-ones and headcount (B2-05, D-046)

Decided by the technical lead on 2026-10-13, before implementation.

**Representation.** A plus-one is not a guest record. Each attendee has `plusOnes`, a whole number
from 0 to 10 (0 = no plus-one). Plus-ones belong to that attendee: they are edited on the
attendee, set to 0 to remove them, and go when the attendee is removed. They have no name, contact
details, dietary needs or RSVP of their own; anything about them goes in the attendee's notes.

**Expected headcount from the guest list.** Calculated on demand, never stored, by one pure
function (`expectedHeadcount` in `src/modules/events/attendees/headcount.ts`). Every screen uses it.

| RSVP        | Counts toward the expected headcount | Shown as                               |
| ----------- | ------------------------------------ | -------------------------------------- |
| `CONFIRMED` | 1 + plus-ones                        | Expected headcount                     |
| `PENDING`   | 0                                    | Not yet confirmed (1 + plus-ones each) |
| `MAYBE`     | 0                                    | Not yet confirmed (1 + plus-ones each) |
| `DECLINED`  | 0 (their plus-ones count 0 too)      | Declined (attendees only)              |

Example: 8 Confirmed attendees bringing 4 plus-ones in total give an expected headcount of 12.

**Not the planning number.** `events.expectedAttendees` is the number typed on Settings for
planning. The guest-list headcount never changes it; the two are shown with different labels.
Comparing them belongs to Impact and Event Health.

**Not live attendance.** This is the expected headcount before the event. How plus-ones are counted
when guests arrive (live attendance) is decided with the Live Attendance Count task (DECISIONS.md
open item 4).

## CHECK constraints (D-010)

Prisma cannot express these, so they are written by hand at the end of the migration that creates
the table. Prisma does not diff CHECK constraints, so later generated migrations leave them in
place.

| Constraint                           | Rule                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `events_name_not_blank`              | `name` contains at least one non-space character.                                                   |
| `events_capacity_positive`           | `capacity` is NULL or greater than 0.                                                               |
| `events_expected_attendees_nonneg`   | `expectedAttendees` is 0 or more.                                                                   |
| `events_ends_not_before_start`       | `endsAt` is NULL or not earlier than `startsAt`.                                                    |
| `audit_logs_action_format`           | `action` looks like `<entity>.<verb>` in lower case.                                                |
| `audit_logs_entity_pair`             | `entityType` and `entityId` are both set or both NULL.                                              |
| `events_last_attendee_number_nonneg` | `lastAttendeeNumber` is 0 or more.                                                                  |
| `attendees_name_not_blank`           | `name` contains at least one non-space character.                                                   |
| `attendees_number_positive`          | `number` is 1 or more.                                                                              |
| `attendees_plus_ones_range`          | `plusOnes` is from 0 to 10.                                                                         |
| `attendees_optional_text_not_blank`  | `email`, `phone`, `category`, `dietaryNeeds` and `notes` are NULL or contain a non-space character. |

## Ownership trigger (D-022)

Hand-written in migration `20261011090000_event_ownership`. Prisma does not diff triggers, so later
generated migrations leave them in place.

| Trigger                    | When                                     | Rule                                                               |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `events_must_have_owner`   | After an event is inserted               | The event has an `OWNER` membership by the end of the transaction. |
| `event_members_keep_owner` | After a membership is updated or deleted | The event still has an `OWNER` by the end of the transaction.      |

Both are deferred: they check at commit, so an event and its first `OWNER` can be written in either
order inside one transaction (or as one nested Prisma create). Deleting a whole event is allowed;
its memberships go with it.

A violation fails with Postgres code `23514` and a message that starts with
`events_must_have_owner:`. Database drivers do not reliably pass the constraint name through, so
the app recognises the error by that message prefix.

## Append-only audit log (D-037)

Trigger `audit_logs_append_only` (migration `20261012090000_audit_log`) rejects any UPDATE or
DELETE on `audit_logs` issued directly, with an error starting `audit_logs_append_only:`. Changes made
by a foreign key action still happen: deleting an event removes its entries (D-004), and deleting a
user sets `actorId` to NULL. The trigger tells them apart by trigger depth (a foreign key action runs
inside its own trigger).

## Deletion behaviour

Who may delete what is set by the permission matrix (D-031, D-033).

| Deleted row     | Effect                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Event           | Owners only (D-033). Its memberships, attendees and audit log are deleted (cascade). Later event-owned tables also cascade (D-004).     |
| Attendee        | Owners and Coordinators (`attendees.manage`, D-035). Permanently deleted; an `attendee.deleted` audit entry keeps its number and name.  |
| User            | Blocked while the user created any event (D-011), or is the last `OWNER` of any event (D-022). Otherwise their memberships are deleted. |
| Membership      | Blocked if it is the event's last `OWNER` (D-022). Demoting or moving the last `OWNER` is blocked too.                                  |
| Audit log entry | Never deleted directly (D-037). Removed only with its event.                                                                            |

## Reading events

Events are only ever read through a membership filter (`members: { some: { userId } }`), using the
user ID from the server session (D-026). The list uses the `event_members (userId)` index.

## Rules for tables added later

These decisions already apply to the tables later tasks will add:

- Money is `Decimal(12, 2)` in Philippine pesos, never floating point.
- Every event-owned table has `eventId`, an index that starts with it, and an `ON DELETE CASCADE`
  foreign key to `events` (D-004). `delete-event.db.test.ts` fails if any foreign key to `events`
  does not cascade.
- Links between two event-owned rows are composite foreign keys on `(eventId, id)`; optional ones use
  `ON DELETE NO ACTION`, and delete use cases unlink first (D-002).
- Supplier money: paid = sum of supplier payments, committed = accepted quote, payment status
  computed (D-003).
- JSON columns are validated with Zod on every read and write.