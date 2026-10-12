// src/app/(app)/not-found.tsx
// Not-found inside the app shell (B1-13, D-038): unknown routes and events the user can't access
// (D-027). Renders inside the shell's <main>, so it adds no second one, and tells the shell not to
// offer the unavailable event's sections.
import { MarkEventUnavailable } from "@/components/layout/EventContext";
import { NotFoundState } from "@/components/shared/NotFoundState";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white shadow-sm">
      <MarkEventUnavailable />
      <NotFoundState href="/events" linkLabel="Back to my events" />
    </div>
  );
}