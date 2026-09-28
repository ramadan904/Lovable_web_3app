import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An empty space that is empty on purpose. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-20 text-center animate-fade-in", className)}>
      <svg viewBox="0 0 80 100" className="mb-10 h-24 w-20" fill="none" aria-hidden>
        <path d="M12 98V38a28 28 0 0 1 56 0v60" stroke="hsl(var(--bone))" strokeOpacity="0.14" />
        <line x1="0" y1="98.5" x2="80" y2="98.5" className="copper-line" stroke="hsl(var(--copper))" strokeOpacity="0.7" />
        <rect x="12" y="92" width="56" height="6" fill="url(#glow)" />
        <defs>
          <linearGradient id="glow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="hsl(var(--copper))" stopOpacity="0.35" />
            <stop offset="1" stopColor="hsl(var(--copper))" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <h2 className="text-balance font-serif text-3xl text-bone md:text-4xl">{title}</h2>
      {children && <div className="mt-4 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-bone-dim">{children}</div>}
      {action && <div className="mt-10">{action}</div>}
    </div>
  );
}
