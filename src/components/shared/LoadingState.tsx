// src/components/shared/LoadingState.tsx
import { cn } from "@/lib/utils";
import { StateIcon } from "./StateIcon";

type LoadingStateProps = {
  /** Visible and announced. Say what is loading, for example "Loading attendees". */
  label?: string;
  /** "inline" fits inside a button row or card. "block" fills a page area. */
  variant?: "block" | "inline";
  className?: string;
};

// role="status" is a polite live region. The spinner stops under prefers-reduced-motion.
export function LoadingState({
  label = "Loading",
  variant = "block",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 text-ink-2",
        variant === "block" ? "justify-center px-4 py-12" : "justify-start py-2",
        className,
      )}
    >
      <StateIcon name="loading" className="text-blue motion-safe:animate-spin" />
      <span>{label}…</span>
    </div>
  );
}