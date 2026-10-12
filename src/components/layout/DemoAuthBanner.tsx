// src/components/layout/DemoAuthBanner.tsx
// Shown on every page while the dev-only demo sign-in is on (D-024), so it is never left on by
// accident. The caller decides whether to render it (isDemoAuthEnabled()). With sample data
// (D-041) it also says that nothing is saved, so sample events are never mistaken for real ones.
import { Banner } from "@/components/shared/Banner";

type DemoAuthBannerProps = {
  /** True when event data comes from the in-memory sample store (no DATABASE_URL). */
  sampleData?: boolean;
  className?: string;
};

export function DemoAuthBanner({ sampleData = false, className }: DemoAuthBannerProps) {
  return (
    <Banner
      severity="warning"
      title={sampleData ? "Demo sign-in and sample data are on" : "Demo sign-in is on"}
      className={className}
    >
      You are using EventOps as a demo user. No real account is checked and nothing is saved to
      Supabase.{" "}
      {sampleData ? (
        <>
          The events are sample data kept in memory: changes work but reset when the dev server
          restarts. Set <code>DATABASE_URL</code> in <code>.env.local</code> to use a real
          database.{" "}
        </>
      ) : null}
      This only works with <code>npm run dev</code>; remove <code>DEV_DEMO_AUTH</code> from{" "}
      <code>.env.local</code> to turn it off.
    </Banner>
  );
}