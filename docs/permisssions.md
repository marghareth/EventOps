<!-- docs/PERMISSIONS.md -->

# Event permissions

The approved permission matrix for roles inside an event (D-035, approved by the technical lead on
2026-10-12). The code in `src/modules/events/permissions.ts` must match this table exactly;
`src/modules/events/permissions.test.ts` fails if they differ. Change both together, and only with
the technical lead's approval.

## Roles

| Role        | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| Owner       | Full event management, including members and deleting the event. |
| Coordinator | Day-to-day operations. Can't manage members or delete the event. |
| Viewer      | Read-only access to the event.                                   |

Each membership has exactly one role, stored in `event_members.role` (D-034). Every event has at
least one Owner (D-022).

## Matrix

| Permission             | What it covers                                          | Owner | Coordinator | Viewer |
| ---------------------- | ------------------------------------------------------- | ----- | ----------- | ------ |
| `event.view`           | Open the event, its sections and dashboard              | Yes   | Yes         | Yes    |
| `event.edit`           | Edit the event's details                                | Yes   | Yes         | No     |
| `event.status`         | Change the event's status                               | Yes   | Yes         | No     |
| `event.delete`         | Permanently delete the event and everything in it       | Yes   | No          | No     |
| `members.manage`       | Add members, change their roles and remove them         | Yes   | No          | No     |
| `attendees.manage`     | Add, edit and remove attendees, RSVP and plus-ones      | Yes   | Yes         | No     |
| `attendees.export`     | Download attendees as CSV (guest personal data)         | Yes   | Yes         | No     |
| `import.run`           | Spreadsheet or AI import, including confirming the rows | Yes   | Yes         | No     |
| `accessibility.manage` | Accessibility requirements and resources                | Yes   | Yes         | No     |
| `suppliers.manage`     | Suppliers, quotes and payments                          | Yes   | Yes         | No     |
| `budget.manage`        | Budget categories and allocations                       | Yes   | Yes         | No     |
| `tasks.manage`         | Create, assign and complete tasks                       | Yes   | Yes         | No     |
| `impact.assumptions`   | Edit impact assumptions such as cost per head           | Yes   | Yes         | No     |
| `audit.view`           | See the activity log, including before and after values | Yes   | Yes         | No     |

## How it is enforced

1. **Membership.** `requireEventAccess` / `getEventAccess` load the event only for its members.
   Everyone else gets the same 404 as an unknown event (D-027). Membership alone grants
   `event.view`.
2. **Role, on the server.** Every server action and route handler that writes calls
   `can(role, permission)` with the role loaded from the database, never a role sent by the
   browser.
3. **Role, in the database.** Where a write is a single statement, it also filters by
   `rolesAllowed(permission)`, so a role change between the check and the write changes nothing.
4. **The UI follows the role** (hidden buttons, read-only views) but is never the check. Tests call
   the server actions directly with refused roles.

## Role boundaries tested so far

Each row's action and database tests are written when its feature is built.

| Permission     | Built in | Action tests (every role)                    | Database tests (every role)     |
| -------------- | -------- | -------------------------------------------- | ------------------------------- |
| `event.view`   | B1-04    | `access.test.ts`, `access-coverage.test.tsx` | `members/membership.db.test.ts` |
| `event.edit`   | B1-05    | `actions.test.ts` (updateEventAction)        | `update-event.db.test.ts`       |
| `event.delete` | B1-06    | `actions.test.ts` (deleteEventAction)        | `delete-event.db.test.ts`       |