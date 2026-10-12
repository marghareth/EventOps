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

| Item                                                                                                                                      | Batch | Status                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| **B0-09 Authentication Foundation**: Supabase Auth, sessions, protected routes, server-side checks, minimal pages                         | B0    | In review: unit, component, database and browser tests pass; real sign-in needs the manual check in docs/SECURITY.md |
| **B0-10 Application Shell**: root and authenticated layouts, sidebar, header, user menu, responsive navigation, event context placeholder | B0    | In review: 209 unit and component tests pass (48 more); checked in a browser at phone and desktop widths             |
| **B1-01 Event Data Model**: event model, constraints, timestamps, indexes, ownership through membership                                   | B1    | In review: 42 database tests pass on a clean local PostgreSQL 16; migration not yet applied to Supabase              |
| Supabase Auth: sign up, log in, log out (user-facing, Tier 1)                                                                             |       | In progress: working foundation from B0-09; polish pending                                                           |
| Event workspace: create, edit, delete                                                                                                     |       | Not started                                                                                                          |
| Event members with Owner, Coordinator, Viewer, enforced server-side                                                                       |       | Not started                                                                                                          |
| Zod validation on every input                                                                                                             |       | In progress: settings validation done and tested                                                                     |
| Audit log: who, what, when, old → new value                                                                                               |       | Not started (table added by its own task, D-008)                                                                     |
| **B0-08 Database Foundation**: PostgreSQL + Prisma, users/events/members schema, constraints, indexes, init migration, Prisma client      | B0    | In review: 22 database tests pass on a clean local PostgreSQL 16; CI job added; not yet applied to Supabase          |

### People

| Item                                                             | Batch   | Status                                                         |
| ---------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| Attendee CRUD: RSVP, category, contact, plus-ones, dietary needs |         | Not started                                                    |
| Search, filter, sort guest list                                  |         | Not started                                                    |
| CSV import with column mapping and preview                       |         | Not started                                                    |
| CSV export                                                       |         | Not started                                                    |
| Accessibility requirements per attendee                          |         | Not started                                                    |
| **Live Attendance Count** (approved Tier 2 → Tier 1 addition)    | Batch 2 | Blocked: plus-one counting not defined (DECISIONS open item 4) |

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