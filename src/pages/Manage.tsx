import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarPlus, Check, CheckCircle2, Clock4, CloudRain, Copy, MapPin, MessageSquare, Repeat, Umbrella } from "lucide-react";
import { toast } from "sonner";
import { PhoneThread } from "@/components/PhoneThread";
import { SlotPicker } from "@/components/SlotPicker";
import { Tracker } from "@/components/Tracker";
import { WeatherStatus } from "@/components/WeatherStatus";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/useNow";
import { timelineFor } from "@/lib/automations";
import { ADDONS, BUSINESS, FREE_CHANGE_H, PARKING, PLAN_DISCOUNT, RAIN_CHECK_H, SERVICES, ZONES, dollars, hoursLabel, isCovered, needsDryDay } from "@/lib/business";
import { CAN_DOWNLOAD, downloadIcs } from "@/lib/ics";
import { dryOptions } from "@/lib/engine";
import { ACTIVE, BookingError } from "@/lib/model";
import { getJob } from "@/lib/ops";
import { actions, useStore } from "@/lib/store";
import { HOUR, MIN, localDate, fmtDay, fmtDayLong, fmtRelative, fmtStamp, fmtTime } from "@/lib/time";
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
  const changeRef = useRef<HTMLElement>(null);
  const nowMinute = Math.floor(now / MIN);
  const freeNow = !!job && job.startMs - now >= FREE_CHANGE_H * HOUR;
  // One-tap alternatives: the nearest dry times for an outdoor car, the nearest open times for a covered one.
  const alternatives = useMemo(
    () => (job && freeNow && ACTIVE.includes(job.status) ? dryOptions(state, job, now, 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, job?.id, job?.startMs, freeNow, nowMinute],
  );

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
  const refundable = free || job.rainAffected;
  const end = job.startMs + job.durationMin * MIN;
  const tl = timelineFor(state, job, now);
  const at = (k: string) => tl.find((t) => t.kind === k);
  // Always three steps, in order. If a step's time has already passed at booking, say where it went instead of dropping it.
  const nextSteps = [
    at("prep")
      ? { title: "Prep note", text: `${fmtStamp(at("prep")!.at)}: what to clear out, and any gate code changes`, done: at("prep")!.state === "sent" }
      : { title: "Prep note", text: "is in your confirmation (you booked inside 48 hours): clear out personal items and trash", done: true },
    at("reminder")
      ? { title: "One-tap confirm", text: `${fmtStamp(at("reminder")!.at)}: tap Confirm and you're set`, done: at("reminder")!.state === "sent" }
      : { title: "One-tap confirm", text: "isn't needed: you booked inside 24 hours, so you're already confirmed", done: true },
    { title: "On-the-way text", text: `${fmtStamp(job.startMs - 30 * MIN)}: with a live map of Bertha`, done: at("omw")?.state === "sent" },
    ...(job.plan ? [{ title: "Care plan", text: `once this visit is done, your next one (every ${job.plan.everyWeeks} weeks) is booked automatically, 10% off, no deposit`, done: false }] : []),
    { title: "Rain watch", text: covered ? "Your car is covered, so weather never moves you." : `${RAIN_CHECK_H} hours before, if heavy rain is forecast, you're offered dry times and moved free.`, done: false },
  ];
  const openChange = (mode: "move" | "cancel") => {
    if (mode === "move" && free) { setMoving(true); setCancelling(false); }
    if (mode === "cancel" && refundable) { setCancelling(true); setMoving(false); }
    window.setTimeout(() => changeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const copyCode = () => {
    navigator.clipboard?.writeText(job.code).then(
      () => toast.success("Booking code copied"),
      () => toast(`Your booking code is ${job.code}`),
    );
  };
  const guard = (fn: () => void, ok: string) => {
    try { fn(); toast.success(ok); } catch (e) { if (e instanceof BookingError) toast.error(e.message); else throw e; }
  };

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      {isNew && active && (
        <div className="mb-8 overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-lift animate-rise-in">
          <div className="iris-bar h-1.5" aria-hidden="true" />
          <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-sun"><CheckCircle2 className="size-5" aria-hidden="true" /> You're booked</p>
                <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{fmtDayLong(job.startMs)} at {fmtTime(job.startMs)}</h1>
                <p className="mt-2 max-w-xl text-primary-foreground/85">
                  {BUSINESS.ownerFirst} and {BUSINESS.van} will be at {job.address}, arriving around {fmtTime(job.startMs)} and finished by about {fmtTime(end)}. Nothing else to do.
                </p>
              </div>
              <div className="iris-border rounded-md px-5 py-3 text-center" style={{ "--iris-fill": "hsl(var(--primary))" } as React.CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/75">Booking code</p>
                <p className="font-display text-3xl font-extrabold tracking-wider">{job.code}</p>
                <button type="button" onClick={copyCode} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground underline underline-offset-4">
                  <Copy className="size-3.5" aria-hidden="true" /> Copy code
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {CAN_DOWNLOAD && <Button variant="sun" onClick={() => downloadIcs(job)}><CalendarPlus /> Add to calendar</Button>}
              <Button variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => openChange("move")}>Reschedule</Button>
              <Button variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => openChange("cancel")}>Cancel</Button>
            </div>

            <section aria-label="What happens next" className="rounded-md bg-primary-foreground/10 p-4">
              <h2 className="mb-3 font-display text-lg font-bold">What happens next</h2>
              <ol className="space-y-2.5 text-sm">
                {nextSteps.map((n) => (
                  <li key={n.title} className="flex gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sun text-[0.65rem] font-bold text-sun-ink" aria-hidden="true">{n.done ? "✓" : "•"}</span>
                    <span><strong>{n.title}</strong> <span className="text-primary-foreground/80">{n.text}</span></span>
                  </li>
                ))}
              </ol>
            </section>
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

      {active && job.delayMin > 0 && (
        <section role="status" aria-label="Running late" className="mb-6 flex gap-3 rounded-lg border border-sun/50 bg-sun-soft p-4 text-sun-ink">
          <Clock4 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">{BUSINESS.van} is running about {job.delayMin} min behind today</p>
            <p className="text-sm">{BUSINESS.ownerFirst} will get to you around <strong>{fmtTime(job.startMs + job.delayMin * MIN)}</strong> instead of {fmtTime(job.startMs)}. Nothing to do: you'll get a text when he's on the way, and the map below shows him live.</p>
          </div>
        </section>
      )}
      {active && !job.rainOffer && (
        <WeatherStatus
          className="mb-6"
          parking={job.parking} startMs={job.startMs} durationMin={job.durationMin} zone={job.zone} excludeJobId={job.id}
          onPick={free ? (ms) => guard(() => actions.move(job.id, ms), "Moved to a dry day") : undefined}
          pickLabel="Move to"
        />
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
              <div><dt className="eyebrow">Total</dt><dd className="font-semibold">{dollars(job.totalCents)} {job.discountCents > 0 && <span className="chip ml-1 border-sun/50 bg-sun-soft text-sun-ink">−{dollars(job.discountCents)} neighbour deal</span>} <span className="font-normal text-muted-foreground">({job.depositCents === 0 ? "care plan: no deposit" : `${dollars(job.depositCents)} deposit ${job.depositState === "refunded" ? "refunded" : job.depositState === "kept" ? "kept" : job.depositState === "applied" ? "applied" : "paid"}`})</span></dd></div>
            </dl>
            {active && CAN_DOWNLOAD && <Button variant="outline" size="sm" className="mt-5" onClick={() => downloadIcs(job)}><CalendarPlus /> Add to calendar</Button>}
          </section>

          {active && <Tracker state={state} date={localDate(job.startMs)} now={now} focusJobId={job.id} />}

          {active && job.plan && (
            <section className="card p-5 md:p-6" aria-labelledby="plan-h">
              <h2 id="plan-h" className="flex items-center gap-2 text-xl font-bold"><Repeat className="size-5 text-fern" aria-hidden="true" /> Your care plan: every {job.plan.everyWeeks} weeks</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {Math.round(PLAN_DISCOUNT * 100)}% off every visit, and no deposit after the first. When each visit is done, the next one is booked for you automatically: the same weekday and time if it's free, otherwise the nearest slot. {job.source === "plan" ? "This visit was booked for you automatically." : "The next visit will be booked when this one is done."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.source === "plan" && free && <Button variant="outline" onClick={() => guard(() => actions.skipPlanVisit(job.id), "Skipped. Your plan carries on from the next visit.")}>Skip this visit</Button>}
                <Button variant="ghost" onClick={() => guard(() => actions.endCarePlan(job.id), "Plan ended. This visit stays; no more are booked after it.")}>End my plan</Button>
              </div>
            </section>
          )}

          {active && <AccessCard key={job.id} id={job.id} gate={job.access.gateCode} notes={job.access.notes} />}

          {active && (
            <section ref={changeRef} id="change" tabIndex={-1} className="card p-5 focus:outline-none md:p-6" aria-labelledby="change-h">
              <h2 id="change-h" className="text-xl font-bold">Reschedule or cancel</h2>
              {free ? (
                <p className="mt-1 text-sm text-muted-foreground">Free until {fmtStamp(job.startMs - FREE_CHANGE_H * HOUR)}. No calls, no forms: your reminders move with you.</p>
              ) : job.rainAffected ? (
                <p className="mt-1 text-sm text-muted-foreground">Rain has changed this booking, so you can cancel at any time for a full refund of your {dollars(job.depositCents)}. To pick a different time, use the dry options above or call {BUSINESS.phone}.</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Changes are free up to {FREE_CHANGE_H} hours ahead. {BUSINESS.ownerFirst} is already planning your day, so for anything now please call {BUSINESS.phone}. Cancelling now keeps the deposit.</p>
              )}

              {free && !moving && !cancelling && alternatives.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">{covered ? "Nearest open times, one tap:" : "Nearest dry times, one tap:"}</p>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="One-tap alternatives">
                    {alternatives.map((ms) => (
                      <li key={ms}><Button size="sm" variant="soft" onClick={() => guard(() => actions.move(job.id, ms), "Moved. Your reminders moved too.")}>{fmtDay(ms)} · {fmtTime(ms)}</Button></li>
                    ))}
                  </ul>
                </div>
              )}

              {!moving && !cancelling && (free || job.rainAffected) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {free && <Button variant="outline" onClick={() => setMoving(true)}>Pick another time</Button>}
                  <Button variant="danger" onClick={() => setCancelling(true)}>{free ? "Cancel" : "Cancel for a full refund"}</Button>
                </div>
              )}
              {moving && (
                <div className="mt-5 space-y-5">
                  <SlotPicker durationMin={job.durationMin} zone={job.zone} parking={job.parking} now={now} value={target} onChange={setTarget} excludeJobId={job.id} needsDry={needsDryDay(job.addons, job.parking)} />
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
                  <p className="font-semibold text-danger">Cancel this booking? Your {dollars(job.depositCents)} deposit is refunded{job.rainAffected && !free ? " in full, because rain changed your booking" : ""}.</p>
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
