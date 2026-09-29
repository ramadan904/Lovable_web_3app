import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarPlus, Check, CheckCircle2, CloudRain, MapPin, MessageSquare, Umbrella } from "lucide-react";
import { toast } from "sonner";
import { PhoneThread } from "@/components/PhoneThread";
import { SlotPicker } from "@/components/SlotPicker";
import { Tracker } from "@/components/Tracker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/useNow";
import { timelineFor } from "@/lib/automations";
import { ADDONS, BUSINESS, FREE_CHANGE_H, PARKING, SERVICES, ZONES, dollars, hoursLabel, isCovered } from "@/lib/business";
import { CAN_DOWNLOAD, downloadIcs } from "@/lib/ics";
import { ACTIVE, BookingError } from "@/lib/model";
import { getJob } from "@/lib/ops";
import { actions, useStore } from "@/lib/store";
import { HOUR, localDate, fmtDayLong, fmtRelative, fmtStamp, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: string }> = {
  booked: { label: "Booked", tone: "border-sun/50 bg-sun-soft text-sun-ink" },
  confirmed: { label: "Confirmed", tone: "border-fern/30 bg-fern-soft text-fern-ink" },
  completed: { label: "Done", tone: "border-border bg-muted text-foreground" },
  cancelled: { label: "Cancelled", tone: "border-border bg-muted text-foreground" },
  released: { label: "Released", tone: "border-danger/30 bg-danger-soft text-danger" },
  no_show: { label: "No-show", tone: "border-danger/30 bg-danger-soft text-danger" },
};

export default function Manage() {
  const { code = "" } = useParams();
  const [sp] = useSearchParams();
  const isNew = sp.get("new") === "1";
  const state = useStore();
  const now = useNow();
  const job = getJob(state, code);
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const messages = useMemo(() => state.messages.filter((m) => m.jobId === job?.id).sort((a, b) => a.at - b.at), [state.messages, job?.id]);

  if (!job) {
    return (
      <div className="container max-w-xl py-20 text-center">
        <h1 className="text-3xl font-extrabold">We can't find that booking</h1>
        <p className="mt-3 text-muted-foreground">Check the link in your text or email. If you've reset the demo, earlier bookings are gone.</p>
        <Button asChild className="mt-6"><Link to="/book">Book a detail</Link></Button>
      </div>
    );
  }

  const active = ACTIVE.includes(job.status);
  const until = job.startMs - now;
  const free = until >= FREE_CHANGE_H * HOUR;
  const covered = isCovered(job.parking);
  const reminderSent = messages.some((m) => m.kind === "reminder");
  const st = STATUS[job.status];
  const guard = (fn: () => void, ok: string) => {
    try { fn(); toast.success(ok); } catch (e) { if (e instanceof BookingError) toast.error(e.message); else throw e; }
  };

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      {isNew && active && (
        <div className="mb-8 overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-lift animate-rise-in">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-sun"><CheckCircle2 className="size-5" aria-hidden="true" /> You're booked</p>
              <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{fmtDayLong(job.startMs)} at {fmtTime(job.startMs)}</h1>
              <p className="mt-2 max-w-xl text-primary-foreground/85">{BUSINESS.ownerFirst} and {BUSINESS.van} will be at {job.address}. Nothing else to do: we'll text you a prep note, then a one-tap confirm the day before.</p>
            </div>
            {CAN_DOWNLOAD && <Button variant="sun" size="lg" onClick={() => downloadIcs(job)}><CalendarPlus /> Add to calendar</Button>}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Booking {job.code}</p>
          {(!isNew || !active) && <h1 className="mt-1 text-3xl font-extrabold">{SERVICES[job.service].name}, {fmtDayLong(job.startMs)}</h1>}
          {isNew && active && <h2 className="mt-1 text-2xl font-extrabold">{SERVICES[job.service].name} for {job.customer.name.split(" ")[0]}</h2>}
        </div>
        <span className={cn("chip text-sm", st.tone)}>{st.label}</span>
      </div>

      {/* Things that need one tap from the customer ------------------------------ */}
      {active && job.rainOffer && (
        <section aria-labelledby="rain-h" className="mb-6 rounded-lg border border-rain/30 bg-rain-soft p-5 md:p-6">
          <h2 id="rain-h" className="flex items-center gap-2 text-xl font-bold text-rain"><CloudRain className="size-5" aria-hidden="true" /> Rain is forecast for your day</h2>
          <p className="mt-1 text-foreground/85">Your car is outdoors, so we won't wash it in a downpour. Pick a dry time, free to move. If you don't pick, we'll take the first one {fmtRelative(now, job.rainOffer.autoAt)}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {job.rainOffer.options.map((ms, i) => (
              <Button key={ms} variant={i === 0 ? "default" : "outline"} onClick={() => guard(() => actions.chooseRain(job.id, i), "Moved to a dry day")}>
                {fmtDayLong(ms)}, {fmtTime(ms)}
              </Button>
            ))}
          </div>
        </section>
      )}
      {active && job.status === "booked" && reminderSent && (
        <section aria-labelledby="confirm-h" className="mb-6 rounded-lg border border-sun/50 bg-sun-soft p-5 md:p-6">
          <h2 id="confirm-h" className="text-xl font-bold text-sun-ink">Are we still on for {fmtTime(job.startMs)}?</h2>
          <p className="mt-1 text-sun-ink/90">Tap to confirm. If we don't hear back by {fmtTime(job.startMs - 3 * HOUR)}, we release the slot to the waitlist.</p>
          <Button className="mt-4" onClick={() => guard(() => actions.confirm(job.id), "Confirmed. See you then!")}><Check /> Yes, I'll be there</Button>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="card p-5 md:p-6" aria-labelledby="details-h">
            <h2 id="details-h" className="text-xl font-bold">The details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="eyebrow">When</dt><dd className="font-semibold">{fmtDayLong(job.startMs)}, {fmtTime(job.startMs)} · about {hoursLabel(job.durationMin)}</dd></div>
              <div><dt className="eyebrow">Vehicle</dt><dd className="font-semibold capitalize">{job.vehicle.label}</dd></div>
              <div><dt className="eyebrow">Where</dt><dd className="flex items-start gap-1.5 font-semibold"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{job.address} ({ZONES[job.zone].name})</dd></div>
              <div><dt className="eyebrow">Parking</dt><dd className="flex items-start gap-1.5 font-semibold">{covered ? <Umbrella className="mt-0.5 size-4 shrink-0 text-fern" aria-hidden="true" /> : <CloudRain className="mt-0.5 size-4 shrink-0 text-rain" aria-hidden="true" />}{PARKING[job.parking].name}</dd></div>
              <div><dt className="eyebrow">Includes</dt><dd>{[SERVICES[job.service].name, ...job.addons.map((a) => ADDONS[a].name)].join(", ")}</dd></div>
              <div><dt className="eyebrow">Total</dt><dd className="font-semibold">{dollars(job.totalCents)} {job.discountCents > 0 && <span className="chip ml-1 border-sun/50 bg-sun-soft text-sun-ink">−{dollars(job.discountCents)} neighbour deal</span>} <span className="font-normal text-muted-foreground">({dollars(job.depositCents)} deposit {job.depositState === "refunded" ? "refunded" : job.depositState === "kept" ? "kept" : job.depositState === "applied" ? "applied" : "paid"})</span></dd></div>
            </dl>
            {active && CAN_DOWNLOAD && <Button variant="outline" size="sm" className="mt-5" onClick={() => downloadIcs(job)}><CalendarPlus /> Add to calendar</Button>}
          </section>

          {active && <Tracker state={state} date={localDate(job.startMs)} now={now} focusJobId={job.id} />}

          {active && <AccessCard key={job.id} id={job.id} gate={job.access.gateCode} notes={job.access.notes} />}

          {active && (
            <section className="card p-5 md:p-6" aria-labelledby="change-h">
              <h2 id="change-h" className="text-xl font-bold">Need to change something?</h2>
              {free ? (
                <p className="mt-1 text-sm text-muted-foreground">Free until {fmtStamp(job.startMs - FREE_CHANGE_H * HOUR)}. No calls, no forms: your reminders move with you.</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Changes are free up to {FREE_CHANGE_H} hours ahead. {BUSINESS.ownerFirst} is already planning your day, so for anything now please call {BUSINESS.phone}. Cancelling now keeps the deposit.</p>
              )}
              {free && !moving && !cancelling && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setMoving(true)}>Move to another time</Button>
                  <Button variant="danger" onClick={() => setCancelling(true)}>Cancel</Button>
                </div>
              )}
              {moving && (
                <div className="mt-5 space-y-5">
                  <SlotPicker durationMin={job.durationMin} zone={job.zone} parking={job.parking} now={now} value={target} onChange={setTarget} excludeJobId={job.id} />
                  <div className="flex gap-2">
                    <Button disabled={!target} onClick={() => guard(() => { actions.move(job.id, target!); setMoving(false); setTarget(null); }, "Moved. Your reminders moved too.")}>
                      {target ? `Move to ${fmtDayLong(target)}, ${fmtTime(target)}` : "Pick a new time"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setMoving(false); setTarget(null); }}>Never mind</Button>
                  </div>
                </div>
              )}
              {cancelling && (
                <div className="mt-5 space-y-3 rounded-md border border-danger/30 bg-danger-soft p-4">
                  <p className="font-semibold text-danger">Cancel this booking? Your {dollars(job.depositCents)} deposit is refunded.</p>
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={() => guard(() => { actions.cancel(job.id); setCancelling(false); }, "Cancelled. Deposit refunded.")}>Yes, cancel</Button>
                    <Button variant="ghost" onClick={() => setCancelling(false)}>Keep it</Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {active && (
            <section className="card p-5" aria-labelledby="next-h">
              <h2 id="next-h" className="text-lg font-bold">What we do for you</h2>
              <p className="mb-3 text-sm text-muted-foreground">Nobody has to remember any of this.</p>
              <ol className="space-y-3">
                {timelineFor(state, job, now).map((t) => (
                  <li key={t.kind} className="flex gap-3 text-sm">
                    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem]", t.state === "sent" ? "border-primary bg-primary text-primary-foreground" : t.state === "skipped" ? "border-border bg-muted text-muted-foreground" : "border-input bg-card")} aria-hidden="true">
                      {t.state === "sent" ? <Check className="size-3" /> : ""}
                    </span>
                    <span>
                      <span className="font-semibold">{t.label}</span>
                      <span className="block text-muted-foreground">{fmtStamp(t.at)}{t.state === "sent" ? " · sent" : t.state === "skipped" ? " · not needed" : ""}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      <section className="mt-8" aria-labelledby="msgs-h">
        <h2 id="msgs-h" className="mb-1 flex items-center gap-2 text-xl font-bold"><MessageSquare className="size-5 text-fern" aria-hidden="true" /> Your messages from Fernhill</h2>
        <p className="mb-4 text-sm text-muted-foreground">In production these arrive as texts and emails. Here they show up as they're "sent".</p>
        <PhoneThread messages={messages} />
      </section>
    </div>
  );
}

function AccessCard({ id, gate, notes }: { id: string; gate: string; notes: string }) {
  const [g, setG] = useState(gate);
  const [n, setN] = useState(notes);
  const dirty = g !== gate || n !== notes;
  return (
    <section className="card p-5 md:p-6" aria-labelledby="access-h">
      <h2 id="access-h" className="text-xl font-bold">Gate codes and notes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Change them any time; {BUSINESS.ownerFirst} sees the latest on his sheet the morning of. No texting him a code at 7 am.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="g2">Gate or door code</Label><Input id="g2" value={g} onChange={(e) => setG(e.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="n2">Notes</Label><Textarea id="n2" className="min-h-12" rows={2} value={n} onChange={(e) => setN(e.target.value)} /></div>
      </div>
      <Button className="mt-4" variant="soft" size="sm" disabled={!dirty} onClick={() => { actions.updateAccess(id, g, n); toast.success("Saved. Dario will see it on his sheet."); }}>Save</Button>
    </section>
  );
}
