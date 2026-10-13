// src/app/(app)/events/[eventId]/import/page.tsx
// CSV import (B2-14 to B2-18, D-052): upload, map columns, preview, confirm, result. Checks access
// itself (D-027). Owners and Coordinators get the import steps (import.run, D-035); Viewers get
// "You don't have access", even when they type the URL. Every step's server action authorizes
// again and re-checks the file, so the page is never the security check.
import type { Metadata } from "next";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { ImportWizard, importStepAction } from "@/modules/events/attendees/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({ params }: { params: Promise<{ eventId: string }> }) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const listHref = `/events/${event.id}/attendees`;

  if (!can(event.role, "import.run")) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to attendees" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-h2 font-extrabold">Import attendees</h1>
      <p className="mt-2 text-ink-2">
        Add guests from a CSV file. You&apos;ll match the columns and check every row first.
      </p>
      <div className="mt-6">
        <ImportWizard action={importStepAction.bind(null, event.id)} listHref={listHref} />
      </div>
    </div>
  );
}