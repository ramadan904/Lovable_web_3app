import { SERVICES, ZONES } from "@/lib/business";
import type { State } from "@/lib/model";
import { fmtDay, fmtRelative, fmtStamp, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function WaitlistPanel({ state, now }: { state: State; now: number }) {
  const list = [...state.waitlist].sort((a, b) => a.createdAt - b.createdAt);
  return (
    <section aria-label="Waitlist" className="space-y-4">
      <p className="max-w-2xl text-muted-foreground">
        When someone cancels, moves for rain, or never confirms, the freed time goes to the first person here whose job fits (checked against the drive), with two hours to claim it. Nobody phones anybody.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((w) => (
          <li key={w.id} className="card space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{w.name}</p>
              <span className={cn("chip", w.status === "offered" ? "border-sun/50 bg-sun-soft text-sun-ink" : w.status === "booked" ? "border-fern/30 bg-fern-soft text-fern-ink" : "border-border bg-muted")}>
                {w.status === "waiting" ? "Waiting" : w.status === "offered" ? "Offer out" : w.status === "booked" ? "Got a slot" : "Missed the window"}
              </span>
            </div>
            <p className="text-sm">{SERVICES[w.service].name} · <span className="capitalize">{w.vehicle.label}</span> · {ZONES[w.zone].name}</p>
            <p className="text-sm text-muted-foreground">Joined {fmtStamp(w.createdAt)}</p>
            {w.status === "offered" && w.offer && (
              <p className="rounded-md bg-sun-soft px-3 py-2 text-sm text-sun-ink">Offered {fmtDay(w.offer.startMs)} at {fmtTime(w.offer.startMs)} · expires {fmtRelative(now, w.offer.expiresAt)}</p>
            )}
          </li>
        ))}
      </ul>
      {!list.length && <p className="text-muted-foreground">Nobody is waiting.</p>}
    </section>
  );
}
