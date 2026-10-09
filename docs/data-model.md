<!-- docs/DATA_MODEL.md -->

# Data model

The source of truth is `prisma/schema.prisma` plus the migrations in `prisma/migrations/`. This page
explains the rules that the schema alone does not make obvious. Decisions are recorded in
[DECISIONS.md](DECISIONS.md).

Status: the schema and the first migration (`20261009141000_init`) exist. No feature code reads or
writes these tables yet.

## Ground rules

- Every event-owned table has `eventId`, and every query filters by it.
- Money is `Decimal(12, 2)` in Philippine pesos, never floating point.
- Users live in Supabase Auth. `userId`, `createdById`, `changedById` and `actorId` hold the Supabase
  user id and have no foreign key, except `EventMember.userId`, which points at `Profile`.
- JSON columns (`ImpactEvent.before/after`, `ImpactItem.assumptionsUsed`, `ImportSession.extracted`,
  `ImportSession.validationReport`, `AuditLog.before/after`) are validated with Zod on every read
  and write.
- Event health is computed on demand and is not stored.

## Cross-event integrity (D-002)

A row can only link to another row of the same event. The database enforces this with composite
foreign keys on `(eventId, id)`:

| Child                        | Column              | Parent            |
| ---------------------------- | ------------------- | ----------------- |
| `accessibility_requirements` | `attendeeId`        | `attendees`       |
| `accessibility_requirements` | `volunteerId`       | `volunteers`      |
| `supplier_payments`          | `supplierId`        | `suppliers`       |
| `budget_items`               | `supplierId`        | `suppliers`       |
| `tasks`                      | `assigneeMemberId`  | `event_members`   |
| `tasks`                      | `relatedSupplierId` | `suppliers`       |
| `volunteers`                 | `roleId`            | `volunteer_roles` |
| `impact_items`               | `impactEventId`     | `impact_events`   |

Server-side authorization is still required on every request. These keys are a second line of
defence, not a replacement.

## CHECK constraints

Prisma cannot express these, so they are written by hand in the init migration. Prisma does not
diff CHECK constraints, so later generated migrations leave them in place.

| Constraint                             | Rule                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `accessibility_requirements_one_owner` | Exactly one of `attendeeId` and `volunteerId` is set.                                        |
| `budget_items_amount_source`           | Linked to a supplier: `committedAmount` and `paidAmount` are NULL. Not linked: both are set. |

## Money (D-003)

| Figure                        | Source                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| Paid to a supplier            | Sum of its `supplier_payments` rows.                            |
| Committed to a supplier       | `quoteAmount` when `quoteStatus` is `ACCEPTED`, otherwise zero. |
| Supplier payment status       | Computed from the paid amount. The mapping is not yet approved. |
| Budget line, supplier-linked  | Committed and paid come from the supplier.                      |
| Budget line, not linked       | Its own `committedAmount` and `paidAmount`.                     |
| Remaining budget, over-budget | Computed by the budget domain from the figures above.           |

A supplier links to at most one budget line.

## Readable IDs

| ID              | Source                                                               |
| --------------- | -------------------------------------------------------------------- |
| `EVT-2026-0001` | `event_reference_counters`, one row per year, atomic upsert (D-005). |
| `ATT-0184`      | `Event.nextAttendeeNumber`, incremented in the creating transaction. |
| `SUP-0012`      | `Event.nextSupplierNumber`, incremented in the creating transaction. |

## Deletion behaviour

What happens in the database when a row is deleted. Who may delete what is set by the permission
matrix, which is not yet documented.

| Deleted row    | Effect                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event          | Cascades to every event-owned table, including the audit log (D-004). Cannot be undone.                                                                                          |
| Profile        | Cascades to that user's `event_members` rows.                                                                                                                                    |
| Attendee       | Cascades to the attendee's accessibility requirements.                                                                                                                           |
| Volunteer      | Cascades to the volunteer's accessibility requirements.                                                                                                                          |
| Supplier       | Cascades to its payments. Blocked while a budget line or task links to it: the use case first unlinks them and copies the supplier's totals onto its budget line (D-002, D-003). |
| Event member   | Blocked while a task is assigned to it: the use case first unassigns those tasks (D-002).                                                                                        |
| Volunteer role | Blocked while a volunteer has the role: the use case first clears the role (D-002).                                                                                              |
| Impact event   | Cascades to its impact items.                                                                                                                                                    |