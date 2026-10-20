// src/app/(app)/events/[eventId]/impact/page.tsx
// Impact Detection (B7-F01 to B7-F18; D-101 to D-104). "Change one thing, see everything it
// affects." Every member can try a proposed expected attendance and read the result and the history
// (event.view). Owners and Coordinators also edit the assumptions (impact.assumptions) and save an
// analysis to the history (impact.record). Nothing here changes the event. Checks access itself
// (D-027); the read authorizes again, and every action checks once more.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import {
  AssumptionsForm,
  AssumptionsSummary,
  IMPACT_NOTICES,
  ImpactHistory,
  ImpactList,
  ImpactNotice,
  ImpactSimulator,
  ImpactSummary,
  SaveAnalysisButton,
  getImpactWorkspace,
} from "@/modules/events/impact/public";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Impact" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const IMPACT_REFERENCE = /^IMP-\d{4,}$/;

export default async function ImpactPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const query = await searchParams;
  const rawTo = first(query.to);
  const workspace = await getImpactWorkspace(event.id, rawTo);

  if (!workspace.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        {workspace.reason === "unavailable" ? (
          <ErrorState
            headingLevel={1}
            title="Couldn't analyze this event"
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

  const { proposal, assumptions, categories, history, canEditAssumptions, canRecord } = workspace;
  const basePath = `/events/${event.id}/impact`;
  const kind = IMPACT_NOTICES.find((k) => k === first(query.notice));
  const ref = first(query.ref);
  const result = proposal.status === "analyzed" ? proposal.result : null;
  const shownValue = proposal.status === "invalid" ? proposal.raw : (rawTo ?? "");

  return (
    <div className="flex flex-col gap-8">
      {kind ? (
        <ImpactNotice kind={kind} reference={ref && IMPACT_REFERENCE.test(ref) ? ref : undefined} />
      ) : null}

      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-extrabold">Impact</h1>
        <p className="max-w-prose text-ink-2">
          Try a different expected attendance and see what it would affect: seating, catering, the
          budget, accessibility and tasks. Results are worked out by fixed rules from your records
          and assumptions, never by AI, and nothing about the event changes.
        </p>
      </div>

      <section aria-labelledby="impact-try" className="flex flex-col gap-4">
        <h2 id="impact-try" className="text-h3 font-bold">
          Try a change
        </h2>
        <ImpactSimulator
          action={basePath}
          current={workspace.event.expectedAttendees}
          value={shownValue}
          error={proposal.status === "invalid" ? proposal.message : undefined}
        />
      </section>

      {result ? (
        <section aria-labelledby="impact-results" className="flex flex-col gap-4">
          <h2 id="impact-results" className="text-h3 font-bold">
            Results
          </h2>
          <ImpactSummary result={result} eventId={event.id} />
          {result.items.length > 0 ? (
            <>
              <ImpactList items={result.items} eventId={event.id} />
              {canRecord ? (
                <SaveAnalysisButton
                  eventId={event.id}
                  from={result.change.from}
                  to={result.change.to}
                  version={assumptions.version}
                />
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section id="assumptions" aria-labelledby="impact-assumptions" className="flex flex-col gap-4">
        <h2 id="impact-assumptions" className="text-h3 font-bold">
          Assumptions
        </h2>
        <p className="max-w-prose text-sm text-ink-2">
          Estimates use these values. None is set by default: a rule that needs a missing value says
          so instead of guessing.
        </p>
        {canEditAssumptions ? (
          <AssumptionsForm
            eventId={event.id}
            current={assumptions}
            categories={categories}
            proposal={result && !result.noChange ? result.change.to : null}
          />
        ) : (
          <AssumptionsSummary
            cateringCostPerHead={assumptions.cateringCostPerHead}
            accessibleSeatsPer100={assumptions.accessibleSeatsPer100}
            cateringCategoryName={assumptions.cateringCategoryName}
          />
        )}
      </section>

      <section aria-labelledby="impact-history" className="flex flex-col gap-4">
        <h2 id="impact-history" className="text-h3 font-bold">
          Saved analyses
        </h2>
        {history.length === 0 ? (
          <div className="rounded-xl bg-white shadow-xs">
            <EmptyState
              headingLevel={3}
              title="No saved analyses yet"
              description={
                canRecord
                  ? "Try a change above, then choose Save to history to keep the result."
                  : "Owners and Coordinators can save analyses here."
              }
            />
          </div>
        ) : (
          <ImpactHistory entries={history} eventId={event.id} />
        )}
        {history.length > 0 ? (
          <p className="text-sm text-ink-2">
            Showing the latest {history.length}. Saved analyses can&apos;t be edited. See{" "}
            <Link href={`/events/${event.id}/activity`} className="text-blue underline underline-offset-2">
              Activity
            </Link>{" "}
            for who saved what.
          </p>
        ) : null}
      </section>
    </div>
  );
}