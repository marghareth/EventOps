// src/app/(app)/layout.tsx
// Every page under (app) requires a signed-in user. This check runs on the server for every
// request; the proxy redirect is only a convenience. Server actions and route handlers under
// (app) must still call requireUser() / getCurrentUser() themselves.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
        <p className="font-display text-h4 font-extrabold">EventOps</p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-ink-2">
            <span className="sr-only">Signed in as </span>
            {user.email}
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}