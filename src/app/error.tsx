// src/app/error.tsx
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

// Never render error.message: it can contain internal details. The digest is a safe reference.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRetry(reset);
  return (
    <main id="main" className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl bg-white shadow-sm">
        <ErrorState
          headingLevel={1}
          description="We couldn't load this page. Try again."
          onRetry={retry}
          reference={error.digest}
        />
      </div>
    </main>
  );
}