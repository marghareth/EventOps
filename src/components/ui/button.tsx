// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Design system B0-11: pill shape, Manrope label, 44 px minimum height. The focus ring comes from
// the global :focus-visible rule in globals.css.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-transparent font-display text-sm font-bold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-blue text-white hover:bg-blue-dark",
        destructive: "bg-critical text-white hover:bg-critical/90",
        outline: "border-ink bg-transparent text-ink hover:bg-ink/10",
        secondary: "bg-mist text-ink hover:bg-line",
        ghost: "text-ink hover:bg-ink/10",
        link: "rounded-none text-blue underline-offset-4 hover:underline",
      },
      size: {
        // 44 px minimum touch target (min-h-11)
        default: "min-h-11 px-6 py-2",
        sm: "min-h-11 px-4",
        lg: "min-h-11 px-8",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button };