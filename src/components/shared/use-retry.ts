// src/components/shared/use-retry.ts
// "Try again" for route error screens (B1-15, D-040). reset() alone only re-renders the page in the
// browser, so a page that failed on the server (for example while the database was down) stays
// broken. Asking the router for fresh server data first, in the same transition, makes the retry
// real. This is what Next 16's unstable_retry does; we keep our own copy so a rename of that
// unstable API can't silently break every Try again button.
"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback } from "react";

export function useRetry(reset: () => void): () => void {
  const router = useRouter();
  return useCallback(() => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }, [router, reset]);
}