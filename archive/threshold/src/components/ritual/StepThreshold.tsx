import { useMemo } from "react";
import { StepActions, StepHeader } from "./StepFrame";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useThresholds } from "@/hooks/useCatalogue";
import type { RitualDraft } from "@/hooks/useRitual";
import { matchThresholds } from "@/lib/matching";
import { cn } from "@/lib/utils";

export function StepThreshold({
  draft,
  update,
  onNext,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  onNext: () => void;
}) {
  const { data: thresholds, isLoading } = useThresholds();
  const suggestion = useMemo(
    () => (!draft.thresholdSlug && thresholds ? matchThresholds(draft.thresholdWords, thresholds)[0] : undefined),
    [draft.thresholdSlug, draft.thresholdWords, thresholds],
  );
  const canNext = !!draft.thresholdSlug || draft.thresholdWords.trim().length >= 3;

  return (
    <div>
      <StepHeader step={0} title="What are you crossing?">
        Choose the nearest, or say it in your own words. Nothing you write here is shared until you decide to hold a
        time.
      </StepHeader>

      <fieldset>
        <legend className="sr-only">Thresholds</legend>
        <div className="border-t border-bone/[0.07]">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 border-b border-bone/[0.07] py-6">
                <Skeleton className="h-6 w-2/5" />
                <Skeleton className="ml-auto hidden h-4 w-1/3 md:block" />
              </div>
            ))}
          {thresholds?.map((t) => {
            const selected = draft.thresholdSlug === t.slug;
            return (
              <label
                key={t.slug}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-1.5 border-b border-bone/[0.07] py-5 pl-7 pr-2 transition-colors duration-700 ease-quiet md:flex-row md:items-baseline md:gap-8 md:py-6",
                  "has-[:focus-visible]:bg-bone/[0.025]",
                  selected ? "bg-copper/[0.045]" : "hover:bg-bone/[0.02]",
                )}
              >
                <input
                  type="radio"
                  name="threshold"
                  value={t.slug}
                  checked={selected}
                  onChange={() => update({ thresholdSlug: t.slug })}
                  onKeyDown={(e) => e.key === "Enter" && onNext()}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 h-px -translate-y-1/2 transition-all duration-700 ease-quiet",
                    selected ? "w-4 bg-copper-bright" : "w-0 bg-bone/40 group-hover:w-2.5",
                  )}
                />
                <span
                  className={cn(
                    "font-serif text-[1.625rem] leading-tight transition-colors duration-700 md:w-[46%] md:text-[1.75rem]",
                    selected ? "text-bone" : "text-bone/80 group-hover:text-bone",
                  )}
                >
                  {t.name}
                </span>
                <span className={cn("text-[0.9375rem] leading-relaxed transition-colors duration-700", selected ? "text-bone-dim" : "text-bone-faint")}>
                  {t.line}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-14 max-w-2xl">
        <label htmlFor="threshold-words" className="eyebrow">
          {draft.thresholdSlug ? "Anything to add, in your own words" : "Or, in your own words"}
        </label>
        <Textarea
          id="threshold-words"
          value={draft.thresholdWords}
          onChange={(e) => update({ thresholdWords: e.target.value.slice(0, 400) })}
          placeholder="The decree arrives on Thursday. Nineteen years."
          className="mt-2 min-h-[4.5rem] font-serif text-xl"
          rows={2}
        />
        <div aria-live="polite" className="mt-4 min-h-[1.5rem] text-sm text-bone-faint">
          {suggestion && (
            <p className="animate-fade-in">
              This sounds close to{" "}
              <button
                type="button"
                onClick={() => update({ thresholdSlug: suggestion.slug })}
                className="text-copper-bright underline decoration-copper/30 underline-offset-4 transition-colors duration-500 hover:decoration-copper"
              >
                {suggestion.name.toLowerCase()}
              </button>
              . Choose it, or simply continue.
            </p>
          )}
          {!draft.thresholdSlug && !suggestion && draft.thresholdWords.trim().length >= 12 && (
            <p className="animate-fade-in">We'll introduce you to Guides who hold many kinds of thresholds.</p>
          )}
        </div>
      </div>

      <StepActions onNext={onNext} canNext={canNext} />
    </div>
  );
}
