import { useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { SpanDiagram } from "@/components/threshold/SpanDiagram";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyAnswers } from "@/hooks/useMine";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { cityOf, durationWords, fmt, fmtTime, relativeFromNow } from "@/lib/time";
import type { Guide, Session, SessionType, Threshold } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SessionCard({
  session,
  guide,
  form,
  threshold,
  tz,
  now,
  onRelease,
  releasing,
}: {
  session: Session;
  guide: Guide | undefined;
  form: SessionType | undefined;
  threshold: Threshold | undefined;
  tz: string;
  now: Date;
  onRelease: () => void;
  releasing: boolean;
}) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const answers = useMyAnswers(session.id, showAnswers);
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  const live = start <= now && now < end;
  const firstName = guide?.name.split(" ")[0] ?? "Your Guide";
  const bufferStart = new Date(start.getTime() - session.buffer_before_min * 60_000);
  const bufferEnd = new Date(end.getTime() + session.buffer_after_min * 60_000);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border p-6 transition-[opacity,border-color] duration-700 ease-quiet md:p-10",
        live ? "border-copper/50" : "border-bone/[0.08]",
        releasing && "opacity-40",
      )}
      aria-busy={releasing}
    >
      {live && <div className="pointer-events-none absolute inset-x-0 top-0 h-40 threshold-glow" aria-hidden />}
      <div className="relative grid gap-8 md:grid-cols-[8.5rem_1fr]">
        <div className="flex items-baseline gap-4 md:block">
          <p className="font-serif text-[4.5rem] leading-[0.85] text-bone tabular-nums">{fmt(start, tz, "d")}</p>
          <div>
            <p className="font-serif text-xl text-bone-dim md:mt-3">{fmt(start, tz, "MMMM")}</p>
            <p className="text-sm text-bone-faint">{fmt(start, tz, "EEEE")}</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className={cn("eyebrow", live && "text-copper-bright")}>{live ? "Happening now" : relativeFromNow(start, now)}</p>
          <h3 className="mt-3 font-serif text-[2rem] leading-tight text-bone">{threshold?.name ?? session.threshold_words ?? "Your threshold"}</h3>
          <p className="mt-2 text-[0.9375rem] text-bone-dim">
            with {guide?.name ?? "your Guide"} · {form?.name ?? session.session_type} · {durationWords(form?.duration_min ?? 90)}
          </p>
          <p className="mt-1 text-sm tabular-nums text-bone-faint">
            {fmtTime(start, tz)}–{fmtTime(end, tz)} {cityOf(tz)}
            {guide && cityOf(guide.timezone) !== cityOf(tz) && ` · ${fmtTime(start, guide.timezone)} for ${firstName} in ${guide.location}`}
          </p>

          <SpanDiagram
            className="mt-8 max-w-xl"
            durationMin={form?.duration_min ?? 90}
            practicalMin={session.session_type === "aftermath" ? 60 : 0}
            times={{ prepare: fmtTime(bufferStart, tz), start: fmtTime(start, tz), end: fmtTime(end, tz), rest: fmtTime(bufferEnd, tz) }}
          />

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadIcs(
                  "threshold.ics",
                  buildIcs({
                    uid: session.id,
                    start,
                    end,
                    title: `Threshold · with ${guide?.name ?? "your Guide"}`,
                    description: `${form?.name ?? ""}. ${firstName} will be present from forty-five minutes before.`,
                  }),
                )
              }
            >
              <CalendarPlus aria-hidden /> Add to calendar
            </Button>
            <button
              type="button"
              aria-expanded={showAnswers}
              aria-controls={`answers-${session.id}`}
              onClick={() => setShowAnswers((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-bone-dim transition-colors duration-500 hover:text-bone"
            >
              What you told {firstName}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-500", showAnswers && "rotate-180")} aria-hidden />
            </button>
            {!live && (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                disabled={releasing}
                className="text-sm text-bone-faint underline decoration-transparent underline-offset-4 transition-colors duration-500 hover:text-bone-dim hover:decoration-bone/30 md:ml-auto"
              >
                {releasing ? "Releasing…" : "Release this time"}
              </button>
            )}
          </div>

          <div
            id={`answers-${session.id}`}
            className={cn("grid transition-[grid-template-rows,opacity] duration-700 ease-quiet", showAnswers ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
          >
            <div className="overflow-hidden">
              <dl className="mt-8 space-y-6 border-t border-bone/[0.07] pt-8">
                {answers.isLoading &&
                  [0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-5 w-4/5" />
                    </div>
                  ))}
                {answers.data?.map((a) => (
                  <div key={a.position}>
                    <dt className="text-xs text-bone-faint">{a.prompt}</dt>
                    <dd className={cn("mt-1.5 font-serif text-lg leading-snug", a.answer ? "text-bone/90" : "italic text-bone-faint")}>
                      {a.answer ?? "Kept for the room."}
                    </dd>
                  </div>
                ))}
                {answers.data?.length === 0 && <p className="text-sm text-bone-faint">No answers were written for this session.</p>}
              </dl>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Release this time?</DialogTitle>
          <DialogDescription>
            {firstName}'s hour on {fmt(start, tz, "EEEE d MMMM")} will become free again. If you wrote a letter, it will be returned to you,
            unopened. You can always begin again.
          </DialogDescription>
          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" autoFocus>
                Keep it
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                onRelease();
              }}
            >
              Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
