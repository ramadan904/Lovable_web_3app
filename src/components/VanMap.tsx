import { Check } from "lucide-react";
import { HOME_ZONE, ZONES, type ZoneKey } from "@/lib/business";
import type { Job } from "@/lib/model";
import { routeBlocks } from "@/lib/engine";
import { ZONE_XY, type VanPos } from "@/lib/tracker";

interface Props {
  jobs: Job[];
  van: VanPos;
  minute: number;
  rain: boolean;
  /** Customer view: only this job is named; every other stop is an anonymous pin. */
  focusJobId?: string;
  label: string;
  animate?: boolean;
}

const first = (n: string) => n.split(/\s+/)[0];
const t = (m: number) => {
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")}${h >= 12 ? "p" : "a"}`;
};

/** A schematic Portland with the day's route drawn on it and Bertha somewhere along it. */
export function VanMap({ jobs, van, minute, rain, focusJobId, label, animate = false }: Props) {
  const sorted = [...jobs].sort((a, b) => a.startMs - b.startMs);
  const blocks = routeBlocks(sorted);
  const drives = blocks.filter((b) => b.kind === "drive" || b.kind === "home");
  const flip = van.from && van.to && ZONE_XY[van.to].x < ZONE_XY[van.from].x;
  const moving = van.phase === "driving" || van.phase === "driving_home";

  return (
    <svg viewBox="0 0 100 76" className="mx-auto block w-full max-w-2xl rounded-lg border bg-[hsl(var(--rain-soft)/0.55)]" role="img" aria-label={label}>
      <defs>
        <pattern id="vm-grid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M6 0H0V6" fill="none" stroke="hsl(var(--foreground))" strokeOpacity="0.05" strokeWidth="0.25" />
        </pattern>
      </defs>
      <rect width="100" height="76" fill="url(#vm-grid)" />
      {/* the rivers */}
      <path d="M-2 5 Q 30 1 60 6 T 102 3 V-2 H-2Z" fill="hsl(var(--rain))" fillOpacity="0.16" />
      <path d="M48 5 C 42 18, 58 30, 50 44 S 44 62, 52 78" fill="none" stroke="hsl(var(--rain))" strokeOpacity="0.28" strokeWidth="3.4" strokeLinecap="round" />
      <text x="53.5" y="41" fontSize="2.3" fill="hsl(var(--rain))" fillOpacity="0.8" fontStyle="italic" aria-hidden="true">Willamette</text>

      {/* the day's planned route, then the part already driven */}
      {drives.map((b, i) => {
        const a = ZONE_XY[b.from!];
        const z = ZONE_XY[b.to!];
        const done = minute >= b.endMin ? 1 : minute <= b.startMin ? 0 : (minute - b.startMin) / (b.endMin - b.startMin);
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="hsl(var(--foreground))" strokeOpacity="0.28" strokeWidth="0.7" strokeDasharray="1.4 1.6" />
            <line x1={a.x} y1={a.y} x2={a.x + (z.x - a.x) * done} y2={a.y + (z.y - a.y) * done} stroke="hsl(var(--primary))" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        );
      })}

      {/* every zone Fernhill serves */}
      {(Object.keys(ZONES) as ZoneKey[]).map((z) => {
        const p = ZONE_XY[z];
        const used = sorted.some((j) => j.zone === z) || z === HOME_ZONE;
        return (
          <g key={z} aria-hidden="true">
            <circle cx={p.x} cy={p.y} r="7.2" fill="hsl(var(--card))" fillOpacity={used ? 0.75 : 0.45} stroke="hsl(var(--foreground))" strokeOpacity={used ? 0.28 : 0.12} strokeWidth="0.35" />
            <text x={p.x} y={p.y - 8.8} textAnchor="middle" fontSize="2.4" fontWeight="600" fill="hsl(var(--muted-foreground))">{ZONES[z].name}</text>
          </g>
        );
      })}

      {/* home base */}
      <g transform={`translate(${ZONE_XY[HOME_ZONE].x - 5.4} ${ZONE_XY[HOME_ZONE].y - 5.6})`} aria-hidden="true">
        <path d="M0 2.4 L2.4 0 L4.8 2.4 V4.6 H0Z" fill="hsl(var(--primary))" />
        <rect x="1.9" y="3" width="1" height="1.6" fill="hsl(var(--primary-foreground))" />
      </g>

      {/* the stops */}
      {sorted.map((j, i) => {
        const p = ZONE_XY[j.zone];
        const work = blocks.find((b) => b.kind === "job" && b.index === i)!;
        const finished = minute >= work.endMin;
        const current = minute >= work.startMin && minute < work.endMin;
        const mine = focusJobId ? j.id === focusJobId : true;
        const dx = (i % 3 - 1) * 4.6; // stops in one zone sit side by side
        const dy = -2.4 + (i % 2) * 5;
        return (
          <g key={j.id} transform={`translate(${p.x + dx} ${p.y + dy})`} aria-hidden="true">
            <circle r={mine ? (focusJobId ? 3.9 : 3.1) : 2.3} fill={finished ? "hsl(var(--primary))" : current ? "hsl(var(--sun))" : "hsl(var(--card))"}
              stroke={mine ? "hsl(var(--foreground))" : "hsl(var(--foreground) / 0.4)"} strokeWidth={mine ? 0.7 : 0.4} />
            {current && <circle r={mine && focusJobId ? 3.9 : 3.1} fill="none" stroke="hsl(var(--sun))" strokeWidth="0.6"><animate attributeName="r" values="3.1;6;3.1" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" /></circle>}
            {finished ? (
              <path d={mine ? "M-1.3 0.1 L-0.3 1.1 L1.4 -1.1" : "M-0.9 0 L-0.2 0.7 L1 -0.8"} fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round" />
            ) : mine ? (
              <text y={focusJobId ? 0.9 : 1} textAnchor="middle" fontSize={focusJobId ? 2.5 : 2.9} fontWeight="800" fill="hsl(var(--foreground))">{focusJobId ? "You" : i + 1}</text>
            ) : null}
            {mine && (
              <text y={focusJobId ? 7.4 : 6.6} textAnchor="middle" fontSize="2.3" fontWeight="600" fill="hsl(var(--foreground))">
                {focusJobId ? t(work.startMin) : `${first(j.customer.name)} ${t(work.startMin)}`}
              </text>
            )}
          </g>
        );
      })}

      {/* rain, only on a wet day */}
      {rain && (
        <g stroke="hsl(var(--rain))" strokeWidth="0.35" strokeLinecap="round" opacity="0.55" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <line key={i} x1={(i * 37) % 100} y1={(i * 13) % 70} x2={((i * 37) % 100) - 1.4} y2={((i * 13) % 70) + 3.2} className="animate-rain" style={{ animationDelay: `${(i % 7) * 180}ms` }} />
          ))}
        </g>
      )}

      {/* Bertha */}
      <g style={{ transform: `translate(${van.x + (moving ? 0 : 5.6)}px, ${van.y + (moving ? 0 : 1.6)}px)`, transition: animate ? "transform 900ms linear" : "none" }} aria-hidden="true">
        {moving && <circle r="4.4" fill="hsl(var(--sun))" fillOpacity="0.35"><animate attributeName="r" values="3;6;3" dur="1.6s" repeatCount="indefinite" /></circle>}
        <g transform={`scale(${flip ? -1 : 1} 1) translate(0 -3.4)`}>
          <rect x="-3.6" y="-2.2" width="7.2" height="3.6" rx="0.9" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="0.55" />
          <path d="M1.4 -2.2 H2.6 L3.6 -0.6 V1.4 H1.4Z" fill="hsl(var(--rain-soft))" stroke="hsl(var(--foreground))" strokeWidth="0.45" strokeLinejoin="round" />
          <rect x="-3.6" y="0" width="5" height="0.8" fill="hsl(var(--primary))" />
          <circle cx="-2" cy="1.5" r="0.95" fill="hsl(var(--foreground))" />
          <circle cx="2" cy="1.5" r="0.95" fill="hsl(var(--foreground))" />
        </g>
      </g>
    </svg>
  );
}

export function Legend({ focus }: { focus: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map key">
      <li className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-primary" /> Driven</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-0 w-5 border-t-2 border-dashed border-foreground/30" /> Planned</li>
      <li className="flex items-center gap-1.5"><span className="inline-flex size-3.5 items-center justify-center rounded-full bg-sun" /> Working now</li>
      <li className="flex items-center gap-1.5"><span className="inline-flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2.5" aria-hidden="true" /></span> Done</li>
      {focus && <li>Other stops are shown without names</li>}
    </ul>
  );
}
