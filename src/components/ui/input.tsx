import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-12 w-full border-0 border-b border-bone/15 bg-transparent px-0 text-base text-bone transition-colors duration-500 ease-quiet",
      "placeholder:text-bone-faint hover:border-bone/30 focus-visible:border-copper focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
