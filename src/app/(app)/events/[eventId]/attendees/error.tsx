// src/app/(app)/events/[eventId]/attendees/error.tsx
// Error state for the guest list and the attendee pages below it (B2-09, D-040). The sidebar and
// event header stay. Never shows error.message, which can contain internal details; the digest is
// a safe reference. Try again fetches fresh server data before re-rendering (useRetry).
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

export default function AttendeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRetry(reset);
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <ErrorState
        headingLevel={1}
        title="Couldn't load attendees"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  );
}