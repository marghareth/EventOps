<!-- CHANGELOG.md -->

# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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