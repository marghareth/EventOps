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
        "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base shadow-xs",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-[#C62828] aria-invalid:ring-[#C62828]/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };