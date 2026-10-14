<!-- docs/TESTING.md -->

# Testing

How EventOps is tested, how to run each layer, and what each one proves. Contributing rules are in
[CONTRIBUTING.md](../CONTRIBUTING.md#tests).

## Layers

| Layer                | Command                      | Where                     | In CI | Needs               |
| -------------------- | ---------------------------- | ------------------------- | ----- | ------------------- |
| Unit and component   | `npm test`                   | `src/**/*.test.ts(x)`     | Yes   | Nothing             |
| Database integration | `npm run test:db`            | `src/**/*.db.test.ts`     | Yes   | `TEST_DATABASE_URL` |
| Browser (basic)      | `npm run test:e2e`           | `e2e/*.spec.ts`           | No    | Nothing             |
| Browser lifecycle    | `npm run test:e2e:lifecycle` | `e2e/lifecycle/*.spec.ts` | Yes   | `E2E_DATABASE_URL`  |

- **Unit and component tests** cover rules, validation, components and pages with their
  dependencies mocked.
- **Database tests** run the real server code against PostgreSQL: constraints, triggers,
  isolation between events, roles, the audit log, and the end-to-end security and lifecycle tests.
  Only "who is signed in" is mocked, because there is no real Supabase account in tests.
- **Sample data (D-041).** `sample-data.test.ts` checks that the dev-only sample store keeps the
  database's rules (members only, role re-checks, stale saves refused, valid audit entries). The
  sample store never replaces the database tests: features are tested against PostgreSQL.
- **Browser tests** drive the real app in Chromium.

## Attendee tests (B2-20, B2-21, B2-23)

### Security checkpoint (B2-20)

`src/modules/events/attendees/authorization.db.test.ts` is one matrix: six callers × nine attendee
operations, through the real server actions, reads and export route (as a crafted request would
reach them), against PostgreSQL. Every denied call is checked to change nothing in either event and
to add nothing to Activity. It runs in CI's database job.

| Caller                                     | Read list | Read details | Edit form | Create | Edit | RSVP | Delete | Import | Export |
| ------------------------------------------ | --------- | ------------ | --------- | ------ | ---- | ---- | ------ | ------ | ------ |
| User A on Event A (Owner)                  | Yes       | Yes          | Yes       | Yes    | Yes  | Yes  | Yes    | Yes    | Yes    |
| Coordinator of Event A                     | Yes       | Yes          | Yes       | Yes    | Yes  | Yes  | Yes    | Yes    | Yes    |
| Viewer of Event A                          | Yes       | Yes          | No        | No     | No   | No   | No     | No     | No     |
| User A on Event B (not a member)           | No        | No           | No        | No     | No   | No   | No     | No     | No     |
| User A, Event A, Attendee B in the request | Yes       | No           | No        | Yes    | No   | No   | No     | Yes    | Yes    |
| Signed out                                 | No        | No           | No        | No     | No   | No   | No     | No     | No     |

The same file checks that no response to a refused or cross-event call contains another event's
attendee data, and that a Viewer's reads never contain contact details or notes. A deliberately
wrong expectation (a Viewer allowed to create) was confirmed to fail the matrix.

### Activity (B2-21)

`attendees/activity.db.test.ts` runs create → edit → RSVP change → import → export → delete and
checks the Activity feed, in order and in words, then scans every stored audit row for the email,
phone, dietary needs and notes used, which must not appear. A second test checks that refused
actions and saves that change nothing record nothing.

### Coverage (B2-23)

| Item                        | Tests                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Create attendee             | `attendees/create-flow.db.test.ts`, `actions.test.ts`, `ui/AttendeeForm.test.tsx`, `schema.test.ts` |
| Edit attendee               | `attendees/edit-flow.db.test.ts` (incl. stale saves), `actions.test.ts`                             |
| Delete attendee             | `attendees/delete-flow.db.test.ts`, `ui/RemoveAttendeeSection.test.tsx`                             |
| RSVP changes                | `attendees/rsvp.db.test.ts` (all 12 changes, invalid states), `rsvp-filter.test.ts`                 |
| Plus-ones                   | `attendees/headcount.test.ts`, `edit-flow.db.test.ts`, `schema.test.ts` (0 to 10)                   |
| Dietary needs               | `attendees/dietary.db.test.ts`, `ui/AttendeeList.test.tsx`                                          |
| Notes and details page      | `attendees/notes.db.test.ts`, `ui/AttendeeDetailsView.test.tsx`, attendees `page.test.tsx`          |
| Search, filtering, sorting  | `attendees/guest-list-query.test.ts`, `guest-list.db.test.ts`, `ui/GuestListControls.test.tsx`      |
| Valid CSV, mapping, preview | `attendees/import-rules.test.ts`, `import.db.test.ts`, `ui/ImportWizard.test.tsx`                   |
| Malformed CSV, limits       | `attendees/csv.test.ts`, `import.db.test.ts` (type, size, UTF-8, unclosed quote)                    |
| Missing required column     | `import-rules.test.ts` (`readMapping`), `import.db.test.ts` (back to mapping with reasons)          |
| Invalid values              | `import-rules.test.ts` (email, RSVP words, plus-ones, lengths)                                      |
| Confirmation                | `import.db.test.ts` (numbering, changed preview, tampered file, duplicates on a second import)      |
| Import failure behaviour    | `import.db.test.ts` (a database failure saves no attendee, number or Activity entry)                |
| Export: valid CSV           | `attendees/export-csv.test.ts` (quoting, formula safety, BOM, round trip)                           |
| Export: correct event data  | `attendees/export.db.test.ts`                                                                       |
| Export: no cross-event data | `export.db.test.ts`, `authorization.db.test.ts`                                                     |
| Authorization               | `attendees/authorization.db.test.ts`, the role rows in [PERMISSIONS.md](PERMISSIONS.md)             |
| Activity                    | `attendees/activity.db.test.ts`, `audit/describe.test.ts`                                           |

### Placeholder tests

Six test files from the scaffold (D-019) belong to features not built yet (accessibility readiness, the seventh, got real tests in B3-07). Each holds one
`it.todo` naming its feature, so `npm test` passes and reports them as to-do (D-054).

### End-to-end attendee flow (B2-24)

`e2e/lifecycle/attendee-flow.spec.ts` runs the whole attendee flow in Chromium as the demo user,
against a reset test database:

1. Open a fresh event (a second event with its own guest is created first).
2. Create an attendee with a plus-one, dietary needs, a category and an RSVP; check the headcount.
3. Open the details page and edit the name, plus-ones and notes.
4. Import a CSV: suggested column matching, preview with a row needing correction, confirm, and
   check the guest list.
5. Search (accent-insensitive), search for the other event's guest (no match), filter by category,
   sort by plus-ones descending, then filter by RSVP; the sorted column is announced.
6. Export, read the downloaded file and check its rows, and that the other event's guest is absent.
7. Check Activity for every step, and that no screen refused a legitimate action.

It resets the demo data before and after, so it can run before or after the event lifecycle spec.
Both run with `npm run test:e2e:lifecycle` and in CI's `e2e` job (D-055).

## Accessibility tests (B3-01 to B3-10)

| Area                                                                                                                          | Tests                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables, constraints, cascades, cross-event links (B3-01)                                                                      | `accessibility/accessibility-tables.db.test.ts`                                                                                                                       |
| Definitions equal the database enums; validation (B3-02)                                                                      | `accessibility/definitions.test.ts`, `accessibility/domain/definitions.test.ts`, `accessibility/schema.test.ts`                                                       |
| Add, edit, remove; duplicates (also concurrent); stale and unchanged saves; notes not loaded (B3-03)                          | `accessibility/requirements.db.test.ts`                                                                                                                               |
| Security matrix: seven callers × seven operations through the real actions and reads; refusals change nothing (B3-03)         | `accessibility/authorization.db.test.ts`                                                                                                                              |
| Activity entries, wording, and the audit registry's copies (B3-03)                                                            | `accessibility/audit.test.ts`                                                                                                                                         |
| Activity: six actions in order, actor and event, no notes; reads, refusals and no-ops not recorded (B3-12)                    | `accessibility/activity.db.test.ts`                                                                                                                                   |
| Section, form, remove dialog, notice: states, roles, labels, keyboard-reachable radio groups (B3-04)                          | `accessibility/ui/*.test.tsx`                                                                                                                                         |
| Add and edit pages, details-page notice and failed-read state (B3-04)                                                         | `attendees/[attendeeId]/accessibility/pages.test.tsx`                                                                                                                 |
| Resources: set up, concurrent set-up, edit, stale, unchanged, remove, refused roles and events (B3-05)                        | `accessibility/resources.db.test.ts`                                                                                                                                  |
| Resource security matrix: five callers × five operations; unknown types refused (B3-05)                                       | `accessibility/authorization.db.test.ts`                                                                                                                              |
| Authorization (B3-13): User B on Event A; alert reads in both matrices; refusals turned away before storage                   | `accessibility/authorization.db.test.ts`                                                                                                                              |
| Resource list, form, remove dialog, notice; Accessibility and resource pages (B3-05)                                          | `accessibility/ui/Resource*.test.tsx`, `accessibility/pages.test.tsx`                                                                                                 |
| Readiness coverage: counting, mapping, resource states, seats, edge cases, determinism (B3-07)                                | `accessibility/domain/readiness.test.ts`                                                                                                                              |
| Readiness status: the four statuses, the rule in order, Preferred never changes it (B3-08)                                    | `accessibility/domain/readiness-status.test.ts`                                                                                                                       |
| Gaps: identifiable missing resources, no false gaps, several at once, seats, check by hand, consequences, determinism (B3-09) | `accessibility/domain/gaps.test.ts`                                                                                                                                   |
| Named domain cases through coverage, status, gaps and alerts; unknown type or priority refused (B3-14)                        | `accessibility/domain/scenarios.test.ts`                                                                                                                              |
| Integration: attendee → need → resource → readiness → gaps → alert from stored data; refusals; Activity (B3-15)               | `accessibility/integration.db.test.ts`                                                                                                                                |
| Readiness view: status, gaps, needs and resources in order; roles; empty and error states; readiness from stored data (B3-10) | `accessibility/pages.test.tsx`, `accessibility/ui/ReadinessView.test.tsx`, `accessibility/application/get-readiness.test.ts`, `accessibility/requirements.db.test.ts` |
| Alerts: only real gaps, never covered needs or advice; reasons; event and guest alerts; roles; failed read (B3-11)            | `accessibility/domain/alerts.test.ts`, `[eventId]/page.test.tsx`, `attendees/[attendeeId]/accessibility/pages.test.tsx`                                               |

### Accessibility domain: proof the tests catch a broken rule (B3-14)

`accessibility/domain/scenarios.test.ts` runs each named B3-14 case through the whole pure chain
(coverage, status, gaps, alerts). No coverage tool is installed (option 4b), so branch coverage was
checked by mutation instead: on 2026-10-13 each of 35 rules in `readiness.ts`,
`readiness-status.ts`, `gaps.ts` and `alerts.ts` was broken in turn (a guard removed, a mapping
swapped, a boundary moved from `<` to `<=`, an order or filter dropped) and the domain tests were
run. All 35 were caught. The first run let two through, and a test was added for each: a guest
counted once when two needs share a resource, and the event alert following the status rather
than the gaps alone. The domain tests run in about a second.

### Accessibility authorization: proof the tests catch a removed check (B3-13)

The matrix in `accessibility/authorization.db.test.ts` calls the server actions and reads directly,
so hiding a button in the page proves nothing to it. On 2026-10-13 each server-side check was
removed by hand, the accessibility database tests were run, and the change was reverted:

| Check removed                                                                     | Tests that failed |
| --------------------------------------------------------------------------------- | ----------------- |
| Role check at the boundary (`accessibility.manage` and `.private` → `event.view`) | 12 of 168         |
| Membership and role (`authorizeEvent` grants Owner on any event)                  | 35 of 168         |
| Role re-check in storage (`managedBy` filter)                                     | 6 of 168          |
| Authorization in the alerts read (`getAccessibilityAlerts`)                       | 6 of 168          |

Each layer is caught on its own: the boundary by the "refused before storage" tests, storage by the
role re-check tests in `requirements.db.test.ts` and `resources.db.test.ts`.

### End-to-end accessibility flow (B3-04)

`e2e/lifecycle/accessibility-flow.spec.ts` runs in Chromium as the demo user, against a reset test
database: an attendee starts with no needs; add one choosing with the keyboard (arrow keys in the
radio group) and one Other need (refused without a note, then saved); the details page lists both
with their priority; edit one, remove the other through the confirmation dialog; Activity shows each
change and never the notes. Step 5 sets up accessible seats (refused without a count, then saved),
edits the status and count, removes it, and checks Activity. Step 6 adds a Required need with no resource (Not ready, with the gap and its fix link), sets
the resource up from the gap, and sees Ready with the Preferred need left as advice. While Not ready, the Overview shows the
accessibility alert and the guest's page shows their alert with a fix link; once Ready, neither
appears (B3-11).

### Known flaky test

`attendee-flow.spec.ts` step 5 (search, filter and sort) fails intermittently in `next dev`: for a
moment after a client navigation the guest list is rendered twice, so a text match finds two
elements or none. Seen on the Batch 2 commit before any Batch 3 change (1 run in 3); not fixed in
Batch 3, reported to the technical lead.

## Event lifecycle tests (B1-14, D-039)

The whole event foundation is tested as one story, twice:

1. **`src/modules/events/lifecycle.db.test.ts`** (database layer, in CI). Four real users: Ana
   (Owner), Ben, Cara and Dan (not a member). Through the real server actions, page access checks,
   API routes and audit log:

   Sign in → create → listed → open → edit → activity → Ben becomes Coordinator, Cara Viewer →
   Dan refused everywhere → Cara can read but not write → Ben can edit but not delete → roles
   change and take effect at once → Ana deletes → gone from every list, page and API, with its
   members and activity.

2. **`e2e/lifecycle/event-lifecycle.spec.ts`** (browser, local). The same story in Chromium,
   signed in with dev demo sign-in (D-024). The demo user's role is changed between steps
   (Owner → Coordinator → Viewer → not a member → Owner) and the pages are checked for what
   each role sees and can do, then the event is deleted through the typed confirmation.

Role changes are applied directly in the database in both tests, because member management screens
don't exist yet (D-034).

### Repeatable state

- The database test creates its own users and deletes everything it made, so it can run any
  number of times, alongside the other database tests.
- The browser test resets the demo user's data before every run (`scripts/reset-demo.ts`, called
  from `e2e/lifecycle/global-setup.ts`). It deletes the demo user's events (with everything in
  them, D-004) and the extra test users. It refuses any database whose name doesn't contain `test`
  or `e2e`.
- Event numbers come from a counter (D-005). Don't insert events into a test database by hand or
  with a seed script without also setting `event_reference_counters` for that year, or the next
  event created in the app gets a duplicate number and can't be saved. If in doubt, recreate the
  test database and apply the migrations again.

### Running the browser lifecycle test

```bash
createdb eventops_e2e   # a separate, empty database; its name must contain "test" or "e2e"
export E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventops_e2e
DIRECT_URL=$E2E_DATABASE_URL npm run db:deploy   # apply every migration
npm run test:e2e:lifecycle
```

It starts its own dev server on port 3100 (`E2E_PORT` to change it) with `DEV_DEMO_AUTH=true` and
that database; your `.env.local` and normal dev server are not used. If Playwright can't download
its own Chromium, set `PLAYWRIGHT_CHROMIUM_PATH` to a local Chromium.

It is not in CI yet: it needs a dev server with demo sign-in and a database, which CI doesn't start
for browser tests.