// src/app/(app)/events/[eventId]/suppliers/page.tsx
// Placeholder (B0-10, D-019). Replaced by this page's feature task.
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({ params }: { params: Promise<{ eventId: string }> }) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  await requireEventAccess((await params).eventId);
  return <PagePlaceholder title="Suppliers" />;
}