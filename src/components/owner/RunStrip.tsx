import { Droplets, Home, Truck } from "lucide-react";
import { DAY_END_MIN, DAY_START_MIN, ZONES } from "@/lib/business";
import { routeBlocks } from "@/lib/engine";
import type { Job } from "@/lib/model";
import { atLocal, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const first = (n: string) => n.split(/\s+/)[0];

/** The day in one glance: jobs, the drives between them (already calculated), and when he's home. */
export function RunStrip({ jobs, date, title }: { jobs: Job[]; date: string; title: string }) {
  const sorted = [...jobs].sort((a, b) => a.startMs - b.startMs);
  const blocks = routeBlocks(sorted);
  if (!sorted.length) return null;
  const span = DAY_END_MIN - DAY_START_MIN;
  const driving = blocks.filter((b) => b.kind === "drive" || b.kind === "home").reduce((n, b) => n + (b.endMin - b.startMin), 0);
  const at = (m: number) => fmtTime(atLocal(date, m));
  const home = blocks[blocks.length - 1].endMin;

  return (
    <section aria-label={title} className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-extrabold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "job" : "jobs"} · <strong className="text-foreground">{driving} min</strong> driving in total · home by {at(home)}
        </p>
      </div>

      <div className="relative mt-4 h-7 overflow-hidden rounded-md border bg-muted/50" aria-hidden="true">
        {blocks.map((b, i) => (
          <span
            key={i}
            className={cn("absolute inset-y-0", b.kind === "job" ? "bg-primary" : b.kind === "refill" ? "hatch-refill" : "hatch")}
            style={{ left: `${((b.startMin - DAY_START_MIN) / span) * 100}%`, width: `${((b.endMin - b.startMin) / span) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem] font-medium text-muted-foreground" aria-hidden="true"><span>8 am</span><span>12 pm</span><span>5:30 pm</span></div>

      <ol className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch" aria-label="Stops and drives in order">
        {blocks.map((b, i) => {
          if (b.kind === "load") return null;
          if (b.kind === "job") {
            const j = sorted[b.index];
            return (
              <li key={i} className="rounded-md border-2 border-primary bg-fern-soft px-3 py-2 text-sm text-fern-ink">
                <span className="block font-bold">{at(b.startMin)} · {first(j.customer.name)}</span>
                <span className="block text-xs">{ZONES[j.zone].name} · {b.endMin - b.startMin} min on site</span>
              </li>
            );
          }
          const Icon = b.kind === "refill" ? Droplets : b.kind === "home" ? Home : Truck;
          return (
            <li key={i} className={cn("flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold", b.kind === "refill" ? "hatch-refill" : "hatch")}>
              <Icon className="size-3.5" aria-hidden="true" />
              {b.kind === "refill" ? `Refill ${b.endMin - b.startMin} min` : `${b.endMin - b.startMin} min ${b.kind === "home" ? "home" : `to ${ZONES[b.to!].name}`}`}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
