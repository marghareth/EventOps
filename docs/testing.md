<!-- docs/TESTING.md -->

# Testing

How EventOps is tested, how to run each layer, and what each one proves. Contributing rules are in
[CONTRIBUTING.md](../CONTRIBUTING.md#tests).

## Layers

| Layer                | Command                      | Where                     | In CI | Needs               |
| -------------------- | ---------------------------- | ------------------------- | ----- | ------------------- |
| Unit and component   | `npm test`                   | `src/**/*.test.ts(x)`     | Yes   | Nothing             |
| Database integration | `npm run test:db`            | `src/**/*.db.test.ts`     | Yes   | `TEST_DATABASE_URL` |
| Browser (basic)      | `npm run test:e2e`           | `e2e/*.spec.ts`           | No    | Nothing             |
| Browser lifecycle    | `npm run test:e2e:lifecycle` | `e2e/lifecycle/*.spec.ts` | No    | `E2E_DATABASE_URL`  |

- **Unit and component tests** cover rules, validation, components and pages with their
  dependencies mocked.
- **Database tests** run the real server code against PostgreSQL: constraints, triggers,
  isolation between events, roles, the audit log, and the end-to-end security and lifecycle tests.
  Only "who is signed in" is mocked, because there is no real Supabase account in tests.
- **Browser tests** drive the real app in Chromium.

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