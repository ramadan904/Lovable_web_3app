import { StepActions, StepHeader } from "./StepFrame";
import { SpanDiagram } from "@/components/threshold/SpanDiagram";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionTypes } from "@/hooks/useCatalogue";
import type { RitualDraft } from "@/hooks/useRitual";
import { durationWords } from "@/lib/time";
import type { SessionTypeKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const DETAIL: Record<SessionTypeKey, string> = {
  solo: "For most thresholds. Nothing to organise, no one to manage.",
  witnessed: "Your witness joins for the whole session. We don't send invitations — you simply bring them.",
  aftermath: "For thresholds with paperwork on the other side: court orders, clinics, employers, families.",
};

export function StepForm({
  draft,
  update,
  guideName,
  onNext,
  onBack,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  guideName: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: types, isLoading } = useSessionTypes();

  return (
    <div>
      <StepHeader step={3} title="Choose the form it takes.">
        Every form is held the same way: {guideName} arrives forty-five minutes before you and stays forty-five minutes
        after. No one is booked into that time.
      </StepHeader>

      <fieldset>
        <legend className="sr-only">Session form</legend>
        <div className="space-y-4">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}
          {types?.map((t, i) => {
            const selected = draft.sessionType === t.key;
            return (
              <label
                key={t.key}
                className={cn(
                  "group block cursor-pointer rounded-lg border p-6 transition-[border-color,background-color,box-shadow] duration-700 ease-quiet animate-rise-in md:p-8",
                  "has-[:focus-visible]:border-copper/60",
                  selected
                    ? "border-copper/50 bg-copper/[0.04] shadow-[0_0_80px_-30px_hsl(var(--copper)/0.5)]"
                    : "border-bone/[0.08] hover:border-bone/20",
                )}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <input
                  type="radio"
                  name="form"
                  value={t.key}
                  checked={selected}
                  onChange={() => update({ sessionType: t.key, slotStart: draft.sessionType === t.key ? draft.slotStart : null })}
                  onKeyDown={(e) => e.key === "Enter" && onNext()}
                  className="sr-only"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="font-serif text-[1.75rem] leading-tight text-bone md:text-[2rem]">{t.name}</h2>
                  <p className="text-sm tabular-nums text-bone-faint">{durationWords(t.duration_min)}</p>
                </div>
                <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-bone-dim">{t.line}</p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-bone-faint">{DETAIL[t.key]}</p>
                <SpanDiagram
                  className="mt-7"
                  durationMin={t.duration_min}
                  practicalMin={t.key === "aftermath" ? 60 : 0}
                  active={selected}
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <StepActions onBack={onBack} onNext={onNext} canNext={!!draft.sessionType} />
    </div>
  );
}
