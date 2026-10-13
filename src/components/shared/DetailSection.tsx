// src/components/shared/DetailSection.tsx
// One titled section of a detail page (B2-13): a white card with a level-2 heading that labels the
// region. Shared so every module renders its own section the same way (the attendee page composes
// sections from the attendees module now and the accessibility module in Batch 3) without
// importing another module's UI.
import type { ReactNode } from "react";

type Props = {
  /** Unique on the page; used for the heading id. */
  id: string;
  title: string;
  children: ReactNode;
};

export function DetailSection({ id, title, children }: Props) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="rounded-xl bg-white p-6 shadow-xs sm:p-8">
      <h2 id={headingId} className="text-h4 font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}