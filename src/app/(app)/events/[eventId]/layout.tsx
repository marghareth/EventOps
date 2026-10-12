// src/app/(app)/events/[eventId]/layout.tsx
// Event context placeholder (B0-10, D-018). Rejects malformed event IDs and renders the section.
// It deliberately loads no event data: the membership and role check (PROJECT_RULES section 7)
// and the event name arrive with the event-workspace task, which replaces this placeholder.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";

const eventIdSchema = z.uuid();

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!eventIdSchema.safeParse(eventId).success) notFound();
  return <>{children}</>;
}