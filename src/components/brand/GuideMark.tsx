import type { PresenceType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A Guide's presence glyph, in place of a photograph.
 * Guides are met by how they hold a room, not by how they look.
 */
export function GuideMark({
  name,
  presence,
  className,
  size = "md",
}: {
  name: string;
  presence: PresenceType;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const dims = { sm: "h-12 w-10", md: "h-[4.5rem] w-14", lg: "h-28 w-[5.5rem]" }[size];
  const text = { sm: "text-base", md: "text-2xl", lg: "text-4xl" }[size];

  return (
    <div className={cn("relative shrink-0", dims, className)} aria-hidden>
      <svg viewBox="0 0 56 72" className="absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="none">
        <path d="M6 70V26a22 22 0 0 1 44 0v44" stroke="hsl(var(--bone))" strokeOpacity="0.16" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {presence === "still" && <line x1="22" y1="70" x2="34" y2="70" stroke="hsl(var(--copper-bright))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {presence === "steady" && (
          <>
            <line x1="14" y1="70" x2="42" y2="70" stroke="hsl(var(--copper))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <line x1="18" y1="66" x2="38" y2="66" stroke="hsl(var(--copper))" strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {presence === "direct" && <line x1="0" y1="70" x2="56" y2="70" stroke="hsl(var(--copper-bright))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {presence === "tender" && (
          <>
            <ellipse cx="28" cy="70" rx="22" ry="6" fill="hsl(var(--copper))" fillOpacity="0.18" />
            <line x1="10" y1="70" x2="46" y2="70" stroke="hsl(var(--copper))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <span className={cn("absolute inset-x-0 bottom-[22%] text-center font-serif leading-none text-bone/80", text)}>{initials}</span>
    </div>
  );
}
