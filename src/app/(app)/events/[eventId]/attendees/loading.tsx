// src/app/(app)/events/[eventId]/attendees/loading.tsx
// Shown while the guest list, an attendee's details or the add and edit pages load (B2-09). Below
// the event layout, so a refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading attendees" />
    </div>
  );
}