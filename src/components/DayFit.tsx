import { DAY_END_MIN, DAY_START_MIN, MAX_JOBS_PER_DAY, REFILL_MIN, ZONES, type ZoneKey } from "@/lib/business";
import { routeBlocks, type RouteBlock } from "@/lib/engine";
import type { Job } from "@/lib/model";
import { localMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";

const SPAN = DAY_END_MIN - DAY_START_MIN;
const pct = (min: number) => Math.max(0, Math.min(100, ((min - DAY_START_MIN) / SPAN) * 100));
const clock = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

type Candidate = { startMs: number; durationMin: number; zone: ZoneKey };

/**
 * Shows, for one day, the thing the calendar is really doing: the jobs already booked, the driving
 * between them, the water refill before the third job, and where the customer's time would fit.
 * Every number comes from routeBlocks(), the same function that builds Dario's own day sheet.
 */
export function DayFit({ jobs, candidate }: { jobs: Job[]; candidate: Candidate | null }) {
  const mine = candidate as unknown as Job | null; // routeBlocks only reads start, duration and zone
  const all = mine ? [...jobs, mine] : jobs;
  const blocks = routeBlocks(all);
  const order = [...all].sort((a, b) => a.startMs - b.startMs);
  const myIndex = mine ? order.findIndex((j) => j === mine) : -1;

  const at = (i: number) => order[i];
  const driveIn = blocks.find((b) => b.kind === "drive" && b.index === myIndex);
  const refill = blocks.some((b) => b.kind === "refill" && b.index === myIndex);
  const home = blocks.find((b) => b.kind === "home");

  let caption: string;
  if (!mine) {
    caption = `${jobs.length} of ${MAX_JOBS_PER_DAY} jobs booked this day. Pick a time to see where it fits.`;
  } else {
    const drive = driveIn ? driveIn.endMin - driveIn.startMin : 0;
    const before = myIndex === 0
      ? `Dario loads the van at 8:00 and drives ${drive} min to you.`
      : `Dario finishes his ${ZONES[at(myIndex - 1).zone].name} job at ${clock(localMinutes(at(myIndex - 1).startMs) + at(myIndex - 1).durationMin)}, then drives ${drive} min to you.`;
    caption = `${jobs.length} of ${MAX_JOBS_PER_DAY} jobs already booked, so yours would be job ${myIndex + 1}. ${before}${refill ? ` A ${REFILL_MIN}-minute water refill fits in first.` : ""}${home ? ` He's home by ${clock(home.endMin)}.` : ""}`;
  }

  const style = (b: RouteBlock) => {
    const mineJob = b.kind === "job" && b.index === myIndex;
    if (b.kind === "job") return mineJob ? "bg-primary text-primary-foreground" : "bg-foreground/30";
    if (b.kind === "refill") return "bg-rain/70";
    if (b.kind === "load") return "bg-foreground/15";
    return "bg-[repeating-linear-gradient(135deg,hsl(var(--foreground)/0.28)_0_3px,transparent_3px_6px)]"; // driving
  };

  return (
    <figure aria-label="How this day fits together" className="rounded-md border bg-card p-4">
      <figcaption className="text-sm font-semibold">How this day fits together</figcaption>
      <div className="relative mt-3 h-7 overflow-hidden rounded bg-muted" aria-hidden="true">
        {blocks.map((b, i) => (
          <div key={i} className={cn("absolute inset-y-0 flex items-center justify-center overflow-hidden text-[0.65rem] font-bold", style(b))}
            style={{ left: `${pct(b.startMin)}%`, width: `${Math.max(0.8, pct(b.endMin) - pct(b.startMin))}%` }}>
            {b.kind === "job" && b.index === myIndex ? "You" : null}
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[0.65rem] text-muted-foreground" aria-hidden="true">
        {[8, 10, 12, 14, 16].map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${pct(h * 60)}%` }}>{h % 12 || 12}{h < 12 ? "a" : "p"}</span>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-foreground/30" /> Booked</li>
        {mine && <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-primary" /> You</li>}
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[repeating-linear-gradient(135deg,hsl(var(--foreground)/0.4)_0_2px,transparent_2px_4px)]" /> Driving</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-rain/70" /> Water refill</li>
      </ul>
      <p className="mt-2 text-sm text-foreground/85">{caption}</p>
    </figure>
  );
}
