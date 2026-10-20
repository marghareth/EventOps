// src/components/ui/input.tsx
// Text input (shadcn/ui pattern, themed with the EventOps tokens). 44 px tall for touch targets,
// a visible focus ring, and a red border plus ring when aria-invalid is set. Error text is shown by
// the form field, so the invalid state never depends on colour alone.
import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // The design system field (B10-F01, D-114): the same look as fieldControlClass.
        "h-11 w-full min-w-0 rounded-md border-[1.5px] border-line bg-field px-3.5 text-base text-ink",
        "placeholder:text-ink-3 hover:border-stone focus:border-blue",
        "disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-3",
        "aria-invalid:border-critical aria-invalid:bg-critical-tint",
        className,
      )}
      {...props}
    />
  );
}

export { Input };