<!-- docs/data-model.md -->

# Data model

The source of truth is `prisma/schema.prisma` plus the migrations in `prisma/migrations/`. This page
explains the rules the schema alone does not make obvious. Decisions are recorded in
[DECISIONS.md](DECISIONS.md).

**Status (B4-12):** the database has `users`, `events`, `event_members`,
`event_reference_counters`, `audit_logs`, `attendees`, `accessibility_requirements`,
`accessibility_resources`, `suppliers`, `supplier_quotes` and `supplier_payments`, created by
migrations `20261009143000_init` (B0-08),
`20261011090000_event_ownership` (B1-01), `20261012090000_audit_log` (B1-11),
`20261012120000_attendees` (B2-01), `20261013120000_accessibility` (B3-01) and
`20261014090000_suppliers` (B4-01), `20261014120000_supplier_quotes` (B4-08) and
`20261014150000_supplier_payments` (B4-12). Other tables are added by their batch tasks (D-008).

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

| Column                                     | Type          | Rules                                                                                                                                 |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                       | uuid          | Primary key, generated                                                                                                                |
| `reference`                                | text          | Required, unique, for example `EVT-2026-0001` (D-005)                                                                                 |
| `name`                                     | varchar(120)  | Required, not blank (CHECK), at most 120 characters (D-023)                                                                           |
| `description`                              | varchar(5000) | Optional, at most 5,000 characters (D-023)                                                                                            |
| `venue`                                    | varchar(200)  | Optional, at most 200 characters (D-023)                                                                                              |
| `startsAt`                                 | timestamp     | Required                                                                                                                              |
| `endsAt`                                   | timestamp     | Optional; not before `startsAt` (CHECK)                                                                                               |
| `capacity`                                 | integer       | Optional; greater than 0 when set (CHECK)                                                                                             |
| `expectedAttendees`                        | integer       | Defaults to 0; not negative (CHECK). A planning number, not a count of records.                                                       |
| `lastAttendeeNumber`, `lastSupplierNumber` | integer       | Last readable number issued (`ATT-`, `SUP-`); 0 or more (CHECK); incremented in the creating transaction, never reused (D-042, D-068) |
| `status`                                   | event_status  | `DRAFT` (default), `PLANNING`, `LIVE`, `COMPLETED`, `CANCELLED`                                                                       |
| `createdById`                              | uuid          | Required; FK to `users.id`, ON DELETE RESTRICT (D-011)                                                                                |
| `createdAt`, `updatedAt`                   | timestamp     | `createdAt` set on insert. `updatedAt` set by Prisma on every update through the client; raw SQL updates must set it themselves.      |

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
| `dietaryNeeds` | varchar(500), optional  | Free text; several needs separated by semicolons (D-047)              |
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

### `accessibility_requirements` (model `AccessibilityRequirement`, B3-01, D-056)

One need of one attendee. Several needs are several rows. What each type and priority means is in
"Accessibility requirements and resources" below (D-057).

| Column       | Type                                  | Notes                                                                                                       |
| ------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`         | uuid                                  | Primary key                                                                                                 |
| `eventId`    | uuid                                  | Required. Foreign key to `events`, `ON DELETE CASCADE`                                                      |
| `attendeeId` | uuid                                  | Required. With `eventId`, a composite foreign key to `attendees (eventId, id)`, `ON DELETE CASCADE` (D-002) |
| `type`       | enum `accessibility_requirement_type` | One of the seven requirement types (D-057)                                                                  |
| `priority`   | enum `requirement_priority`           | `REQUIRED`, `PREFERRED` or `INFORMATIONAL`. New requirements: `REQUIRED`                                    |
| `note`       | varchar(500), optional                | Free text. Required for `OTHER`. Owners and Coordinators only (D-058)                                       |
| `createdAt`  | timestamp                             | Set automatically                                                                                           |
| `updatedAt`  | timestamp                             | Set on every change; edits refuse stale saves with it (D-032)                                               |

Indexes: unique `(eventId, attendeeId, type)` (one requirement of each type per attendee), unique
`(eventId, id)` (target of later composite foreign keys, D-002), `(eventId, type)` for counting needs
across the event.

- **Can't cross events.** The composite foreign key means a requirement in event A can never point
  at an attendee of event B, whatever the application sends.
- **Goes with its attendee** (D-045) and with its event (D-004).

### `accessibility_resources` (model `AccessibilityResource`, B3-01, D-056)

What the event provides for one resource type. No row for a type means "Not set up".

| Column      | Type                               | Notes                                                                 |
| ----------- | ---------------------------------- | --------------------------------------------------------------------- |
| `id`        | uuid                               | Primary key                                                           |
| `eventId`   | uuid                               | Required. Foreign key to `events`, `ON DELETE CASCADE`                |
| `type`      | enum `accessibility_resource_type` | One of the six resource types (D-057)                                 |
| `status`    | enum `resource_status`             | `NOT_AVAILABLE`, `ARRANGING` or `AVAILABLE`                           |
| `quantity`  | integer, optional                  | Accessible seats only: how many, 0 or more. NULL for every other type |
| `note`      | varchar(500), optional             | Free text, for example "Ramp at the side entrance"                    |
| `createdAt` | timestamp                          | Set automatically                                                     |
| `updatedAt` | timestamp                          | Set on every change; edits refuse stale saves with it (D-032)         |

Indexes: unique `(eventId, type)` (one row per type per event), unique `(eventId, id)` (D-002).

### `suppliers` (model `Supplier`, B4-01, D-068)

A supplier of one event. Suppliers are strictly event-specific: the same business used for two
events is two rows, and nothing is shared between events.

| Column           | Type                     | Notes                                                                                     |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `id`             | uuid                     | Primary key                                                                               |
| `eventId`        | uuid                     | Required. Foreign key to `events`, `ON DELETE CASCADE` (D-004)                            |
| `number`         | integer                  | Readable ID `SUP-0001`, per event, from `events.lastSupplierNumber`; 1 or more (CHECK)    |
| `name`           | varchar(120)             | Required, not blank (CHECK). Duplicates allowed: the number tells them apart              |
| `category`       | enum `supplier_category` | Required; one of the canonical categories (D-069)                                         |
| `categoryDetail` | varchar(60), optional    | Required for `OTHER` (what they provide, for example "Fireworks"); NULL otherwise (CHECK) |
| `contactName`    | varchar(120), optional   | The person to talk to                                                                     |
| `email`          | varchar(254), optional   | Stored trimmed and lower case                                                             |
| `phone`          | varchar(32), optional    |                                                                                           |
| `notes`          | varchar(2000), optional  | Details the team needs, for example "Tasting on Nov 3"                                    |
| `createdAt`      | timestamp                | Set automatically                                                                         |
| `updatedAt`      | timestamp                | Set on every change; edits refuse stale saves with it (D-032)                             |

Indexes: unique `(eventId, number)`, unique `(eventId, id)` (target of later composite foreign keys
from supplier payments, budget lines and tasks, D-002), `(eventId, name)` and `(eventId, category)`
for the supplier list. Optional text is NULL or has content (CHECK). Quotes are rows of
`supplier_quotes` and deposits and payments are rows of `supplier_payments` (both below),
following D-003.

### `supplier_quotes` (model `SupplierQuote`, B4-08, D-075)

A price one supplier quoted for one event. A supplier can have several quotes (for example two
packages); at most one is Accepted (D-076), checked by the quote use cases.

| Column            | Type                   | Notes                                                                                                                                                       |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | uuid                   | Primary key                                                                                                                                                 |
| `eventId`         | uuid                   | Required. Foreign key to `events`, `ON DELETE CASCADE` (D-004)                                                                                              |
| `supplierId`      | uuid                   | Required. Composite foreign key `(eventId, supplierId)` to `suppliers (eventId, id)`, `ON DELETE CASCADE` (D-002, D-072): the supplier is in the same event |
| `number`          | integer                | Readable ID `QUO-0001`, per event, from `events.lastQuoteNumber`; 1 or more (CHECK); never reused                                                           |
| `description`     | varchar(120), optional | Tells a supplier's quotes apart, for example "Package B, 200 guests"; not blank (CHECK)                                                                     |
| `amount`          | numeric(12, 2)         | Philippine pesos, exactly two decimals; more than 0 (CHECK), at most 9,999,999,999.99                                                                       |
| `status`          | enum `quote_status`    | `PENDING` (default), `ACCEPTED` or `DECLINED` (D-076)                                                                                                       |
| `statusChangedAt` | timestamp              | When the status last changed; set on create and on every status change                                                                                      |
| `createdAt`       | timestamp              | Set automatically                                                                                                                                           |
| `updatedAt`       | timestamp              | Set on every change; edits refuse stale saves with it (D-032)                                                                                               |

Indexes: unique `(eventId, number)`, unique `(eventId, id)`, and `(eventId, supplierId, status)`
for a supplier's quotes and its accepted one.

### `supplier_payments` (model `SupplierPayment`, B4-12, D-077)

A payment owed to one supplier of one event: status tracking only, never payment processing.

| Column        | Type                         | Notes                                                                                                                    |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`          | uuid                         | Primary key                                                                                                              |
| `eventId`     | uuid                         | Required. Foreign key to `events`, `ON DELETE CASCADE` (D-004)                                                           |
| `supplierId`  | uuid                         | Required. Composite foreign key `(eventId, supplierId)` to `suppliers (eventId, id)`, `ON DELETE CASCADE` (D-002, D-072) |
| `number`      | integer                      | Readable ID `PAY-0001`, per event, from `events.lastPaymentNumber`; 1 or more (CHECK); never reused                      |
| `kind`        | enum `payment_kind`          | `DEPOSIT` or `PAYMENT` (a balance or an instalment)                                                                      |
| `description` | varchar(120), optional       | For example "50% downpayment"; not blank (CHECK)                                                                         |
| `amount`      | numeric(12, 2)               | Pesos, exactly two decimals; more than 0 (CHECK) (D-075)                                                                 |
| `dueDate`     | date                         | Required. Calendar date in Philippine time, no time; 2000-01-01 to 2100-12-31 (CHECK)                                    |
| `status`      | enum `payment_record_status` | `UNPAID` (default) or `PAID`: what is recorded. Due, overdue and upcoming are calculated (D-079)                         |
| `paidOn`      | date, optional               | The day it was paid: set for `PAID`, NULL for `UNPAID` (CHECK); same range; not in the future (app)                      |
| `createdAt`   | timestamp                    | Set automatically                                                                                                        |
| `updatedAt`   | timestamp                    | Set on every change; edits refuse stale saves with it (D-032)                                                            |

Indexes: unique `(eventId, number)`, unique `(eventId, id)`, `(eventId, supplierId, dueDate)` for a
supplier's payments, and `(eventId, status, dueDate)` for unpaid payments across the event.

## Money (D-075)

- **Currency:** Philippine pesos only. There is no currency column; every amount is pesos.
- **Precision:** `numeric(12, 2)`: exactly two decimal places (centavos), up to
  ₱9,999,999,999.99. Never floating point: amounts travel as strings from the form to the database
  (`suppliers/money.ts`) and come back as Prisma `Decimal` values, turned into strings with
  `toFixed(2)`.
- **Input:** `120000`, `120,000` or `120,000.50`, with an optional leading "₱". Refused with a clear
  message: empty, negative or zero amounts; more than two decimal places (never rounded); more than
  ₱9,999,999,999.99; anything else (`1.000,00`, `1e5`, ranges, letters, spaces inside). PostgreSQL
  would round a third decimal on its own, so the application refuses it first.
- **Display:** `₱120,000.50`, formatted from the string.
- **Arithmetic (B4-13, D-078):** sums and comparisons use whole centavos as BigInt
  (`toCentavos`, `fromCentavos`), never floating point and never rounded; an amount that isn't in
  the canonical stored form throws instead of being guessed. Committed money is the Accepted
  quote's amount (D-003, D-075); budget totals come with the budget tasks and follow the budget
  domain contract.

## Suppliers: the rules in one place (B4-25)

The tables are described above; this section summarises the rules that apply to them. Each point
links to the decision that sets it.

**Supplier model (D-068, D-073).** A supplier belongs to exactly one event; the same business used
for two events is two suppliers. Each has a readable ID per event (`SUP-0001`, never reused), a name
(duplicates allowed), a category, and optional contact person, phone, email and notes. Nothing else
personal is collected. Quotes and payments are their own rows, linked to the supplier in the same
event by composite foreign keys (D-002).

**Category rules (D-069).** One of 13 canonical values: Venue, Catering, Cake and desserts, Photo
and video, Sound and lights, Entertainment, Flowers and styling, Hair and makeup, Attire, Rentals,
Transport, Printing and stationery, Other. The list in `suppliers/categories.ts` equals the database
enum (tested). Other must say what the supplier provides (up to 60 characters, for example
"Fireworks"); for every other category that text is dropped and stored as NULL (CHECK).

**Quote statuses (D-076).** Pending (the default), Accepted, Declined. Owners and Coordinators may
set any status from any status, so mistakes can be corrected; every change is in Activity and moves
`statusChangedAt`. The one limit: a supplier has at most one Accepted quote. Accepting a second is
refused with a message naming the Accepted one, also when two arrive at the same moment (the
supplier row is locked for the transaction). Nothing changes status on its own.

**Payment statuses (D-077, D-078).** Each payment records only Unpaid or Paid, with the day it was
paid for Paid (CHECK). The supplier's payment status is calculated, never stored:

| Status            | When                                                     |
| ----------------- | -------------------------------------------------------- |
| No accepted quote | No quote is Accepted, whatever has been paid             |
| Unpaid            | A quote is Accepted and nothing has been paid            |
| Partially paid    | More than ₱0.00 and less than the Accepted quote is paid |
| Paid              | At least the Accepted quote is paid; any extra is noted  |

Paid is the sum of payments recorded as Paid; Unpaid rows don't count. Overdue is a separate flag
(below), because a partly paid supplier can also be overdue.

**Money representation (D-075, D-078).** See "Money" above: pesos only, `numeric(12, 2)`, strings
from form to database, centavo BigInt arithmetic, nothing rounded.

**Deletion behaviour (D-072, D-004).** Removing a supplier is permanent, needs confirmation, and is
for Owners and Coordinators. Its quotes and payments go with it (cascade); its Activity entries
stay, keeping its readable ID and name, and its numbers are never reused. Deleting the event deletes
its suppliers, quotes and payments. Quotes and payments have no remove action of their own: a payment is
corrected by editing (D-080), and a quote's status can be set to Declined (D-076); both go with
their supplier. See "Deletion behaviour" below.

**Due dates and overdue (D-079).** Due and paid dates are calendar days in Philippine time
(`date`, 2000-01-01 to 2100-12-31, CHECK); the app refuses a paid date after today. "Today" is worked out
on the server once per request in Asia/Manila, never taken from the browser. For each payment:

| Due status | When                                     |
| ---------- | ---------------------------------------- |
| Paid       | Recorded as paid: never overdue          |
| Overdue    | Unpaid, and the due date is before today |
| Due today  | Unpaid, and due today                    |
| Upcoming   | Unpaid, and due on a later day           |

A supplier's next due date is its earliest unpaid payment; it also has an overdue count. The
supplier list, its search and its filters use these same calculations (D-081 to D-083).

**Authorization (D-035, D-036, D-068).** Every member (`event.view`) sees the suppliers, contacts,
quotes and payments; only Owners and Coordinators (`suppliers.manage`) add, edit or remove them;
a supplier's recent Activity needs `audit.view`. Every action authorizes on the server from the
stored role, and the database statement re-checks the role while it writes. A supplier, quote or
payment is looked up only inside the authorized event (and a quote or payment only under its own
supplier), so another event's IDs give "not found". Details and tests: `docs/SECURITY.md`
("Suppliers") and `docs/PERMISSIONS.md`.

## Supplier categories (B4-02, D-069)

Categories are a controlled list, not free text, so "Catering" and "catering services" can't both
appear. The canonical list is `src/modules/events/suppliers/categories.ts`; the form, server
validation, lists, the audit registry's copy and the database enum `supplier_category` follow it,
and tests keep them equal.

| Value                     | Label                   | Covers                                             |
| ------------------------- | ----------------------- | -------------------------------------------------- |
| `VENUE`                   | Venue                   | Where the event takes place.                       |
| `CATERING`                | Catering                | Food and drinks for guests.                        |
| `CAKE_AND_DESSERTS`       | Cake and desserts       | Cakes, pastries, dessert tables.                   |
| `PHOTO_AND_VIDEO`         | Photo and video         | Photographers and videographers.                   |
| `SOUND_AND_LIGHTS`        | Sound and lights        | Sound systems, lighting and technical crew.        |
| `ENTERTAINMENT`           | Entertainment           | Bands, DJs, hosts and performers.                  |
| `FLOWERS_AND_STYLING`     | Flowers and styling     | Florists, stylists and decorations.                |
| `HAIR_AND_MAKEUP`         | Hair and makeup         | Hair and makeup artists.                           |
| `ATTIRE`                  | Attire                  | Gowns, suits and costume rentals.                  |
| `RENTALS`                 | Rentals                 | Tables, chairs, tents, linens and other equipment. |
| `TRANSPORT`               | Transport               | Cars, vans and shuttles.                           |
| `PRINTING_AND_STATIONERY` | Printing and stationery | Invitations, signage, programs and other print.    |
| `OTHER`                   | Other                   | Anything else; says what the supplier provides.    |

- **Other** requires a short description (`categoryDetail`, up to 60 characters), shown as
  "Other: Fireworks". Every other category stores no detail; a value sent with another category is
  dropped, never stored (CHECK `suppliers_category_detail`).
- **Only canonical values** are accepted, exactly as listed: "catering" or an unknown value is
  refused with "Choose what the supplier provides." The detail is trimmed, with inner spaces
  collapsed.
- **Extending:** a new category is one entry in the canonical list and a migration adding the enum
  value. Rule packs per event type are Tier 3.

## Attendees at a glance (Batch 2)

One row per guest in `attendees` (table above), always inside one event. The sections below define
each part; user-facing steps are in [USER_FLOWS.md](USER_FLOWS.md).

| Topic                | Rule                                                                         | Section                 |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| Identity             | Readable ID `ATT-0001` per event, never reused                               | `attendees` table       |
| RSVP                 | Pending, Confirmed, Maybe, Declined; any to any                              | RSVP states             |
| Plus-ones            | A count 0 to 10 on the attendee, not guest records                           | Plus-ones and headcount |
| Expected headcount   | Confirmed attendees × (1 + plus-ones); computed, never stored                | Plus-ones and headcount |
| Dietary needs        | One free-text entry; several separated by semicolons; every member sees it   | Dietary needs           |
| Notes, email, phone  | Owners and Coordinators only (`attendees.private`)                           | Notes                   |
| Search, filter, sort | On the authorized list; nothing stored                                       | Guest list search…      |
| CSV import           | Validated server-side at every step; one transaction; nothing before confirm | CSV import              |
| CSV export           | Every field, this event only, formula-safe, recorded                         | CSV export              |
| Activity             | Changes recorded without contact details, dietary needs or notes             | [AUDIT.md](AUDIT.md)    |
| Who may do what      | [PERMISSIONS.md](PERMISSIONS.md); tested in `authorization.db.test.ts`       |                         |

## RSVP states (B2-08, D-049)

| State       | Meaning                    | Counts toward the expected headcount |
| ----------- | -------------------------- | ------------------------------------ |
| `PENDING`   | No reply yet (the default) | No (shown as not yet confirmed)      |
| `CONFIRMED` | Coming                     | Yes, as 1 + plus-ones (D-046)        |
| `MAYBE`     | Replied, unsure            | No (shown as not yet confirmed)      |
| `DECLINED`  | Not coming                 | No                                   |

Any state may change to any other (Owners and Coordinators). Each change is recorded in Activity.
The guest list can be filtered to one state (`?rsvp=<state in lower case>`); the filter only
narrows the list the reader may already see.

## Guest list search, filters and sorting (B2-10 to B2-12, D-050)

Applied by the page to the guest list the server authorized for the reader; nothing is stored or
changed. The query is read from the address:

| Parameter  | Values                                                 | Notes                                               |
| ---------- | ------------------------------------------------------ | --------------------------------------------------- |
| `q`        | text, up to 100 characters                             | Name and ID; email and phone with attendees.private |
| `rsvp`     | `confirmed`, `pending`, `maybe`, `declined`            | D-049                                               |
| `category` | one of this event's categories (case ignored)          |                                                     |
| `dietary`  | `yes` (recorded) or `no` (not recorded)                | Only with attendees.dietary                         |
| `plusones` | `yes` (bringing plus-ones) or `no`                     |                                                     |
| `sort`     | `name` (default), `id`, `rsvp`, `plusones`, `category` | Ties: name, then ID                                 |
| `dir`      | `asc` (default) or `desc`                              | No category sorts last either way                   |

Filters combine with AND. The `(eventId, name)` and `(eventId, rsvpStatus)` indexes serve the
guest-list read; a database-side search would come with pagination.

## CSV import (B2-14 to B2-18, D-052)

No new tables. An import adds ordinary attendees (same columns, same rules as the add form) in one
transaction, takes the next ATT numbers in file order, and writes one `attendees.imported` audit
entry. Nothing is stored before the user confirms, and the uploaded file is never kept.

Import validation rules, all on the server at every step:

| Check      | Rule                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| File       | `.csv` name and CSV media type; at most 500 KB; UTF-8; no NUL bytes                                                                      |
| Shape      | A header row, then 1 to 2,000 rows; at most 50 columns; values up to 5,000 characters; no extra values beyond the headers; quotes closed |
| Mapping    | Each column to one known field or "Don't import"; each field once; Name required                                                         |
| Row values | The add form's schema (D-042): name required, email and phone formats, plus-ones 0 to 10, lengths                                        |
| RSVP words | The four states, or yes / attending / going, no / not attending / regrets, tentative / unsure, empty                                     |
| Duplicates | Same name (ignoring case and accents) and same email when both have one, against the list and the file                                   |
| Confirm    | The number to import must equal what the user saw, or nothing is imported                                                                |

## CSV export (B2-19, D-053)

No new tables. The export reads the event's attendees in ID order (every field) and writes one
`attendees.exported` audit entry in the same transaction.

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

## Dietary needs (B2-06, D-047)

Decided by the technical lead on 2026-10-13, before implementation.

- **One entry per attendee.** `dietaryNeeds` is free text. Several needs share the entry, separated
  by semicolons: "Vegetarian; no nuts; halal". There is no fixed list of needs.
- **Removing** means clearing the field: it is stored as NULL. NULL means "nothing recorded", not
  "no restrictions"; the guest list shows it as a dash ("Not recorded" for screen readers).
- **Belongs to the attendee.** It is edited on the attendee, and goes when the attendee is removed.
  Plus-ones have no dietary needs of their own (D-046); note theirs in the attendee's entry.
- **Who sees it:** every event member (`attendees.dietary`, PERMISSIONS.md). The guest-list query
  selects it only for roles with that permission.
- **Activity** records only that it changed, never the text (AUDIT.md).

## Notes (B2-07, D-048)

Decided by the technical lead on 2026-10-13, before implementation.

- **One entry per attendee.** `notes` is free text up to 2,000 characters; line breaks are kept.
  Clearing it stores NULL. There is no notes history.
- **Belongs to the attendee.** Edited on the attendee, removed with the attendee, never moved to
  another attendee or event.
- **Who sees it:** Owners and Coordinators (`attendees.private`, which also covers email and
  phone). The details page's query selects these fields only for roles with that permission.
- **Activity** records only that notes changed, never the text (AUDIT.md).

## Accessibility requirements and resources (B3-02, D-057)

The canonical definitions live in `src/modules/events/accessibility/domain/`:
`requirement-type.ts` (requirement types and priorities) and `resource.ts` (resource types and
statuses). Forms, server validation (`accessibility/schema.ts`), the details page and the Activity
feed all read their labels and rules from there; UI text is never the source. Tests keep each list
equal to its database enum and to the audit registry's copy. Labels describe what is needed, never
the person.

### Requirement types (what an attendee needs)

| Value                 | Label                        | Covers                                                                        |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `MOBILITY_ASSISTANCE` | Mobility assistance          | Uses a wheelchair or another mobility aid, or needs help moving around.       |
| `ACCESSIBLE_SEATING`  | Accessible seating           | A seat with space for a wheelchair or with easy access.                       |
| `STEP_FREE_ENTRANCE`  | Step-free entry              | Getting in and around without steps: a ramp, an elevator or a level entrance. |
| `ACCESSIBLE_RESTROOM` | Accessible restroom          | A restroom they can use, for example with more space and grab bars.           |
| `SIGN_LANGUAGE`       | Sign-language interpretation | An interpreter for the spoken parts of the event.                             |
| `CAPTIONING`          | Captioning                   | Live captions for the spoken parts of the event.                              |
| `OTHER`               | Other                        | Anything not listed. The note must say what is needed.                        |

Dietary needs are not a requirement type: they stay one free-text field on the attendee (D-047).
Transport, seating plans and volunteer needs are later tiers.

### Priorities (how firmly a requirement must be met)

| Value           | Label           | Meaning                                                                                    |
| --------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `REQUIRED`      | Required        | Must be in place for the guest. The default. Readiness (later in Batch 3) counts it.       |
| `PREFERRED`     | Preferred       | Would help, but the guest can attend without it. Shown; never makes the event "not ready". |
| `INFORMATIONAL` | For information | Context for staff, nothing to arrange. Never counted.                                      |

The readiness calculation itself (which requirements a resource satisfies, and how) is not defined
here; it is decided with the readiness task.

### Resource types (what the event provides)

| Value                 | Label                     | Count?                     |
| --------------------- | ------------------------- | -------------------------- |
| `ACCESSIBLE_SEATS`    | Accessible seats          | Yes: how many, 0 to 10,000 |
| `ACCESSIBLE_ENTRANCE` | Accessible entrance       | No                         |
| `RAMP_OR_ELEVATOR`    | Ramp or elevator          | No                         |
| `ACCESSIBLE_RESTROOM` | Accessible restroom       | No                         |
| `CAPTIONING`          | Captioning                | No                         |
| `SIGN_LANGUAGE`       | Sign-language interpreter | No                         |

### Resource status

| Value           | Label          | Meaning                       |
| --------------- | -------------- | ----------------------------- |
| (no row)        | Not set up     | Nobody has recorded it yet.   |
| `NOT_AVAILABLE` | Not available  | The event can't provide this. |
| `ARRANGING`     | Being arranged | Planned, not confirmed yet.   |
| `AVAILABLE`     | Available      | In place and confirmed.       |

### Validation

Every value is checked on the server with the same schemas the forms use:

- **Requirement:** type from the list (anything else: "Choose what the guest needs."); priority
  from the list, empty means Required; note trimmed, empty stored as NULL, at most 500 characters
  (counted like Postgres); `OTHER` must have a note ("Describe what the guest needs."). At most one
  requirement of each type per attendee.
- **Resource:** every member sees the whole record (it describes the venue, not a person, D-061);
  the type comes from the address, never the form; status from the list; accessible
  seats need a whole number from 0 to 10,000; other types ignore any count and store NULL; note as
  above.

## Accessibility readiness (B3-07 to B3-11, D-062 to D-064, D-066)

Readiness answers: "Are our guests' accessibility needs covered, and if not, what is missing?" It
is calculated on demand from the stored requirements and resources by one pure function
(`accessibility/domain/readiness.ts`): no database, clock, network, AI or permission check inside.
Nothing about readiness is stored, so it can't be set by hand. The same input always gives the same
result, in the same order.

### Which needs count (B3-07, options 1a and 2a)

| Requirement                             | Treatment                                                           |
| --------------------------------------- | ------------------------------------------------------------------- |
| Guest's RSVP is Declined                | Left out ("declined"), whatever the priority                        |
| Priority For information                | Left out ("for information")                                        |
| Priority Required (guest not declined)  | **Decides** readiness                                               |
| Priority Preferred (guest not declined) | Checked the same way, but **advice only**: never changes the status |

Confirmed, Pending and Maybe guests all count: preparing one accessible seat too many is better than
one too few. Plus-ones have no needs of their own.

### Which resource covers which need (option 3a)

| Need                         | Depends on                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Accessible seating           | Accessible seats, counted (below)                                                  |
| Step-free entry              | Accessible entrance; and Ramp or elevator **if it has been recorded**              |
| Mobility assistance          | The same as step-free entry. Staff help can't be tracked until volunteers (Tier 2) |
| Accessible restroom          | Accessible restroom                                                                |
| Sign-language interpretation | Sign-language interpreter                                                          |
| Captioning                   | Captioning                                                                         |
| Other                        | Nothing: it can't be checked automatically ("check by hand")                       |

Ramp or elevator is considered only when someone has recorded it, because EventOps does not know
whether the venue has more than one level; once recorded, anything but Available is a problem.

### When a resource covers a need

| Resource state           | Result for the need              |
| ------------------------ | -------------------------------- |
| No record ("Not set up") | Missing                          |
| Not available            | Missing                          |
| Being arranged           | Being arranged (not covered yet) |
| Available                | Covered (seats: see below)       |

A need that depends on two resources takes the worse result: missing, then short, then being
arranged, then covered.

### Seats

When accessible seats are Available, the seat count is compared with the counted Accessible
seating needs:

- **Required** seating needs are covered when seats ≥ the number of Required seating needs.
  Otherwise every Required seating need is **short**: EventOps can't choose which guests go
  without, so it never marks some covered and others not.
- **Preferred** seating needs are covered only when seats ≥ Required + Preferred seating needs
  (Required guests come first); otherwise they are short (advice only).
- 0 seats Available with any seating need is short.

### Readiness status (B3-08, option 7a)

The event's status is derived from the coverage above, only from needs that **decide** (Required,
guest not declined). Preferred needs never change it. The canonical list is
`accessibility/domain/readiness-status.ts`; the UI and the server both use it.

| Status              | When                                                                                      | Shown as |
| ------------------- | ----------------------------------------------------------------------------------------- | -------- |
| `NO_REQUIRED_NEEDS` | No need decides readiness (none recorded, or only Preferred, For information or declined) | Info     |
| `NOT_READY`         | At least one deciding need is missing or short                                            | Critical |
| `ALMOST_READY`      | None missing or short, but at least one is being arranged or to check by hand             | Warning  |
| `READY`             | Every deciding need is covered                                                            | Success  |

Checked in that order. "No required needs" is kept apart from Ready so an event with nothing
recorded never looks finished. The status is never stored and has no setter, so it can't be changed
by hand.

### Gaps (B3-09)

A gap says exactly what is wrong, for whom, and what it means. `accessibility/domain/gaps.ts`
derives them from the coverage; covered needs never produce one. Several gaps can exist at once.

| Kind               | When                                                 | One gap per                          |
| ------------------ | ---------------------------------------------------- | ------------------------------------ |
| `not-set-up`       | A needed resource has no record                      | resource                             |
| `not-available`    | A needed resource is recorded as Not available       | resource                             |
| `being-arranged`   | A needed resource is recorded as Being arranged      | resource                             |
| `not-enough-seats` | Accessible seats are Available but fewer than needed | event (seats are counted as a whole) |
| `check-by-hand`    | An Other need, which no resource can cover           | requirement                          |

Each gap carries:

- **the affected requirements**: guest (ID such as `ATT-0003` and name), need type and priority,
  sorted by guest number;
- **the resource** and its state (or none, for check by hand), and for seats the seats available
  and the Required and Preferred seating needs;
- **the consequence**: `not-ready` (a deciding need is missing or short), `almost-ready` (a
  deciding need is being arranged or to check by hand), or `advice` (only Preferred needs are
  affected);
- **a plain summary** built from the canonical labels, for example "Captioning is not set up, but
  2 guests need it." Never a vague "Accessibility issue".

Order (deterministic): consequence (not ready, almost ready, advice), then resource in definition
order with check-by-hand last, then the first affected guest's number.

### Alerts (B3-11, D-066)

Alerts are the gaps worth interrupting someone for. `accessibility/domain/alerts.ts` derives them
from the status and the gaps on every read; nothing is stored, sent or dismissed.

| Gap consequence | Alert                     |
| --------------- | ------------------------- |
| `not-ready`     | Critical                  |
| `almost-ready`  | Warning (needs attention) |
| `advice`        | None                      |

- One alert per alerting gap, in the gaps' order, with a headline, the gap's sentence and its
  consequence, the resource and the affected guests.
- One event-level alert while the status is Not ready (critical) or Almost ready (warning), with
  the number of issues. None for Ready or No required needs.
- A guest's alerts are the gap alerts that list that guest.

### Edge cases

- No needs, or only left-out needs: nothing to cover (the status is "No required needs", B3-08).
- The order of the input never changes the result: needs are sorted by guest number, then by type
  order, then by ID.
- Two resources of the same type in the input are refused as invalid input (the database allows
  one per type, D-056).
- A requirement whose type or priority is not one of the canonical values is refused as invalid
  input (B3-14); it is never guessed as covered or as advice.
- Notes are never part of the input.

## Tasks (B6-F01 to B6-F05, D-094, D-095)

A task is one piece of operational work for an event. It holds a title, a description, a priority
and an optional assignee; due date, status and the related supplier or area are added by their own
features, each with its own migration.

| Field         | Rule                                                                                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`      | Per-event sequence behind the readable ID `TSK-0001`, from `events.lastTaskNumber`. Issued in the same transaction as the insert and never reused.                                                                         |
| `title`       | Required, 1 to 120 characters, trimmed, at least one non-space character.                                                                                                                                                  |
| `description` | Optional, at most 2,000 characters, trimmed, line breaks kept. Blank is stored as NULL.                                                                                                                                    |
| `priority`    | Required: `HIGH`, `MEDIUM` or `LOW` (enum `task_priority`). A new task is `MEDIUM` unless another is chosen; that default belongs to the domain, not to a column default. Tasks that existed before D-095 became `MEDIUM`. |
| `assigneeId`  | Optional: the `event_members` row the task is assigned to, NULL for unassigned. Any role can be assigned; being assigned grants no permission.                                                                             |
| `updatedAt`   | The edit version (D-032): a save carrying an older value is refused as stale.                                                                                                                                              |

A task belongs to exactly one event and is deleted with it (D-004). `(eventId, number)` and
`(eventId, id)` are unique; the second is the target of the composite links later task features add
(D-002). The assignee is a composite foreign key `(eventId, assigneeId)` to
`event_members(eventId, id)`, so the database refuses a member of another event (D-002). The key is
NO ACTION because Prisma cannot set one column of a composite key to NULL; the trigger
`event_members_unassign_tasks` (migration `20261017120000_task_priority_assignee`) clears
`assigneeId`, and moves `updatedAt`, when a member is removed, whether directly, with their user or
with the event. Owners and Coordinators create, edit, assign and delete (`tasks.manage`); every
member reads. A task is permanently deleted after a confirmation (D-095); it has no dependent rows
yet, and its number is never reused. Audit: `task.created`, `task.updated` and `task.deleted`
(`docs/audit.md`).

## Impact (B7, D-101 to D-103)

Impact analyses are simulations: nothing here changes the event. The rules are in
[impact-rules.md](impact-rules.md).

**`event_impact_assumptions`**: at most one row per event (primary key `eventId`), deleted with it.

| Field                   | Rule                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `cateringCostPerHead`   | Optional `DECIMAL(12,2)`, 0 or more (CHECK). No default.                                             |
| `accessibleSeatsPer100` | Optional `DECIMAL(5,2)`, 0 to 100 (CHECK). No default.                                               |
| `cateringCategoryId`    | Optional. Composite foreign key `(eventId, cateringCategoryId)` to `budget_categories(eventId, id)`. |
| `updatedAt`             | The edit version (D-032).                                                                            |

Deleting a budget category clears `cateringCategoryId` first (trigger
`budget_categories_clear_impact_catering`, migration `20261020090000_impact`), so the deletion is never
blocked. Edited by `impact.assumptions` (Owner, Coordinator).

**`impact_analyses`**: saved analyses, append-only (trigger `impact_analyses_append_only`, like the
audit log), deleted only with their event.

| Field             | Rule                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `number`          | Per-event sequence behind `IMP-0001`, from `events.lastImpactNumber`; never reused. 1 or more.         |
| `fromAttendees`   | The stored expected attendees when saved. 0 to 1,000,000.                                              |
| `toAttendees`     | The proposed expected attendees. 0 to 1,000,000.                                                       |
| `overallSeverity` | `CRITICAL`, `NEEDS_ATTENTION`, `INFO` or `PASSED` (enum `impact_severity`).                            |
| `result`          | JSONB object (CHECK): the snapshot (version 1), validated on write and read by `impactSnapshotSchema`. |
| `createdById`     | Who saved it; SET NULL if the user is deleted.                                                         |

`(eventId, number)` is unique and `(eventId, createdAt)` is indexed for the history list. Saved by
`impact.record` (Owner, Coordinator); read by every member. Audit: `impact_assumptions.updated` and
`impact_analysis.created` (`docs/audit.md`).

## CHECK constraints (D-010)

Prisma cannot express these, so they are written by hand at the end of the migration that creates
the table. Prisma does not diff CHECK constraints, so later generated migrations leave them in
place.

| Constraint                                  | Rule                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `events_name_not_blank`                     | `name` contains at least one non-space character.                                                   |
| `events_capacity_positive`                  | `capacity` is NULL or greater than 0.                                                               |
| `events_expected_attendees_nonneg`          | `expectedAttendees` is 0 or more.                                                                   |
| `events_ends_not_before_start`              | `endsAt` is NULL or not earlier than `startsAt`.                                                    |
| `audit_logs_action_format`                  | `action` looks like `<entity>.<verb>` in lower case.                                                |
| `audit_logs_entity_pair`                    | `entityType` and `entityId` are both set or both NULL.                                              |
| `events_last_attendee_number_nonneg`        | `lastAttendeeNumber` is 0 or more.                                                                  |
| `events_last_supplier_number_nonneg`        | `lastSupplierNumber` is 0 or more.                                                                  |
| `events_last_quote_number_nonneg`           | `lastQuoteNumber` is 0 or more.                                                                     |
| `supplier_quotes_amount_positive`           | `amount` is more than 0.                                                                            |
| `supplier_quotes_number_positive`           | `number` is 1 or more.                                                                              |
| `supplier_quotes_description_not_blank`     | `description` is NULL or contains a non-space character.                                            |
| `events_last_payment_number_nonneg`         | `lastPaymentNumber` is 0 or more.                                                                   |
| `events_last_task_number_nonneg`            | `lastTaskNumber` is 0 or more.                                                                      |
| `tasks_number_positive`                     | `number` is 1 or more.                                                                              |
| `tasks_title_not_blank`                     | `title` has at least one non-space character.                                                       |
| `tasks_description_not_blank`               | `description` is NULL or contains a non-space character.                                            |
| `tasks_eventId_assigneeId_fkey`             | `assigneeId` is NULL or a member of the task's own event (D-095).                                   |
| `supplier_payments_amount_positive`         | `amount` is more than 0.                                                                            |
| `supplier_payments_number_positive`         | `number` is 1 or more.                                                                              |
| `supplier_payments_description_not_blank`   | `description` is NULL or contains a non-space character.                                            |
| `supplier_payments_paid_on_rule`            | `paidOn` is set for `PAID` and NULL for `UNPAID`.                                                   |
| `supplier_payments_dates_in_range`          | `dueDate` and `paidOn` are from 2000-01-01 to 2100-12-31.                                           |
| `suppliers_name_not_blank`                  | `name` has at least one non-space character.                                                        |
| `suppliers_number_positive`                 | `number` is 1 or more.                                                                              |
| `suppliers_category_detail`                 | `categoryDetail` is set and not blank for `OTHER`, and NULL for every other category.               |
| `suppliers_optional_text_not_blank`         | `contactName`, `email`, `phone` and `notes` are NULL or contain a non-space character.              |
| `attendees_name_not_blank`                  | `name` contains at least one non-space character.                                                   |
| `attendees_number_positive`                 | `number` is 1 or more.                                                                              |
| `attendees_plus_ones_range`                 | `plusOnes` is from 0 to 10.                                                                         |
| `attendees_optional_text_not_blank`         | `email`, `phone`, `category`, `dietaryNeeds` and `notes` are NULL or contain a non-space character. |
| `accessibility_requirements_note_not_blank` | `note` is NULL or contains a non-space character.                                                   |
| `accessibility_requirements_other_has_note` | An `OTHER` requirement has a note.                                                                  |
| `accessibility_resources_quantity_rule`     | `quantity` is 0 or more for `ACCESSIBLE_SEATS`, and NULL for every other type.                      |
| `accessibility_resources_note_not_blank`    | `note` is NULL or contains a non-space character.                                                   |

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

| Deleted row               | Effect                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event                     | Owners only (D-033). Its memberships, attendees, accessibility requirements and resources, suppliers and their quotes and payments, and audit log are deleted (cascade). Later event-owned tables also cascade (D-004).                                                                                                                                                         |
| Attendee                  | Owners and Coordinators (`attendees.manage`, D-035). Permanently deleted; an `attendee.deleted` audit entry keeps its number and name. Its accessibility requirements are deleted with it (cascade, D-056).                                                                                                                                                                     |
| Accessibility requirement | Owners and Coordinators (`accessibility.manage`). Permanently deleted; the audit entry keeps the attendee number and the type.                                                                                                                                                                                                                                                  |
| Supplier                  | Owners and Coordinators (`suppliers.manage`, D-072). Permanently deleted, after confirming; a `supplier.deleted` audit entry keeps its number and name, and numbers are never reused. Its quotes and payments are deleted with it (cascade, D-075, D-077). Its budget line will be unlinked keeping its totals, and task links cleared (D-002, D-003), when those tables exist. |
| Task                      | Owners and Coordinators (`tasks.manage`, D-095). Permanently deleted, after confirming; a `task.deleted` audit entry keeps its number and title, and numbers are never reused.                                                                                                                                                                                                  |
| Accessibility resource    | Owners and Coordinators (`accessibility.manage`). Permanently deleted; the type then shows as "Not set up".                                                                                                                                                                                                                                                                     |
| User                      | Blocked while the user created any event (D-011), or is the last `OWNER` of any event (D-022). Otherwise their memberships are deleted.                                                                                                                                                                                                                                         |
| Membership                | Blocked if it is the event's last `OWNER` (D-022). Demoting or moving the last `OWNER` is blocked too.                                                                                                                                                                                                                                                                          |
| Audit log entry           | Never deleted directly (D-037). Removed only with its event.                                                                                                                                                                                                                                                                                                                    |

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
- Supplier money: paid = sum of the supplier's payments recorded as Paid, committed = the
  supplier's Accepted quote, payment status computed (D-003, D-075, D-077, D-078).
- JSON columns are validated with Zod on every read and write.