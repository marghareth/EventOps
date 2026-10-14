// src/app/(app)/events/[eventId]/accessibility/page.tsx
// The event's Accessibility page (B3-05, B3-06, B3-10; D-061, D-065). Answers "Are our guests'
// accessibility needs covered, and if not, what is missing?", in this order: the readiness status,
// what's missing (gaps, with links to fix them), what guests need, and what the event provides
// (resources, editable by Owners and Coordinators). Every member can read it. Checks access itself
// (D-027); the read authorizes again and the readiness is calculated by the domain on every request,
// never stored. A failed read shows an error state; loading.tsx covers loading.
import type { Metadata } from "next";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  GapList,
  NeedsOverview,
  RESOURCE_NOTICES,
  ReadinessSummary,
  ResourceList,
  ResourceNotice,
  getAccessibilityOverview,
  isResourceType,
} from "@/modules/events/accessibility/public";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Accessibility" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Only a known notice and a known resource type are read from the address. */
function noticeFrom(search: Record<string, string | string[] | undefined>) {
  const kind = RESOURCE_NOTICES.find((k) => k === search.resource);
  return kind && isResourceType(search.type) ? { kind, type: search.type } : null;
}

async function loadOverview(eventId: string) {
  try {
    return await getAccessibilityOverview(eventId);
  } catch {
    return null;
  }
}

export default async function AccessibilityPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const notice = noticeFrom((await searchParams) ?? {});
  const result = await loadOverview(event.id);
  const basePath = `/events/${event.id}/accessibility`;
  const attendeesPath = `/events/${event.id}/attendees`;

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">Accessibility</h1>
      <p className="mt-2 text-ink-2">
        Are our guests&apos; accessibility needs covered, and if not, what is missing?
      </p>
      {notice ? (
        <div className="mt-4">
          <ResourceNotice kind={notice.kind} type={notice.type} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-6">
        {result?.ok ? (
          <>
            <ReadinessSummary status={result.readiness.status} counts={result.readiness.counts} />
            <GapList
              gaps={result.readiness.gaps}
              status={result.readiness.status}
              basePath={basePath}
              attendeesPath={attendeesPath}
              canManage={result.canManage}
            />
            <NeedsOverview coverage={result.readiness.coverage} attendeesPath={attendeesPath} />
            <ResourceList
              basePath={basePath}
              resources={result.resources}
              canManage={result.canManage}
            />
          </>
        ) : (
          <div className="rounded-xl bg-white shadow-xs">
            <ErrorState
              title="We couldn't load accessibility"
              description="Reload the page to try again."
              headingLevel={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}