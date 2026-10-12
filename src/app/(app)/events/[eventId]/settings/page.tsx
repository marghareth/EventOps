// src/app/(app)/events/[eventId]/settings/page.tsx
// Event settings (B1-05): edit the event's details. Checks access itself (D-027). Owners and
// Coordinators get the form (D-031); Viewers see the details read-only. The action checks again.
import type { Metadata } from "next";
import { Banner } from "@/components/shared/Banner";
import {
  EditEventForm,
  EventDetailsCard,
  can,
  requireEventAccess,
  toEventFormValues,
  updateEventAction,
} from "@/modules/events/public";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { access } = await requireEventAccess(eventId);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Settings</h1>
      {access.kind === "no-database" ? (
        <Banner severity="info" title="No database connected">
          Demo sign-in has no event to edit. Set DATABASE_URL in .env.local.
        </Banner>
      ) : can(access.event.role, "event.edit") ? (
        <section
          aria-labelledby="edit-event-heading"
          className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
        >
          <h2 id="edit-event-heading" className="text-h4 font-bold">
            Event details
          </h2>
          <p className="mt-1 mb-6 text-sm text-ink-2">
            Changes show across the workspace as soon as you save. The status and event number
            don&apos;t change here.
          </p>
          <EditEventForm
            action={updateEventAction.bind(null, access.event.id)}
            saved={toEventFormValues(access.event)}
            version={access.event.updatedAt.toISOString()}
          />
        </section>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            You can view these details. Owners and Coordinators can edit them.
          </p>
          <EventDetailsCard event={access.event} />
        </>
      )}
    </div>
  );
}