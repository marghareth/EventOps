<!-- docs/DATA_MODEL.md -->

# Data model

The source of truth is `prisma/schema.prisma` plus the migrations in `prisma/migrations/`. This page
explains the rules the schema alone does not make obvious. Decisions are recorded in
[DECISIONS.md](DECISIONS.md).

**Status (B1-01):** the database has `users`, `events`, `event_members` and
`event_reference_counters`, created by migrations `20261009143000_init` (B0-08) and
`20261011090000_event_ownership` (B1-01). Other tables are added by their batch tasks (D-008). No
event feature code reads or writes these tables yet; B1-02 onwards add it.

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

## CHECK constraints (D-010)

Prisma cannot express these, so they are written by hand at the end of the init migration. Prisma
does not diff CHECK constraints, so later generated migrations leave them in place.

| Constraint                         | Rule                                              |
| ---------------------------------- | ------------------------------------------------- |
| `events_name_not_blank`            | `name` contains at least one non-space character. |
| `events_capacity_positive`         | `capacity` is NULL or greater than 0.             |
| `events_expected_attendees_nonneg` | `expectedAttendees` is 0 or more.                 |
| `events_ends_not_before_start`     | `endsAt` is NULL or not earlier than `startsAt`.  |

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

## Deletion behaviour

Who may delete what is set by the permission matrix, which is not yet documented.

| Deleted row | Effect                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Event       | Its memberships are deleted (cascade). Later event-owned tables also cascade (D-004).                                                   |
| User        | Blocked while the user created any event (D-011), or is the last `OWNER` of any event (D-022). Otherwise their memberships are deleted. |
| Membership  | Blocked if it is the event's last `OWNER` (D-022). Demoting or moving the last `OWNER` is blocked too.                                  |

## Rules for tables added later

These decisions already apply to the tables later tasks will add:

- Money is `Decimal(12, 2)` in Philippine pesos, never floating point.
- Every event-owned table has `eventId`, an index that starts with it, and an `ON DELETE CASCADE`
  foreign key to `events` (D-004).
- Links between two event-owned rows are composite foreign keys on `(eventId, id)`; optional ones use
  `ON DELETE NO ACTION`, and delete use cases unlink first (D-002).
- Supplier money: paid = sum of supplier payments, committed = accepted quote, payment status
  computed (D-003).
- JSON columns are validated with Zod on every read and write.