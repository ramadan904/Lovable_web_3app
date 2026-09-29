import { CloudRain, ShieldCheck, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { PARKING, RAIN_CHECK_H, RAIN_LIMIT, isCovered, type Parking, type ZoneKey } from "@/lib/business";
import { dryOptions } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { fmtDay, fmtDayLong, fmtTime, localDate } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { WeatherChip } from "./Weather";

interface Props {
  parking: Parking;
  /** When known, the card checks the forecast for that day. */
  startMs?: number;
  durationMin?: number;
  zone?: ZoneKey;
  /** An existing booking, so its own slot doesn't count as taken. */
  excludeJobId?: string;
  /** One-tap switch to a dry alternative. */
  onPick?: (startMs: number) => void;
  pickLabel?: string;
  className?: string;
}

/**
 * Says plainly whether this address is weather-sensitive, what the forecast is for the day,
 * and, when heavy rain is forecast for an outdoor car, the next dry times, one tap away.
 */
export function WeatherStatus({ parking, startMs, durationMin, zone, excludeJobId, onPick, pickLabel = "Switch to", className }: Props) {
  const state = useStore();
  const now = useNow();
  const covered = isCovered(parking);

  if (covered) {
    return (
      <section aria-label="Weather status" className={cn("flex gap-3 rounded-lg border border-fern/30 bg-fern-soft p-4 text-fern-ink", className)}>
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Not weather-sensitive</p>
          <p className="text-sm">Your {PARKING[parking].name.toLowerCase()} is covered, so rain never moves this booking. Dario works in it.</p>
        </div>
      </section>
    );
  }

  const f = startMs ? forecastFor(localDate(startMs), state.stormDays) : null;
  const wet = !!f && f.rain >= RAIN_LIMIT;
  const alts =
    wet && startMs && durationMin && zone
      ? dryOptions(state, { id: excludeJobId, startMs, durationMin, zone, parking }, now, 3)
      : [];

  return (
    <section
      aria-label="Weather status"
      className={cn("rounded-lg border p-4", wet ? "border-rain/40 bg-rain-soft text-foreground" : "border-sun/50 bg-sun-soft text-sun-ink", className)}
    >
      <div className="flex gap-3">
        <CloudRain className={cn("mt-0.5 size-5 shrink-0", wet ? "text-rain" : "text-sun-ink")} aria-hidden="true" />
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            Weather-sensitive: {PARKING[parking].name.toLowerCase()} is outdoors
            {f && startMs && <WeatherChip f={f} />}
          </p>
          {!f && (
            <p className="text-sm">
              We watch the forecast for you. {RAIN_CHECK_H} hours before, if heavy rain is expected, you're texted the next dry times and moved free. Pick one, or we take the first.
            </p>
          )}
          {f && !wet && startMs && (
            <p className="text-sm">
              {fmtDayLong(startMs)} looks {f.label.toLowerCase()} ({f.rain}% rain). Nothing to do. We check again {RAIN_CHECK_H} hours before, and if that changes we'll offer dry times automatically.
            </p>
          )}
          {f && wet && startMs && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>Rain is likely on {fmtDay(startMs)} ({f.rain}%).</strong> You can keep this time: if the forecast holds, we'll text you {RAIN_CHECK_H} hours ahead with dry options, and move you automatically if you don't reply. Or choose a dry time now:
              </p>
              {alts.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Dry alternatives">
                  {alts.map((ms) => (
                    <li key={ms}>
                      {onPick ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => onPick(ms)}>
                          {pickLabel} {fmtDay(ms)} · {fmtTime(ms)}
                        </Button>
                      ) : (
                        <span className="chip border-border bg-card text-foreground">{fmtDay(ms)} · {fmtTime(ms)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">No dry slot is open in the next three weeks that fits. You can keep this one, or join the waitlist.</p>
              )}
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Umbrella className="size-4" aria-hidden="true" /> Can't move at all? A rain change can always be cancelled for a full refund.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
