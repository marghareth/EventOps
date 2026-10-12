// src/app/(app)/error.tsx
// Error screen inside the app shell (B1-15, D-040). Catches failures in any signed-in page that has
// no error screen of its own, including the event layout's access check, so the sidebar and header
// stay. Never shows error.message, which can contain internal details; the digest is a safe
// reference. Failures in the shell itself (the signed-in check) still reach src/app/error.tsx.
"use client";

import Link from "next/link";
import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRetry(reset);
  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white shadow-xs">
      <ErrorState
        headingLevel={1}
        title="Couldn't load this page"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={retry}
        reference={error.digest}
      >
        <Button asChild variant="secondary">
          <Link href="/events">Back to my events</Link>
        </Button>
      </ErrorState>
    </div>
  );
}