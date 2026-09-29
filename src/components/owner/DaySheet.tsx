import { Droplets, Home, Truck } from "lucide-react";
import { OPEN_WEEKDAYS, ZONES } from "@/lib/business";
import { routeBlocks } from "@/lib/engine";
import type { Job, State } from "@/lib/model";
import { atLocal, fmtDate, fmtTime, localDate, weekdayOf } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { WeatherChip } from "../Weather";
import { Tracker } from "../Tracker";
import { JobCard } from "./JobCard";
import { withDelay } from "@/lib/tracker";
import { RunStrip } from "./RunStrip";

const clock = (date: string, min: number) => fmtTime(atLocal(date, min));

/** The morning sheet: the route in order, with every code and note already in place. */
export function DaySheet({ state, date, now }: { state: State; date: string; now: number }) {
  const jobs = state.jobs.filter((j) => localDate(j.startMs) === date && ["booked", "confirmed", "completed"].includes(j.status)).sort((a, b) => a.startMs - b.startMs);
  const f = forecastFor(date, state.stormDays);
  const blocks = routeBlocks(withDelay(jobs));
  const closed = !OPEN_WEEKDAYS.includes(weekdayOf(date));
  const revenue = jobs.reduce((n, j) => n + j.totalCents, 0);

  return (
    <section aria-label={`Route for ${fmtDate(date, "EEEE, MMMM d")}`} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold">{fmtDate(date, "EEEE, MMMM d")}</h2>
        <WeatherChip f={f} />
        <span className="text-sm text-muted-foreground">{jobs.length} {jobs.length === 1 ? "job" : "jobs"} · ${Math.round(revenue / 100).toLocaleString()}</span>
      </div>

      {jobs.length > 0 && <RunStrip now={now} jobs={jobs} date={date} title={date === localDate(now) ? "Today's run" : `Run for ${fmtDate(date, "EEEE")}`} />}

      {jobs.length > 0 && <Tracker state={state} date={date} now={now} />}

      {closed && <p className="rounded-md bg-muted p-4 text-muted-foreground">Closed. Mondays are van maintenance, Sundays are rest.</p>}
      {!closed && !jobs.length && <p className="rounded-md bg-muted p-4 text-muted-foreground">Nothing booked yet. The booking page is still showing this day as open.</p>}

      {jobs.length > 0 && (
        <ol className="relative space-y-3 border-l-2 border-dashed border-foreground/25 pl-6 sm:pl-8">
          {blocks.map((b, i) => {
            if (b.kind === "job") {
              const job = jobs[b.index] as Job;
              return (
                <li key={`j${i}`} className="relative">
                  <span className="absolute -left-[2.05rem] top-4 flex size-6 items-center justify-center rounded-full bg-primary font-display text-xs font-extrabold text-primary-foreground sm:-left-[2.55rem]" aria-hidden="true">{b.index + 1}</span>
                  <JobCard job={job} stormDays={state.stormDays} />
                </li>
              );
            }
            const text =
              b.kind === "load" ? "Load the van, check the water" :
              b.kind === "refill" ? "Water refill at base (the tank holds two jobs)" :
              b.kind === "home" ? `Drive home to ${ZONES[b.to!].name}` :
              `Drive to ${ZONES[b.to!].name}`;
            const Icon = b.kind === "refill" ? Droplets : b.kind === "home" ? Home : Truck;
            return (
              <li key={`b${i}`} className="relative">
                <span className="absolute -left-[1.85rem] top-1.5 flex size-4 items-center justify-center rounded-full bg-background sm:-left-[2.35rem]" aria-hidden="true"><Icon className="size-4 text-muted-foreground" /></span>
                <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm", b.kind === "refill" ? "hatch-refill" : "hatch")}>
                  <span className="font-semibold">{text}</span>
                  <span className="font-medium text-foreground/80">{clock(date, b.startMin)} · {b.endMin - b.startMin} min</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {jobs.length > 0 && <p className="text-sm text-muted-foreground">Home by about {clock(date, blocks[blocks.length - 1].endMin)}. Nothing on this page had to be typed by Dario.</p>}
    </section>
  );
}
