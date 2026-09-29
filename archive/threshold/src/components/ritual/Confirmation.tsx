import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { cityOf, fmt, fmtTime } from "@/lib/time";
import type { Guide, SessionType } from "@/lib/types";
import { capitalize, pronounsOf } from "@/lib/utils";

/**
 * Not a checkmark. The room dims, a line of light crosses it, and the words
 * arrive one at a time — slowly enough to be read, and felt.
 */
export function Confirmation({
  sessionId,
  guide,
  form,
  start,
  end,
  tz,
  unlocks,
  clientName,
}: {
  sessionId: string;
  guide: Guide;
  form: SessionType;
  start: Date;
  end: Date;
  tz: string;
  unlocks: Date | null;
  clientName: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const firstName = guide.name.split(" ")[0];
  const p = pronounsOf(guide.pronouns);
  const pronoun = capitalize(p.subject);
  const verb = p.plural ? ["arrive", "stay"] : ["arrives", "stays"];

  useEffect(() => {
    const t = setTimeout(() => heading.current?.focus({ preventScroll: true }), 1400);
    return () => clearTimeout(t);
  }, []);

  const addToCalendar = () =>
    downloadIcs(
      "threshold.ics",
      buildIcs({
        uid: sessionId,
        start,
        end,
        title: `Threshold · with ${guide.name}`,
        description: `${form.name}. ${firstName} will be present from forty-five minutes before. Your record: ${window.location.origin}/record`,
      }),
    );

  const beat = (i: number) => ({ animationDelay: `${1200 + i * 900}ms` });

  return (
    <section className="relative flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center overflow-hidden px-6 pb-24 text-center">
      <div className="pointer-events-none fixed inset-0 bg-charcoal-950 animate-fade-in" style={{ animationDuration: "1600ms" }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 animate-fade-in"
        style={{
          animationDelay: "900ms",
          animationDuration: "3000ms",
          background: "radial-gradient(45% 40% at 50% 62%, hsl(var(--copper) / 0.14), hsl(var(--copper) / 0.04) 55%, transparent 80%)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-2xl">
        <div className="copper-line mx-auto mb-16 h-px w-full origin-center animate-draw-line" style={{ animationDelay: "300ms" }} aria-hidden />

        <h1
          ref={heading}
          tabIndex={-1}
          className="font-serif text-[3.5rem] leading-none text-bone opacity-0 outline-none animate-fade-in md:text-[5rem]"
          style={{ animationDelay: "1200ms", animationDuration: "1400ms" }}
        >
          It is held{clientName ? `, ${clientName}` : ""}.
        </h1>

        <p className="mt-10 font-serif text-2xl text-bone/90 opacity-0 animate-rise-in md:text-[1.75rem]" style={beat(1)}>
          {fmt(start, tz, "EEEE d MMMM")} · {fmtTime(start, tz)}
          <span className="mt-2 block font-sans text-sm text-bone-faint">
            {cityOf(tz)} time · {form.name}, until {fmtTime(end, tz)}
          </span>
        </p>

        <p className="mx-auto mt-10 max-w-md text-[1.0625rem] leading-relaxed text-bone-dim opacity-0 animate-rise-in" style={beat(2)}>
          {firstName} will be waiting. {pronoun} {verb[0]} forty-five minutes before you, and {verb[1]} forty-five minutes after. No one else
          will be seen in that time.
        </p>

        {unlocks && (
          <p className="mx-auto mt-6 max-w-md text-[1.0625rem] leading-relaxed text-bone-dim opacity-0 animate-rise-in" style={beat(3)}>
            Your letter is sealed. It will open on{" "}
            <span className="text-bone">{fmt(unlocks, tz, "EEEE d MMMM 'at' HH:mm")}</span>.
          </p>
        )}

        <div className="mt-16 flex flex-col items-center justify-center gap-4 opacity-0 animate-fade-in sm:flex-row" style={beat(unlocks ? 4 : 3)}>
          <Button asChild>
            <Link to="/record">Go to my thresholds</Link>
          </Button>
          <Button variant="outline" onClick={addToCalendar}>
            <CalendarPlus aria-hidden /> Add to calendar
          </Button>
        </div>

        <p className="mt-16 text-xs leading-relaxed text-bone-faint opacity-0 animate-fade-in" style={beat(unlocks ? 5 : 4)}>
          If you need to release this time, you can do so from your record, until the hour begins.
        </p>
      </div>
    </section>
  );
}
