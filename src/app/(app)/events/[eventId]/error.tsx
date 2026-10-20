// src/app/(app)/events/[eventId]/error.tsx
// Error state for the Overview and the event pages without their own (import, the Tier 2
// placeholders) (B10-F06, D-115). Before, an error there replaced the whole event screen, sidebar
// included; now the sidebar and event header stay, so the user can go elsewhere in the event. Never
// shows error.message, which can contain internal details; the digest is a safe reference. Try
// again fetches fresh server data before re-rendering (useRetry).
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

export default function EventPageError({
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
        title="Couldn't load this page"
        description="Something went wrong on our side. Nothing you entered was lost. Try again in a moment, or open another section from the menu."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  );
}