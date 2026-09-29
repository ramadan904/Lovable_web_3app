import { Link } from "react-router-dom";
import { SealedEnvelope } from "@/components/threshold/SealedEnvelope";
import { fmt, relativeFromNow } from "@/lib/time";
import type { LetterEnvelope } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LetterCard({
  letter,
  tz,
  now,
  context,
  returned,
}: {
  letter: LetterEnvelope;
  tz: string;
  now: Date;
  context: string;
  returned: boolean;
}) {
  const open = new Date(letter.unlocks_at) <= now;
  const inner = (
    <>
      <SealedEnvelope open={open} className="shrink-0" />
      <div className="min-w-0">
        <p className={cn("eyebrow", open && !letter.opened_at && "text-copper-bright")}>
          {open ? (letter.opened_at ? "Opened" : returned ? "Returned to you, unopened" : "Ready to open") : "Sealed"}
        </p>
        <p className="mt-2 font-serif text-2xl leading-tight text-bone">
          {open ? (letter.opened_at ? `Read ${relativeFromNow(letter.opened_at, now)}` : "Your letter is waiting.") : `Opens ${relativeFromNow(letter.unlocks_at, now)}`}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bone-faint">
          {open ? "Unsealed" : "Unseals"} {fmt(letter.unlocks_at, tz, "EEEE d MMMM, HH:mm")}
          <br />
          {letter.word_count} words · {context}
        </p>
      </div>
    </>
  );

  if (!open) {
    return (
      <div className="flex items-center gap-7 rounded-lg border border-bone/[0.08] p-6 md:p-8" aria-label={`Sealed letter. Opens ${fmt(letter.unlocks_at, tz, "EEEE d MMMM 'at' HH:mm")}.`}>
        {inner}
      </div>
    );
  }
  return (
    <Link
      to={`/letters/${letter.id}`}
      className={cn(
        "group flex items-center gap-7 rounded-lg border p-6 transition-[border-color,background-color,box-shadow] duration-700 ease-quiet md:p-8",
        letter.opened_at ? "border-bone/[0.08] hover:border-bone/20" : "border-copper/40 hover:border-copper/70 hover:shadow-[0_0_80px_-30px_hsl(var(--copper)/0.6)]",
      )}
    >
      {inner}
    </Link>
  );
}
