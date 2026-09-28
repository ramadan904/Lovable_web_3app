import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/brand/PageShell";
import { GuideMark } from "@/components/brand/GuideMark";
import { Doorway } from "@/components/threshold/Doorway";
import { Reveal } from "@/components/threshold/Reveal";
import { SealedEnvelope } from "@/components/threshold/SealedEnvelope";
import { SpanDiagram } from "@/components/threshold/SpanDiagram";
import { Button } from "@/components/ui/button";
import { useGuides, useThresholds } from "@/hooks/useCatalogue";
import { hasRitualInProgress, STEPS } from "@/hooks/useRitual";
import { PRESENCE, SEED_THRESHOLDS } from "@/lib/data/seed";
import { ROMAN } from "@/lib/utils";

const MOMENTS = [
  "finalizing a divorce after nineteen years",
  "the week before surgery",
  "the last day of a thirty-year career",
  "the house after the youngest leaves",
  "the first month home from prison",
  "the appointment where they say 'months'",
  "choosing to stop IVF",
  "the day 'temporary' becomes 'permanent'",
  "signing your new name for the first time",
];

const RITUAL_LINES = [
  "Choose, or describe, what you are crossing.",
  "Meet three to five Guides. Never more.",
  "Answer three questions your Guide will read.",
  "Alone, witnessed, or with the practical aftermath.",
  "An hour with stillness on either side.",
  "Write to the person you'll be afterwards.",
  "Hold the time. Your letter is sealed.",
];

function CyclingMoment() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setI((n) => (n + 1) % MOMENTS.length);
        setVisible(true);
      }, 700);
    }, 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative">
      <span className={`transition-opacity duration-700 ease-quiet ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden>
        {MOMENTS[i]}.
      </span>
      <span className="sr-only">for moments like finalizing a divorce, surgery, leaving a career, or a terminal diagnosis.</span>
    </span>
  );
}

export default function Index() {
  const thresholds = useThresholds();
  const guides = useGuides();
  const [inProgress, setInProgress] = useState(false);
  useEffect(() => setInProgress(hasRitualInProgress()), []);
  const list = thresholds.data ?? SEED_THRESHOLDS;
  const featured = (guides.data ?? []).filter((g) => ["mara", "imani", "ruth"].includes(g.slug));

  return (
    <PageShell>
      {/* Hero ------------------------------------------------------------ */}
      <section className="relative -mt-20 overflow-hidden pt-20 md:-mt-24 md:pt-24">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-charcoal-950/60 to-transparent" aria-hidden />
        <div className="container relative grid min-h-[calc(100dvh-6rem)] items-center gap-10 pb-16 md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:pb-24">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow mb-8 opacity-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
              Appointments for the moments that do not reverse
            </p>
            <h1
              className="text-balance font-serif text-[3.25rem] leading-[0.98] text-bone opacity-0 animate-rise-in sm:text-[4.5rem] lg:text-[5.75rem]"
              style={{ animationDelay: "350ms", animationDuration: "1400ms" }}
            >
              Some doors only close behind you.
            </h1>
            <p
              className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-bone-dim opacity-0 animate-fade-in md:text-xl"
              style={{ animationDelay: "1100ms", animationDuration: "1400ms" }}
            >
              Threshold is where you book a Guide for the hour your life permanently changes — and make sure you don't cross it alone.
            </p>
            <p
              className="mt-6 font-serif text-xl italic text-copper-bright/90 opacity-0 animate-fade-in md:text-2xl"
              style={{ animationDelay: "1700ms", animationDuration: "1400ms" }}
            >
              For <CyclingMoment />
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-6 opacity-0 animate-fade-in" style={{ animationDelay: "2200ms" }}>
              <Button asChild size="lg">
                <Link to="/begin">
                  {inProgress ? "Continue where you left off" : "Begin"} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <a href="#how" className="text-sm text-bone-dim underline decoration-bone/20 underline-offset-[6px] transition-colors duration-500 hover:text-bone hover:decoration-copper/70">
                How it holds you
              </a>
            </div>
            <p className="mt-14 max-w-md text-sm leading-relaxed text-bone-faint opacity-0 animate-fade-in" style={{ animationDelay: "2800ms" }}>
              Not therapy. Not a crisis line. A held hour, with someone who has stood at this door before.
            </p>
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-25 md:pointer-events-auto md:relative md:inset-auto md:items-center md:opacity-100">
            <Doorway className="max-w-[22rem] md:max-w-[26rem]" />
          </div>
        </div>
      </section>

      {/* What we hold ----------------------------------------------------- */}
      <section id="hold" className="border-t border-bone/[0.07] py-24 md:py-36">
        <div className="container grid gap-14 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <Reveal className="md:sticky md:top-24 md:self-start">
            <p className="eyebrow mb-6">What we hold</p>
            <h2 className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">Each of these changes a person permanently.</h2>
            <p className="mt-6 max-w-sm text-[1.0625rem] leading-relaxed text-bone-dim">
              They deserve more than a calendar invite. Choose the one nearest to yours and begin there.
            </p>
          </Reveal>
          <ol className="border-t border-bone/[0.07]">
            {list.map((t, i) => (
              <Reveal as="li" key={t.slug} delay={i * 40}>
                <Link
                  to={`/begin?threshold=${t.slug}`}
                  className="group relative flex items-baseline gap-6 border-b border-bone/[0.07] py-6 pl-1 transition-colors duration-700 ease-quiet hover:bg-bone/[0.015]"
                >
                  <span className="w-8 shrink-0 font-serif text-sm text-bone-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1">
                    <span className="block font-serif text-[1.625rem] leading-tight text-bone/85 transition-colors duration-700 group-hover:text-bone md:text-3xl">
                      {t.name}
                    </span>
                    <span className="mt-1.5 block text-[0.9375rem] text-bone-faint transition-colors duration-700 group-hover:text-bone-dim">{t.line}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 -translate-x-2 text-copper-bright opacity-0 transition-all duration-700 ease-quiet group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                  <span className="absolute bottom-[-1px] left-0 h-px w-0 bg-copper/70 transition-all duration-1000 ease-quiet group-hover:w-full" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* How it holds you --------------------------------------------------- */}
      <section id="how" className="relative border-t border-bone/[0.07] bg-charcoal-950/40 py-24 md:py-36">
        <div className="container">
          <Reveal className="max-w-3xl">
            <p className="eyebrow mb-6">How it holds you</p>
            <h2 className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">Emotional safety is built into the calendar, not painted on it.</h2>
          </Reveal>

          <div className="mt-20 grid gap-20 md:mt-28 md:gap-28">
            <Principle
              numeral="I"
              title="Stillness on either side."
              body="Your Guide arrives forty-five minutes before you and stays forty-five minutes after. Those minutes are enforced by the calendar itself — no one can ever be booked into them."
            >
              <SpanDiagram durationMin={90} times={{ prepare: "09:15", start: "10:00", end: "11:30", rest: "12:15" }} />
            </Principle>

            <Principle
              numeral="II"
              title="Never more than two a day."
              body="Guides hold at most two thresholds a day; some hold only one. We would rather you wait a week than meet someone depleted. Scarcity here is a kindness."
            >
              <ScarcityDay />
            </Principle>

            <Principle
              numeral="III"
              title="A letter you cannot open yet."
              body="Before your session you write to the person you'll be afterwards. It is sealed — even from you — until forty-eight hours after you cross. Your Guide will never read it."
            >
              <div className="flex items-center gap-8">
                <SealedEnvelope />
                <div className="text-sm leading-relaxed text-bone-faint">
                  <p className="font-serif text-2xl text-bone">Sealed</p>
                  <p className="mt-1">Opens Saturday, 11:30</p>
                  <p>48 hours after your session</p>
                </div>
              </div>
            </Principle>
          </div>
        </div>
      </section>

      {/* The ritual -------------------------------------------------------- */}
      <section className="border-t border-bone/[0.07] py-24 md:py-36">
        <div className="container grid gap-14 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <Reveal className="md:sticky md:top-24 md:self-start">
            <p className="eyebrow mb-6">The booking is a ritual</p>
            <h2 className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">Seven quiet steps. Nothing rushed.</h2>
            <p className="mt-6 max-w-sm text-[1.0625rem] leading-relaxed text-bone-dim">
              You can stop at any point. Your place is kept on this device, and nothing is shared until you hold the time.
            </p>
            <Button asChild variant="outline" className="mt-10">
              <Link to="/begin">Begin the ritual</Link>
            </Button>
          </Reveal>
          <ol className="relative">
            <span className="absolute bottom-6 left-[1.1rem] top-6 w-px bg-gradient-to-b from-copper/60 via-bone/10 to-transparent" aria-hidden />
            {STEPS.map((name, i) => (
              <Reveal as="li" key={name} delay={i * 60} className="relative flex gap-8 pb-10 last:pb-0">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bone/15 bg-charcoal-900 font-serif text-sm text-copper-bright">
                  {ROMAN[i]}
                </span>
                <div className="pt-1">
                  <h3 className="font-serif text-2xl text-bone md:text-[1.75rem]">{name}</h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-bone-faint">{RITUAL_LINES[i]}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Guides -------------------------------------------------------------- */}
      <section className="border-t border-bone/[0.07] bg-charcoal-950/40 py-24 md:py-36">
        <div className="container">
          <Reveal className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <p className="eyebrow mb-6">Threshold Guides</p>
              <h2 className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">People who have stood at these doors before.</h2>
            </div>
            <Link to="/guides" className="text-sm text-bone-dim underline decoration-bone/20 underline-offset-[6px] transition-colors duration-500 hover:text-bone hover:decoration-copper/70">
              Meet every Guide
            </Link>
          </Reveal>
          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {(featured.length ? featured : [null, null, null]).map((g, i) => (
              <Reveal key={g?.id ?? i} delay={i * 90}>
                <div className="flex h-full flex-col rounded-lg border border-bone/[0.08] p-8 transition-colors duration-700 hover:border-bone/20">
                  {g ? (
                    <>
                      <GuideMark name={g.name} presence={g.presence} />
                      <blockquote className="mt-8 flex-1 font-serif text-[1.375rem] italic leading-snug text-bone/90">“{g.statement}”</blockquote>
                      <p className="mt-8 text-sm text-bone">{g.name}</p>
                      <p className="mt-1 text-xs text-bone-faint">
                        {PRESENCE[g.presence].name} · {g.location} · {g.years_holding} years
                      </p>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="skeleton h-[4.5rem] w-14" />
                      <div className="skeleton h-20 w-full" />
                      <div className="skeleton h-4 w-1/2" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Not therapy ---------------------------------------------------------- */}
      <section className="border-t border-bone/[0.07] py-28 md:py-44">
        <Reveal className="container max-w-4xl text-center">
          <p className="eyebrow mb-10">What this is not</p>
          <p className="text-balance font-serif text-[2.25rem] leading-[1.12] text-bone md:text-[3.5rem]">
            Threshold doesn't try to fix anything. It makes sure you don't cross alone.
          </p>
          <p className="mx-auto mt-10 max-w-lg text-[0.9375rem] leading-relaxed text-bone-faint">
            Guides are not therapists and do not diagnose or treat. If you are in crisis, please contact your local emergency number.
          </p>
        </Reveal>
      </section>

      {/* Final call ------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-bone/[0.07] py-28 md:py-40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full threshold-glow opacity-70" aria-hidden />
        <div className="copper-line absolute inset-x-0 top-0 h-px" aria-hidden />
        <Reveal className="container relative text-center">
          <h2 className="font-serif text-5xl text-bone md:text-7xl">When you are ready.</h2>
          <p className="mx-auto mt-6 max-w-md text-[1.0625rem] leading-relaxed text-bone-dim">It takes about ten minutes. You can stop at any point.</p>
          <Button asChild size="lg" className="mt-12">
            <Link to="/begin">
              Begin <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Reveal>
      </section>
    </PageShell>
  );
}

function Principle({ numeral, title, body, children }: { numeral: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <Reveal className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
      <div>
        <p className="font-serif text-lg text-copper-bright">{numeral}</p>
        <h3 className="mt-3 font-serif text-4xl leading-tight text-bone md:text-5xl">{title}</h3>
        <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-bone-dim">{body}</p>
      </div>
      <div className="rounded-lg border border-bone/[0.07] bg-charcoal-900/60 p-8 md:p-10">{children}</div>
    </Reveal>
  );
}

function ScarcityDay() {
  // 08:00–18:00, two sessions with their stillness; the rest deliberately empty.
  const span = 600;
  const pct = (m: number) => `${(m / span) * 100}%`;
  const blocks = [
    { at: 75, len: 90 },
    { at: 330, len: 90 },
  ];
  return (
    <div>
      <div className="relative h-12 overflow-hidden rounded-md bg-bone/[0.04]" role="img" aria-label="A Guide's day from eight to six: two sessions, each with forty-five minutes of stillness either side, and nothing else.">
        {blocks.map((b) => (
          <div key={b.at}>
            <div className="buffer-hatch absolute inset-y-1.5" style={{ left: pct(b.at - 45), width: pct(b.len + 90) }} />
            <div className="absolute inset-y-1.5 bg-copper/80" style={{ left: pct(b.at), width: pct(b.len) }} />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-between text-[0.6875rem] tabular-nums text-bone-faint">
        <span>08:00</span>
        <span>13:00</span>
        <span>18:00</span>
      </div>
      <p className="mt-6 text-sm text-bone-faint">
        <span className="text-bone-dim">Full.</span> The rest of the day stays empty on purpose.
      </p>
    </div>
  );
}
