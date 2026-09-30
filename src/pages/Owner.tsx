import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, Clock, MessageSquareText, Repeat, Route, Send, Timer, Wallet } from "lucide-react";
import { DaySheet } from "@/components/owner/DaySheet";
import { JustBooked } from "@/components/owner/JustBooked";
import { NeedsYou } from "@/components/owner/NeedsYou";
import { WaitlistCard } from "@/components/owner/WaitlistCard";
import { WeatherMoves } from "@/components/owner/WeatherMoves";
import { Inquiries } from "@/components/owner/Inquiries";
import { MessagesLog } from "@/components/owner/MessagesLog";
import { WaitlistPanel } from "@/components/owner/WaitlistPanel";
import { WeekView } from "@/components/owner/WeekView";
import { Van } from "@/components/Van";
import { useNow } from "@/hooks/useNow";
import { BUSINESS, OPEN_WEEKDAYS } from "@/lib/business";
import { activeJobs } from "@/lib/engine";
import { MINUTES_SAVED, ledgerFor } from "@/lib/ledger";
import { useStore } from "@/lib/store";
import { addDays, fmtDate, fmtTime, localDate, localMinutes, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "day", label: "Day sheet" },
  { key: "week", label: "Week" },
  { key: "messages", label: "Messages sent" },
  { key: "inquiries", label: "Inquiries" },
  { key: "waitlist", label: "Waitlist" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

export default function Owner() {
  const state = useStore();
  const now = useNow();
  const today = localDate(now);
  const [tab, setTab] = useState<Tab>("day");
  const [day, setDay] = useState<string | null>(null);
  const [how, setHow] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const jobDays = useMemo(() => {
    const set = new Set(activeJobs(state).concat(state.jobs.filter((j) => j.status === "completed")).map((j) => localDate(j.startMs)));
    const out: string[] = [];
    for (let i = -2; i <= 9; i++) {
      const d = addDays(today, i);
      if (OPEN_WEEKDAYS.includes(weekdayOf(d)) && (set.has(d) || i >= 0)) out.push(d);
    }
    return out;
  }, [state, today]);

  // Default: today if a job is still to come, otherwise the next day with work.
  const defaultDay = useMemo(() => {
    const upcoming = activeJobs(state).filter((j) => j.startMs > now).sort((a, b) => a.startMs - b.startMs)[0];
    return upcoming ? localDate(upcoming.startMs) : today;
  }, [state, now, today]);
  const selectedDay = day ?? defaultDay;

  const ledger = ledgerFor(state, now);
  const flagged = activeJobs(state).filter((j) => j.ownerFlag);
  const asks = state.inquiries.filter((q) => q.status === "needs_owner");
  const needs = flagged.length + asks.length;
  const hour = localMinutes(now) / 60;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nextJob = activeJobs(state).filter((j) => j.startMs > now).sort((a, b) => a.startMs - b.startMs)[0];

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : null;
    if (to === null) return;
    e.preventDefault();
    setTab(TABS[to].key);
    tabRefs.current[TABS[to].key]?.focus();
  };

  return (
    <div className="container py-8 md:py-12">
      <header className="mb-8 grid items-center gap-6 md:grid-cols-[1fr_16rem]">
        <div>
          <p className="eyebrow">Owner view · {BUSINESS.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-5xl">{greeting}, {BUSINESS.ownerFirst}.</h1>
          <p className="mt-3 max-w-2xl text-lg text-foreground/85">
            {needs === 0 ? (
              <>Nothing needs you right now. {nextJob ? <>Next up: <strong>{nextJob.customer.name}</strong>, {fmtDate(localDate(nextJob.startMs), "EEEE")} at {fmtTime(nextJob.startMs)}.</> : "The calendar is quiet."}</>
            ) : (
              <><strong>{needs} {needs === 1 ? "thing needs" : "things need"} you.</strong> Everything else was handled while you were working.</>
            )}
          </p>
        </div>
        <Van className="hidden md:block" raining={state.stormDays.length > 0} />
      </header>

      <NeedsYou state={state} />
      <JustBooked state={state} now={now} />

      <section aria-labelledby="handled-h" className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="handled-h" className="text-2xl font-extrabold">Handled for you this week</h2>
            <p className="text-muted-foreground">The last 7 days, counted exactly. Work that used to be Dario's evenings.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-fern underline underline-offset-4" aria-expanded={how} onClick={() => setHow(!how)}>
            How we count <ChevronDown className={cn("size-4 transition-transform", how && "rotate-180")} aria-hidden="true" />
          </button>
        </div>
        {how && (
          <div className="mb-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Messages, bookings and money are exact counts from the log. Hours saved multiplies them by conservative minutes of Dario's time per action:</p>
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <li>{MINUTES_SAVED.message} min per message sent for him</li>
              <li>{MINUTES_SAVED.booking} min per booking taken with no call</li>
              <li>{MINUTES_SAVED.inquiry} min per inquiry answered</li>
              <li>{MINUTES_SAVED.move} min per time change handled</li>
              <li>{MINUTES_SAVED.rain} min per rain reschedule</li>
              <li>{MINUTES_SAVED.backfill} min per gap refilled from the waitlist</li>
              <li>{MINUTES_SAVED.draft} min per drafted reply he only had to send</li>
            </ul>
          </div>
        )}

        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Headline accent icon={<MessageSquareText className="size-5" />} label="Messages you didn't have to write" value={String(ledger.messages)}
            sub={`texts and emails sent in your name, plus ${ledger.inquiries} inquiries answered in seconds`} />
          <Headline icon={<Timer className="size-5" />} label="Hours saved" value={hm(ledger.minutes)} sub="of admin you didn't do (estimate, see how we count)" />
          <Headline icon={<Repeat className="size-5" />} label="No-shows recovered" value={`${ledger.backfilled} ${ledger.backfilled === 1 ? "slot" : "slots"}`}
            sub={`$${Math.round(ledger.recoveredCents / 100).toLocaleString()} rescued from the waitlist · ${ledger.released} released, ${ledger.confirmed} confirmed with one tap`} />
          <Headline icon={<Wallet className="size-5" />} label="Revenue this week" value={`$${Math.round(ledger.revenueCents / 100).toLocaleString()}`}
            sub={`earned across ${ledger.jobsDone} finished jobs · $${Math.round(ledger.aheadCents / 100).toLocaleString()} booked over the next 7 days (${ledger.aheadJobs} jobs)`} />
        </dl>

        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={<CheckCircle2 className="size-5" />} value={String(ledger.bookings)} label="bookings taken with no back-and-forth" />
          <Tile icon={<Repeat className="size-5" />} value={String(ledger.rainMoves + ledger.moves)} label={`reschedules handled (${ledger.rainMoves} for rain, ${ledger.moves} by customers)`} />
          <Tile icon={<Clock className="size-5" />} value={String(ledger.inquiries)} label="inquiries answered in seconds" />
          <Tile icon={<CheckCircle2 className="size-5" />} value={String(ledger.confirmed)} label="one-tap confirmations collected" />
          <Tile icon={<Route className="size-5" />} value={hm(ledger.driveSavedMin)} label={`less driving from neighbour deals (customers saved $${Math.round(ledger.dealCents / 100)})`} />
          <Tile icon={<Send className="size-5" />} value={String(ledger.ownerReplies)} label="drafted replies you sent with one tap" />
          <Tile icon={<Repeat className="size-5" />} value={String(ledger.onPlan)} label={`regulars on a care plan · ${ledger.repeatBooked} repeat ${ledger.repeatBooked === 1 ? "visit" : "visits"} booked this week ($${Math.round(ledger.repeatCents / 100)})`} />
          <Tile icon={<Clock className="size-5" />} value={String(ledger.delaysReported)} label="times one tap told everyone you were running late" />
        </dl>
      </section>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <WeatherMoves state={state} now={now} />
        <WaitlistCard state={state} now={now} />
      </div>

      <div role="tablist" aria-label="Owner sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => { tabRefs.current[t.key] = el; }}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn("-mb-px whitespace-nowrap border-b-4 px-4 py-3 text-[0.95rem] font-bold transition-colors", tab === t.key ? "border-sun text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.key === "messages" && <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">{state.messages.filter((m) => m.at <= now && m.direction === "out").length}</span>}
            {t.key === "waitlist" && <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">{state.waitlist.filter((w) => w.status === "waiting" || w.status === "offered").length}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus-visible:outline-offset-8">
        {tab === "day" && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Pick a day">
              {jobDays.map((d) => (
                <button key={d} type="button" aria-pressed={selectedDay === d} onClick={() => setDay(d)}
                  className={cn("min-w-20 rounded-lg border px-3 py-2 text-center", selectedDay === d ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/50")}>
                  <span className="block text-xs font-semibold uppercase opacity-80">{d === today ? "Today" : fmtDate(d, "EEE")}</span>
                  <span className="block font-display text-lg font-extrabold leading-tight">{fmtDate(d, "MMM d")}</span>
                </button>
              ))}
            </div>
            <DaySheet state={state} date={selectedDay} now={now} />
          </div>
        )}
        {tab === "week" && <WeekView state={state} from={addDays(today, -1)} />}
        {tab === "messages" && <MessagesLog state={state} now={now} />}
        {tab === "inquiries" && <Inquiries state={state} now={now} />}
        {tab === "waitlist" && <WaitlistPanel state={state} now={now} />}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Want to see the customer's side? <Link to="/book" className="font-semibold text-fern underline underline-offset-4">Book a detail</Link>. Then come back and watch it appear here.
      </p>
    </div>
  );
}

function Tile({ icon, value, label, accent = false }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) {
  return (
    <div className={cn("card flex flex-col p-4", accent && "border-primary bg-primary text-primary-foreground")}>
      <div className={cn("mb-2", accent ? "text-sun" : "text-fern")} aria-hidden="true">{icon}</div>
      <dt className={cn("order-2 mt-1.5 text-sm", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{label}</dt>
      <dd className="order-1 font-display text-3xl font-extrabold leading-none">{value}</dd>
    </div>
  );
}

function Headline({ icon, value, label, sub, accent = false }: { icon: React.ReactNode; value: string; label: string; sub: string; accent?: boolean }) {
  return (
    <div className={cn("card flex flex-col p-5", accent && "iris-border text-primary-foreground")} style={accent ? ({ "--iris-fill": "hsl(var(--primary))" } as React.CSSProperties) : undefined}>
      <div className={cn("mb-2", accent ? "text-sun" : "text-fern")} aria-hidden="true">{icon}</div>
      <dt className={cn("order-1 text-sm font-semibold", accent ? "text-primary-foreground" : "text-foreground")}>{label}</dt>
      <dd className="order-2 mt-1 font-display text-4xl font-extrabold leading-none">{value}</dd>
      <dd className={cn("order-3 mt-2 text-sm", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{sub}</dd>
    </div>
  );
}
