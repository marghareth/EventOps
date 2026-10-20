// src/components/layout/DemoAuthBanner.tsx
// Shown on every page while the dev-only demo sign-in is on (D-024), so it is never left on by
// accident. The caller decides whether to render it (isDemoAuthEnabled()). With sample data
// (D-041) it also says that nothing is saved, so sample events are never mistaken for real ones.
// A slim strip (D-118): always visible, but it no longer pushes every page's content down.
import { StateIcon } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";

type DemoAuthBannerProps = {
  /** True when event data comes from the in-memory sample store (no DATABASE_URL). */
  sampleData?: boolean;
  className?: string;
};

export function DemoAuthBanner({ sampleData = false, className }: DemoAuthBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-warning-line bg-warning-tint px-3.5 py-2 text-[13px] text-ink",
        className,
      )}
    >
      <StateIcon name="warning" className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="min-w-0">
        <span className="sr-only">Warning: </span>
        <strong className="font-semibold">
          {sampleData ? "Demo sign-in and sample data are on" : "Demo sign-in is on"}
        </strong>
        <span className="text-ink-2">
          {" "}
          · You are using EventOps as a demo user. No real account is checked and nothing is saved
          to Supabase.{" "}
          {sampleData ? (
            <>
              The events are sample data kept in memory: changes work but reset when the dev server
              restarts. Set <code>DATABASE_URL</code> in <code>.env.local</code> to use a real
              database.{" "}
            </>
          ) : null}
          This only works with <code>npm run dev</code>; remove <code>DEV_DEMO_AUTH</code> from{" "}
          <code>.env.local</code> to turn it off.
        </span>
      </p>
    </div>
  );
}