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

| Action               | Recorded when                                  | Entity     | Details                                                                                                            |
| -------------------- | ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `event.created`      | An event is created (B1-02)                    | `event`    | Event number and name                                                                                              |
| `event.updated`      | Event details are edited (B1-05)               | `event`    | Changed fields only, old → new; the description is marked changed, its text not copied                             |
| `attendee.created`   | An attendee is added (B2-01)                   | `attendee` | Readable ID (`ATT-0001`) and name                                                                                  |
| `attendee.updated`   | An attendee is edited (B2-01)                  | `attendee` | Readable ID; name, RSVP, plus-ones and category old → new; email, phone, dietary needs and notes only as "changed" |
| `attendee.deleted`   | An attendee is removed (B2-01)                 | `attendee` | Readable ID and name, so the log still says who was removed                                                        |
| `attendees.imported` | Attendees are imported from a CSV file (B2-18) | `event`    | How many were added, the first and last new IDs, and how many rows were not imported. No names or file contents    |
| `attendees.exported` | The guest list is downloaded as CSV (B2-19)    | `event`    | How many attendees were exported. Refused attempts are not recorded                                                |

Not recorded:

- **Deleting an event.** D-004 deletes the event's audit log with it, so the entry would vanish at
  once.
- **Edits that change nothing, refused edits and stale edits.** Nothing changed.
- **Reads.** Opening pages, lists or the API is not audited. The one exception is the CSV export
  (`attendees.exported`), because it takes guests' personal data out of EventOps.

Add an action only when the feature that needs it is built, in the registry and in this table.

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