<!-- docs/ARCHITECTURE.md -->

# Architecture

EventOps is a modular monolith: one Next.js application, with each domain area in its own context
under `src/modules/events/` (PROJECT_RULES section 5, D-001).

**Status.** So far this page describes only the accessibility context (B3-18). The other contexts
and the system overview are still to be written; until then, see [DATA_MODEL.md](DATA_MODEL.md),
[SECURITY.md](SECURITY.md) and [DECISIONS.md](DECISIONS.md). The module layout follows D-001, which
is still marked Proposed.

## Accessibility context (Batch 3)

`src/modules/events/accessibility/` keeps attendees' accessibility needs and the event's
accessibility resources, and works out whether the event is ready for those guests. It is a
layered context (D-001). Each layer may use only the layers below it in this table.

| Layer          | Folder                     | What it holds                                                                                                                                                                                                            | May not                                                                                                |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Domain         | `domain/`                  | Canonical types and statuses (`requirement-type.ts`, `resource.ts`); change rules (`requirement.ts`); readiness rules: coverage (`readiness.ts`), status (`readiness-status.ts`), gaps (`gaps.ts`), alerts (`alerts.ts`) | Touch the database, React or Next.js; read the clock, randomness or the network (ESLint enforces each) |
| Application    | `application/`             | Use cases (add, update and remove a requirement; save and remove a resource; get readiness) and the `AccessibilityRepository` port (`ports.ts`)                                                                          | Check permissions (callers do), touch Prisma                                                           |
| Infrastructure | `infrastructure/`          | The repository on PostgreSQL through Prisma, and on the dev-only in-memory sample store (D-041)                                                                                                                          | Decide business rules                                                                                  |
| Server entry   | `actions.ts`, `queries.ts` | Server actions and reads: authorize (`authorizeEvent`), validate (`schema.ts`, Zod), call a use case                                                                                                                     | Be skipped: every page reaches data only through them                                                  |
| UI             | `ui/`                      | Forms, lists, readiness, gap and alert views. Server components unless they need state                                                                                                                                   | Calculate anything: they show what the server sends                                                    |

`composition.ts` picks the repository (Prisma, or the sample store in dev demo mode), and
`public.ts` is the only file other contexts and pages may import.

### How a change flows

1. A page form calls a server action, for example `saveResourceAction`.
2. The action authorizes on the server (`authorizeEvent(eventId, "accessibility.manage")`) and
   returns before any storage is opened if the caller is refused.
3. The action validates the form with Zod (`schema.ts`), with the canonical lists from `domain/`.
4. A use case compares the old and new values (a save with no changes writes nothing) and calls the
   repository.
5. The repository writes in one transaction. The write re-checks the role in the same statement
   (`rolesAllowed`) and refuses a stale version (D-032). It adds the audit entry, without notes
   (D-037, D-058).
6. The action redirects to the page with a notice that names only known values.

### How readiness is read

```
getAccessibilityOverview / getAccessibilityAlerts   (queries.ts: authorize with event.view)
  → getReadiness                                    (application: load requirements and resources)
      → assessCoverage → readinessStatus → detectGaps → deriveAlerts   (domain: pure)
  → pages render the result                         (ui: no calculation)
```

Readiness, gaps and alerts are calculated on every request from the stored needs and resources. They
are never stored, so they can't go stale or be set by hand, and the browser never sends them
(D-062 to D-066). Notes are never loaded for this calculation.

### Where it touches other contexts

| Other context         | How                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`              | `authorizeEvent`, `can` and `rolesAllowed` from `@/modules/events/public`; the dev sample store                                                                      |
| `attendees`           | A requirement belongs to an attendee of the same event (composite foreign key, D-002). Attendee pages embed the Accessibility section and alerts through `public.ts` |
| `audit`               | Six registered actions, written in the same transaction as the change; the Activity feed reads them                                                                  |
| Event Overview page   | Shows the event-level alert from `getAccessibilityAlerts`                                                                                                            |
| Batch 8 (not started) | The Critical Alert View can reuse `deriveAlerts` instead of building a second alert mechanism (D-066)                                                                |