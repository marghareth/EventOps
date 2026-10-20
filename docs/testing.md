<!-- docs/testing.md -->

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

Five test files from the scaffold (D-019) belong to features not built yet (accessibility readiness got real tests in B3-07, supplier actions in B4-03). Each holds one
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

## Supplier tests (Batch 4)

| Area                                                                                                                                                                                            | Tests                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table: fields, numbering per event, duplicates, constraints, limits, cascade, indexes (B4-01)                                                                                                   | `suppliers/suppliers-table.db.test.ts`                                                                                                                                          |
| Categories equal the database enum; Other's description; validation (B4-02)                                                                                                                     | `suppliers/categories.test.ts`                                                                                                                                                  |
| Form validation: required fields, formats, limits, ignored extra fields (B4-03)                                                                                                                 | `suppliers/schema.test.ts`                                                                                                                                                      |
| Adding: numbering (also concurrent), role re-checked in the database, Activity (B4-03)                                                                                                          | `suppliers/suppliers.db.test.ts`                                                                                                                                                |
| Security matrix through the real actions and reads; refusals change nothing (B4-03)                                                                                                             | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Activity entries and wording; the audit registry's category copy (B4-03)                                                                                                                        | `suppliers/audit.test.ts`                                                                                                                                                       |
| Activity: one entry per supplier, quote and payment change, right action and actor; refusals and no-ops none; no contact details; status-led summaries (B4-20)                                  | `suppliers/activity.db.test.ts`, `suppliers/audit.test.ts`                                                                                                                      |
| Form and list components; list and add pages (B4-03)                                                                                                                                            | `suppliers/ui/*.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                                                                            |
| Editing: what changed for Activity; saves, stale and unchanged saves, refusals in the database (B4-04)                                                                                          | `suppliers/schema.test.ts`, `suppliers/suppliers.db.test.ts`                                                                                                                    |
| Edit form and edit links in the matrix, plus another event's supplier for every caller (B4-04)                                                                                                  | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Edit mode of the form; Edit supplier page (B4-04)                                                                                                                                               | `suppliers/ui/SupplierForm.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                                                                 |
| Removing: permanent, Activity kept, numbers not reused, refusals and other events (B4-05)                                                                                                       | `suppliers/suppliers.db.test.ts`, `suppliers/authorization.db.test.ts`                                                                                                          |
| Remove confirmation: nothing removed without confirming, Cancel and Escape, errors (B4-05)                                                                                                      | `suppliers/ui/RemoveSupplierSection.test.tsx`                                                                                                                                   |
| Browser flow: add (Other needs a description), edit, remove, Activity, Viewer read-only (B4-03 to B4-05)                                                                                        | `e2e/lifecycle/supplier-flow.spec.ts`                                                                                                                                           |
| Contact fields and formats; contacts event-scoped and never in Activity through add, edit and remove (B4-06)                                                                                    | `suppliers/schema.test.ts`, `suppliers/suppliers.db.test.ts`, `suppliers/ui/SupplierForm.test.tsx`                                                                              |
| Detail page: matrix row, another event's supplier, Activity only for audit.view and only about the supplier (B4-07)                                                                             | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Detail page sections and page states: contacts, recent activity, Viewer view, not found (B4-07)                                                                                                 | `suppliers/ui/SupplierContactSection.test.tsx`, `suppliers/ui/SupplierActivitySection.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                      |
| Peso amounts: accepted inputs, canonical form, refusals (negative, zero, decimals, too large, ambiguous), display (B4-08)                                                                       | `suppliers/money.test.ts`                                                                                                                                                       |
| Quotes table: exact amounts, numbering, same-event supplier link, CHECKs, statuses, cascades, indexes (B4-08)                                                                                   | `suppliers/supplier-quotes-table.db.test.ts`                                                                                                                                    |
| Payments table: exact amounts, date-only dates, numbering, same-event supplier link, paid-date rule, date range, kinds and statuses, cascades, indexes (B4-12)                                  | `suppliers/supplier-payments-table.db.test.ts`                                                                                                                                  |
| Supplier payment status: each status, one centavo short, exact and over, unpaid rows ignored, exact centavo sums, order independence; the badge (B4-13)                                         | `suppliers/payment-status.test.ts`, `suppliers/money.test.ts`, `suppliers/ui/PaymentStatusBadge.test.tsx`                                                                       |
| Due rules: Overdue, Due today, Upcoming, Paid; paid never overdue; the Manila midnight boundary (16:00 UTC), new year, leap day; impossible dates; next due; the badge (B4-15)                  | `suppliers/payment-due.test.ts`, `suppliers/ui/PaymentDueBadge.test.tsx`                                                                                                        |
| Payment form validation: amounts, real dates in range, past due dates allowed, paid date required for Paid and not after the given day; canonical lists equal the enums (B4-14)                 | `suppliers/payment-schema.test.ts`                                                                                                                                              |
| Adding and editing payments: numbering (also concurrent), exact amounts and dates, stale and unchanged saves, refusals, wrong event or supplier, statuses from stored records (B4-14)           | `suppliers/payments.db.test.ts`                                                                                                                                                 |
| Payment matrix rows; wrong supplier or event; invalid amounts and dates and a future paid date refused on the server; statuses on the supplier page (B4-14)                                     | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Payment form, payments section, Add and Edit payment pages, payment notices (B4-14)                                                                                                             | `suppliers/ui/PaymentForm.test.tsx`, `suppliers/ui/SupplierPaymentsSection.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                 |
| Supplier list overview: accepted quote, pending quotes, payment status, next due; each event's own rows for every member (B4-16)                                                                | `suppliers/supplier-overview.test.ts`, `suppliers/ui/SupplierList.test.tsx`, `suppliers/authorization.db.test.ts`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`    |
| Supplier search: cleaning the address, what matches and what never does, order; another event's suppliers never found; page states (B4-17)                                                      | `suppliers/supplier-list-query.test.ts`, `suppliers/authorization.db.test.ts`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                        |
| Supplier filters: parsing and address round trip, quote groups, AND composition, clearing; Event B never shown; phone-width reload, back and clear (B4-18)                                      | `suppliers/supplier-list-query.test.ts`, `suppliers/authorization.db.test.ts`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`, `e2e/lifecycle/supplier-flow.spec.ts` |
| Whole workflow against seeded data: keyboard-only add, stored values read back, look-alike suppliers in another event, Viewer (B4-22)                                                           | `e2e/lifecycle/supplier-workflow.spec.ts`, `e2e/lifecycle/db.ts` (`seedSuppliers`)                                                                                              |
| Every form problem listed at once; supplier loading and error screens (B4-23)                                                                                                                   | `suppliers/schema.test.ts`, `suppliers/payment-schema.test.ts`, `src/app/(app)/events/[eventId]/suppliers/states.test.tsx`                                                      |
| Quote statuses equal the database enum; labels; the lifecycle rule; the badge (B4-11)                                                                                                           | `suppliers/quote-statuses.test.ts`, `suppliers/ui/QuoteStatusBadge.test.tsx`                                                                                                    |
| Quote form validation: canonical amounts, refusals, statuses, description (B4-09)                                                                                                               | `suppliers/quote-schema.test.ts`                                                                                                                                                |
| Adding quotes: numbering (also concurrent), exact amounts, one Accepted per supplier (also concurrent), refusals in the database, other events, Activity (B4-09)                                | `suppliers/quotes.db.test.ts`                                                                                                                                                   |
| Quote matrix row, IDs in the form ignored, invalid input and second Accepted refused on the server (B4-09)                                                                                      | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Quote form, quotes section, Add quote page, quote notice (B4-09)                                                                                                                                | `suppliers/ui/QuoteForm.test.tsx`, `suppliers/ui/SupplierQuotesSection.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                     |
| Editing quotes: what changed, statusChangedAt only on status changes, stale and unchanged saves, one Accepted per supplier (also two saved together), refusals, wrong event or supplier (B4-10) | `suppliers/quote-schema.test.ts`, `suppliers/quotes.db.test.ts`                                                                                                                 |
| Quote edit matrix rows, quotes through the wrong supplier or event, edit/stale/unchanged through the action (B4-10)                                                                             | `suppliers/authorization.db.test.ts`                                                                                                                                            |
| Quote form edit mode, Edit links, Edit quote page, saved notice (B4-10)                                                                                                                         | `suppliers/ui/QuoteForm.test.tsx`, `suppliers/ui/SupplierQuotesSection.test.tsx`, `src/app/(app)/events/[eventId]/suppliers/pages.test.tsx`                                     |

## Accessibility tests (Batch 3)

**Strategy.** Each layer is tested where that is cheapest to do thoroughly, and each layer's tests
fail if that layer is broken:

| Layer                                                            | What proves it                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Readiness rules (coverage, status, gaps, alerts): pure functions | Unit tests of every named case and edge; 35 of 35 deliberately broken rules caught (B3-14). About a second.    |
| Definitions and validation                                       | Unit tests; definitions compared with the database enums                                                       |
| Server boundary: who may do what                                 | Database matrix calling the real actions and reads as each kind of caller; removed checks make it fail (B3-13) |
| Storage: constraints, one per type, stale saves, cascades, audit | Database tests on PostgreSQL 16                                                                                |
| The whole chain from stored data                                 | Integration test: guest → need → resource → readiness → gaps → alert, with refusals and Activity (B3-15)       |
| Screens: states, roles, labels                                   | Component and page tests using the real domain rules                                                           |
| The workflow in a browser                                        | Two Chromium flows from a reset database, in CI's e2e job (B3-04, B3-16)                                       |
| Accessibility of the screens                                     | One-off audit: axe-core, keyboard, headings, form errors, three widths (B3-17)                                 |

Where each area is tested:

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

### Supplier authorization: the required cases and proof they catch a removed check (B4-19)

`suppliers/authorization.db.test.ts` has a block for the seven required cases, each run through
the real server actions and reads (never the pages) in a fresh world per operation, checking that
a denial leaves both events unchanged:

| Case                                                   | What the test does                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1. User A → Event A supplier: allowed                  | Owner of A reads the list and details, edits the supplier, adds a quote                             |
| 2. User A → Event B supplier: denied                   | Owner of A tries all 13 operations on Event B's supplier, quote and payment                         |
| 3. User B → Event A supplier: denied                   | Owner of B tries all 13 operations on Event A                                                       |
| 4. Viewer supplier write: denied                       | Reads allowed; every write and form refused, with the role message from the action boundary         |
| 5. Coordinator permitted operations: allowed           | All 13 operations                                                                                   |
| 6. Owner permitted operations: allowed                 | All 13 operations                                                                                   |
| 7. Unauthorized quote/payment access: denied           | Viewer, User B, signed out, Event B's IDs, and Event B's quote and payment under Event A's supplier |
| 8. Member of both events (added by the mutation check) | Event B's supplier through Event A's address: not found, nothing saved                              |

On 2026-10-14 each server-side check was removed by hand, the supplier database tests (252) were
run, and the change was reverted:

| Check removed                                                                                       | Tests that failed                         |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Role check at the action boundary (`suppliers.manage` → `event.view` in every action and form read) | 6                                         |
| Role re-check in the database: the supplier lock (quotes, payments)                                 | 4                                         |
| Role re-check in the database: add, edit, remove supplier                                           | 3                                         |
| Event scoping of the supplier lock                                                                  | 1 (case 8; before case 8 was added, none) |
| Event scoping of supplier reads (`getSupplier`)                                                     | 9                                         |
| Supplier scoping of quote and payment reads and edits                                               | 5                                         |

Each layer is caught on its own: the boundary by case 4's role messages, the database re-checks by
the use-case tests in `suppliers.db.test.ts`, `quotes.db.test.ts` and `payments.db.test.ts`, and
scoping by the cross-event cases.

### Supplier workflow against seeded data (B4-22)

`e2e/lifecycle/supplier-workflow.spec.ts` runs the whole supplier workflow in Chromium from a reset
test database. Step 1 signs in, creates the event through the app and seeds it with eight suppliers
of a Cebu wedding through `seedSuppliers` in `e2e/lifecycle/db.ts` (test database only): quotes
Accepted, Pending and Declined, deposits paid, due today and overdue, an Other supplier and
accented names. Due dates are relative to today in Manila, so the statuses are the same on any day.
Seeded rows have no Activity entries; the test's own changes go through the screens. It also
creates a second event, gives it to another Owner and leaves it, with look-alike suppliers (same
name, an overdue deposit) that would show up if a search or filter leaked.

| Step | What it checks                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1-2  | Sign in; open the event from the event list (the other event isn't listed); the seeded list's statuses      |
| 3    | Add a supplier with category and contact using the keyboard only (Tab order, typing into the select, Enter) |
| 4    | Add a quote with the keyboard, then accept it                                                               |
| 5    | Add a deposit with its due date                                                                             |
| 6    | After a reload, and read from the database: amounts and dates exactly as stored                             |
| 7    | The list card: accepted quote, Unpaid, due date, Upcoming                                                   |
| 8    | Search by accent-free text, contact person and SUP ID; no match; clear                                      |
| 9    | Filters combined with each other and the search; overdue only                                               |
| 10   | Edit the supplier                                                                                           |
| 11   | Activity: each change, status-led summaries, no phone, email or contact person                              |
| 12   | The other event's supplier by its address, and by swapping its ID into this event's address: Page not found |
| 13   | As a Viewer: everything readable, no Add or Edit links, every form address refused                          |

### Supplier screens audit (B4-23)

On 2026-10-15 every supplier screen was checked at 375 and 1280 px in Chromium, in sample-data
mode: the list (all, no match, filtered), add and edit supplier with and without errors, the detail
page, add and edit quote and payment with and without errors, and Activity. Each was scanned with
axe-core (WCAG 2.0 to 2.2 A and AA plus best practices, from a scratch script; axe-core is not a
project dependency), checked for sideways scrolling, small targets, heading order, and walked with
Tab at 1280 px.

| Finding                                                                                                           | Outcome                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| No accessibility violations; no sideways scrolling; visible focus on every stop; focus moves to the error summary | Kept                                                                                  |
| A missing paid date (Paid) or Other description was reported only after the other errors were fixed               | Fixed: checked together with every field (`payment-schema.test.ts`, `schema.test.ts`) |
| Supplier names on the list were 18 px tall tap targets                                                            | Fixed: 44 px tap area without moving the layout                                       |
| Loading and error screens had no tests                                                                            | Added `suppliers/states.test.tsx`                                                     |
| The filter form fills the first phone screen before the list                                                      | Kept: same as the guest list; a collapsible filter would be a shared change           |

### Supplier coverage map and rule mutation check (B4-21)

Each supplier rule is tested as a pure function first, without rendering a page or opening a
database; the database and UI layers then check that the same rule is wired in. No coverage tool is
installed (adding one needs approval), so this map comes from reading each rule file against its
tests.

| Rule area                               | Rule file                | Pure rule tests (no UI, no database) | Database tests                                                                           | UI and browser tests                                                |
| --------------------------------------- | ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Supplier validation, contacts, changes  | `schema.ts`              | `schema.test.ts`                     | `suppliers.db.test.ts`, `suppliers-table.db.test.ts`                                     | `SupplierForm.test.tsx`, `pages.test.tsx`, browser steps 1, 2 and 6 |
| Categories                              | `categories.ts`          | `categories.test.ts`                 | `suppliers-table.db.test.ts` (enum)                                                      | `SupplierForm.test.tsx`                                             |
| Peso amounts and centavo arithmetic     | `money.ts`               | `money.test.ts`                      | `supplier-quotes-table.db.test.ts`, `supplier-payments-table.db.test.ts` (exact Decimal) | `QuoteForm.test.tsx`, `PaymentForm.test.tsx`                        |
| Quote validation and changes            | `quote-schema.ts`        | `quote-schema.test.ts`               | `quotes.db.test.ts`                                                                      | `QuoteForm.test.tsx`, browser step 3                                |
| Quote lifecycle (one Accepted)          | `quote-statuses.ts`      | `quote-statuses.test.ts`             | `quotes.db.test.ts` (also concurrent accepts)                                            | `QuoteStatusBadge.test.tsx`, browser steps 3 and 4                  |
| Payment validation and changes          | `payment-schema.ts`      | `payment-schema.test.ts`             | `payments.db.test.ts`, `authorization.db.test.ts` (server refusals)                      | `PaymentForm.test.tsx`, browser step 5                              |
| Payment status (paid vs accepted quote) | `payment-status.ts`      | `payment-status.test.ts`             | `payments.db.test.ts` (from stored records)                                              | `PaymentStatusBadge.test.tsx`, `SupplierPaymentsSection.test.tsx`   |
| Due and overdue (Manila calendar day)   | `payment-due.ts`         | `payment-due.test.ts`                | `payments.db.test.ts`                                                                    | `PaymentDueBadge.test.tsx`, browser step 5                          |
| List overview                           | `supplier-overview.ts`   | `supplier-overview.test.ts`          | `authorization.db.test.ts` (each event's own rows)                                       | `SupplierList.test.tsx`, browser step 5                             |
| Search and filters                      | `supplier-list-query.ts` | `supplier-list-query.test.ts`        | `authorization.db.test.ts` (scoping, stored data)                                        | `pages.test.tsx`, browser step 9                                    |
| Activity wording, no contact details    | `audit/describe.ts`      | `audit.test.ts`                      | `activity.db.test.ts`                                                                    | `SupplierActivitySection.test.tsx`, browser steps 4, 5 and 7        |
| Authorization and event isolation       | (use cases, actions)     | none (it needs the database)         | `authorization.db.test.ts`, use-case tests                                               | browser step 8                                                      |

Financial results are deterministic: amounts are strings and centavo BigInts, never JavaScript
numbers; nothing is rounded (more than two decimals is refused); and today's date is passed in, so
the rules read no clock. `payment-status.test.ts` checks the result is the same in any payment
order, and `money.test.ts` checks sums where floating point would drift (0.10 + 0.20).

On 2026-10-14, 44 changes were made one at a time to the rule files above (a boundary moved from
`<` to `<=`, a guard removed, a limit raised by one, a filter or mapping swapped), the supplier,
audit and page unit tests (601) were run, and each change was reverted:

| Rule file                | Changes | Caught | Not caught                                                                                                                  |
| ------------------------ | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `money.ts`               | 11      | 11     |                                                                                                                             |
| `payment-status.ts`      | 5       | 5      |                                                                                                                             |
| `payment-due.ts`         | 6       | 5      | Day check in `isCalendarDate` removed: equivalent, since an impossible day always changes the month, which is still checked |
| `quote-statuses.ts`      | 2       | 2      |                                                                                                                             |
| `payment-schema.ts`      | 7       | 6      | Last allowed date (Dec 31, 2100) refused: a test was added; now caught                                                      |
| `quote-schema.ts`        | 3       | 3      |                                                                                                                             |
| `schema.ts`              | 7       | 6      | 6-digit phone accepted: a test was added (7 and 15 digits accepted, 6 and 16 refused); now caught                           |
| `supplier-overview.ts`   | 2       | 2      |                                                                                                                             |
| `supplier-list-query.ts` | 4       | 4      |                                                                                                                             |

After the two tests were added, 43 of 44 are caught; the one left changes no behaviour. No change
found a bug in the code.

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

### End-to-end accessibility readiness workflow (B3-16)

`e2e/lifecycle/accessibility-readiness.spec.ts` follows the whole workflow in Chromium, from a
reset test database:

1. Sign in through the login form, create an event and import a twelve-guest list with the CSV
   import.
2. Open the event from the event list, then a guest from the guest list.
3. Add an accessibility need with a note and save it, and give a second guest a captioning need.
4. Set up accessible seats.
5. See the readiness at **Not ready**, with "Captioning is not set up" as the gap and as the
   Overview alert.
6. Add the missing captioning from the gap's link: **Almost ready** while it is being arranged,
   then **Ready** once Available, with no gap and no alert left.
7. Check Activity has every change and never the note.
8. As a Viewer: readiness is visible, but no change links or forms, and the note is hidden.

Every record is made through the real pages and server actions, so nothing bypasses
authorization. Two stand-ins remain:

- **Sign-in** uses the dev-only demo stand-in (D-024), because there is no Supabase project in
  tests. Membership and role checks are the real ones.
- **The role change** in step 8 is a direct database update (`e2e/lifecycle/db.ts`), standing in
  for member screens that don't exist yet (D-034).

Stability: on 2026-10-14 it passed five runs in a row (`--repeat-each=5`, 40 of 40). It waits only
on what the page shows, never on fixed delays.

### End-to-end supplier flow (B4-03 to B4-18)

`e2e/lifecycle/supplier-flow.spec.ts` runs in Chromium as the demo user, against a reset test
database:

1. A new event shows "No suppliers yet". Add a supplier as Other: refused without saying what they
   provide (the typed name is kept), then saved as SUP-0001.
2. Edit it: new name, category changed to Sound and lights (the "What they provide" field goes
   away), new phone. The list shows "is up to date". The detail page shows the new phone and the
   supplier's own Activity, without the phone number.
3. Add quotes from the detail page: `165,000.505` is refused (two decimals at most), then
   ₱165,000.50 Accepted is saved as QUO-0001; a second Accepted quote is refused naming QUO-0001,
   and saved as Pending (QUO-0002). The supplier's Activity shows the quote.
4. Edit quotes: accepting QUO-0002 is refused while QUO-0001 is Accepted; QUO-0001 is changed to
   ₱170,000.00 and Declined; then QUO-0002 is accepted. The supplier's Activity shows each change
   old → new.
5. Deposits and payments: Unpaid against the accepted ₱45,000.00 quote; a paid ₱20,000 deposit makes
   it Partially paid; a ₱25,000 balance due on 2026-01-15 shows as overdue; a paid date in 2099 is
   refused by the server; once the balance is recorded as paid the supplier is Paid with nothing
   overdue, and Activity has the edit. The supplier list shows the same: "₱45,000.00 accepted",
   Partially paid and the overdue Jan 15, 2026 while it is owed, then "Nothing due" (B4-16).
6. Remove the supplier: Cancel in the confirmation keeps it; confirming removes it (and its quotes)
   and the list is empty.
7. Activity shows the add, the edit (category old → new, "Phone changed"), the quotes, the payments
   and the removal, and never the phone number.
8. Add a second supplier, which becomes SUP-0002, and a quote, which becomes QUO-0003 (numbers are
   not reused). As a Viewer (role set in the database, D-034): the list has no phone, email or
   notes and no Add or Edit links; the detail page shows the email link and the quote, with no
   Edit, no Add quote, no quote Edit links, no payment links and no Activity; the edit and
   add-quote addresses say "You don't have access".
   The list card shows "None accepted, 1 pending", No accepted quote and "Nothing due" (B4-16).
9. At 375 px wide (B4-17, B4-18): add a Venue supplier with an accepted quote; search "grand"
   ("1 of 2 suppliers match"); filter by Venue and "Quote accepted"; reload keeps the filters; adding
   "overdue only" shows "No suppliers match"; back restores the previous filters; "Clear search and
   filters" shows both suppliers again. No sideways scrolling.

### Accessibility screens: accessibility and responsive audit (B3-17)

On 2026-10-14 every accessibility screen was audited in Chromium at 375, 768 and 1280 px, with the
sample data and a gap present. The screens:

- the event Overview, with its alert;
- the attendee page, with the Accessibility section and alerts;
- the add-need and edit-need forms;
- the Accessibility page (readiness, gaps, needs, resources);
- the resource form, both setting up and editing.

What was checked, and the result after the fixes below:

| Check                                                                         | Result                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| axe-core scan (WCAG 2.0/2.1 A and AA, best practices), page and invalid forms | 0 violations                                                                         |
| Sideways scrolling                                                            | None at any width                                                                    |
| Keyboard: Tab order through each page                                         | Every control reachable, in reading order, each with a visible focus style           |
| Keyboard: radio groups                                                        | Arrow keys move between choices                                                      |
| Keyboard: remove dialogs                                                      | Focus moves in and stays in; Escape closes; focus returns to the button              |
| Headings                                                                      | One h1 per page; sections are h2, items h3, in order                                 |
| Form errors                                                                   | `aria-invalid` and `aria-describedby` on the field; focus moves to the error summary |
| Tap targets                                                                   | Actions at least 44 px; guest-name links at least 24 px (WCAG 2.2 AA)                |

Fixed:

- **Guest links inside sentences** were told apart from the text by color only (axe
  `link-in-text-block`). They are now always underlined.
- **"Edit" and "Set up" links** were 20 px tall. They now have a 44 px target, and a gap's fix
  link is now a small outline button.

Loading, error and empty states are covered by existing tests: `accessibility/states.test.tsx`,
the error and empty tests in `pages.test.tsx`, `AccessibilitySection.test.tsx` and
`ReadinessView.test.tsx`.

The scan used the `axe-core` copy that ESLint's accessibility plugin already installs, run from a
script outside the repository, so no dependency was added (option 2a). It is not part of CI.

### Known flaky test

`attendee-flow.spec.ts` step 5 (search, filter and sort) fails intermittently in `next dev`: for a
moment after a client navigation the guest list is rendered twice, so a text match finds two
elements or none. Seen on the Batch 2 commit before any Batch 3 change (1 run in 3); not fixed in
Batch 3, reported to the technical lead.

## Impact tests (B7-F16, D-101 to D-104)

| What                                                                                                                                                          | Where                                          | Layer     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------- |
| Every rule, boundary and severity, run with the budget's real D-088 rule; the brand book's 180 → 220 example; determinism                                     | `impact/application/impact-rules.test.ts`      | Unit      |
| Severity order, seat rounding, ratio parsing, keyword matching                                                                                                | `impact/domain/run-impact.test.ts`             | Unit      |
| Server validation (proposal, assumptions, snapshot); one severity list across domain, audit and database                                                      | `impact/schema.test.ts`                        | Unit      |
| Actions ask for their own permission; a refusal never reaches storage                                                                                         | `impact/actions.test.ts`                       | Unit      |
| Assumptions form: values, hidden fields, error summary, refusals                                                                                              | `impact/ui/AssumptionsForm.test.tsx`           | Component |
| Page: roles, results, invalid, no change, history, notices, unavailable; loading and error screens                                                            | `app/(app)/events/[eventId]/impact/*.test.tsx` | Component |
| Owner, Coordinator, Viewer, non-member, other event's owner, signed out; substituted category ID; stale saves; append-only; trigger; CHECKs; Activity wording | `impact/impact.db.test.ts`                     | Database  |
| The whole flow in Chromium: invalid number, 180 → 220, keyboard-only assumptions, save, Activity, event unchanged, 375 and 1280 px, Viewer                    | `e2e/lifecycle/impact-flow.spec.ts`            | Browser   |

**Proof the authorization tests catch a removed check.** Each was removed in turn and the suite run:
the `impact.record` and `impact.assumptions` checks in the actions (caught by `actions.test.ts`; the
database test alone did not catch them, because the storage layer still refused), the role check in
the numbering statement, the event scope of the category lookup, and the stale "from" check (caught
by `impact.db.test.ts`). 5 of 5 caught.

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