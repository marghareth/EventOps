<!-- CHANGELOG.md -->

# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

- My events: its loading and error files moved into the `(list)` route group, so refused event
  pages answer with HTTP 404 instead of 200.
- `npm run build` no longer fails when Supabase settings are absent (as in CI): pages behind
  sign-in are marked dynamic, so the build never tries to prerender them.

### Changed

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