// src/app/(app)/events/[eventId]/budget/loading.tsx
// Shown while the budget or one of its add and edit pages loads (B5-F15). Below the event layout,
// so a refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading the budget" />
    </div>
  );
}