// src/components/shared/Decor.tsx
// Decorative shapes for dashboard tiles (D-119): a soft flower, a blob, a circle and a hill, drawn
// in the current text color. Purely visual: hidden from assistive technology, never focusable, and
// placed behind the tile's content by the caller (absolute, pointer-events-none).
import { cn } from "@/lib/utils";

export type DecorShape = "flower" | "blob" | "circle" | "hill";

const PATHS: Record<DecorShape, string> = {
  // Eight rounded petals around a center.
  flower:
    "M100 10c13 0 22 14 26 27 11-8 27-12 37-3s6 26-2 37c13 4 27 13 27 26s-14 22-27 26c8 11 12 27 3 37s-26 6-37-2c-4 13-13 27-26 27s-22-14-26-27c-11 8-27 12-37 3s-6-26 2-37c-13-4-27-13-27-26s14-22 27-26c-8-11-12-27-3-37s26-6 37 2c4-13 13-27 26-27z",
  blob: "M152 38c22 22 34 58 20 88s-52 52-88 46-66-38-70-74 18-66 50-74 66-8 88 14z",
  circle: "M100 10a90 90 0 1 0 0.01 0z",
  hill: "M0 150c30-40 60-60 100-60s70 20 100 60v50H0z",
};

export function Decor({ shape, className }: { shape: DecorShape; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 200"
      className={cn("pointer-events-none absolute", className)}
    >
      <path d={PATHS[shape]} fill="currentColor" />
    </svg>
  );
}