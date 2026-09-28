import { Check } from "lucide-react";
import type { Automation, WeekLedger } from "@/lib/automations";
import { fmt } from "@/lib/time";
import { cn } from "@/lib/utils";

/** A session's automations as a quiet timeline: done, scheduled, withdrawn. */
export function AutomationList({ items, tz, className }: { items: Automation[]; tz: string; className?: string }) {
  return (
    <ol className={cn("relative space-y-5", className)}>
      <span className="absolute bottom-2 left-[0.4375rem] top-2 w-px bg-bone/10" aria-hidden />
      {items.map((a) => (
        <li key={`${a.kind}-${a.at.getTime()}`} className="relative flex gap-4">
          <span
            className={cn(
              "relative z-10 mt-1 flex h-[0.9375rem] w-[0.9375rem] shrink-0 items-center justify-center rounded-full",
              a.state === "done" && "bg-copper text-charcoal-950",
              a.state === "scheduled" && "border border-copper/70 bg-charcoal-850",
              a.state === "withdrawn" && "border border-bone/20 bg-charcoal-850",
            )}
            aria-hidden
          >
            {a.state === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0">
            <p className={cn("text-sm", a.state === "withdrawn" ? "text-bone-faint line-through decoration-bone/30" : "text-bone")}>
              {a.title}
              <span className="ml-2 text-xs text-bone-faint">
                {a.state === "done" ? "Done" : a.state === "scheduled" ? fmt(a.at, tz, "EEE d MMM, HH:mm") : "Withdrawn"}
                <span className="sr-only">{a.audience === "client" ? ", for the client" : ", for the Guide"}</span>
              </span>
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-bone-faint">{a.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The owner-effort ledger: what the Guide didn't have to do this week. */
export function HandledTiles({ ledger, demo }: { ledger: WeekLedger; demo: boolean }) {
  const hours = ledger.stillnessMinutes / 60;
  const tiles = [
    { label: "Sessions held with no back-and-forth", value: String(ledger.held) },
    { label: "Messages you didn't have to write", value: String(ledger.messagesHandled) },
    { label: "Stillness protected around sessions", value: `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h` },
    { label: "Briefings ready before arrival", value: String(ledger.briefings) },
  ];
  return (
    <section aria-labelledby="handled-h" className="mb-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="handled-h" className="eyebrow">
          Handled for you this week
        </h2>
        <p className="text-xs text-bone-faint">
          {ledger.moves > 0 && `${ledger.moves} ${ledger.moves === 1 ? "move" : "moves"} made by clients themselves. `}
          {demo ? "In the demo, messages are scheduled and shown, not emailed." : "Delivered by email on schedule."}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-bone/[0.08] bg-bone/[0.08] lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-charcoal-900 px-5 py-5">
            <dt className="text-xs leading-snug text-bone-dim">{t.label}</dt>
            <dd className="mt-2 font-sans text-[2rem] font-semibold leading-none tracking-[-0.02em] text-bone">{t.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
