// src/app/(app)/events/[eventId]/accessibility/page.tsx
// The event's Accessibility page (B3-05, D-061): the six accessibility resources with their status,
// seat count and note, for every member. Owners and Coordinators can set up, edit and remove them.
// Checks access itself (D-027); the read authorizes again. A failed read shows an error state; the
// event's loading screen covers loading. Readiness (required vs available) is a later Batch 3 task.
import type { Metadata } from "next";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  RESOURCE_NOTICES,
  ResourceList,
  ResourceNotice,
  getEventResources,
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

async function loadResources(eventId: string) {
  try {
    return await getEventResources(eventId);
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
  const result = await loadResources(event.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">Accessibility</h1>
      <p className="mt-2 text-ink-2">
        What this event can provide. Guests&apos; individual needs are on each attendee&apos;s page.
      </p>
      {notice ? (
        <div className="mt-4">
          <ResourceNotice kind={notice.kind} type={notice.type} />
        </div>
      ) : null}
      <div className="mt-6">
        {result?.ok ? (
          <ResourceList
            basePath={`/events/${event.id}/accessibility`}
            resources={result.resources}
            canManage={result.canManage}
          />
        ) : (
          <div className="rounded-xl bg-white shadow-xs">
            <ErrorState
              title="We couldn't load the accessibility resources"
              description="Reload the page to try again."
              headingLevel={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}