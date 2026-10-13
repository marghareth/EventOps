<!-- CHANGELOG.md -->

# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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