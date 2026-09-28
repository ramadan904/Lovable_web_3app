import { cn } from "@/lib/utils";

/** A letter that cannot be opened yet. The seal breathes, slowly. Once open, the page rises. */
export function SealedEnvelope({ open = false, className }: { open?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={cn("h-24 w-[7.5rem]", className)} fill="none" aria-hidden>
      {open && (
        <g className="animate-rise-in">
          <rect x="16" y="2" width="88" height="60" rx="2" className="fill-[hsl(40_14%_20%)]" />
          <line x1="26" y1="16" x2="80" y2="16" stroke="hsl(var(--bone))" strokeOpacity="0.35" />
          <line x1="26" y1="25" x2="92" y2="25" stroke="hsl(var(--bone))" strokeOpacity="0.2" />
          <line x1="26" y1="34" x2="86" y2="34" stroke="hsl(var(--bone))" strokeOpacity="0.2" />
        </g>
      )}
      <rect x="0.5" y="16.5" width="119" height="79" rx="3" className="fill-charcoal-800" stroke="hsl(var(--bone))" strokeOpacity="0.14" />
      {open ? (
        <>
          <path d="M1 17 60 58 119 17" stroke="hsl(var(--bone))" strokeOpacity="0.08" />
          <line x1="36" y1="78" x2="84" y2="78" stroke="hsl(var(--copper-bright))" strokeWidth="1.25" />
        </>
      ) : (
        <>
          <path d="M1 17 60 60 119 17" stroke="hsl(var(--bone))" strokeOpacity="0.16" />
          <g className="animate-breathe">
            <circle cx="60" cy="60" r="9" className="fill-copper-deep" />
            <circle cx="60" cy="60" r="6" stroke="hsl(var(--copper-bright))" strokeOpacity="0.6" strokeWidth="0.75" />
          </g>
        </>
      )}
    </svg>
  );
}
