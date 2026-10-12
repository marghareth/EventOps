// src/components/layout/DemoAuthBanner.tsx
// Shown on every page while the dev-only demo sign-in is on (D-024), so it is never left on by
// accident. The caller decides whether to render it (isDemoAuthEnabled()).
import Link from "next/link";
import { Banner } from "@/components/shared/Banner";

type DemoAuthBannerProps = {
  /** An event page to try, for example /events/<id>/attendees. Omitted on the sign-in pages. */
  sampleEventHref?: string;
  className?: string;
};

export function DemoAuthBanner({ sampleEventHref, className }: DemoAuthBannerProps) {
  return (
    <Banner severity="warning" title="Demo sign-in is on" className={className}>
      You are using EventOps as a demo user. No real account is checked and nothing is saved to
      Supabase. This only works with <code>npm run dev</code>; remove <code>DEV_DEMO_AUTH</code>{" "}
      from <code>.env.local</code> to turn it off.
      {sampleEventHref ? (
        <>
          {" "}
          <Link href={sampleEventHref} className="font-semibold text-blue underline">
            Open a sample event
          </Link>
          .
        </>
      ) : null}
    </Banner>
  );
}