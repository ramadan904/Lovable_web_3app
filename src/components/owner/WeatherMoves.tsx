import { CloudRain, CloudSun } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { WeatherIcon } from "@/components/Weather";
import { RAIN_LIMIT, isCovered } from "@/lib/business";
import { ACTIVE, type State } from "@/lib/model";
import { DAY, addDays, fmtDate, fmtDay, fmtRelative, fmtStamp, localDate } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";

/** What the weather did to this week, and what it's about to do. All of it handled without Dario. */
export function WeatherMoves({ state, now }: { state: State; now: number }) {
  const since = now - 7 * DAY;
  const moves = state.events.filter((e) => e.kind === "rain_moved" && e.at >= since && e.at <= now).sort((a, b) => b.at - a.at);
  const auto = moves.filter((e) => /no reply/.test(e.text)).length;
  const waiting = state.jobs.filter((j) => ACTIVE.includes(j.status) && j.rainOffer);
  const today = localDate(now);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
    const f = forecastFor(d, state.stormDays);
    const atRisk = state.jobs.filter((j) => ACTIVE.includes(j.status) && localDate(j.startMs) === d && !isCovered(j.parking) && f.rain >= RAIN_LIMIT).length;
    return { d, f, atRisk };
  });
  const risky = week.reduce((n, w) => n + w.atRisk, 0);

  return (
    <section aria-labelledby="weather-h" className="card p-5">
      <h2 id="weather-h" className="flex items-center gap-2 text-xl font-extrabold"><CloudRain className="size-5 text-rain" aria-hidden="true" /> Weather moves this week</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {moves.length} moved for rain{moves.length ? ` (${auto} automatically, ${moves.length - auto} by the customer)` : ""} · {waiting.length} waiting on a reply · {risky} outdoor {risky === 1 ? "job" : "jobs"} at risk in the next 7 days
      </p>

      <ul className="mt-4 grid grid-cols-7 gap-1 text-center" aria-label="Seven-day forecast with outdoor jobs at risk">
        {week.map(({ d, f, atRisk }) => (
          <li key={d} className={cn("rounded-md px-1 py-2", f.wet ? "bg-rain-soft text-rain" : "bg-sun-soft/60 text-sun-ink")}>
            <p className="text-[0.7rem] font-semibold uppercase">{fmtDate(d, "EEE")}</p>
            <WeatherIcon f={f} className="mx-auto my-1 size-4" />
            <p className="text-xs font-bold">{f.rain}%</p>
            <p className="mt-0.5 text-[0.65rem] font-semibold leading-tight">{atRisk ? `${atRisk} at risk` : f.wet ? "none out" : "clear"}</p>
          </li>
        ))}
      </ul>

      {waiting.length > 0 && (
        <div className="mt-4">
          <h3 className="eyebrow mb-2">Offers out</h3>
          <ul className="space-y-2">
            {waiting.map((j) => (
              <li key={j.id} className="rounded-md bg-rain-soft px-3 py-2 text-sm text-rain">
                <strong>{j.customer.name}</strong> was offered dry times for {fmtDay(j.startMs)}. Takes the first option {fmtRelative(now, j.rainOffer!.autoAt)} if no reply.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h3 className="eyebrow mb-2">Moved</h3>
        {moves.length ? (
          <ul className="space-y-2">
            {moves.map((e) => (
              <li key={e.id} className="text-sm"><span className="text-muted-foreground">{fmtStamp(e.at)}</span> · {e.text.replace(/^Rain: /, "")}</li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CloudSun} title="No weather moves this week">
            When heavy rain is forecast for an outdoor job, Fernhill offers the customer dry times {`48`} hours ahead and lists every move here. Try <strong>Storm hits the busiest outdoor day</strong> in the demo controls.
          </EmptyState>
        )}
      </div>
    </section>
  );
}
