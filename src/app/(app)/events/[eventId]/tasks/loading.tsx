// src/app/(app)/events/[eventId]/tasks/loading.tsx
// Shown while the task list or the add and edit pages load (B6-F01, B6-F02). Below the event
// layout, so a refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading tasks" />
    </div>
  );
}