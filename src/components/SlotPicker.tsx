import { useEffect, useMemo, useState } from "react";
import { CloudRain, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_JOBS_PER_DAY, ZONES, dollars, isCovered, type Parking, type ZoneKey } from "@/lib/business";
import { activeJobs, explainDay, neighbourDeal, slotsByDay, type TimeVerdict, type WhyNot } from "@/lib/engine";
import { localDate, localMinutes, fmtDate, fmtDay, fmtTime } from "@/lib/time";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DayFit } from "./DayFit";
import { WeatherChip, WeatherIcon } from "./Weather";

interface Props {
  durationMin: number;
  zone: ZoneKey;
  parking: Parking;
  now: number;
  value: number | null;
  onChange: (startMs: number) => void;
  excludeJobId?: string;
  /** Sealant outdoors: only dry days will do, so wet days show nothing. */
  needsDry?: boolean;
  /** Start with "dry days only" on (an outdoor car that came in through the natural-language box). */
  dryDefault?: boolean;
  /** The day the customer asked for, if it has times: opened first. */
  preferDate?: string | null;
  /** Show neighbour deals: only when booking new (a move keeps the deal it was booked with). */
  showDeals?: boolean;
  /** Rendered when nothing is open, so the caller can offer the waitlist. */
  whenEmpty?: React.ReactNode;
}

/** Real availability only: every time listed here passed the same rules the server enforces. */
export function SlotPicker({ durationMin, zone, parking, now, value, onChange, excludeJobId, showDeals = false, needsDry = false, dryDefault = true, preferDate = null, whenEmpty }: Props) {
  const state = useStore();
  const covered = isCovered(parking);
  const minute = Math.floor(now / 60_000);
  // Dry-days-only is for outdoor cars; a covered car is never moved by rain, so it never needs the filter.
  const [dryOnly, setDryOnly] = useState(dryDefault && !covered);
  const dryFilter = dryOnly && !covered;
  const days = useMemo(
    () => slotsByDay(state, durationMin, zone, now, excludeJobId, { needsDry, dryOnly: dryFilter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, durationMin, zone, minute, excludeJobId, needsDry, dryFilter],
  );
  const dealOf = (ms: number) => (showDeals ? neighbourDeal(state, { startMs: ms, durationMin, zone }, excludeJobId) : null);
  const jobsOn = (date: string) => activeJobs(state).filter((j) => localDate(j.startMs) === date && j.id !== excludeJobId).length;
  const withSlots = days.filter((d) => d.slots.length);
  const bestDry = withSlots.find((d) => covered || !d.forecast.wet);

  const dateOfValue = value ? days.find((d) => d.slots.includes(value))?.date : undefined;
  const [picked, setPicked] = useState<string | null>(dateOfValue ?? null);
  const wished = preferDate ? withSlots.find((d) => d.date === preferDate) : undefined;
  // Open on a dry day with real choice (three or more times) rather than one with a single gap left.
  const roomy = withSlots.find((d) => (covered || !d.forecast.wet) && d.slots.length >= 3);
  const selected = days.find((d) => d.date === (picked ?? dateOfValue)) ?? wished ?? roomy ?? bestDry ?? withSlots[0];

  // The customer asked for a particular day and it has nothing open: say so, instead of silently showing another.
  const wishedDay = preferDate ? days.find((d) => d.date === preferDate) : undefined;
  const wishMissed = !!preferDate && !picked && !value && !wished && !!selected && !!wishedDay;
  const wishReason = wishedDay?.reason === "wet" ? "is forecast wet" : "is fully booked";

  useEffect(() => {
    if (picked && !days.find((d) => d.date === picked)?.slots.length) setPicked(null);
  }, [days, picked]);

  if (!withSlots.length) {
    const wetOnly = (needsDry || dryFilter) && days.some((d) => d.reason === "wet");
    return (
      <div className="rounded-lg border border-dashed bg-muted/50 p-6 text-center">
        <p className="font-display text-lg font-bold">{wetOnly ? "No dry day with a free slot in the next three weeks" : "Nothing open in the next three weeks"}</p>
        <p className="mx-auto mt-1 max-w-md text-muted-foreground">
          {wetOnly
            ? needsDry
              ? "Ceramic spray sealant needs a dry day to cure outdoors. Choose a covered spot, or take the sealant off, and more days open up. Or join the waitlist."
              : "Every open day in the next three weeks is forecast wet, and your car is outdoors. Show the wet days and pick one (we'll offer dry options 48 hours ahead), or join the waitlist."
            : "Dario is one person with one van, and this stretch is full. Join the waitlist and you'll be texted the moment a slot frees up."}
        </p>
        {dryFilter && !needsDry && <Button type="button" variant="outline" className="mt-4" onClick={() => setDryOnly(false)}>Show wet days too</Button>}
        {whenEmpty}
      </div>
    );
  }

  // Every time on the day, bookable or refused with its reason: the rules, made visible.
  const verdicts: TimeVerdict[] = selected ? explainDay(state, durationMin, zone, selected.date, now, excludeJobId) : [];
  const morning = verdicts.filter((v) => localMinutes(v.startMs) < 12 * 60);
  const afternoon = verdicts.filter((v) => localMinutes(v.startMs) >= 12 * 60);
  const WHY_LABEL: Record<WhyNot, string> = { booked: "Booked", drive: "Drive time", limit: `${MAX_JOBS_PER_DAY} of ${MAX_JOBS_PER_DAY}`, early: "Van loading" };
  const reasonsShown = (Object.keys(WHY_LABEL) as WhyNot[]).map((w) => verdicts.find((v) => v.why === w)).filter((v): v is TimeVerdict => !!v);
  const wetPick = !!selected && selected.forecast.wet && !covered;

  return (
    <div className="space-y-5">
      {needsDry && (
        <p role="note" className="flex gap-2 rounded-md border border-rain/30 bg-rain-soft p-3 text-sm text-rain">
          <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span><strong>Ceramic spray sealant needs about four dry hours to cure.</strong> Outdoors, that means we can only offer dry days, so wet days are greyed out. In a garage or carport, any day works.</span>
        </p>
      )}
      {!covered && !needsDry && (
        <label className="flex cursor-pointer items-center gap-3 rounded-md border bg-card px-4 py-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sun">
          <input type="checkbox" checked={dryOnly} onChange={(e) => setDryOnly(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
          <span><strong>Dry days only.</strong> <span className="text-muted-foreground">Your car is outdoors, so days forecast for heavy rain are blocked. Untick to see them anyway.</span></span>
        </label>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Pick a day</legend>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-3">
          {days.filter((d) => d.open).map((d) => {
            const disabled = !d.slots.length;
            const active = selected?.date === d.date;
            const dry = !d.forecast.wet;
            return (
              <button
                key={d.date}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => setPicked(d.date)}
                className={cn(
                  "relative flex min-w-[5.75rem] snap-start flex-col items-center gap-0.5 rounded-lg border bg-card px-3 py-2.5 text-center transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground shadow-card" : "hover:border-foreground/50",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {bestDry?.date === d.date && !active && (
                  <span className="absolute -top-2.5 rounded-full bg-sun px-2 py-px text-[0.65rem] font-bold uppercase tracking-wide text-sun-ink">{covered ? "Soonest" : "Best dry day"}</span>
                )}
                <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{fmtDate(d.date, "EEE")}</span>
                <span className="font-display text-xl font-extrabold leading-none">{fmtDate(d.date, "d")}</span>
                <span className="text-xs opacity-80">{fmtDate(d.date, "MMM")}</span>
                <span className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", active ? "text-primary-foreground" : d.forecast.wet ? "text-rain" : "text-sun-ink")}>
                  <WeatherIcon f={d.forecast} className={cn("size-3.5", active && "!text-primary-foreground")} />
                  {d.forecast.rain}%
                </span>
                <span className="text-[0.7rem] font-medium opacity-80">{disabled ? (d.reason === "wet" ? (needsDry ? "Needs dry" : "Rain") : jobsOn(d.date) >= MAX_JOBS_PER_DAY ? `Full · ${MAX_JOBS_PER_DAY} of ${MAX_JOBS_PER_DAY}` : "Full") : `${d.slots.length} ${d.slots.length === 1 ? "time" : "times"}`}</span>
                {!disabled && d.slots.some((ms) => dealOf(ms)) && (
                  <span className={cn("mt-0.5 rounded-full px-1.5 py-px text-[0.65rem] font-bold", active ? "bg-sun text-sun-ink" : "bg-sun-soft text-sun-ink")}>Deals</span>
                )}
                <span className="sr-only">{dry ? "Dry" : "Rain likely"}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Full</strong> means Dario already has {MAX_JOBS_PER_DAY} jobs that day (his limit: one van, one water tank), or no gap is left once the drive between jobs is counted.
        </p>
      </fieldset>

      {selected && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold">{fmtDate(selected.date, "EEEE, MMMM d")}</h3>
            <WeatherChip f={selected.forecast} />
            {covered && <span className="chip border-fern/30 bg-fern-soft text-fern-ink"><Umbrella className="size-3.5" aria-hidden="true" /> Covered: rain can't move you</span>}
          </div>
          {wishMissed && (
            <p role="note" className="rounded-md border border-sun/50 bg-sun-soft p-3 text-sm text-sun-ink">
              <strong>{fmtDate(preferDate!, "EEEE, MMMM d")}</strong> {wishReason}, so we opened the next day with room: {fmtDate(selected!.date, "EEEE, MMMM d")}. Pick any day above.
            </p>
          )}
          {wetPick && (
            <p role="note" className="flex gap-2 rounded-md border border-rain/30 bg-rain-soft p-3 text-sm text-rain">
              <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Rain is likely this day and your car will be outdoors. You can still book it: if the forecast holds, we'll text you two days ahead with dry times and move you for free.{bestDry && !bestDry.forecast.wet ? ` The best dry day is ${fmtDate(bestDry.date, "EEEE")}.` : ""}</span>
            </p>
          )}
          {showDeals && selected.slots.some((ms) => dealOf(ms)) && (
            <p role="note" className="rounded-md border border-sun/50 bg-sun-soft p-3 text-sm text-sun-ink">
              <strong>Neighbour deal.</strong> Dario is already in {ZONES[zone].name} this day. The times marked with a discount sit right next to that job, so he makes one trip instead of two. Every minute he doesn't drive is 50¢ off your bill.
            </p>
          )}
          {[["Morning", morning], ["Afternoon", afternoon]].map(([label, list]) =>
            (list as TimeVerdict[]).length ? (
              <fieldset key={label as string}>
                <legend className="eyebrow mb-2">{label as string}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {(list as TimeVerdict[]).map((v) => {
                    const ms = v.startMs;
                    if (v.why) {
                      return (
                        <span
                          key={ms}
                          role="img"
                          aria-label={`${fmtTime(ms)}, not available: ${WHY_LABEL[v.why]}. ${v.detail}`}
                          title={v.detail ?? undefined}
                          className="flex h-12 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-[0.95rem] font-medium leading-tight text-muted-foreground"
                        >
                          <span className="line-through decoration-muted-foreground/60" aria-hidden="true">{fmtTime(ms)}</span>
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wide" aria-hidden="true">{WHY_LABEL[v.why]}</span>
                        </span>
                      );
                    }
                    return (
                      <button
                        key={ms}
                        type="button"
                        aria-pressed={value === ms}
                        onClick={() => onChange(ms)}
                        aria-label={dealOf(ms) ? `${fmtTime(ms)}, neighbour deal, ${dollars(dealOf(ms)!.discountCents)} off` : undefined}
                        className={cn(
                          "flex h-12 flex-col items-center justify-center rounded-md border bg-card text-[0.95rem] font-semibold leading-tight transition-colors",
                          value === ms ? "border-primary bg-primary text-primary-foreground shadow-card" : "hover:border-foreground/60 hover:bg-muted",
                        )}
                      >
                        {fmtTime(ms)}
                        {dealOf(ms) && <span className={cn("text-[0.7rem] font-bold", value === ms ? "text-sun" : "text-fern")}>−{dollars(dealOf(ms)!.discountCents)}</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null,
          )}
          {reasonsShown.length > 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-foreground/85">
              <p className="font-semibold">Why some times are crossed out</p>
              <ul className="mt-1.5 space-y-1">
                {reasonsShown.map((v) => (
                  <li key={v.why!}><strong>{WHY_LABEL[v.why!]}:</strong> {v.detail}</li>
                ))}
              </ul>
            </div>
          )}
          {value && selected.slots.includes(value) && (
            <p role="status" className={cn("flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold", selected.forecast.wet && !covered ? "border-rain/30 bg-rain-soft text-rain" : "border-fern/30 bg-fern-soft text-fern-ink")}>
              <WeatherIcon f={selected.forecast} className="size-4" />
              You picked {fmtDay(value)} at {fmtTime(value)}: {selected.forecast.rain}% chance of rain{covered ? ", and your car is covered, so rain can't touch it." : selected.forecast.wet ? ". We'll re-check 48 hours ahead and offer dry times if it holds." : ": a dry day."}
            </p>
          )}
          <DayFit
            jobs={activeJobs(state).filter((j) => localDate(j.startMs) === selected.date && j.id !== excludeJobId)}
            candidate={value && selected.slots.includes(value) ? { startMs: value, durationMin, zone } : null}
          />
          <p className="text-sm text-muted-foreground">
            Times are Portland time. Each time already includes Dario's drive from his previous job, so when it says 9:00, he's at your door at 9:00.
          </p>
        </div>
      )}
    </div>
  );
}
