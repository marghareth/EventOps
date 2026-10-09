// src/app/error.tsx
"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2">We couldn&apos;t load this page. Try again.</p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}