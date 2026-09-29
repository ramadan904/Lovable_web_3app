import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CloudRain, MapPin, Send, Sparkles, Truck, Umbrella } from "lucide-react";
import { Van } from "@/components/Van";
import { WeatherIcon } from "@/components/Weather";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useNow } from "@/hooks/useNow";
import { BUSINESS, DEPOSIT_CENTS, MAX_JOBS_PER_DAY, REFILL_MIN, dollars, quote } from "@/lib/business";
import { slotsByDay } from "@/lib/engine";
import { bookingLink, parseInquiry } from "@/lib/inquiry";
import type { Inquiry } from "@/lib/model";
import { actions, useStore } from "@/lib/store";
import { addDays, fmtDate, fmtDay, fmtTime, localDate } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { EXAMPLES } from "@/components/owner/Inquiries";

export default function Index() {
  const state = useStore();
  const now = useNow();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Inquiry | null>(null);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setAnswer(actions.inquire("Website visitor", text.trim()));
  };
  const parsed = useMemo(() => (answer ? parseInquiry(answer.text, answer.at) : null), [answer]);

  // Real availability, straight from the same engine the booking uses.
  const openNow = useMemo(() => {
    const q = quote("suv", "full", [], "NE");
    return slotsByDay(state, q.durationMin, "NE", now)
      .filter((d) => d.slots.length && !d.forecast.wet)
      .slice(0, 3)
      .map((d) => d.slots[0]);
  }, [state, now]);

  const week = useMemo(() => {
    const today = localDate(now);
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, [now]);

  return (
    <>
      {/* Hero ------------------------------------------------------------------ */}
      <section className="border-b bg-gradient-to-b from-fern-soft/70 to-background">
        <div className="container grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise-in">
            <p className="chip border-primary/30 bg-card text-primary"><MapPin className="size-3.5" aria-hidden="true" /> {BUSINESS.city} · we come to you</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              A clean car in your driveway. <span className="text-fern">Booked before you finish this sentence.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-foreground/85">
              {BUSINESS.owner} runs Fernhill from one van, {BUSINESS.van}. He can't answer texts while he's under a dashboard, so you never have to wait for one: ask below and get real prices, real times and rain handled.
            </p>

            <form onSubmit={ask} className="mt-7 max-w-xl space-y-3 rounded-lg border bg-card p-4 shadow-lift">
              <label htmlFor="ask" className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-sun-ink" aria-hidden="true" /> Ask the way you'd text a friend</label>
              <Textarea id="ask" rows={2} value={text} onChange={(e) => { setText(e.target.value); setAnswer(null); }} placeholder="My dog wrecked my Outback. I'm in Sellwood. Friday morning?" />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={!text.trim()}><Send /> Get real times</Button>
                <Button asChild variant="ghost"><Link to="/book">Or pick everything myself <ArrowRight /></Link></Button>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="Try an example">
                {EXAMPLES.slice(0, 3).map((ex) => (
                  <button key={ex} type="button" onClick={() => { setText(ex); setAnswer(null); }} className="max-w-full truncate rounded-full border bg-background px-3 py-1 text-left text-xs font-medium hover:border-foreground/50">{ex}</button>
                ))}
              </div>
            </form>

            {answer && parsed && (
              <div className="mt-4 max-w-xl space-y-3 animate-rise-in" role="status" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fernhill replied instantly</p>
                <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-fern-soft px-4 py-3 text-fern-ink">{answer.reply.replace(/ fernhill\.app\S*/g, "").replace(/: ?$/, ".")}</p>
                {answer.status !== "needs_owner" && (
                  <div className="flex flex-wrap gap-2">
                    {answer.suggested.map((ms) => (
                      <Button key={ms} asChild variant="sun" size="sm"><Link to={bookingLink({ ...parsed, startMs: ms })}>{fmtDay(ms)} · {fmtTime(ms)}</Link></Button>
                    ))}
                    <Button asChild variant="outline" size="sm"><Link to={bookingLink(parsed)}>{answer.suggested.length ? "See all times" : "Continue"}</Link></Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="animate-rise-in [animation-delay:120ms]">
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-b from-rain-soft to-card px-6 pt-6">
                <Van />
              </div>
              <div className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Next dry openings</h2>
                  <span className="text-xs font-medium text-muted-foreground">Full Refresh · SUV · NE Portland</span>
                </div>
                {openNow.length ? (
                  <ul className="grid gap-2">
                    {openNow.map((ms) => (
                      <li key={ms}>
                        <Link to={bookingLink({ vehicle: "suv", service: "full", zone: "NE", zip: "97212", startMs: ms })} className="flex items-center justify-between rounded-md border bg-background px-4 py-3 font-semibold hover:border-foreground/60">
                          <span>{fmtDay(ms)} at {fmtTime(ms)}</span>
                          <ArrowRight className="size-4 text-fern" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground">Dry days are filling up. Join the waitlist on the booking page.</p>}
                <p className="text-sm text-muted-foreground">Live from Dario's calendar. Drive time between jobs is already counted.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works ---------------------------------------------------------- */}
      <section className="container py-16" aria-labelledby="how-h">
        <h2 id="how-h" className="max-w-2xl text-3xl font-extrabold md:text-4xl">From “can you do my car?” to “you’re booked” in one sitting</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: "Say what you drive, where it is", d: "Or just text it in your own words. We work out the size, the service, the add-ons and the neighborhood, then price and time it.", icon: <Truck className="size-5" /> },
            { n: 2, t: "Pick a time that's really free", d: "Only slots Dario can actually reach appear. Drive time, water refills and his daily limit are already in the maths.", icon: <CalendarCheck className="size-5" /> },
            { n: 3, t: "Done. Nobody has to text you", d: `A ${dollars(DEPOSIT_CENTS)} deposit holds it. Prep note, confirm-tap, rain check and on-the-way text all happen on their own.`, icon: <Sparkles className="size-5" /> },
          ].map((s) => (
            <li key={s.n} className="card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-fern-soft text-fern-ink" aria-hidden="true">{s.icon}</span>
              <h3 className="mt-4 text-xl font-bold"><span className="text-muted-foreground">{s.n}.</span> {s.t}</h3>
              <p className="mt-2 text-foreground/80">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Rain ------------------------------------------------------------------ */}
      <section className="border-y bg-rain-soft/60" aria-labelledby="rain-h">
        <div className="container grid gap-10 py-16 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow !text-rain">The Portland problem</p>
            <h2 id="rain-h" className="mt-1 text-3xl font-extrabold md:text-4xl">It rains here. We plan for it.</h2>
            <p className="mt-4 text-lg text-foreground/85">
              Washing a car outdoors in a downpour is a bad job for everyone. So if your car is outside and heavy rain is forecast two days before, we text you the nearest dry times and move you free. Pick one, or we take the first.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex gap-3"><Umbrella className="mt-1 size-5 shrink-0 text-fern" aria-hidden="true" /><span><strong>Garage or carport?</strong> Rain never touches your booking.</span></li>
              <li className="flex gap-3"><CloudRain className="mt-1 size-5 shrink-0 text-rain" aria-hidden="true" /><span><strong>Driveway or street?</strong> We watch the forecast so you don't have to.</span></li>
            </ul>
          </div>
          <div className="card p-5" aria-label="Seven-day forecast">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">The week ahead, as the booking page sees it</p>
            <ul className="grid grid-cols-7 gap-1.5 text-center">
              {week.map((d) => {
                const f = forecastFor(d, state.stormDays);
                return (
                  <li key={d} className={cn("rounded-md px-1 py-3", f.wet ? "bg-rain-soft text-rain" : "bg-sun-soft/60 text-sun-ink")}>
                    <p className="text-xs font-semibold uppercase">{fmtDate(d, "EEE")}</p>
                    <WeatherIcon f={f} className="mx-auto my-1.5 size-5" />
                    <p className="text-sm font-bold">{f.rain}%</p>
                    <p className="sr-only">{f.label}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">Illustrative forecast for the demo. In production this reads a real weather API.</p>
          </div>
        </div>
      </section>

      {/* Before / after -------------------------------------------------------- */}
      <section className="container py-16" aria-labelledby="ba-h">
        <p className="eyebrow">Same customer. Same Thursday.</p>
        <h2 id="ba-h" className="mt-1 max-w-3xl text-3xl font-extrabold md:text-4xl">Before: nine messages and a no-show. After: none from Dario.</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3 p-6">
            <h3 className="flex items-center justify-between text-lg font-bold">Before <span className="chip border-danger/30 bg-danger-soft text-danger">9 messages · 2 days</span></h3>
            <ul className="space-y-2 text-[0.9375rem]" aria-label="A typical booking thread">
              {[
                ["in", "hi do you do subarus? how much?"],
                ["out", "Yes! Depends what you need. Inside, outside, both?"],
                ["in", "both, dog hair everywhere lol"],
                ["out", "OK ~$250. Where are you?"],
                ["in", "sellwood"],
                ["out", "I have Friday 2pm or Sat 9?"],
                ["in", "friday morning? or next week"],
                ["out", "Friday's out. Tue 10?"],
                ["in", "ok 👍"],
              ].map(([d, t], i) => (
                <li key={i} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2", d === "out" ? "rounded-tl-md bg-muted" : "ml-auto rounded-tr-md bg-primary/90 text-primary-foreground")}>{t}</li>
              ))}
            </ul>
            <p className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger">Then, Tuesday: heavy rain, no reply to the reminder, and a two-hour hole in Dario's day.</p>
          </div>
          <div className="card space-y-3 p-6">
            <h3 className="flex items-center justify-between text-lg font-bold">Now <span className="chip border-fern/30 bg-fern-soft text-fern-ink">0 messages from Dario</span></h3>
            <ol className="space-y-3 text-[0.9375rem]">
              {[
                ["10:02 pm", "She writes once, in her own words. Fernhill replies in seconds with a price, a duration and three real times."],
                ["10:03 pm", "She taps a time, adds her gate code, pays the deposit. Booked."],
                ["Sun", "Prep note goes out by itself. Forecast: heavy rain Tuesday."],
                ["Mon 9 am", "Her car's in the driveway, so she gets three dry options. She taps Wednesday. Reminders follow."],
                ["Tue", "Her old Tuesday slot goes to the first person on the waitlist whose job fits. Nobody phoned anyone."],
                ["Wed", "One-tap confirm. Dario arrives, the gate code is on his sheet. Two hours later: care tips and a rebook link."],
              ].map(([when, what]) => (
                <li key={when} className="grid grid-cols-[5rem_1fr] gap-3"><span className="font-display font-bold text-fern">{when}</span><span>{what}</span></li>
              ))}
            </ol>
            <Button asChild className="mt-2"><Link to="/owner">See Dario's side <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>

      {/* Quirks ---------------------------------------------------------------- */}
      <section className="border-t bg-card" aria-labelledby="rules-h">
        <div className="container py-16">
          <h2 id="rules-h" className="max-w-2xl text-3xl font-extrabold md:text-4xl">One van. One Dario. Rules the calendar actually keeps.</h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">These are the quirks of a real one-person detailing business, and they're enforced by the booking engine, not left to memory.</p>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Three jobs a day, at most", `Then Bertha and Dario are done. The calendar never offers a fourth.`],
              ["The tank holds two jobs", `Before a third job there's a ${REFILL_MIN}-minute refill stop, and it's on the clock.`],
              ["Drive time is work time", "Portland to Beaverton is 35 minutes. Slots reflect it, so he's never late."],
              ["Vehicle size sets the time", "A pet-hair SUV takes twice as long as a sedan wash. Duration and price follow the car."],
              ["High no-show risk", `A ${dollars(DEPOSIT_CENTS)} deposit, a one-tap confirm the day before, and unconfirmed slots go to the waitlist ${3} hours ahead.`],
              ["Gates, codes and tricky parking", "Customers add them once. They land on Dario's morning sheet, not in his texts."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border bg-background p-5">
                <dt className="font-display text-lg font-bold">{t}</dt>
                <dd className="mt-1 text-foreground/80">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">Max {MAX_JOBS_PER_DAY} jobs a day · Tue to Sat · Portland, Beaverton and Tigard.</p>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold md:text-4xl">Book it in a minute. Dario won't even know until Tuesday.</h2>
            <p className="mt-2 text-primary-foreground/80">Or open his console and watch what happens when it rains.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="sun" size="lg"><Link to="/book"><CalendarCheck /> Book a detail</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><Link to="/owner">Owner view</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
