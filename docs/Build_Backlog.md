<!-- BUILD_BACKLOG.md -->

# Build backlog

**Source.** The tiers below are transcribed from the EventOps Brand Book v1.0, section 06 (Feature
scope), plus the two Tier 2 → Tier 1 additions approved in PROJECT_RULES section 2.2.
`docs/SCOPE.md` is still empty, so the technical lead must confirm this list is the approved
scope. Batch and task IDs (for example `B1-02`) are assigned by the technical lead; only the two
batches PROJECT_RULES names are filled in.

**Scope is frozen.** Do not add, remove or move items without the technical lead's approval
(PROJECT_RULES section 2.1). Anything not listed here belongs in [ROADMAP.md](ROADMAP.md).

**Status values.** Not started · In progress · In review (built and tested, awaiting the technical
lead) · Done (accepted) · Blocked.

_Last updated: 2026-10-09._

## Tier 1: required baseline

### Foundation

| Item                                                                                                                                                                                              | Batch | Status                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B0-09 Authentication Foundation**: Supabase Auth, sessions, protected routes, server-side checks, minimal pages                                                                                 | B0    | In review: unit, component, database and browser tests pass; real sign-in needs the manual check in docs/SECURITY.md                                                   |
| **B0-10 Application Shell**: root and authenticated layouts, sidebar, header, user menu, responsive navigation, event context placeholder                                                         | B0    | In review: 209 unit and component tests pass (48 more); checked in a browser at phone and desktop widths                                                               |
| **B1-01 Event Data Model**: event model, constraints, timestamps, indexes, ownership through membership                                                                                           | B1    | In review: 42 database tests pass on a clean local PostgreSQL 16; migration not yet applied to Supabase                                                                |
| **B1-02 Create Event**: form, validation, transactional save with OWNER membership, redirect, loading, errors, success notice                                                                     | B1    | In review: 292 unit and 47 database tests pass; checked end to end in a browser with demo sign-in and local PostgreSQL                                                 |
| **B1-03 Event List**: member-only list page and GET /api/events, loading, empty, error, responsive                                                                                                | B1    | In review: 318 unit and 53 database tests pass; checked in a browser at phone and desktop widths, with another user's event never shown                                |
| **B1-04 Event Workspace**: member-only workspace, identity header, overview, GET /api/events/<id>, 404 for refused events                                                                         | B1    | In review: 338 unit and 56 database tests pass; browser run confirms 404 for other users', unknown and malformed events                                                |
| **B1-05 Edit Event**: settings page, validated edits by Owner and Coordinator, Viewer read-only, stale saves refused, workspace refreshes                                                         | B1    | In review: 374 unit and 62 database tests pass; checked in a browser. Audit entry added in B1-11                                                                       |
| **B1-06 Delete Event**: Owner-only permanent delete with typed confirmation, cascade (D-004), redirect with notice, 404 afterwards                                                                | B1    | In review: 400 unit and 70 database tests pass; checked in a browser (cancel, partial number, delete, 404 afterwards)                                                  |
| **B1-07 Event Membership**: model, one role per membership, server-side checks on every event page, isolation tests                                                                               | B1    | In review: membership tests pass on PostgreSQL 16; no schema or UI change. Member management is a separate task (D-034)                                                |
| **B1-08 Event Roles**: approved permission matrix (docs/PERMISSIONS.md), server-side role checks, role boundary tests, role shown in the UI                                                       | B1    | In review: matrix test, role boundary tests and settings tests pass; no schema change                                                                                  |
| **B1-09 Server-Side Event Authorization**: one reusable authorization pattern, end-to-end security matrix, cross-event and escalation tests, guard tests                                          | B1    | In review: the end-to-end security test passes on PostgreSQL 16; no schema or UI change                                                                                |
| **B1-10 Event Settings**: settings page with current values, shared form system, validation, role permissions, loading, error, success, mobile                                                    | B1    | In review: delivered by B1-05, B1-06 and B1-08; re-verified in a browser for all three roles at 375, 768 and 1280 px. Status changes are open item 9                   |
| **B1-11 Audit Log Foundation**: audit_logs table, controlled action list, written with each change, append-only, Activity page for Owner and Coordinator                                          | B1    | In review: unit, database and end-to-end tests pass on PostgreSQL 16; migration not yet applied to Supabase                                                            |
| **B1-12 Activity Feed**: activity page from the audit log, authorized, newest first, actor, action, context, time, empty, loading, error, responsive                                              | B1    | In review: delivered by B1-11; re-verified in a browser for every role at 375, 768 and 1280 px. Debt: errors while an event loads replace the app shell (open item 10) |
| **B1-13 Event Navigation & Context**: event named in tabs and top bar, URL-only context, safe IDs, navigation follows access, refresh keeps context, safe not-found                               | B1    | In review: unit and component tests pass; checked in a browser (refresh, sidebar, not-found, 375/768/1280 px)                                                          |
| **B1-14 Event Foundation Integration Tests**: full lifecycle (create → list → open → edit → activity → roles → authorization → delete → gone) at database and browser level, repeatable           | B1    | In review: database lifecycle test passes twice in a row and cleans up; browser lifecycle passes 9/9 twice from a reset database (local only)                          |
| **B1-15 Event Foundation Polish**: loading, empty and error states, form feedback, confirmations, keyboard, screen-reader semantics, mobile layout, visual consistency, no console or lint errors | B1    | In review: every screen checked in a browser for each role at 375/768/1280 px (axe, console, keyboard, states); fixes and remaining items in docs/QUALITY.md           |
| Supabase Auth: sign up, log in, log out (user-facing, Tier 1)                                                                                                                                     |       | In progress: working foundation from B0-09; polish pending                                                                                                             |
| Event workspace: create, edit, delete                                                                                                                                                             |       | Done: create (B1-02), list (B1-03), workspace (B1-04), edit (B1-05) and delete (B1-06), all in review                                                                  |
| Event members with Owner, Coordinator, Viewer, enforced server-side                                                                                                                               |       | In progress: model and server-side enforcement done (B1-07); adding, changing and removing members not started                                                         |
| Zod validation on every input                                                                                                                                                                     |       | In progress: settings validation done and tested                                                                                                                       |
| Audit log: who, what, when, old → new value                                                                                                                                                       |       | In progress: foundation, event actions and Activity page done (B1-11); later modules add their own actions                                                             |
| **B0-08 Database Foundation**: PostgreSQL + Prisma, users/events/members schema, constraints, indexes, init migration, Prisma client                                                              | B0    | In review: 22 database tests pass on a clean local PostgreSQL 16; CI job added; not yet applied to Supabase                                                            |

### People

| Item                                                                                                                                                    | Batch   | Status                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| **B2-01 Attendee Data Model**: attendees table and migration, validation, create/edit/delete server actions with role checks and audit (no screens yet) | B2      | In review: unit and database tests pass, including roles, cross-event isolation, stale saves and numbering |
| **B2-02 Attendee Creation**: Add attendee page (Owner, Coordinator), read-only guest list with "added" confirmation, sample guests                      | B2      | In review: component, page, action and database flow tests pass; checked in a browser at 375/1280 px       |
| **B2-03 Attendee Editing**: edit page from the guest list (Owner, Coordinator), all fields, stale saves refused, saved notice, audit, sample data       | B2      | In review: form, page, action and database flow tests pass; checked in a browser (two tabs, 375/1280 px)   |
| **B2-04 Attendee Deletion**: Remove attendee with confirmation (Owner, Coordinator), permanent, audited, sample data                                    | B2      | In review: dialog, action, page and database flow tests pass; checked in a browser (375/1280 px)           |
| **B2-05 Plus-One Management**: plus-ones as a count 0–10 (D-046), expected headcount on the guest list (confirmed + their plus-ones)                    | B2      | In review: headcount rule, summary, page and database tests pass; checked in a browser (375/1280 px)       |
| **B2-06 Dietary Needs**: one free-text entry (several needs separated by semicolons), shown on the guest list to every member (D-047)                   | B2      | In review: database, read, page and component tests pass; checked in a browser (375/1280 px)               |
| Search, filter, sort guest list                                                                                                                         |         | Not started                                                                                                |
| CSV import with column mapping and preview                                                                                                              |         | Not started                                                                                                |
| CSV export                                                                                                                                              |         | Not started                                                                                                |
| Accessibility requirements per attendee                                                                                                                 |         | Not started                                                                                                |
| **Live Attendance Count** (approved Tier 2 → Tier 1 addition)                                                                                           | Batch 2 | Blocked: plus-one counting not defined (DECISIONS open item 4)                                             |

### Resources and money

| Item                                                                     | Batch | Status      |
| ------------------------------------------------------------------------ | ----- | ----------- |
| Supplier profiles: category, contact, quote, deposit, payments, due date |       | Not started |
| Budget categories: allocation, estimated, committed, paid                |       | Not started |
| Remaining budget and over-budget warnings                                |       | Not started |

### Operations

| Item                                                                  | Batch | Status      |
| --------------------------------------------------------------------- | ----- | ----------- |
| Tasks: assignee, due date, priority, status, related supplier or area |       | Not started |
| Overdue task detection                                                |       | Not started |

### Signature features

| Item                                                        | Batch   | Status      |
| ----------------------------------------------------------- | ------- | ----------- |
| Impact Detection engine (deterministic)                     |         | Not started |
| Accessibility readiness (required vs available)             |         | Not started |
| Event Health dashboard                                      |         | Not started |
| **Critical Alert View** (approved Tier 2 → Tier 1 addition) | Batch 8 | Not started |
| AI spreadsheet import with review step                      |         | Not started |
| Configurable assumptions panel                              |         | Not started |

### Engineering

| Item                                                                                                    | Batch | Status                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| Unit tests: impact engine, accessibility, budget, authorization, import validation                      |       | Not started                                                                                                      |
| GitHub Actions CI: lint → typecheck → knip → test → build                                               |       | In progress: build passes, including without Supabase settings; test and knip still fail on empty scaffold files |
| ESLint, Prettier, commitlint, Prisma migrations                                                         |       | In progress: tooling configured; import-boundary rules verified                                                  |
| Shared UI states: loading, empty, error, success, not found, no access                                  |       | Done: built and tested (51 tests)                                                                                |
| Deployed on Vercel with seeded demo data                                                                |       | Not started                                                                                                      |
| Documentation set (README, docs/, CONTRIBUTING, SECURITY, CHANGELOG, ROADMAP, LICENSE, CODE_OF_CONDUCT) |       | In progress                                                                                                      |
| Mobile-responsive layouts                                                                               |       | Not started                                                                                                      |

## Tier 2: only after Tier 1 is accepted and advancement is authorized

- Event-day dashboard: attendance, outstanding tasks, critical issues, health score
- QR check-in: per-attendee QR, scan, manual fallback, live count
- Volunteer management: profiles, roles, shifts, coverage, check-in
- Event timeline: simple run-of-show
- Expense and payment tracking linked to suppliers
- Impact history: past changes and what they triggered
- Easter egg: Konami-code "Bridezilla mode" and a funny 404 page

## Tier 3: stretch, only when authorized

- PDF quote extraction (text-based PDFs only, reviewed before saving)
- Seating: table assignment with accessible-seat designation
- Transportation: vehicle capacity vs assigned guests, feeding an impact rule
- Supplier arrival tracking for event day
- Reports: event, budget, attendance, volunteer, supplier, accessibility, post-event
- Supplier comparison table
- Event templates (wedding, conference, school event) as impact rule packs

## Open scope questions

See the open items in [docs/DECISIONS.md](docs/DECISIONS.md#open-items-needing-a-decision): QR
check-in scaffolding, transport and volunteer impact rules, Tier 2 scaffolding, and plus-one
counting.