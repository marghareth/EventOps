// src/app/(app)/layout.tsx
// Application shell for every signed-in page (B0-10): sidebar, header with user menu, and the main
// content area. The requireUser() check runs on the server for every request; the proxy redirect
// is only a convenience. Server actions and route handlers must still check the user themselves.
import Link from "next/link";
import type { ReactNode } from "react";
import { DemoAuthBanner } from "@/components/layout/DemoAuthBanner";
import { EventContextProvider } from "@/components/layout/EventContext";
import { BrandMark } from "@/components/layout/NavIcon";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getUserProfile, requireUser } from "@/lib/auth";
import { isDemoAuthEnabled, isSampleDataMode } from "@/lib/demo-auth";
import { signOutAction } from "../(auth)/actions";

// Pages behind sign-in are per user: never prerender them at build time. Without this, a build
// with no Supabase settings (CI) tries to prerender them and fails.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getUserProfile(user);

  return (
    <EventContextProvider>
      <div className="min-h-dvh md:flex">
        {/* Desktop sidebar. Below md it moves into the header's Menu drawer. An <aside> so the
            brand link sits inside a landmark like everything else on the page (B1-15). */}
        <aside
          aria-label="Sidebar"
          className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-white"
        >
          <Link
            href="/events"
            className="flex min-h-16 items-center gap-2 border-b border-line px-5 font-display text-h4 font-extrabold"
          >
            <BrandMark className="size-7" />
            EventOps
          </Link>
          <Sidebar className="flex-1 overflow-y-auto" />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={profile} signOutAction={signOutAction} />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 focus:outline-none md:px-8 md:py-8"
          >
            {isDemoAuthEnabled() ? (
              <DemoAuthBanner sampleData={isSampleDataMode()} className="mb-6" />
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </EventContextProvider>
  );
}