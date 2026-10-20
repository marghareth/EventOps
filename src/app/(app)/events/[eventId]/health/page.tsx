// src/app/(app)/events/[eventId]/health/page.tsx
// Event Health (B8-F01 to B8-F20; D-105 to D-107): the status and score, the issues with their
// explanations, and every check grouped by area. "?show=critical" is the Critical Alert View
// (B8-F14, B8-F15): only Critical issues, each saying why and linking to the section that fixes it.
// Every member can read it (event.view). Nothing is stored, sent or dismissed. Checks access itself
// (D-027); the read authorizes again.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { cn } from "@/lib/utils";
import {
  HealthCheckList,
  HealthIssueList,
  HealthStatusPanel,
  getEventHealth,
} from "@/modules/events/health/public";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Health" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const tab = (current: boolean) =>
  cn(
    "inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold",
    current ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-stone",
  );

export default async function HealthPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const criticalOnly = first((await searchParams).show) === "critical";
  const result = await getEventHealth(event.id, { withActivity: false });
  const basePath = `/events/${event.id}/health`;

  if (!result.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        {result.reason === "unavailable" ? (
          <ErrorState
            headingLevel={1}
            title="Couldn't check the event's health"
            description="We couldn't read all of this event's data. Nothing was changed. Try again in a moment."
          />
        ) : (
          <UnauthorizedState
            kind="forbidden"
            href={`/events/${event.id}`}
            linkLabel="Back to the overview"
          />
        )}
      </div>
    );
  }

  const { health } = result;
  const critical = health.issues.filter((issue) => issue.outcome === "CRITICAL");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-extrabold">
          {criticalOnly ? "Critical issues" : "Event health"}
        </h1>
        <p className="max-w-prose text-ink-2">
          {criticalOnly
            ? "The problems that need fixing first, worked out now from your records. Each one says why it is critical and where to fix it."
            : "Thirteen checks across attendees, suppliers, the budget, accessibility and tasks, worked out now from your records by fixed rules, never by AI."}
        </p>
      </div>

      <HealthStatusPanel report={health} />

      <nav aria-label="Health view" className="flex flex-wrap gap-2">
        <Link
          href={basePath}
          aria-current={criticalOnly ? undefined : "page"}
          className={tab(!criticalOnly)}
        >
          All checks
        </Link>
        <Link
          href={`${basePath}?show=critical`}
          aria-current={criticalOnly ? "page" : undefined}
          className={tab(criticalOnly)}
        >
          Critical only ({critical.length})
        </Link>
      </nav>

      {criticalOnly ? (
        <section aria-labelledby="health-critical" className="flex flex-col gap-4">
          <h2 id="health-critical" className="sr-only">
            Critical issues
          </h2>
          {critical.length === 0 ? (
            <div className="rounded-xl bg-white shadow-xs">
              <EmptyState
                headingLevel={3}
                title="No critical issues"
                description={
                  health.counts.NEEDS_ATTENTION > 0
                    ? `Nothing is Critical right now. ${health.counts.NEEDS_ATTENTION} ${health.counts.NEEDS_ATTENTION === 1 ? "check needs" : "checks need"} attention.`
                    : "Nothing is Critical right now."
                }
              />
            </div>
          ) : (
            <HealthIssueList issues={critical} eventId={event.id} label="Critical issues" />
          )}
        </section>
      ) : (
        <>
          <section aria-labelledby="health-issues" className="flex flex-col gap-4">
            <h2 id="health-issues" className="text-h3 font-bold">
              Issues
            </h2>
            {health.issues.length === 0 ? (
              <p role="status" className="rounded-xl bg-white p-5 text-sm text-ink-2 shadow-xs">
                {health.status === null
                  ? "Nothing to check yet. Add guests, suppliers, a budget or tasks."
                  : "No issues: every check that could be made passes."}
              </p>
            ) : (
              <HealthIssueList issues={health.issues} eventId={event.id} label="Health issues" />
            )}
          </section>
          <section aria-labelledby="health-checks" className="flex flex-col gap-4">
            <h2 id="health-checks" className="text-h3 font-bold">
              Every check
            </h2>
            <HealthCheckList checks={health.checks} eventId={event.id} />
          </section>
        </>
      )}
    </div>
  );
}