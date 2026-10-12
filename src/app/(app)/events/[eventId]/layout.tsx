// src/app/(app)/events/[eventId]/layout.tsx
// Event workspace (B1-04, D-027). Loads the event on the server for members only; unknown events,
// other users' events and malformed IDs all show the not-found page. Each page below must still
// call requireEventAccess itself before reading event data (see modules/events/access.ts).
import type { ReactNode } from "react";
import { Banner } from "@/components/shared/Banner";
import { EventHeader, requireEventAccess } from "@/modules/events/public";

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { access } = await requireEventAccess(eventId);

  return (
    <>
      {access.kind === "ok" ? (
        <EventHeader event={access.event} />
      ) : (
        <Banner severity="info" title="No database connected" className="mb-6">
          Demo sign-in is showing the workspace layout without event data. Set DATABASE_URL in
          .env.local to open real events.
        </Banner>
      )}
      {children}
    </>
  );
}