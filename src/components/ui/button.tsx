import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[0.9375rem] font-medium tracking-[-0.005em] transition-[background-color,border-color,color,opacity,box-shadow] duration-500 ease-quiet disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-bone text-charcoal-950 hover:bg-[hsl(40_36%_91%)] shadow-[0_0_0_0_hsl(var(--copper)/0)] hover:shadow-[0_0_40px_-8px_hsl(var(--copper)/0.45)]",
        outline: "rounded-full border border-bone/20 text-bone hover:border-bone/45 hover:bg-bone/[0.03]",
        ghost: "rounded-full text-bone-dim hover:text-bone hover:bg-bone/[0.04]",
        quiet: "text-bone-dim underline decoration-bone/20 underline-offset-[6px] hover:text-bone hover:decoration-copper/70",
        copper: "rounded-full border border-copper/40 text-copper-bright hover:border-copper hover:bg-copper/[0.06]",
        destructive: "rounded-full border border-destructive/40 text-[hsl(8_60%_70%)] hover:border-destructive hover:bg-destructive/10",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-9 px-4 text-sm",
        lg: "h-14 px-9 text-base",
        icon: "h-10 w-10 rounded-full",
        inline: "h-auto p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
