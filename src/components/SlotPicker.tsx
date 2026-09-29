import { useEffect, useMemo, useState } from "react";
import { CloudRain, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZONES, dollars, isCovered, type Parking, type ZoneKey } from "@/lib/business";
import { neighbourDeal, slotsByDay } from "@/lib/engine";
import { localMinutes, fmtDate, fmtTime } from "@/lib/time";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
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
export function SlotPicker({ durationMin, zone, parking, now, value, onChange, excludeJobId, showDeals = false, needsDry = false, dryDefault = false, preferDate = null, whenEmpty }: Props) {
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
  const withSlots = days.filter((d) => d.slots.length);
  const bestDry = withSlots.find((d) => covered || !d.forecast.wet);

  const dateOfValue = value ? days.find((d) => d.slots.includes(value))?.date : undefined;
  const [picked, setPicked] = useState<string | null>(dateOfValue ?? null);
  const wished = preferDate ? withSlots.find((d) => d.date === preferDate) : undefined;
  const selected = days.find((d) => d.date === (picked ?? dateOfValue)) ?? wished ?? bestDry ?? withSlots[0];

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

  const morning = selected?.slots.filter((ms) => localMinutes(ms) < 12 * 60) ?? [];
  const afternoon = selected?.slots.filter((ms) => localMinutes(ms) >= 12 * 60) ?? [];
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
          <span><strong>Show dry days only.</strong> <span className="text-muted-foreground">Your car is outdoors, so we hide days forecast for heavy rain.</span></span>
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
                <span className="text-[0.7rem] font-medium opacity-80">{disabled ? (d.reason === "wet" ? (needsDry ? "Needs dry" : "Rain") : "Full") : `${d.slots.length} ${d.slots.length === 1 ? "time" : "times"}`}</span>
                {!disabled && d.slots.some((ms) => dealOf(ms)) && (
                  <span className={cn("mt-0.5 rounded-full px-1.5 py-px text-[0.65rem] font-bold", active ? "bg-sun text-sun-ink" : "bg-sun-soft text-sun-ink")}>Deals</span>
                )}
                <span className="sr-only">{dry ? "Dry" : "Rain likely"}</span>
              </button>
            );
          })}
        </div>
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
          {[["Morning", morning], ["Afternoon", afternoon]].map(([label, slots]) =>
            (slots as number[]).length ? (
              <fieldset key={label as string}>
                <legend className="eyebrow mb-2">{label as string}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {(slots as number[]).map((ms) => (
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
                  ))}
                </div>
              </fieldset>
            ) : null,
          )}
          <p className="text-sm text-muted-foreground">
            Times are Portland time. Each time already includes Dario's drive from his previous job, so when it says 9:00, he's at your door at 9:00.
          </p>
        </div>
      )}
    </div>
  );
}
