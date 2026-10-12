// src/app/(app)/events/[eventId]/event-day/page.tsx
// Placeholder (B0-10, D-019). Tier 2: not linked in the navigation.
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Event day" };

export default async function EventDayPage({ params }: { params: Promise<{ eventId: string }> }) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  await requireEventAccess((await params).eventId);
  return <PagePlaceholder title="Event day" tier={2} />;
}