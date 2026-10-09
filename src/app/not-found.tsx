// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2">This page doesn&apos;t exist or has moved.</p>
      <Link className="mt-4 inline-block underline" href="/">
        Back to home
      </Link>
    </main>
  );
}