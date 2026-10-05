# Changelog

All notable changes to EventOps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project dependencies pinned to exact versions, with npm scripts for dev, build, lint, typecheck, knip, test, e2e and Prisma tasks. Includes the `check` script.
- Initial Prisma schema: events, members, attendees, accessibility, suppliers, budget, tasks, volunteers, timeline, impact, import sessions and audit log. Money uses `Decimal`.

### Notes
- The schema is not yet connected to a database. No migration has been created.
- `xlsx` was replaced by `read-excel-file` because the npm `xlsx` package is outdated and has known vulnerabilities.
- Prisma is pinned to 7.10.0 because the npm `latest` tag points to an 8.0 release candidate.
- TypeScript is pinned to 6.0.3 because `typescript-eslint` does not yet support 7.x.