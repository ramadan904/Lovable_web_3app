import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RadioTower, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZONES } from "@/lib/business";
import type { State } from "@/lib/model";
import { DAY_RANGE, describeVan, etaFor, vanAt, withDelay } from "@/lib/tracker";
import { atLocal, fmtTime, localDate, localMinutes } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { Legend, VanMap } from "./VanMap";

interface Props {
  state: State;
  date: string;
  now: number;
  /** Customer view: names only this job, and says what it means for them. */
  focusJobId?: string;
}

const STATUS_JOBS = ["booked", "confirmed", "completed"];

/** Live position of the van, with a time scrubber and a "play the day" replay. */
export function Tracker({ state, date, now, focusJobId }: Props) {
  const jobs = useMemo(() => withDelay(state.jobs.filter((j) => localDate(j.startMs) === date && STATUS_JOBS.includes(j.status))), [state.jobs, date]);
  const isToday = localDate(now) === date;
  const nowMin = Math.min(DAY_RANGE.end, Math.max(DAY_RANGE.start - 30, localMinutes(now)));
  const [manual, setManual] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  // Following the clock ("live") is the default on the day itself; otherwise start at 8:00.
  const live = manual === null && isToday;
  const minute = manual ?? (isToday ? nowMin : DAY_RANGE.start);

  // Leaving a day (or changing customer) resets the scrubber.
  useEffect(() => { setManual(null); setPlaying(false); }, [date, focusJobId]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setManual((m) => {
        const next = (m ?? minute) + 4;
        if (next >= DAY_RANGE.end) { setPlaying(false); return DAY_RANGE.end; }
        return next;
      });
    }, 110);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const van = vanAt(jobs, minute);
  const sentence = describeVan(van, (z) => ZONES[z].name);
  const eta = focusJobId ? etaFor(jobs, focusJobId, minute) : null;
  const wet = forecastFor(date, state.stormDays).wet;
  const clock = fmtTime(atLocal(date, minute));

  return (
    <section className="card overflow-hidden" aria-label="Where's Bertha?">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary px-5 py-3 text-primary-foreground">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <RadioTower className="size-5 text-sun" aria-hidden="true" /> Where's Bertha?
        </h3>
        <span className={cn("chip", live ? "border-sun/60 bg-sun text-sun-ink" : "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground")}>
          {live ? "Live" : isToday ? "Replay" : "Preview of the day"} · {clock}
        </span>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {eta ? (
          <div>
            <p className="font-display text-2xl font-extrabold leading-tight" aria-live="polite">{eta.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sentence}.{!isToday && " On the day, this map follows Bertha in real time."}</p>
          </div>
        ) : (
          <p className="font-display text-xl font-bold" aria-live="polite">{sentence}</p>
        )}

        <VanMap jobs={jobs} van={van} minute={minute} rain={wet} focusJobId={focusJobId} label={`Map of Portland. ${sentence}. Clock ${clock}.`} animate={live && !playing} />
        <Legend focus={!!focusJobId} />

        <div className="space-y-3 rounded-md bg-muted/60 p-3">
          <label htmlFor={`scrub-${focusJobId ?? "owner"}`} className="flex items-center justify-between text-sm font-semibold">
            <span>Scrub through the day</span>
            <span className="tabular-nums text-muted-foreground">{clock}</span>
          </label>
          <input
            id={`scrub-${focusJobId ?? "owner"}`}
            type="range"
            min={DAY_RANGE.start - 30}
            max={DAY_RANGE.end}
            step={5}
            value={minute}
            onChange={(e) => { setPlaying(false); setManual(Number(e.target.value)); }}
            className="w-full accent-[hsl(var(--primary))]"
            aria-valuetext={`${clock}. ${sentence}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={playing ? "outline" : "default"} onClick={() => { if (!playing && minute >= DAY_RANGE.end) setManual(DAY_RANGE.start - 30); setPlaying(!playing); }}>
              {playing ? <><Pause /> Pause</> : <><Play /> Play the day</>}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setPlaying(false); setManual(DAY_RANGE.start - 30); }}><RotateCcw /> Start of day</Button>
            {isToday && <Button type="button" size="sm" variant="soft" disabled={live} onClick={() => { setPlaying(false); setManual(null); }}>Back to live</Button>}
          </div>
        </div>
      </div>
    </section>
  );
}
