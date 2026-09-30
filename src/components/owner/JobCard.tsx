import { Ban, CloudRain, CreditCard, KeyRound, MapPin, NotebookText, Phone, Umbrella } from "lucide-react";
import { ADDONS, PARKING, SERVICES, ZONES, dollars, hoursLabel, isCovered } from "@/lib/business";
import type { Job } from "@/lib/model";
import { HOUR, fmtDay, fmtTime, localDate } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";

export function StatusChip({ job, className }: { job: Job; className?: string }) {
  const map: Record<string, string> = {
    booked: "border-sun/50 bg-sun-soft text-sun-ink",
    confirmed: "border-fern/30 bg-fern-soft text-fern-ink",
    completed: "border-border bg-muted text-foreground",
    cancelled: "border-border bg-muted text-foreground",
    released: "border-danger/30 bg-danger-soft text-danger",
    no_show: "border-danger/30 bg-danger-soft text-danger",
  };
  const label = { booked: "Awaiting confirm", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled", released: "Released", no_show: "No-show" }[job.status];
  return <span className={cn("chip", map[job.status], className)}>{label}</span>;
}

/** Everything Dario needs at the curb, and nothing he'd have to ask for. */
export function JobCard({ job, stormDays, compact = false }: { job: Job; stormDays: string[]; compact?: boolean }) {
  const covered = isCovered(job.parking);
  const f = forecastFor(localDate(job.startMs), stormDays);
  const end = job.startMs + job.durationMin * 60_000;
  return (
    <article className="card overflow-hidden" aria-label={`${job.customer.name}, ${fmtTime(job.startMs)}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-4 py-2.5">
        <p className="font-display text-lg font-extrabold">
          {fmtTime(job.startMs)} <span className="font-medium text-muted-foreground">to {fmtTime(end)}</span>
          {compact && <span className="ml-2 text-sm font-medium text-muted-foreground">{fmtDay(job.startMs)}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip job={job} />
          {!covered && f.wet && <span className="chip border-rain/30 bg-rain-soft text-rain"><CloudRain className="size-3.5" aria-hidden="true" /> Rain forecast</span>}
        </div>
      </header>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold">{job.customer.name}</h3>
          <p className="font-semibold">{dollars(job.totalCents)}</p>
        </div>
        <p className="text-[0.95rem]">
          <strong>{SERVICES[job.service].name}</strong> · <span className="capitalize">{job.vehicle.label}</span> · {hoursLabel(job.durationMin)}
        </p>
        {job.addons.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Add-ons">
            {job.addons.map((a) => <li key={a} className="chip border-border bg-card text-foreground">{ADDONS[a].name}</li>)}
          </ul>
        )}
        <dl className="grid gap-2 text-sm">
          <div className="flex items-start gap-2"><dt className="sr-only">Address</dt><MapPin className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" />
            <dd><a className="font-semibold underline decoration-fern/30 underline-offset-4 hover:decoration-fern" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.address}, Portland OR ${job.zip}`)}`} target="_blank" rel="noreferrer">{job.address}</a> <span className="text-muted-foreground">({ZONES[job.zone].name})</span></dd></div>
          <div className="flex items-start gap-2"><dt className="sr-only">Parking</dt>{covered ? <Umbrella className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" /> : <CloudRain className="mt-0.5 size-4 shrink-0 text-rain" aria-hidden="true" />}
            <dd>{PARKING[job.parking].name} <span className="text-muted-foreground">· {covered ? "not weather-sensitive" : "weather-sensitive, watched for you"}</span></dd></div>
          <div className="flex items-start gap-2"><dt className="sr-only">Payment</dt><CreditCard className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" />
            <dd>
              {job.depositCents === 0 ? "Care plan: no deposit" : `${dollars(job.depositCents)} deposit ${job.depositState === "refunded" ? "refunded" : job.depositState === "kept" ? "kept" : "paid"}`}
              <span className="text-muted-foreground"> · {dollars(Math.max(0, job.totalCents - job.depositCents))} due on the day{job.discountCents > 0 ? `, incl. ${dollars(job.discountCents)} neighbour deal` : ""}</span>
            </dd></div>
          {job.access.gateCode && (
            <div className="flex items-start gap-2"><dt className="sr-only">Gate code</dt><KeyRound className="mt-0.5 size-4 shrink-0 text-sun-ink" aria-hidden="true" />
              <dd><span className="rounded bg-sun-soft px-2 py-0.5 font-mono text-[0.95rem] font-bold text-sun-ink">{job.access.gateCode}</span></dd></div>
          )}
          {job.access.notes && <div className="flex items-start gap-2"><dt className="sr-only">Notes</dt><NotebookText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dd>{job.access.notes}</dd></div>}
          <div className="flex items-start gap-2"><dt className="sr-only">Phone</dt><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dd><a className="underline underline-offset-4" href={`tel:${job.customer.phone.replace(/\D/g, "")}`}>{job.customer.phone}</a></dd></div>
        </dl>
        {(job.status === "booked") && <p className="rounded-md bg-sun-soft px-3 py-2 text-sm text-sun-ink">If they haven't confirmed by {fmtTime(job.startMs - 3 * HOUR)}, the slot goes to the waitlist automatically.</p>}
        {job.rainOffer && <p className="rounded-md bg-rain-soft px-3 py-2 text-sm text-rain">Rain offer sent. Options are waiting on the customer; the first is taken automatically if they don't pick.</p>}
        {(job.dealMin ?? 0) > 0 && <p className="rounded-md bg-fern-soft px-3 py-2 text-sm text-fern-ink">Neighbour deal: right next to another {ZONES[job.zone].name} job, so about {job.dealMin} min less driving. The customer paid {dollars(job.discountCents)} less.</p>}
        {job.delayMin > 0 && <p className="rounded-md bg-sun-soft px-3 py-2 text-sm text-sun-ink">Running about {job.delayMin} min behind: the customer was told, and expects you around {fmtTime(job.startMs + job.delayMin * 60_000)}.</p>}
        {job.plan && <p className="rounded-md bg-fern-soft px-3 py-2 text-sm text-fern-ink">Care plan: every {job.plan.everyWeeks} weeks{job.source === "plan" ? ", booked automatically after their last visit, 10% off, no deposit" : ". The next visit is booked automatically when this one is done"}.</p>}
        {job.movedFrom.length > 0 && <p className="text-sm text-muted-foreground">Moved from {fmtDay(job.movedFrom[job.movedFrom.length - 1])} by the customer. You did nothing.</p>}
        {job.status === "cancelled" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Ban className="size-4" aria-hidden="true" />{job.closedReason}</p>}
      </div>
    </article>
  );
}
