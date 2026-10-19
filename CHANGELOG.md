<!-- CHANGELOG.md -->

# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **B6-F03 Task deletion (D-095, proposed).**
  - Owners and Coordinators can delete a task from the list. A confirmation names the task and says
    it can't be undone; Viewers see no Delete button. The list then shows "Task TSK-0004 removed.".
    The number is never reused. Activity keeps the task's ID and title.
- **B6-F04 Task assignment (D-095, proposed).**
  - A task can be assigned to a member of its event, or left unassigned, from the add and edit forms.
    The list shows who it is assigned to. A member of another event is refused by the server and by
    the database. Removing a member unassigns their tasks instead of blocking the removal. Activity
    shows "Assignee: Unassigned → Ana Reyes". Any role can be assigned; this needs your confirmation
    (D-095, point 3).
- **B6-F05 Task priority (D-095, proposed).**
  - Every task has a priority: High, Medium (the default) or Low, shown as a word on the list and
    chosen on the add and edit forms. Tasks that existed before this change became Medium. Activity
    shows "Priority: Medium → High".
  - Migration `20261017120000_task_priority_assignee` (enum, two columns, foreign key and a trigger on
    `event_members`), written by hand: run `prisma migrate dev` once to confirm there is no drift.
    Applied to PostgreSQL 18 in testing, including on a database that already held a task.

- **B6-F10 Overdue detection (D-098, proposed).**
  - A task that is not Done and whose due date has passed shows an "Overdue" badge on the list. A
    task due today is not overdue until Philippine midnight; a Done task or one with no due date never
    is. Nothing is stored or sent: it is worked out when the list is shown. Needs your confirmation
    that "incomplete" means Not started or In progress.
- **B6-F11 Event-scoped task data and B6-F12 task authorization (D-099, proposed).**
  - Checked, not changed: tasks belong to one event, members read, Owners and Coordinators write, and
    the role is checked on the page, in the action and again in storage. Added tests for another
    event's task, non-members, Owners and Coordinators, a role changed between the check and the write,
    and the Add and Edit pages. No gap was found in the code.
- **B6-F08 Task list and B6-F09 task filtering (D-097, proposed).**
  - The task list was already event-scoped and visible to every member; this adds tests that pin it.
  - Above the list, filters for status, priority, assignee (or Unassigned) and due date (has one, has
    none, on or after, on or before). They combine, live in the address so reload and back keep them,
    and work on a phone. The list says "2 of 9 tasks match" and "No tasks match" with a Clear filters
    link. Viewers can filter too. There is no "overdue" filter yet.
- **B6-F06 Task status (D-096, proposed).**
  - Every task has a status: Not started (the default), In progress or Done, chosen on the add and
    edit forms and shown as a word on the list. Tasks that existed before this change became Not
    started. Activity shows "Status: Not started → Done". Only Owners and Coordinators can change it,
    so an assigned Viewer can't mark their own task done; this needs your confirmation (D-096,
    point 4).
- **B6-F07 Task due dates (D-096, proposed).**
  - A task can have a due date: an optional calendar date in Philippine time, set, changed or cleared
    on the add and edit forms. The list shows "Due Nov 15, 2026" or "No due date". A date in the past
    is allowed. Activity shows "Due date: none → Nov 15, 2026". Nothing is flagged late yet.
  - Migration `20261017150000_task_status_due_date` (enum, two columns, a range CHECK), written by
    hand: run `prisma migrate dev` once to confirm there is no drift. Applied to PostgreSQL 18 in
    testing, including on a database that already held a task.

- **B6-F01 Task creation (D-094, proposed).**
  - Owners and Coordinators can add a task to an event with a title and an optional description. Each
    task gets a readable ID (TSK-0001, numbered per event). The Tasks page now lists them, with an
    empty state, a confirmation after adding, and loading and error screens. Viewers can read the
    list but see no Add or Edit controls. Adding a task is recorded in Activity.
  - New table `tasks` and column `events.lastTaskNumber` (migration `20261017090000_tasks`, written
    by hand: run `prisma migrate dev` once to confirm there is no drift).

- **B6-F02 Task editing.**
  - Owners and Coordinators can change a task's title and description. A save that changes nothing
    says so and writes nothing; a save over someone else's newer edit is refused. Activity shows the
    title change old → new and "Description changed" (the text is never copied).

- **B5-F14 Budget audit and activity records (D-093, proposed).**
  - Activity now says what happened to the budget in plain words: a category or item added, edited,
    moved to another category or removed, with amounts old → new. Before this, these entries showed
    "Made a change (details unavailable)". Item notes are never shown, only "Notes changed". The
    audit registry test now lists the six budget actions.

- **B5-F15 Budget error and empty states.**
  - The budget and its add and edit pages have a loading screen and an error screen (no internal
    details, Try again). After a failed save both forms list every problem at once in a summary that
    takes focus and links to each field. An event with categories but no items says every total is
    ₱0.00.

- **B5-F16 Responsive budget interface.**
  - Items show as stacked cards on a phone and as columns from 768 px, so the budget no longer
    scrolls sideways. Summaries wrap, form controls are 44 px tall and form buttons fill the width
    on a phone.

- **B4-25 Supplier documentation.**
  - DATA_MODEL.md now has one Suppliers section with the rules for categories, quote and payment
    statuses, money, deletion, due dates and authorization. The money notes no longer say there is
    no arithmetic (centavo sums since B4-13).

- **B4-22 Supplier workflow test.**
  - A browser test runs the whole supplier workflow against a realistic seeded Cebu wedding:
    sign in, add a supplier and quote with the keyboard only, accept the quote, add a deposit
    with a due date, then list, search, filter, edit and Activity. Stored amounts and dates are
    read back from the database, another event's look-alike supplier is never reachable, and a
    Viewer can't open any form.

- **B4-23 Supplier screens polish.**
  - The supplier and payment forms now list every problem at once: a missing paid date or an
    Other supplier without a description is reported together with other errors, not on the next
    try. Supplier names on the list have a 44 px tap area on phones.

- **B4-21 Supplier tests.**
  - A coverage map of the supplier rules and a rule mutation check (44 changes, 43 caught, the
    other changes no behaviour). Two boundary tests were added: the last allowed payment date and
    the shortest phone number.

- **B4-20 Supplier activity.**
  - Quote and payment status changes now lead their Activity line ("Accepted the quote QUO-0002 for
    SUP-0001", "Marked the payment PAY-0002 for SUP-0001 as paid (Oct 2, 2026)"). Each supplier,
    quote and payment change is tested to write exactly one entry and never a contact detail.

- **B4-19 Supplier authorization tests.**
  - The seven required access cases for suppliers, quotes and payments are tested through the real
    server actions, and each server-side check was shown to be caught when removed.

- **B4-18 Supplier filters (D-083).**
  - Filter suppliers by category, quote, payment status and overdue payments, together with the
    search. Filters stay in the address, so reload, back and sharing keep them.

- **B4-17 Supplier search (D-082).**
  - Find suppliers by name, contact person, what they provide or ID. Accents and capitals don't
    matter; "No suppliers match" says what was searched and how to clear it.

- **B4-16 Supplier list overview (D-081).**
  - Each supplier on the list now shows its accepted quote, its payment status and its next due
    date, marked Overdue or Due today when that applies.

- **B4-14 Managing deposits and payments (D-080).**
  - Owners and Coordinators can add and edit a supplier's deposits and payments: amount, due date,
    and whether and when it was paid. The supplier's page shows the payment status, anything
    overdue, and each payment.

- **B4-15 Payment due status (D-079).**
  - Each payment shows Overdue, Due today, Upcoming or Paid, by Philippine calendar day. A paid
    payment is never overdue.

- **B4-13 Supplier payment status (D-078).**
  - A supplier is No accepted quote, Unpaid, Partially paid or Paid, comparing what has been paid
    with the accepted quote, to the centavo.

- **B4-12 Supplier payments data model (D-077).**
  - Each supplier can hold its deposits and other payments (PAY-0001): an amount in pesos, a due
    date, and whether it has been paid and when. Tracking only; no payment processing.

- **B4-10 Editing quotes (D-075, D-076).**
  - Owners and Coordinators can change a quote's amount, status and description. If someone else
    saved it first, the save is refused. Activity shows each change.

- **B4-09 Adding quotes (D-075).**
  - Owners and Coordinators can add a quote to a supplier from its page: an amount in pesos, a
    status and an optional description. Every member sees the supplier's quotes; Activity records
    each one.

- **B4-11 Quote statuses (D-076).**
  - A quote is Pending, Accepted or Declined. A supplier can have one Accepted quote at a time;
    accepting another is refused until the first is changed.

- **B4-08 Supplier quotes data model (D-075).**
  - Each supplier can hold several quotes (QUO-0001), each with an amount in pesos stored exactly to
    the centavo, a status and an optional description.

- **B4-07 Supplier detail page (D-074).**
  - Each supplier's name opens a page with its category and contact details. Owners and
    Coordinators also see Edit supplier and the supplier's recent Activity.

- **B4-06 Supplier contacts (D-073).**
  - A supplier's contact person, phone and email are defined, checked and kept to business
    details. The form says every member can see them; Activity never shows them.

- **B4-05 Removing suppliers (D-072).**
  - Owners and Coordinators can remove a supplier after confirming. Removal is permanent; Activity
    keeps the supplier's number and name, and numbers are never reused.

- **B4-04 Editing suppliers (D-071).**
  - Owners and Coordinators can edit a supplier from the Suppliers page. If someone else saved the
    supplier first, the save is refused so nothing is overwritten. Activity shows what changed,
    without contact details.

- **B4-03 Adding suppliers (D-070).**
  - Owners and Coordinators can add a supplier with its name, category, contact person, phone,
    email and notes. Every member sees the event's suppliers on the Suppliers page, with phone and
    email as links. Each addition appears in Activity.

- **B4-02 Supplier categories (D-069).**
  - Suppliers are grouped by a fixed list of thirteen categories, from Venue and Catering to
    Printing and stationery. "Other" asks what the supplier provides, for example "Fireworks".

- **B4-01 Supplier data model (D-068).**
  - Each event can now store its own suppliers: a readable number (SUP-0001), name, category,
    contact person, email, phone and notes. Suppliers belong to one event only and are deleted with
    it.

- **B3-20 Accessibility batch verification.**
  - Every local check passes and is recorded in docs/gates/BATCH-3.md. CI and the first
    `prisma migrate deploy` of the accessibility migration have not run yet.

- **B3-19 Accessibility security review.**
  - A note containing an invisible NUL character is now refused with a clear message instead of a
    generic save error. The review and its remaining debt are recorded in SECURITY.md.

- **B3-18 Accessibility documentation.**
  - ARCHITECTURE.md now describes the accessibility context: its layers, how a change and a
    readiness read flow, and where it touches other parts. ACCEPTANCE_CRITERIA.md lists every Batch
    3 criterion with its evidence. TESTING.md gains a test strategy summary.

- **B3-17 Accessibility screens polish.**
  - Guest links inside sentences are now underlined, not just colored, and "Edit" and "Set up"
    links are easier to tap (44 px). Every accessibility screen was checked for keyboard use,
    screen-reader structure, form errors and small screens.

- **B3-16 Accessibility browser workflow.**
  - A browser test now follows the whole accessibility workflow on a realistic twelve-guest event,
    from sign-in to readiness going from Not ready to Almost ready to Ready, Activity, and a
    Viewer's read-only view.

- **B3-15 Accessibility integration tests.**
  - One test follows a real event from guests to needs, resources, readiness, gaps and alerts in the
    database, including a guest declining and a guest being removed, with refused users changing
    nothing and every change in Activity.

- **B3-14 Accessibility domain tests.**
  - Every named readiness case is tested through status, gaps and alerts. A need with an unknown
    type or priority is now refused instead of being guessed.

- **B3-13 Accessibility authorization tests.**
  - The security matrix now also covers another event's owner trying Event A, and the alert reads.
    New tests show refused callers are turned away before any data is opened. Removing any
    server-side check makes the tests fail (recorded in docs/TESTING.md).

- **B3-12 Accessibility Activity.**
  - Confirmed end to end: adding, changing and removing an accessibility need or an event resource
    each appear in the event's Activity with who did it, never the note. Viewing pages records
    nothing.

- **B3-11 Accessibility Alerts (D-066).**
  - The event Overview shows an accessibility alert while the event is Not ready or Almost ready,
    with the issues behind it and a link to the Accessibility page. A guest's page shows the alerts
    about their needs, with a link to fix the resource for Owners and Coordinators.
  - Alerts are worked out from the stored data on every visit: only real gaps raise them, never a
    covered need or a Preferred need's advice. Nothing is stored, sent or dismissed.

- **B3-10 Accessibility Readiness View (D-065).**
  - The Accessibility page now answers "Are our guests' accessibility needs covered, and if not,
    what is missing?": the readiness status first, then each gap with the guests it affects and a
    link to fix it, then guests' needs by type, then the event's resources. Calculated on every
    visit from the stored data; every member can see it.

- **B3-09 Accessibility Gap Detection (D-064).**
  - Each gap names the guests and needs affected, the missing or short resource, what it means for
    readiness (Not ready, Almost ready or advice only) and a plain sentence such as "Captioning is
    not set up, but 2 guests need it." Covered needs never produce a gap; the order is fixed.

- **B3-08 Readiness Status (D-063).**
  - Four canonical readiness statuses with plain descriptions: No required needs, Not ready, Almost
    ready, Ready. Derived from the coverage of Required needs only, never stored, so it can't be set
    by hand.

- **B3-07 Accessibility Readiness Domain Logic (D-062).**
  - A pure, deterministic calculation of which guests' accessibility needs the event's resources
    cover: Required needs decide, Preferred are advice, For information and declined guests are
    left out; seats are compared as a whole; Other needs are to check by hand. The rules are
    written in DATA_MODEL.md. No AI, no permission checks, nothing stored.

- **B3-06 Accessibility Resource Management UI.**
  - The Accessibility page and resource forms have their own loading and error screens, and the
    resource list is headed "What the event provides" so it reads apart from guests' needs.

- **B3-05 Accessibility Resource CRUD (D-061).**
  - The event's Accessibility page now lists the six resources (accessible seats, accessible
    entrance, ramp or elevator, accessible restroom, captioning, sign-language interpreter) with
    their status, seat count and note, replacing the placeholder. Owners and Coordinators can set
    each one up, edit it or remove it; stale saves are refused.
  - Activity entries `accessibility_resource.created`, `.updated` and `.deleted`.

- **B3-04 Accessibility Requirement UI (D-060).**
  - The attendee details page has an Accessibility section listing each need with its priority in
    words and, for Owners and Coordinators, its note. Owners and Coordinators can add a need, edit
    it, or remove it after confirming. Notices confirm each change.
  - Accessible forms: labelled radio groups with descriptions, disabled "(already added)" choices,
    errors in a summary and beside the field. Empty, error and no-access states.
  - A browser test covers adding (choosing with the keyboard), editing, removing and Activity.

- **B3-03 Accessibility Requirement CRUD (D-058, D-059).**
  - Server actions to add, edit and remove an attendee's accessibility needs, for Owners and
    Coordinators (`accessibility.manage`), validated with the shared schema. One need of each type
    per attendee; stale saves refused; a save that changes nothing records nothing.
  - New permission row `accessibility.private` (Owner, Coordinator): only those roles receive the
    notes, which can hold health details. Every member sees types and priorities.
  - Activity entries `accessibility_requirement.created`, `.updated` and `.deleted`, which never
    store the note or the name.
  - Use cases behind an `AccessibilityRepository` port, with Prisma and sample-data (D-041)
    implementations. A security matrix test runs seven callers through every operation.

- **B3-02 Accessibility Requirement Definitions (D-057).**
  - One canonical list each for requirement types (seven, including Other), priorities (Required,
    Preferred, For information), resource types (six) and resource statuses, with labels and
    meanings, in `accessibility/domain/`. Shared Zod validation in `accessibility/schema.ts`.
    Documented in DATA_MODEL.md.

- **B3-01 Accessibility Data Model (D-056).**
  - New tables `accessibility_requirements` (an attendee's needs: type, priority, optional note;
    one of each type per attendee; tied to the attendee and event by a composite foreign key so it
    can't cross events) and `accessibility_resources` (what the event provides: one row per type,
    status, a seat count for accessible seats only, optional note). Migration
    `20261013120000_accessibility`; both cascade with their event, requirements with their attendee.

- **B2-25 Attendee Documentation.**
  - New `docs/USER_FLOWS.md` (guest list, add, view and edit, remove, import pipeline, export, with
    roles and error states) and `docs/ACCEPTANCE_CRITERIA.md` (every Batch 2 criterion → where it is
    met → the test that proves it).
  - DATA_MODEL.md: an attendees overview and the import validation rules. SECURITY.md: the attendee
    permission table and how it is proven. TESTING.md: the security matrix, Activity test, coverage
    matrix and end-to-end flow (added in B2-20 to B2-24).

- **B2-24 Attendee E2E Flow (D-055).**
  - A browser test of the whole attendee flow: create with a plus-one, dietary needs and RSVP, edit,
    import a CSV (match, preview, confirm), search, filter and sort, export and read the file, and
    check Activity, with a second event proving nothing crosses over.
  - CI gets an `e2e` job running the browser lifecycle suite against a fresh PostgreSQL, keeping
    the Playwright report when something fails.

- **B2-22 Attendee UX Polish.**
  - "Export CSV" now confirms the download ("Downloaded EVT-2026-0001-attendees-2026-10-13.csv (8
    attendees).") and shows a clear message if the export fails, instead of raw JSON. It still works
    without JavaScript.
  - Every attendee screen and state was swept at 375, 768 and 1280 px with axe, a scroll check and a
    keyboard focus walk: no violations, no sideways scroll, visible focus everywhere. Results in
    QUALITY.md.

- **B2-20 Attendee Authorization Tests, B2-21 Attendee Activity, B2-23 Attendee Tests.**
  - A security checkpoint test: six callers (Owner, Coordinator, Viewer, a user on another event,
    a cross-event attendee ID, signed out) × nine attendee operations through the real actions and
    API route, with every denial checked to change nothing and leak nothing.
  - An Activity test running create, edit, RSVP change, import, export and delete, checking the
    feed in order and that no entry stores contact details, dietary needs or notes.
  - A coverage matrix in TESTING.md mapping every listed attendee behaviour to its tests, and the
    attendee audit policy in AUDIT.md.
  - CI's check job is green again (D-054): the seven empty scaffold test files are to-dos, knip
    checks built code only, and unused public exports were removed.

- **B2-19 CSV Export (D-053).**
  - "Export CSV" on the guest list (Owners and Coordinators) downloads every attendee of this event
    as a CSV file named like `EVT-2026-0001-attendees-2026-10-13.csv`: ID, name, RSVP, plus-ones,
    category, dietary needs, email, phone and notes. The file opens correctly in Excel and can be
    imported again.
  - Formula-looking values are made safe; an empty guest list gives a header-only file.
  - New address `/api/events/<id>/attendees/export`, replacing the placeholder
    `/api/attendees/export`. Viewers get 403, non-members and other events 404, signed-out users 401.
  - Each export is recorded in Activity ("Exported the guest list as CSV (12 attendees)").
  - Tests: the file (columns, order, quoting, formula safety, header-only, round trip to the import,
    Manila file name), the route's failure paths, the Export link per role, sample data, and against
    PostgreSQL: content, event isolation, every refused caller, and the Activity entry.

- **B2-14 to B2-18 CSV import (D-052).**
  - The Import page (and "Import CSV" on the guest list) brings a guest spreadsheet into the event
    for Owners and Coordinators: choose a .csv file, match its columns to EventOps fields (common
    headers are filled in), preview every row, then confirm.
  - The preview shows the totals (rows, to import, needing correction, possible duplicates), the
    matching, the columns not imported, and each row with its reasons. Rows needing correction can
    be downloaded to fix. Possible duplicates are skipped unless chosen.
  - Nothing is saved before confirming. At confirm the server re-checks the whole file and imports
    the valid rows in one transaction, or nothing. The result shows the new IDs; Activity records
    "Imported 184 attendees from a CSV file (ATT-0009 to ATT-0192)".
  - Rows follow the add form's rules; RSVP also accepts common words such as Yes, No and Tentative.
  - Limits: 500 KB, 2,000 rows, UTF-8 CSV. Works with sample data.
  - Docs fixed: the decisions index now lists D-050 and D-051, and PERMISSIONS.md lists B2-07's
    `attendees.private` row under "Role boundaries tested so far".
  - Tests: the parser, mapping, validation, duplicates and preview rules; every step and its
    states; the page per role; and against PostgreSQL: nothing written before confirming, event
    isolation, numbering, all-or-nothing on a database failure, tampered steps, duplicates on a
    second import, refused roles, and the Activity entry.

- **B2-13 Attendee Detail View (D-051).**
  - The attendee details page is now composed of independent sections (Details, Notes), each from
    its own module, in a shared section frame. Batch 3 adds Accessibility as its own section without
    changing the attendees module. Nothing visible changed.
  - Tests: the section frame, section order per role, and a removed attendee being not found.

- **B2-10 Attendee Search, B2-11 Attendee Filtering, B2-12 Attendee Sorting (D-050).**
  - One search, filter and sort form above the guest list, kept in the address (works without
    JavaScript, can be bookmarked). It stacks into one column on phones.
  - Search by name (ignoring case and accents) or attendee ID for every member; Owners and
    Coordinators can also search by email or phone.
  - Filters for Category, Dietary needs (recorded or not) and Plus-ones, combined with the RSVP links
    (which now keep the other choices); "Clear all" resets everything.
  - Sort by Name, ID, RSVP, Plus-ones or Category, ascending or descending, with stable tie-breaks.
    The sorted column is announced to screen readers.
  - "No attendees match" says what was searched and filtered and offers to clear it. The headcount
    summary and RSVP counts still cover the whole guest list.
  - The guest-list read now loads email and phone for Owners and Coordinators (for search only;
    still not shown in the list). Viewers still don't receive them, and notes are never loaded.
  - Tests: the query functions (matching, filters, combinations, sorting, junk values), the form, the
    sorted column, the page per role, and against PostgreSQL: event isolation, Viewer email search,
    and sorting that leaves every stored row and Activity unchanged.

- **B2-09 Attendee List.**
  - The guest list and the attendee pages below it have their own loading screen ("Loading
    attendees") and error screen ("Couldn't load attendees", with Try again and a safe reference),
    following D-040. The event header and sidebar stay in both.
  - Tests: the loading and error screens (no internal details, Try again refreshes server data) and
    an acceptance pass over the guest list for an Owner and a Viewer. Checked in a browser against
    PostgreSQL at 375, 768 and 1280 px, with the table locked (loading) and the attendees query
    failing (error).

- **B2-08 RSVP Status (D-049).**
  - The guest list can be filtered by RSVP: "All · Confirmed · Pending · Maybe · Declined", each
    with its count. The choice is kept in the address, the current one is marked for screen
    readers, and "No Maybe attendees" offers "Show everyone". The count reads "2 of 8 attendees,
    Confirmed"; the headcount summary still covers the whole list.
  - The four RSVP states and their meaning are documented; any state can change to any other.
  - Tests: the filter functions and links, the page with each filter for every role, and every one
    of the 12 RSVP changes against PostgreSQL (saved, in Activity, headcount), plus unchanged saves,
    invalid states, Viewers, non-members and another event's attendee.

- **B2-07 Attendee Notes (D-048).**
  - New attendee details page, opened from any name on the guest list by every member: ID, name,
    RSVP, plus-ones, category and dietary needs, with "Edit attendee" for Owners and Coordinators.
  - Notes appear in their own section with their line breaks, shown as text (never HTML), or "No
    notes." Email, phone and notes are shown only to Owners and Coordinators (new permission row
    `attendees.private`); the server doesn't load them for Viewers, and the page says who can see
    them.
  - The notes hint says who sees notes and that clearing the field removes them. Activity still
    records only "Notes changed".
  - Tests: creating, editing and clearing notes against PostgreSQL, the right attendee and event,
    Activity without the text, every role, non-members, signed-out users and another event's
    attendee; the read with each permission; the details view (line breaks, HTML-like text, empty
    values); the page per role.

- **B2-06 Dietary Needs (D-047).**
  - The guest list has a Dietary needs column for every member, Viewers included (new permission
    row `attendees.dietary`). An empty entry shows a dash, read as "Not recorded".
  - Several needs go in one entry, separated by semicolons; clearing the field removes them. The
    form hint says both. Activity still records only "Dietary needs changed".
  - The guest list now loads only the columns it shows. Email, phone and notes are loaded only by
    the edit form (Owners and Coordinators).
  - Tests: recording, editing and removing against PostgreSQL, the right attendee and event,
    Activity without the text, every role and non-members, the read with and without the permission,
    the list column, the page and the form hint.

- **B2-05 Plus-One Management (D-046).**
  - Plus-ones are a count on each attendee (0 for none, up to 10), recorded in `DATA_MODEL.md`
    before building. The form hint now says "Guests coming with them: 0 for none, up to 10."
  - The guest list shows the expected headcount above the table: confirmed attendees plus their
    plus-ones, how many are not yet confirmed (with the people they would bring), and how many
    declined. Pending, Maybe and Declined are not counted.
  - The headcount is calculated from the guest list every time; it is not the event's planning
    number and not live attendance.
  - Tests: the headcount rule (none, one, ten, mixed statuses, removing a plus-one), the summary, the
    guest list page, and editing plus-ones against PostgreSQL.

- **B2-04 Attendee Deletion (D-045).**
  - "Remove attendee" on the edit page (Owners and Coordinators), behind a confirmation that starts
    on Cancel. Cancel or Escape removes nothing. The guest list confirms "Attendee removed".
  - The attendee is permanently removed; Activity records "Removed the attendee <name> (ATT-…)".
    Numbers are never reused.
  - Removing works with sample data, so adding, editing and removing attendees all work without a
    database.
  - Tests: confirmation dialog, actions, pages, sample data, and removal end to end against
    PostgreSQL, including refused roles and another event's attendee.

- **B2-03 Attendee Editing (D-044).**
  - Edit attendee page, opened from the attendee's name in the guest list (Owners and
    Coordinators): every field loaded and editable, field errors, a "Saving changes…" state, and a
    clear message if someone else saved first. "Changes saved" on the guest list afterwards; "No
    changes to save" when nothing changed.
  - Viewers see plain names and can't open the form; another event's attendee is not found.
  - Each save records the changed fields in Activity (contact details, dietary needs and notes only
    as "changed").
  - Editing works with sample data.
  - Tests: form, pages, actions, sample data, and the full edit flow against PostgreSQL.

- **B2-02 Attendee Creation (D-043).**
  - Add attendee page for Owners and Coordinators: name (required), email, phone, RSVP, plus-ones,
    category, dietary needs and notes, with errors next to each field and in a summary, kept input,
    a "Adding attendee…" state that blocks double submits, and a safe message on server errors.
  - Guest list page for every member: ID, name, RSVP, plus-ones and category, an empty state, and an
    "Attendee added" confirmation after saving. Viewers see no Add button and are refused the form.
  - Sample data includes guests, and adding an attendee works with sample data.
  - Tests: form, list and page components, actions, sample guests, and the full add flow against
    PostgreSQL including Activity.

- **B2-01 Attendee Data Model (D-042).**
  - Table `attendees` (migration `20261012120000_attendees`): name, optional email, phone and
    category, RSVP status (Pending, Confirmed, Declined, Maybe), plus-ones (0 to 10), dietary needs,
    notes and timestamps. Belongs to one event and is deleted with it; readable IDs `ATT-0001` per
    event; CHECK constraints and indexes for the guest list and RSVP counts.
  - Validation with clear messages, and create, edit and delete server actions for Owners and
    Coordinators, with the role re-checked in the database, stale edits refused and every change
    recorded in the audit log without copying contact details, dietary needs or notes.
  - `getEventAttendees` for pages: every member can read the guest list.
  - Activity shows added, edited and removed attendees.
  - Tests: validation, actions, audit registry and 33 database tests.

- **Sample data for demo sign-in (D-041).** With `DEV_DEMO_AUTH=true` and no `DATABASE_URL`,
  `npm run dev` now shows six sample events (Owner, Coordinator and Viewer roles, plus one event
  the demo user can't open) with sample activity, instead of "No database connected". Create, edit
  and delete work in memory and reset when the dev server restarts. Only the data source changes:
  sign-in, access checks, permissions, validation and the audit registry are the real code.
  `src/modules/events/sample-data.ts`, with tests.

- **B1-15 Event Foundation Polish.** Every screen checked in a browser at 375, 768 and 1280 px for
  each role: automated accessibility scan, console, keyboard, layout, form, loading and error
  states. Results in `docs/QUALITY.md` (D-040).
  - Error screen inside the app shell (`src/app/(app)/error.tsx`): a failure while an event loads
    keeps the sidebar and header, with Try again and Back to my events. Resolves open item 10.
  - Loading screen for the event overview and sections, below the event header.
  - Browser tab icon (`public/icon.svg`), the brand mark. Static images and icons live in `public/`.
  - A test that fails if a loading screen is added above the event layout.

- **B1-14 Event Foundation Integration Tests.**
  - `lifecycle.db.test.ts`: the whole event lifecycle as one story through the real server code and
    PostgreSQL, with four users (Owner, Coordinator, Viewer, outsider) and role changes; runs in CI
    with `npm run test:db` (D-039).
  - `e2e/lifecycle/event-lifecycle.spec.ts`: the same story in a real browser with dev demo
    sign-in, run locally with `npm run test:e2e:lifecycle` against a reset test database.
  - `scripts/reset-demo.ts` resets the demo user's data, refusing databases not named for tests.
  - `docs/TESTING.md`: every test layer, the lifecycle tests and how to run them.
- **B1-13 Event Navigation & Context.**
  - Browser tabs name the event, for example "Settings · Santos wedding · EventOps" (D-038).
  - The top bar names the event (tablet and desktop) once the server confirmed access.
  - Not-found inside the app keeps the app shell, has a single `<main>`, links back to My events
    and stops offering the unavailable event's sections.
  - `getCurrentUser` is cached per request.
  - Verified in a browser: refresh keeps the event, sidebar links stay inside it, malformed and
    refused event IDs give a 404 with no event navigation, no sideways scrolling at 375 px.
- **B1-12 Activity Feed.** Verified, no code change: the Activity page from B1-11 meets every
  criterion and reads only the audit log. Rechecked in a browser for Owner (entries, newest first),
  Coordinator (empty state), Viewer (refused) and a non-member (404) at 375, 768 and 1280 px, and
  with the database stopped (safe error, no details). Errors while an event loads still replace the
  app shell; recorded as open item 10.
- **B1-11 Audit Log Foundation.**
  - Table `audit_logs` (migration `20261012090000_audit_log`): event, actor, action, entity, details
    and time, append-only through a database trigger, deleted with its event (D-037).
  - A controlled list of audited actions with strict schemas: `event.created` and `event.updated`
    (changed fields, old → new; the description is marked changed, never copied). Written in the
    same transaction as the change. See `docs/AUDIT.md`.
  - Activity page for Owners and Coordinators: the latest 100 entries, newest first, with time,
    who and what changed. Viewers are refused; loading, empty and error states.
  - Tests: recording, rollback, append-only, cascade, deleted actor, registry rules, and who can
    read the log, including end to end against a real database.
- **B1-10 Event Settings.** Verified, no code change: the Settings page from B1-05, B1-06 and B1-08
  meets every criterion. Rechecked in a browser for Owner, Coordinator and Viewer at 375, 768 and
  1280 px (no sideways scrolling, every control at least 44 px tall, keyboard reaches Delete, the
  delete dialog fits a phone screen). Changing event status is recorded as an open item.
- **B1-09 Server-Side Event Authorization.**
  - One authorization pattern for every event operation: `authorizeEvent` (server actions) and
    `authorizeEventRequest` (API routes; 401, 403, 404, 503), alongside `requireEventAccess`
    (pages) (D-036). Edit, delete and `GET /api/events/<id>` now use it, with unchanged behaviour.
  - End-to-end security test against a real database: the required matrix (User A/B × Event A/B,
    Viewer write, Coordinator Owner-only, Owner), cross-event access and role escalation attempts
    (forged role, user or owner fields, demotion and removal after opening a form).
  - Guard test: every server action that takes an event ID must call `authorizeEvent` first.
  - SECURITY.md: "How to authorize an event operation", with templates and a checklist.
- **B1-08 Event Roles.**
  - The full permission matrix for Owner, Coordinator and Viewer is documented in
    `docs/PERMISSIONS.md` and encoded in `permissions.ts`; a test fails if they differ (D-035).
  - Settings tells each member their role and what it allows.
  - Tests for every built role boundary (edit and delete, each role), plus whole-matrix checks:
    Viewer can only view, Owner can do everything, Coordinator is refused exactly the Owner-only
    permissions.
- **B1-07 Event Membership.**
  - Every page under `/events/<id>`, including the placeholder section pages, now checks
    membership itself. A test walks every event page so a new one without the check fails (D-034).
  - Consolidated membership isolation tests: one or many events per user, a role per event, no
    access to other events by ID, removed members lose access, unknown or missing roles refused.
  - `SECURITY.md` maps each membership criterion to where it is enforced and tested.
- **B1-06 Delete Event.**
  - Owners can permanently delete an event from the bottom of its Settings page. The destructive
    dialog names the event, says it can't be undone, and enables Delete only after the event
    number is typed. Cancel deletes nothing (D-033).
  - Everything that belongs to the event is deleted with it (D-004, reconfirmed). The user lands on
    My events with an "Event deleted" notice; the event's pages and API then answer 404.
  - `ConfirmDialog` gained two optional props: `confirmDisabled` and extra content (`children`).
  - The permission matrix gains `event.delete` (Owner only).
  - Tests: 26 unit, component and page tests and 8 database tests, including one that fails if any
    foreign key to `events` does not cascade.
- **B1-05 Edit Event.**
  - Settings page (`/events/<id>/settings`): Owners and Coordinators edit the event's name, date,
    times, venue, description, capacity and expected attendees, with the current values filled
    in and the same validation as Create Event. Viewers see the details read-only (D-031, D-032).
  - Saves are refused if someone else saved since the form was opened, so nothing is silently
    overwritten. A save that changes nothing writes nothing.
  - The header, overview and form show the new values as soon as the save succeeds.
  - Loading and error screens for the Settings page; "Edit event" link on the overview.
  - The permission matrix starts with `event.edit` (D-031).
  - Create Event and Edit Event share one set of form fields (`EventFormFields`).
  - Tests: 36 unit, component and page tests and 6 database tests.
- **B1-04 Event Workspace.**
  - `/events/<id>` loads the event on the server for members only. Other users' events, unknown
    events and malformed IDs all show the not-found page with HTTP 404 (D-027).
  - Workspace header on every event section: event number, name, date and time, venue, status
    and your role. The top bar now shows "Switch event" instead of the raw event ID.
  - Overview: event details and tiles for the Tier 1 sections, each marked "Not set up yet".
  - `GET /api/events/<id>`: the event and your role, for members only.
  - `requireEventAccess`, the access check every event page, action and route must call.
  - Tests: 12 access, 3 layout, 5 overview, 5 API and 3 database tests.
- **B1-03 Event List.**
  - "My events" page: the events you belong to as cards with name, reference, date and time in
    Philippine time, venue, expected attendees, status and your role, grouped into Upcoming and
    Past. Each card opens the event's workspace. Loading, empty, error and "no database" (demo)
    states.
  - `GET /api/events`: the same list as JSON, for the signed-in user only (D-026).
  - Tests: 13 list-rule, 6 database isolation, 5 API, 3 card and 4 page/error-state tests.
- **B1-02 Create Event.**
  - "Create an event" page at `/events/new`: name, date and start time required; end time, venue,
    description, capacity and expected attendees optional. Times are in Philippine time (D-025).
  - Server action that checks the signed-in user, validates with Zod, and saves the event and the
    creator's `OWNER` membership in one transaction with the next `EVT-<year>-<number>` reference
    (D-005).
  - Accessible field errors with a summary, kept input after an error, a "Creating event…" loading
    state, a safe message when saving fails, and an "Event created" notice on the new workspace.
  - Tests: 47 validation, 7 action, 5 form and notice, and 5 database tests.
- **B1-01 Event Data Model.**
  - Every event has at least one `OWNER` membership, enforced by deferred database triggers
    (migration `20261011090000_event_ownership`, D-022). Removing, demoting or deleting the last
    owner fails; the migration stops if existing data already breaks the rule.
  - Length limits: event name 120, venue 200 and description 5,000 characters (D-023).
  - Database tests: ownership, length limits and `createdAt`/`updatedAt` behaviour (16 new, 42 in
    total).
- **Dev-only demo sign-in (D-024).** `DEV_DEMO_AUTH=true` lets `npm run dev` show signed-in pages
  without Supabase, as a demo user with a warning banner. Ignored outside `next dev`; `npm run
build` fails if it is set.
- **B0-10 Application Shell.**
  - Authenticated layout with a desktop sidebar, a header and a main content area capped at
    1200 px. Below 768 px the sidebar moves into a "Menu" drawer (D-021).
  - Sidebar navigation: "My events" and "New event", or the event's Tier 1 sections inside an
    event. The current page is marked with `aria-current="page"`.
  - User menu with the signed-in user's name and email and Sign out, with full keyboard support.
  - Event context placeholder: the event ID from the URL and a "Switch event" link, with no event
    data loaded before access checks exist (D-018). Malformed event IDs show the not-found page.
  - "Skip to main content" link and page titles in the form "Attendees · EventOps".
  - Placeholder pages and API routes for every route without a feature yet (D-019).
    `npm run build` now succeeds.
  - Inline Lucide icons (D-020) with the license notice in `THIRD-PARTY-LICENSES.md`.
  - Tests: 209 unit and component tests in total, 48 more than after B0-09.
- **B0-09 Authentication Foundation.**
  - Supabase Auth with cookie sessions (`@supabase/ssr`): server client, session refresh in
    `src/proxy.ts`, and a redirect to `/login?next=...` for signed-out visitors of protected pages.
  - Server-side checks `requireUser()` and `getCurrentUser()` in `src/lib/auth.ts`, verified with
    Supabase `getUser()` on every call (D-013). Every page under `src/app/(app)/` is protected by
    its layout.
  - Sign-up, sign-in and sign-out server actions with Zod validation, 8-character passwords
    (D-015), required email confirmation (D-014) and the `/auth/confirm` route.
  - The `users` row is created or updated at sign-in and confirmation (D-016).
  - Safe error messages with no account enumeration, and an open-redirect guard for `?next=`.
  - Minimal `/login` and `/sign-up` pages and a sign-out button (D-012).
  - Tests: 107 unit and component tests, 4 database tests and 6 browser (Playwright) tests.
  - `docs/SECURITY.md`: authentication design, required Supabase settings and a manual check.
- **B0-08 Database Foundation.**
  - Prisma schema for `User`, `Event`, `EventMember` and `EventReferenceCounter` (D-008, D-009).
  - Initial migration `prisma/migrations/20261009143000_init`: tables, enums, unique keys, indexes,
    foreign keys, and four hand-written CHECK constraints on events (D-010). An event's creator
    cannot be deleted (D-011); deleting an event deletes its memberships.
  - Server-only Prisma client in `src/lib/db.ts` (`getDb()`), using the pg driver adapter on
    `DATABASE_URL`.
  - `npm run test:db`: database integration tests (migration state, Prisma client round trip,
    unique keys, CHECK constraints, foreign keys, deletion, concurrent event references) against
    `TEST_DATABASE_URL`. Not part of `npm test`.
  - CI job `database`: applies every migration to a clean PostgreSQL 17, checks migration status,
    then runs `npm run test:db`.
- npm scripts for dev, build, start, lint, typecheck, format, format:check, test, test:e2e and knip,
  plus the `check` script (lint, typecheck, knip, test).
- Prisma npm scripts: `db:generate`, `db:validate`, `db:format`, `db:migrate`, `db:deploy` and
  `db:status`.
- `docs/DECISIONS.md`, `BUILD_BACKLOG.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `docs/DATA_MODEL.md` and a populated `.env.example`.

### Fixed

- **Batch 2 repository repair.** The checks were red on the Batch 2 snapshot:
  - Restored the Edit attendee page (`/events/<id>/attendees/<attendeeId>/edit`, B2-03, D-044).
    The details page linked to it, but the file was missing; the page test imported the wrong path.
  - The Import page now shows the CSV import steps for Owners and Coordinators (B2-14 to B2-18,
    D-052) instead of the placeholder, with its own page test (`import/page.test.tsx`).
  - Documentation files use the upper-case names from D-006 (`docs/PERMISSIONS.md`,
    `docs/SECURITY.md`, `docs/TESTING.md`, `docs/DATA_MODEL.md`, `docs/AUDIT.md` and the rest;
    `BUILD_BACKLOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `THIRD-PARTY-LICENSES.md` at the
    root, as their headers say). The permission matrix test reads `docs/PERMISSIONS.md` again.
  - Typecheck: test tables in the event, settings and attendee schema tests are `as const`.
  - knip: removed the unused `AttendeeAddedNotice` (replaced by `AttendeeNotice` in B2-03) and the
    duplicate `playwright/playwright.lifecycle.config.ts`.
  - The database test of expected tables now includes `attendees` (B2-01).
  - Renamed `xportButton.test.tsx` to `ExportButton.test.tsx`.
- "Try again" on every error screen now fetches fresh server data before resetting; before, a page
  that failed on the server stayed broken after the cause was gone (B1-15).
- The desktop sidebar's EventOps link was outside any landmark; the sidebar is now an `<aside>`
  (B1-15).
- The not-found page inside the app no longer nests a second `<main>` (found in B1-04).
- My events: its loading and error files moved into the `(list)` route group, so refused event
  pages answer with HTTP 404 instead of 200.
- `npm run build` no longer fails when Supabase settings are absent (as in CI): pages behind
  sign-in are marked dynamic, so the build never tries to prerender them.

### Changed

- Demo sign-in without a database no longer shows "No database connected"; the `no-database`
  result was removed from the access check, authorization and the event list (D-041). The demo
  banner says when sample data is on.
- The schema covers only the B0-08 tables. The earlier 20-table draft and its draft migration
  `20261009141000_init` were replaced; other tables are added by their own batch tasks (D-008).
- The Supabase user mirror is now `User` / `users` instead of `Profile` / `profiles` (D-009).
- Dependencies in `package.json` are pinned to the exact versions already in `package-lock.json`.
  No installed version changed.
- ESLint import-boundary and determinism rules now target the real module paths under
  `src/modules/events/`, cover the `checkin`, `volunteers` and `timeline` contexts, block relative
  imports into sibling contexts, and apply a baseline rule to any new module folder.
- Global focus style keeps a transparent outline so focus stays visible in Windows High Contrast
  (forced-colors) mode.
- Docs in `docs/` renamed to upper case to match PROJECT_RULES (for example `docs/ARCHITECTURE.md`).
- `npm test` excludes `*.db.test.ts` files.

### Added

- feat(B5-F01): budget categories: add, edit and remove, with an allocation (D-084).
- feat(B5-F02): budget items: add, view, edit, move and remove, under a category (D-085).
- feat(B5-F07): budget summary: the event's allocated, estimated, committed and paid totals (D-086, D-087).
- feat(B5-F08): remaining budget and Within or Over budget status, per category and for the event (D-088).
- docs(D-084..D-089): budget decisions recorded in DECISIONS.md.
- feat(B5-F09): over-budget warning with the reasons, for the event and each category (D-090).
- test(B5-F10): budget event isolation, in query tests and a database test (D-091).
- test(B5-F11): budget authorization: action tests and a caller-by-operation database matrix (D-092, proposed).
- test(B5-F12): budget validation boundaries and database constraint tests (D-092, proposed).
- feat(audit): budget_category.* and budget_item.* actions and Activity lines.
- feat(db): budget_categories, budget_items and events.lastBudgetItemNumber (migration
  20261015090000_budget).
- feat(kernel): src/shared/kernel/money.ts, peso amounts that may be zero.

### Notes

- Decisions recorded for tables that later tasks add: composite `(eventId, id)` foreign keys between
  event-owned rows (D-002), supplier records as the single source of money (D-003), and deleting an
  event purges its audit log (D-004).
- The migration was tested on a clean local PostgreSQL 16. It has not been applied to Supabase yet.
- TypeScript is 5.9.3. An earlier entry here said 6.0.3; that was wrong.
- No spreadsheet library is installed yet. The npm `xlsx` package is outdated and has known
  vulnerabilities, so `read-excel-file` is the proposed replacement. Adding it needs approval
  (PROJECT_RULES section 15).
- Prisma is 7.10.0.