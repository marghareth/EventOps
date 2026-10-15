<!-- docs/AUDIT.md -->

# Audit log

The audit log records meaningful changes inside an event: who did what, to which record, and when
(B1-11, D-037). It is not a log of every database query or page view.

## What an entry holds

| Field                    | Meaning                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `eventId`                | The event. Entries are deleted with their event (D-004).               |
| `actorId`                | The signed-in user who made the change. Empty if that user is deleted. |
| `action`                 | One action from the list below, for example `event.updated`.           |
| `entityType`, `entityId` | The record the action is about, where there is one.                    |
| `details`                | Action-specific details, validated against the action's schema.        |
| `createdAt`              | When it happened (server time, shown in Philippine time).              |

## Audited actions

Only these actions can be written. The registry is `src/modules/events/audit/actions.ts`; each action
has a strict schema, so unlisted fields are refused, not silently stored.

| Action                              | Recorded when                                                          | Entity                      | Details                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `event.created`                     | An event is created (B1-02)                                            | `event`                     | Event number and name                                                                                                                   |
| `event.updated`                     | Event details are edited (B1-05)                                       | `event`                     | Changed fields only, old → new; the description is marked changed, its text not copied                                                  |
| `attendee.created`                  | An attendee is added (B2-01)                                           | `attendee`                  | Readable ID (`ATT-0001`) and name                                                                                                       |
| `attendee.updated`                  | An attendee is edited (B2-01)                                          | `attendee`                  | Readable ID; name, RSVP, plus-ones and category old → new; email, phone, dietary needs and notes only as "changed"                      |
| `attendee.deleted`                  | An attendee is removed (B2-01)                                         | `attendee`                  | Readable ID and name, so the log still says who was removed                                                                             |
| `attendees.imported`                | Attendees are imported from a CSV file (B2-18)                         | `event`                     | How many were added, the first and last new IDs, and how many rows were not imported. No names or file contents                         |
| `attendees.exported`                | The guest list is downloaded as CSV (B2-19)                            | `event`                     | How many attendees were exported. Refused attempts are not recorded                                                                     |
| `accessibility_requirement.created` | An accessibility need is added to an attendee (B3-03)                  | `accessibility_requirement` | The attendee's readable ID, the type and the priority                                                                                   |
| `accessibility_requirement.updated` | An accessibility need is edited (B3-03)                                | `accessibility_requirement` | Readable ID and current type; type and priority old → new; the note only as "changed"                                                   |
| `accessibility_resource.created`    | An event accessibility resource is set up (B3-05)                      | `accessibility_resource`    | Type, status and seat count                                                                                                             |
| `accessibility_resource.updated`    | A resource is edited (B3-05)                                           | `accessibility_resource`    | Type; status and seat count old → new; the note only as "changed"                                                                       |
| `accessibility_resource.deleted`    | A resource is removed (B3-05)                                          | `accessibility_resource`    | Type                                                                                                                                    |
| `accessibility_requirement.deleted` | An accessibility need is removed (B3-03)                               | `accessibility_requirement` | Readable ID and type                                                                                                                    |
| `supplier.created`                  | A supplier is added (B4-03)                                            | `supplier`                  | Readable ID (`SUP-0001`), name, category and, for Other, what they provide. No contact details or notes                                 |
| `supplier.updated`                  | A supplier's details are saved with at least one change (B4-04, D-071) | `supplier`                  | Readable ID and what changed: name and category old → new; contact person, phone, email and notes only as "changed", never their values |
| `supplier.deleted`                  | A supplier is removed (B4-05, D-072)                                   | `supplier`                  | Readable ID and name at that moment. The supplier record is gone                                                                        |
| `quote.created`                     | A quote is added to a supplier (B4-09, D-075)                          | `quote`                     | Quote and supplier readable IDs, amount in pesos ("165000.50"), status and description. Shown on the supplier's page too                |
| `quote.updated`                     | A quote is saved with at least one change (B4-10, D-075)               | `quote`                     | Quote and supplier readable IDs and what changed: amount, status and description, old → new                                             |
| `payment.created`                   | A deposit or payment is added to a supplier (B4-14, D-080)             | `payment`                   | Payment and supplier readable IDs, kind, amount, due date, recorded status, paid date and description                                   |
| `payment.updated`                   | A payment is saved with at least one change (B4-14, D-080)             | `payment`                   | Payment and supplier readable IDs and what changed: kind, amount, due date, status, paid date and description, old → new                |

Not recorded:

- **Deleting an event.** D-004 deletes the event's audit log with it, so the entry would vanish at
  once.
- **Edits that change nothing, refused edits and stale edits.** Nothing changed.
- **Reads.** Opening pages, lists or the API is not audited. The one exception is the CSV export
  (`attendees.exported`), because it takes guests' personal data out of EventOps.

Add an action only when the feature that needs it is built, in the registry and in this table.

### Attendee actions (B2-21)

| Action            | Entry                | What is kept                           | What is never kept                                 |
| ----------------- | -------------------- | -------------------------------------- | -------------------------------------------------- |
| Add               | `attendee.created`   | ID and name                            | Contact details, dietary needs, notes              |
| Edit, RSVP change | `attendee.updated`   | Name, RSVP, plus-ones, category        | Email, phone, dietary needs, notes: "changed" only |
| Remove            | `attendee.deleted`   | ID and name                            | Everything else                                    |
| Import            | `attendees.imported` | Count, first and last ID, rows skipped | Names, file name, file contents                    |
| Export            | `attendees.exported` | Count                                  | Who or what was in the file                        |

Refused actions and saves that change nothing record nothing. Proved by
`attendees/activity.db.test.ts`, which scans every stored entry for the personal data it used.

### Accessibility actions (B3-03, D-059)

| Action | Entry                               | What is kept                | What is never kept            |
| ------ | ----------------------------------- | --------------------------- | ----------------------------- |
| Add    | `accessibility_requirement.created` | Attendee ID, type, priority | The note, the attendee's name |
| Edit   | `accessibility_requirement.updated` | Type and priority old → new | The note: "changed" only      |
| Remove | `accessibility_requirement.deleted` | Attendee ID and type        | The note                      |

Resources (B3-05, D-061) describe the venue, not a person, so their status and seat count are kept
old → new; their free-text note is recorded only as "changed", like the event description.

### Supplier, quote and payment actions (B4-20)

Suppliers use the same audit log and Activity page as every other module; there is no separate
supplier history.

| Action          | Entry              | What is kept                                          | What is never kept                                  |
| --------------- | ------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| Add supplier    | `supplier.created` | ID, name, category, what an Other supplier provides   | Contact person, email, phone, notes                 |
| Edit supplier   | `supplier.updated` | Name and category old → new                           | Contact person, email, phone, notes: "changed" only |
| Remove supplier | `supplier.deleted` | ID and name                                           | Everything else                                     |
| Add quote       | `quote.created`    | Quote and supplier IDs, amount, status, description   | Nothing about the supplier's contacts               |
| Edit quote      | `quote.updated`    | Amount, status and description old → new              | Nothing about the supplier's contacts               |
| Add payment     | `payment.created`  | Payment and supplier IDs, kind, amount, dates, status | Nothing about the supplier's contacts               |
| Edit payment    | `payment.updated`  | Kind, amount, due date, status, paid date, old → new  | Nothing about the supplier's contacts               |

A status change leads the Activity summary, so it reads at a glance: "Accepted the quote QUO-0002
for SUP-0001", "Declined …", "Set the quote … back to Pending"; "Marked the payment PAY-0002 for
SUP-0001 as paid (Oct 2, 2026)" or "… as not paid yet". Other edits read "Edited the quote …" or
"Edited the payment …". The detail lines (old → new) are unchanged. Refused, stale and unchanged
saves record nothing. Proved by `suppliers/activity.db.test.ts`, which makes each change in turn,
checks exactly one entry each, and scans every stored entry and its wording for the contact details
it used.

The requirement note can hold health details, so it is never copied into the log. When an attendee is removed,
their requirements go with them; the `attendee.deleted` entry covers it, with no separate entry per
requirement. Proved by `accessibility/requirements.db.test.ts` and `accessibility/audit.test.ts`.

All six accessibility actions go through the same audit log and Activity feed as every other
change (no second mechanism). Reads, refused writes and saves that change nothing record nothing.
Proved end to end, with the actor and event of each entry, by `accessibility/activity.db.test.ts`
(B3-12).

## What must not be stored

- Only what the action needs. Prefer IDs, names of fields and short business values.
- No email addresses, phone numbers or passwords, and no free-text notes. Long free text such as the
  event description is recorded as "changed", never copied.
- Personal data of attendees: record which fields changed, not their values. Email, phone, dietary
  needs and notes are only ever recorded as "changed" (D-042). The attendee's name is recorded, as
  it is needed to say who was added or removed.
- The actor is stored as a user ID; names are looked up when the log is shown.

## Rules

- **Written with the change.** `writeAudit` takes the transaction of the change, so if the entry
  cannot be written, the change is rolled back too.
- **Append-only.** A database trigger rejects any direct UPDATE or DELETE of an entry. Entries go
  only when their event is deleted; a deleted user's entries stay with no actor.
- **Reading is protected.** Owners and Coordinators can see the log (`audit.view`, D-035) on the
  event's Activity page. `getEventActivity` checks the role itself (D-036). Viewers and non-members
  cannot read it.
- **Validated on read too.** An entry whose action or details no longer match the registry is shown
  as "details unavailable", never as raw data.

## Tests

`audit/actions.test.ts`, `audit/write.test.ts`, `audit/describe.test.ts` (registry and wording),
`audit/audit.db.test.ts` (recording, rollback, append-only, cascade, deleted actor),
`activity.test.ts` and `authorization.db.test.ts` (who can read it),
`attendees/attendees.db.test.ts` and `attendees/schema.test.ts` (attendee entries, no personal
values).