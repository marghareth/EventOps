// src/app/(app)/events/[eventId]/import/page.tsx
// Import (B2-14 to B2-18, D-052; B9, D-109): choose attendees or suppliers and a CSV or Excel file,
// match the columns, preview, confirm, result. Checks access itself (D-027). Owners and
// Coordinators get the import steps (import.run, D-035); Viewers get "You don't have access", even
// when they type the URL. Every step's server action authorizes again and re-checks the file, so
// the page is never the security check. `?type=suppliers` preselects suppliers.
import type { Metadata } from "next";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { CSV_LIMITS } from "@/modules/events/attendees/public";
import { ImportWizard, importStepAction, isImportType } from "@/modules/events/import/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const type = (await searchParams)?.type;
  const initialType = isImportType(type) ? type : "attendees";
  const listHrefs = {
    attendees: `/events/${event.id}/attendees`,
    suppliers: `/events/${event.id}/suppliers`,
  };

  if (!can(event.role, "import.run")) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState
          kind="forbidden"
          href={listHrefs[initialType]}
          linkLabel={initialType === "attendees" ? "Back to attendees" : "Back to suppliers"}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-h2 font-extrabold">Import attendees or suppliers</h1>
      <p className="mt-2 text-ink-2">
        Add guests or suppliers from a spreadsheet. You&apos;ll match the columns and check every
        row first.
      </p>
      <div className="mt-6">
        <ImportWizard
          action={importStepAction.bind(null, event.id)}
          listHrefs={listHrefs}
          initialType={initialType}
          maxRows={CSV_LIMITS.rows}
        />
      </div>
    </div>
  );
}