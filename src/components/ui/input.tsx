import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-input bg-card px-3.5 text-base text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/50 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn(field, "h-12", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-24 py-3", className)} {...props} />
));
Textarea.displayName = "Textarea";
