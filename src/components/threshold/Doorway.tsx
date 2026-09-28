import { cn } from "@/lib/utils";

/** The hero image: a doorway at night, and the light under it. Drawn, not photographed. */
export function Doorway({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 480" className={cn("h-auto w-full", className)} fill="none" aria-hidden>
      <defs>
        <linearGradient id="door-light" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="hsl(var(--copper-bright))" stopOpacity="0.55" />
          <stop offset="0.18" stopColor="hsl(var(--copper))" stopOpacity="0.18" />
          <stop offset="0.6" stopColor="hsl(var(--copper))" stopOpacity="0.03" />
          <stop offset="1" stopColor="hsl(var(--copper))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="floor-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--copper-bright))" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(var(--copper))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="hsl(var(--copper))" stopOpacity="0" />
          <stop offset="0.25" stopColor="hsl(var(--copper))" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="hsl(var(--copper-bright))" />
          <stop offset="0.75" stopColor="hsl(var(--copper))" stopOpacity="0.7" />
          <stop offset="1" stopColor="hsl(var(--copper))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* light from beyond the door */}
      <path d="M80 400V170a80 80 0 0 1 160 0v230Z" fill="url(#door-light)" className="animate-breathe" style={{ animationDuration: "9s" }} />
      {/* light spilling onto the floor */}
      <path d="M80 400h160l60 80H20Z" fill="url(#floor-light)" className="opacity-0 animate-fade-in" style={{ animationDelay: "1400ms", animationDuration: "3000ms" }} />

      {/* frame */}
      <path
        d="M80 400V170a80 80 0 0 1 160 0v230"
        stroke="hsl(var(--bone))"
        strokeOpacity="0.55"
        strokeWidth="1"
        pathLength={1}
        strokeDasharray="1"
        className="animate-[draw-path_3.2s_cubic-bezier(0.22,0.61,0.36,1)_both]"
      />
      <path d="M64 400V166a96 96 0 0 1 192 0v234" stroke="hsl(var(--bone))" strokeOpacity="0.08" strokeWidth="1" />

      {/* the threshold itself */}
      <rect x="0" y="399.5" width="320" height="1.5" fill="url(#sill)" className="origin-center animate-draw-line" style={{ transformBox: "fill-box", animationDelay: "600ms" }} />
    </svg>
  );
}
