<!-- CONTRIBUTING.md -->

# Contributing to EventOps

Thanks for helping. EventOps is a hackathon project with a frozen scope and a human technical lead
who decides what gets built. Please read this page and PROJECT_RULES.md (provided by the technical
lead) before you change anything.

## Before you start

- **Scope is frozen.** Only items in [BUILD_BACKLOG.md](BUILD_BACKLOG.md) are authorized, and only
  for the tier that is currently open. Ideas go to [ROADMAP.md](ROADMAP.md) through a feature
  request.
- **Decisions live in [docs/DECISIONS.md](docs/DECISIONS.md).** If your change needs a new
  decision (a schema change, a deletion rule, a new dependency, a permission question), ask the
  technical lead first.
- **AI assistants** follow the same rules: propose a short plan, wait for approval, implement only
  the approved task, then report what was actually run and verified.

## Set up

Requirements: Node.js 20.9 or later (CI uses Node 22), npm, and a Supabase project.

```bash
npm ci                      # also runs `prisma generate`
cp .env.example .env.local  # then fill in real values
npm run db:deploy           # apply migrations to the database in DIRECT_URL
npm run dev                 # http://localhost:3000
```

Never commit `.env.local` or any real secret.

## Scripts

| Script                | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Start the dev server                                   |
| `npm run build`       | Production build                                       |
| `npm run lint`        | ESLint, including the module boundary rules            |
| `npm run typecheck`   | TypeScript, no emit                                    |
| `npm run knip`        | Find unused files, exports and dependencies            |
| `npm test`            | Unit and component tests (Vitest)                      |
| `npm run test:db`     | Database integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e`    | End-to-end tests (Playwright)                          |
| `npm run check`       | lint, typecheck, knip and test together                |
| `npm run format`      | Format with Prettier                                   |
| `npm run db:generate` | Generate the Prisma client                             |
| `npm run db:validate` | Validate `prisma/schema.prisma`                        |
| `npm run db:format`   | Format `prisma/schema.prisma`                          |
| `npm run db:migrate`  | Create and apply a migration in development            |
| `npm run db:deploy`   | Apply pending migrations (CI and production)           |
| `npm run db:status`   | Show which migrations are applied                      |

## Code structure

Domain code lives in `src/modules/events/<context>/`. Reach another context only through its
`public.ts` (`@/modules/events/<context>/public`); inside a context, use relative imports. Business
rules in `domain/` are pure: no database, no React, no `Date.now()`, no `Math.random()`, no network.
ESLint enforces all of this. See D-001 in [docs/DECISIONS.md](docs/DECISIONS.md).

Authorization always runs on the server. Hiding a button is not authorization.

## Database changes

- Change `prisma/schema.prisma`, then run `npm run db:migrate` to create a migration. Review the
  generated SQL before committing it.
- Every schema change must be justified by the task. Record deletion behaviour and other data
  decisions in `docs/DECISIONS.md` and `docs/DATA_MODEL.md`.
- Links between event-owned rows use composite foreign keys on `(eventId, id)` (D-002).
- CHECK constraints are added by hand to the migration SQL and listed in `docs/DATA_MODEL.md`.

## Tests

Add or update tests for every behaviour you change. Cover the happy path, validation failures,
authorization failures (including another event's IDs) and edge cases. Never delete or weaken a
test to make the suite pass. If a check cannot run, say so in your pull request.

### Database tests

Files named `*.db.test.ts` run against a real PostgreSQL database with `npm run test:db`, never with
`npm test`. Use a separate, empty database whose name contains `test`; the suite refuses to run
otherwise. Never point it at the Supabase project the app uses.

```bash
createdb eventops_test   # or create an empty database any other way
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventops_test
DIRECT_URL=$TEST_DATABASE_URL npm run db:deploy   # apply every migration to the test database
npm run test:db
```

`TEST_DATABASE_URL` can also live in `.env.local`. CI runs the same steps against a fresh
PostgreSQL 17 on every push and pull request.

## Branches and commits

Branch names: `feat/B1-02-create-event`, `fix/B1-09-event-authorization`, `test/B2-30-attendance-count`.

Commit messages follow `<type>(<scope>): <description>` and are checked by commitlint:

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- The description is lower case, and the whole header is at most 72 characters.
- Use the task ID as the scope, for example `feat(B1-02): add event creation`.

Keep commits small and focused. Do not commit generated files, secrets or unrelated changes.

## Pull request checklist

- [ ] The change matches the approved task, and nothing outside it changed.
- [ ] Server-side authorization and validation are in place where data is read or written.
- [ ] Loading, empty, error and success states are handled; keyboard and screen-reader use work.
- [ ] Tests were added or updated, and `npm run check` and `npm run build` pass locally.
- [ ] Docs, `CHANGELOG.md` and `BUILD_BACKLOG.md` are updated.
- [ ] Anything not verified is stated in the description.

## Reporting problems

- Bugs and ideas: open a GitHub issue using the templates.
- Security issues: do not open a public issue. Follow [SECURITY.md](SECURITY.md).

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and that your
contributions are licensed under the [MIT License](LICENSE).