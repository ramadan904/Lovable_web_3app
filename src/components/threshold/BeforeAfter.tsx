import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { Button } from "@/components/ui/button";

const THREAD = [
  { who: "client", at: "Mon 09:12", text: "Hi — I'm not sure this is something you do. My divorce is final on Thursday and I don't think I can be alone for it." },
  { who: "owner", at: "Mon 21:40", text: "Thank you for writing. Could you tell me a little more about what you're going through?" },
  { who: "client", at: "Tue 08:03", text: "Nineteen years. The decree comes by email, which somehow makes it worse…" },
  { who: "owner", at: "Wed 14:15", text: "I'm so sorry. Does Tuesday work? Or Wednesday at 10?" },
  { who: "client", at: "Thu 07:50", text: "Tuesday's gone now. Is there anything before Friday?" },
  { who: "owner", at: "Fri 16:02", text: "Friday at 10 — I have someone at 11, so we'll need to finish on time." },
] as const;

const AFTER = [
  "Chooses the threshold and a Guide who holds it",
  "Answers three questions — told once, read before arrival",
  "Sees only real open hours, in their own time zone",
  "Confirmed in one sitting, with a calendar file",
  "Preparation note and reminder sent on schedule",
  "Can move or release it themselves, until a day before",
];

/** The same inquiry, before and after. */
export function BeforeAfter() {
  return (
    <section aria-labelledby="ba-h" className="border-t border-bone/[0.07] py-24 md:py-36">
      <div className="container">
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-6">From "can I book with you?" to "you're booked"</p>
          <h2 id="ba-h" className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">
            The same inquiry, twice.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-lg border border-bone/[0.08] p-6 md:p-10">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-serif text-3xl text-bone-dim">Before</h3>
              <p className="text-xs text-bone-faint">A typical inquiry, by email</p>
            </div>
            <ol className="mt-8 space-y-3" aria-label="An email thread between a client and a practitioner">
              {THREAD.map((m) => (
                <li key={m.at} className={m.who === "owner" ? "pl-8 md:pl-14" : "pr-8 md:pr-14"}>
                  <div className={m.who === "owner" ? "rounded-md bg-bone/[0.05] px-4 py-3" : "rounded-md border border-bone/[0.08] px-4 py-3"}>
                    <p className="text-[0.6875rem] text-bone-faint">
                      {m.who === "owner" ? "Practitioner" : "Client"} · {m.at}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-bone-dim">{m.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-bone/[0.07] pt-6">
              <Figure label="Messages" value="6" />
              <Figure label="Days to confirm" value="5" />
              <Figure label="Pause between clients" value="None" />
            </dl>
          </Reveal>

          <Reveal delay={120} className="relative flex flex-col overflow-hidden rounded-lg border border-copper/40 p-6 md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 threshold-glow opacity-70" aria-hidden />
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-3xl text-bone">With Threshold</h3>
                <p className="text-xs text-bone-faint">One sitting, about ten minutes</p>
              </div>
              <ol className="mt-8 space-y-4">
                {AFTER.map((line) => (
                  <li key={line} className="flex gap-3 text-[0.9375rem] leading-relaxed text-bone-dim">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-copper text-charcoal-950" aria-hidden>
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
              <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-bone/[0.07] pt-6">
                <Figure label="Messages from the Guide" value="0" />
                <Figure label="Time to confirm" value="Instant" />
                <Figure label="Stillness either side" value="45 min" />
              </dl>
              <div className="mt-auto pt-10">
                <Button asChild>
                  <Link to="/begin">Try it — it takes ten minutes</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs leading-snug text-bone-faint">{label}</dt>
      <dd className="mt-1.5 font-sans text-2xl font-semibold tracking-[-0.02em] text-bone">{value}</dd>
    </div>
  );
}

const OWNER = [
  { title: "No scheduling email, ever", body: "Clients see only true open hours and are confirmed on the spot." },
  { title: "Stillness the calendar enforces", body: "Forty-five minutes before and after every session. Nobody can book into them — not even by accident." },
  { title: "Your daily limit, kept", body: "Once you've held your two (or one), the day closes itself." },
  { title: "A briefing before every session", body: "Threshold, form, time zone and three answers — the story told once, to you." },
  { title: "Moves and releases, self-served", body: "Clients change their own plans until a day before. Your calendar and buffers follow." },
  { title: "Reminders on schedule", body: "Preparation notes and reminders go out without you lifting a finger." },
];

/** The owner's side, said plainly. */
export function ForGuides() {
  return (
    <section aria-labelledby="fg-h" className="border-t border-bone/[0.07] py-24 md:py-36">
      <div className="container grid gap-14 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
        <Reveal className="md:sticky md:top-24 md:self-start">
          <p className="eyebrow mb-6">For Guides</p>
          <h2 id="fg-h" className="text-balance font-serif text-[2.75rem] leading-[1.02] text-bone md:text-6xl">
            Your work is being present. Everything else is handled.
          </h2>
          <Button asChild variant="outline" className="mt-10">
            <Link to="/guide">See a Guide's week</Link>
          </Button>
        </Reveal>
        <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {OWNER.map((o, i) => (
            <Reveal as="li" key={o.title} delay={i * 50}>
              <span className="mb-4 block h-px w-8 bg-copper/70" aria-hidden />
              <h3 className="font-serif text-2xl text-bone">{o.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-bone-dim">{o.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
