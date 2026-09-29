import { cn } from "@/lib/utils";

/** Bertha, in the flesh. Decorative. */
export function Van({ className, raining = false }: { className?: string; raining?: boolean }) {
  return (
    <svg viewBox="0 0 340 150" className={cn("w-full", className)} aria-hidden="true">
      <defs>
        <linearGradient id="van-iris" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: "hsl(var(--iris-1))" }} />
          <stop offset="0.35" style={{ stopColor: "hsl(var(--iris-2))" }} />
          <stop offset="0.65" style={{ stopColor: "hsl(var(--iris-3))" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--iris-4))" }} />
        </linearGradient>
        <clipPath id="vanbody"><path d="M20 108V52a12 12 0 0 1 12-12h150a12 12 0 0 1 9 4l38 42h49a14 14 0 0 1 14 14v8z" /></clipPath>
      </defs>
      <ellipse cx="170" cy="128" rx="150" ry="6" fill="hsl(var(--foreground) / 0.12)" />
      <path d="M20 108V52a12 12 0 0 1 12-12h150a12 12 0 0 1 9 4l38 42h49a14 14 0 0 1 14 14v8z" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinejoin="round" />
      <g clipPath="url(#vanbody)">
        <rect x="10" y="84" width="330" height="14" fill="hsl(var(--primary))" />
        <rect x="10" y="100" width="330" height="4" fill="url(#van-iris)" />
      </g>
      <path d="M198 50l30 34h-30z" fill="hsl(var(--rain-soft))" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinejoin="round" />
      <rect x="34" y="54" width="40" height="24" rx="4" fill="hsl(var(--rain-soft))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
      <text x="88" y="76" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="20" fill="hsl(var(--primary))">Fernhill</text>
      <rect x="20" y="108" width="270" height="6" fill="hsl(var(--foreground) / 0.85)" />
      <g>
        <circle cx="72" cy="116" r="17" fill="hsl(var(--foreground))" />
        <circle cx="72" cy="116" r="7" fill="hsl(var(--muted))" />
        <circle cx="236" cy="116" r="17" fill="hsl(var(--foreground))" />
        <circle cx="236" cy="116" r="7" fill="hsl(var(--muted))" />
      </g>
      <path d="M282 88h6" stroke="hsl(var(--sun))" strokeWidth="5" strokeLinecap="round" />
      {raining && (
        <g stroke="hsl(var(--rain))" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          {[30, 70, 110, 150, 190, 230, 270, 310].map((x, i) => (
            <line key={x} x1={x} y1={6 + (i % 3) * 10} x2={x - 6} y2={20 + (i % 3) * 10} className="animate-rain" style={{ animationDelay: `${i * 140}ms` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="hsl(var(--primary))" />
      <path d="M12 40V27a4 4 0 0 1 4-4h20a4 4 0 0 1 3 1.4l8 9.6h1a4 4 0 0 1 4 4v2a2 2 0 0 1-2 2h-3" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 42h6M28 42h11" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" />
      <circle cx="23" cy="43" r="5" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="3" />
      <circle cx="46" cy="43" r="5" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="3" />
      <path d="M50 14c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="hsl(var(--sun))" />
    </svg>
  );
}
