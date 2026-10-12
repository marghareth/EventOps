// src/app/(app)/events/[eventId]/loading.tsx
// Shown while the overview or a section loads, below the event header (B1-15, D-040). It sits
// inside the event layout, so the layout's access check runs first and a refused event still gets
// a real 404 (D-027). Never move a loading screen above this layout.
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading event" />
    </div>
  );
}