// src/components/shared/StatePanel.tsx
import type { AriaRole, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StateIcon, type StateIconName } from "./StateIcon";

type StatePanelProps = {
  icon: StateIconName;
  title: string;
  description?: ReactNode;
  /** Actions, usually one primary button or link. */
  children?: ReactNode;
  /** "critical" colors the icon only. The title and text always say what happened. */
  tone?: "neutral" | "critical";
  headingLevel?: 1 | 2 | 3;
  role?: AriaRole;
  className?: string;
};

// Shared layout for empty, error, not-found and unauthorized states. Transparent on purpose:
// the caller decides whether it sits on the paper page or inside a white card.
export function StatePanel({
  icon,
  title,
  description,
  children,
  tone = "neutral",
  headingLevel = 2,
  role,
  className,
}: StatePanelProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      role={role}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-12 text-center text-ink",
        className,
      )}
    >
      <StateIcon
        name={icon}
        className={cn("size-10", tone === "critical" ? "text-critical" : "text-ink-3")}
      />
      <Heading className={cn("font-extrabold", headingLevel === 1 ? "text-h2" : "text-h3")}>
        {title}
      </Heading>
      {description ? <p className="text-ink-2">{description}</p> : null}
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </section>
  );
}