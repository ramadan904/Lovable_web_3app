import { useState } from "react";
import { CloudRain } from "lucide-react";
import { DAY_END_MIN, DAY_START_MIN, OPEN_WEEKDAYS, SERVICES } from "@/lib/business";
import { routeBlocks } from "@/lib/engine";
import type { State } from "@/lib/model";
import { fmtDate, fmtTime, localDate, localMinutes, weekdayOf, addDays } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "../Weather";
import { JobCard } from "./JobCard";

const PX = 1; // pixels per minute
const HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX;
const hours = Array.from({ length: 10 }, (_, i) => 8 + i);

/** A week drawn to scale: jobs, and the hatched drive time that makes them fit. */
export function WeekView({ state, from }: { state: State; from: string }) {
  const days: string[] = [];
  for (let i = 0; days.length < 6 && i < 14; i++) {
    const d = addDays(from, i);
    if (OPEN_WEEKDAYS.includes(weekdayOf(d))) days.push(d);
  }
  const [selected, setSelected] = useState<string | null>(null);
  const job = state.jobs.find((j) => j.id === selected);

  return (
    <section aria-label="This week" className="space-y-5">
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[52rem] grid-cols-[3rem_repeat(6,minmax(0,1fr))] gap-2">
          <div />
          {days.map((d) => {
            const f = forecastFor(d, state.stormDays);
            return (
              <div key={d} className="px-1 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fmtDate(d, "EEE")}</p>
                <p className="font-display text-lg font-extrabold leading-tight">{fmtDate(d, "MMM d")}</p>
                <p className={cn("mt-0.5 flex items-center justify-center gap-1 text-xs font-semibold", f.wet ? "text-rain" : "text-sun-ink")}>
                  <WeatherIcon f={f} className="size-3.5" /> {f.rain}%
                </p>
              </div>
            );
          })}

          <div className="relative" style={{ height: HEIGHT }} aria-hidden="true">
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[0.7rem] font-medium text-muted-foreground" style={{ top: (h * 60 - DAY_START_MIN) * PX }}>
                {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const jobs = state.jobs.filter((j) => localDate(j.startMs) === d && ["booked", "confirmed", "completed"].includes(j.status)).sort((a, b) => a.startMs - b.startMs);
            const blocks = routeBlocks(jobs);
            const f = forecastFor(d, state.stormDays);
            return (
              <div key={d} className={cn("relative overflow-hidden rounded-md border", f.wet ? "bg-rain-soft/60" : "bg-card")} style={{ height: HEIGHT }}>
                {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-foreground/[0.07]" style={{ top: (h * 60 - DAY_START_MIN) * PX }} />)}
                {blocks.filter((b) => b.kind !== "job").map((b, i) => (
                  <div
                    key={i}
                    className={cn("absolute inset-x-0.5 rounded-sm", b.kind === "refill" ? "hatch-refill" : "hatch")}
                    style={{ top: (b.startMin - DAY_START_MIN) * PX, height: Math.max((b.endMin - b.startMin) * PX, 4) }}
                    title={b.kind === "refill" ? "Water refill" : b.kind === "load" ? "Load the van" : "Drive"}
                  />
                ))}
                {jobs.map((j) => {
                  const top = (localMinutes(j.startMs) - DAY_START_MIN) * PX;
                  const height = j.durationMin * PX;
                  const outdoor = !["garage", "carport"].includes(j.parking);
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setSelected(selected === j.id ? null : j.id)}
                      aria-pressed={selected === j.id}
                      aria-label={`${j.customer.name}, ${SERVICES[j.service].name}, ${fmtTime(j.startMs)}`}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border-2 px-1.5 py-1 text-left text-xs leading-tight shadow-card transition-colors",
                        j.status === "completed" ? "border-border bg-muted text-muted-foreground" : j.status === "booked" ? "border-dashed border-sun bg-sun-soft text-sun-ink" : "border-primary bg-fern-soft text-fern-ink",
                        selected === j.id && "ring-2 ring-foreground",
                      )}
                      style={{ top, height }}
                    >
                      <span className="block font-bold">{fmtTime(j.startMs)}</span>
                      <span className="block truncate font-semibold">{j.customer.name}</span>
                      <span className="block truncate">{SERVICES[j.service].name}</span>
                      {outdoor && height > 70 && <CloudRain className="mt-0.5 size-3.5 text-rain" aria-label="Outdoors" />}
                    </button>
                  );
                })}
                {!jobs.length && <p className="p-2 text-center text-xs text-muted-foreground">Open</p>}
                {f.wet && jobs.length === 0 && <span className="absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-rain">Rain</span>}
              </div>
            );
          })}
        </div>
      </div>
      <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-2"><span className="size-4 rounded-sm border-2 border-primary bg-fern-soft" /> Confirmed</li>
        <li className="flex items-center gap-2"><span className="size-4 rounded-sm border-2 border-dashed border-sun bg-sun-soft" /> Awaiting confirm</li>
        <li className="flex items-center gap-2"><span className="hatch size-4 rounded-sm" /> Drive or load</li>
        <li className="flex items-center gap-2"><span className="hatch-refill size-4 rounded-sm" /> Water refill</li>
        <li className="flex items-center gap-2"><span className="size-4 rounded-sm bg-rain-soft" /> Rainy day</li>
      </ul>
      {job && <div className="max-w-xl"><JobCard job={job} stormDays={state.stormDays} compact /></div>}
    </section>
  );
}
