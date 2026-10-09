<!-- CHANGELOG.md -->

# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- npm scripts for dev, build, start, lint, typecheck, format, format:check, test, test:e2e and knip,
  plus the `check` script (lint, typecheck, knip, test).
- Prisma npm scripts: `db:generate`, `db:validate`, `db:format`, `db:migrate`, `db:deploy` and
  `db:status`.
- Initial Prisma schema: events, members, attendees, accessibility, suppliers, budget, tasks,
  volunteers, timeline, impact, import sessions and audit log. Money uses `Decimal`.
- First migration, `prisma/migrations/20261009141000_init`, generated from the schema. It adds two
  hand-written CHECK constraints: an accessibility requirement belongs to exactly one attendee or
  one volunteer, and a budget line linked to a supplier stores no money amounts of its own.
- Composite foreign keys on `(eventId, id)` for every link between two event-owned rows, so the
  database rejects links that cross events (D-002).
- `EventReferenceCounter` table, one row per year, for collision-free `EVT-<year>-<number>` IDs
  (D-005).
- `docs/DECISIONS.md`, `BUILD_BACKLOG.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `docs/DATA_MODEL.md` and a populated `.env.example`.

### Changed

- Dependencies in `package.json` are pinned to the exact versions already in `package-lock.json`.
  No installed version changed.
- Supplier money has one source of truth (D-003): paid = sum of `SupplierPayment` rows, committed =
  the accepted quote. `Supplier.paymentStatus` and the `PaymentStatus` enum were removed; the status
  is computed. Budget lines linked to a supplier no longer store committed or paid amounts, and a
  supplier links to at most one budget line.
- Optional links (task assignee, task supplier, budget-line supplier, volunteer role) use
  `onDelete: NoAction` instead of `SetNull`. Delete use cases clear the link in the same transaction
  (D-002).
- ESLint import-boundary and determinism rules now target the real module paths under
  `src/modules/events/`, cover the `checkin`, `volunteers` and `timeline` contexts, block relative
  imports into sibling contexts, and apply a baseline rule to any new module folder.
- Global focus style keeps a transparent outline so focus stays visible in Windows High Contrast
  (forced-colors) mode.
- Docs in `docs/` renamed to upper case to match PROJECT_RULES (for example `docs/ARCHITECTURE.md`).

### Notes

- TypeScript is 5.9.3. An earlier entry here said 6.0.3; that was wrong.
- No spreadsheet library is installed yet. The npm `xlsx` package is outdated and has known
  vulnerabilities, so `read-excel-file` is the proposed replacement. Adding it needs approval
  (PROJECT_RULES section 15).
- Prisma is 7.10.0.
- Deleting an event purges its audit log with the rest of its data (D-004).