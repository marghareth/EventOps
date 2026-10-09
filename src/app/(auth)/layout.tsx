// src/app/(auth)/layout.tsx
// Shell for the sign-in and sign-up pages (B0-09 minimal pages; Tier 1 polishes them).
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center font-display text-h3 font-extrabold">
          <Link href="/" className="rounded-sm">
            EventOps
          </Link>
        </p>
        <div className="rounded-xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}