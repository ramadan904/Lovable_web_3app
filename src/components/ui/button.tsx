import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-fern-ink",
        sun: "bg-sun text-sun-ink shadow-card hover:brightness-95",
        outline: "border border-input bg-card text-foreground hover:border-foreground/60 hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        soft: "bg-fern-soft text-fern-ink hover:bg-fern-soft/70",
        danger: "border border-danger/40 bg-card text-danger hover:bg-danger-soft",
        link: "h-auto rounded-none p-0 text-fern underline decoration-fern/30 underline-offset-4 hover:decoration-fern",
      },
      size: {
        default: "h-11 px-5 text-[0.95rem]",
        sm: "h-9 px-4 text-sm",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
