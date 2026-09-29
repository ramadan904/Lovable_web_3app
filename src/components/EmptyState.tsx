import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A quiet, useful "nothing here yet" that says what will appear and why. */
export function EmptyState({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-8 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-fern-soft text-fern-ink" aria-hidden="true"><Icon className="size-5" /></span>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
