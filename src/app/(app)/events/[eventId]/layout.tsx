// src/app/(app)/events/[eventId]/layout.tsx
// Event workspace (B1-04, D-027). Loads the event on the server for members only; unknown events,
// other users' events and malformed IDs all show the not-found page. Each page below must still
// call requireEventAccess itself before reading event data (see modules/events/access.ts). Once access
// is confirmed it tells the app shell which event this is (B1-13, D-038).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConfirmEvent } from "@/components/layout/EventContext";
import { EventHeader, requireEventAccess } from "@/modules/events/public";
import { eventNameForTitle } from "./event-title";

type Params = Promise<{ eventId: string }>;

/**
 * Browser tab titles name the event (B1-13, D-038): "Settings · Santos wedding · EventOps". The
 * template applies to the section pages below; the overview page sets its own title (a layout's
 * template does not apply to the page in its own folder).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const name = await eventNameForTitle((await params).eventId);
  return name
    ? { title: { template: `%s · ${name} · EventOps`, default: `${name} · EventOps` } }
    : {};
}

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { eventId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);

  return (
    <>
      <ConfirmEvent event={{ id: event.id, name: event.name, reference: event.reference }} />
      <EventHeader event={event} />
      {children}
    </>
  );
}