import { cn } from "@/lib/utils";

/** The Threshold mark: an open doorway, and the line of light at its sill. */
export function Mark({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("h-6 w-6", className)}>
      <path d="M9 27V8.5a7 7 0 0 1 14 0V27" stroke="hsl(var(--bone))" strokeOpacity="0.85" strokeWidth="1.25" />
      <line
        x1="3"
        y1="27.5"
        x2="29"
        y2="27.5"
        stroke="hsl(var(--copper-bright))"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={cn(animate && "origin-center animate-draw-line")}
        style={animate ? { transformBox: "fill-box" } : undefined}
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-serif text-[1.375rem] leading-none tracking-[-0.01em] text-bone">Threshold</span>
    </span>
  );
}
