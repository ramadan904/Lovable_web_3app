import { CalendarCheck, CloudRain, CreditCard, Droplets, Route, Umbrella } from "lucide-react";
import { MAX_JOBS_PER_DAY, SERVICES, ZONES, dollars, isCovered } from "@/lib/business";
import { activeJobs, routeBlocks } from "@/lib/engine";
import type { Job, State } from "@/lib/model";
import { HOUR, fmtDay, fmtTime, localDate, localMinutes } from "@/lib/time";
import { forecastFor } from "@/lib/weather";

const hm = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${min < 720 ? "AM" : "PM"}`;

function when(now: number, createdAt: number) {
  const min = Math.max(0, Math.round((now - createdAt) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

/** What the calendar had to satisfy to take this booking, worked out from the same route as the day sheet. */
function constraintsFor(state: State, job: Job) {
  const date = localDate(job.startMs);
  const day = activeJobs(state).filter((j) => localDate(j.startMs) === date).sort((a, b) => a.startMs - b.startMs);
  const index = day.findIndex((j) => j.id === job.id);
  const blocks = routeBlocks(day);
  const drive = blocks.find((b) => b.kind === "drive" && b.index === index);
  const refill = blocks.some((b) => b.kind === "refill" && b.index === index);
  const prev = index > 0 ? day[index - 1] : null;
  const rain = forecastFor(date, state.stormDays).rain;
  return { number: index + 1, count: day.length, drive: drive ? drive.endMin - drive.startMin : 0, refill, prev, rain };
}

/** New bookings, each already checked against the limits: the owner sees the outcome, not a to-do. */
export function JustBooked({ state, now }: { state: State; now: number }) {
  const recent = state.jobs
    .filter((j) => (j.source === "web" || j.source === "inquiry") && ["booked", "confirmed"].includes(j.status) && now - j.createdAt < 36 * HOUR && j.createdAt <= now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  if (!recent.length) return null;
  return (
    <section aria-labelledby="just-h" className="mb-8 rounded-lg border border-fern/30 bg-fern-soft/60 p-5">
      <h2 id="just-h" className="flex items-center gap-2 text-lg font-bold text-fern-ink"><CalendarCheck className="size-5" aria-hidden="true" /> Just booked ({recent.length})</h2>
      <p className="mt-1 text-sm text-fern-ink/90">Nothing to do. Each one already passed your limits, and the confirmation, prep note and reminders are queued.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recent.map((j) => {
          const c = constraintsFor(state, j);
          const covered = isCovered(j.parking);
          return (
            <li key={j.id} className="space-y-2 rounded-md bg-card p-4 text-sm">
              <p><strong>{j.customer.name}</strong> booked {SERVICES[j.service].name} <span className="text-muted-foreground">· {when(now, j.createdAt)}</span></p>
              <p className="font-semibold">{fmtDay(j.startMs)} at {fmtTime(j.startMs)} <span className="font-normal text-muted-foreground">({ZONES[j.zone].name})</span></p>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex items-start gap-2"><Route className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" />
                  <span>Job {c.number} of {MAX_JOBS_PER_DAY} that day. {c.prev ? `Drive ${c.drive} min from your ${ZONES[c.prev.zone].name} job (done ${hm(localMinutes(c.prev.startMs) + c.prev.durationMin)}).` : `First stop: loads the van, then ${c.drive} min to get there.`}</span></li>
                {c.refill && <li className="flex items-start gap-2"><Droplets className="mt-0.5 size-4 shrink-0 text-rain" aria-hidden="true" /><span>Water refill fits in before this one.</span></li>}
                <li className="flex items-start gap-2"><CreditCard className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" />
                  <span>{j.depositCents === 0 ? "Care plan: no deposit." : `${dollars(j.depositCents)} deposit paid.`} {dollars(Math.max(0, j.totalCents - j.depositCents))} due on the day.</span></li>
                <li className="flex items-start gap-2">{covered ? <Umbrella className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" /> : <CloudRain className="mt-0.5 size-4 shrink-0 text-rain" aria-hidden="true" />}
                  <span>{covered ? "Covered: rain can't move it." : `${c.rain}% chance of rain. Outdoors, so it's watched and moved for free if it turns wet.`}</span></li>
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
