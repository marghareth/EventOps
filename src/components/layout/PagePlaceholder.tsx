// src/components/layout/PagePlaceholder.tsx
// Stand-in for pages whose feature task has not run yet (D-019). Each feature task replaces its
// placeholder. Shows nothing from the database.
import { EmptyState } from "@/components/shared/EmptyState";

type PagePlaceholderProps = {
  title: string;
  /** Tier 2 pages exist as routes but are not linked or available yet. */
  tier?: 1 | 2;
};

export function PagePlaceholder({ title, tier = 1 }: PagePlaceholderProps) {
  return (
    <>
      <h1 className="text-h2 font-extrabold">{title}</h1>
      <div className="mt-6 rounded-xl bg-white shadow-xs">
        <EmptyState
          headingLevel={2}
          title="Not built yet"
          description={
            tier === 2
              ? "This is a Tier 2 feature. It becomes available after Tier 1 is complete and approved."
              : "This page arrives with its own task. Nothing is shown or saved here yet."
          }
        />
      </div>
    </>
  );
}