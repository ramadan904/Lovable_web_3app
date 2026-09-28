import { StepActions, StepHeader } from "./StepFrame";
import { FadeSwap } from "@/components/threshold/FadeSwap";
import { Textarea } from "@/components/ui/textarea";
import type { RitualDraft } from "@/hooks/useRitual";
import { REFLECTIVE_PROMPTS } from "@/lib/data/seed";
import { cn } from "@/lib/utils";

const LIMIT = 800;

export function StepReflect({
  draft,
  update,
  guideName,
  onNext,
  onBack,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft> | ((d: RitualDraft) => Partial<RitualDraft>)) => void;
  guideName: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const q = draft.question;
  const prompt = REFLECTIVE_PROMPTS[q];
  const value = draft.answers[q];
  const skipped = draft.skipped[q];
  const canNext = value.trim().length > 0 || skipped;

  const setAnswer = (text: string) =>
    update((d) => {
      const answers = [...d.answers] as RitualDraft["answers"];
      const skippedArr = [...d.skipped] as RitualDraft["skipped"];
      answers[q] = text.slice(0, LIMIT);
      if (text.trim()) skippedArr[q] = false;
      return { answers, skipped: skippedArr };
    });

  const advance = () => (q < 2 ? update({ question: q + 1 }) : onNext());
  const retreat = () => (q > 0 ? update({ question: q - 1 }) : onBack());

  const skip = () => {
    update((d) => {
      const skippedArr = [...d.skipped] as RitualDraft["skipped"];
      const answers = [...d.answers] as RitualDraft["answers"];
      skippedArr[q] = true;
      answers[q] = "";
      return { skipped: skippedArr, answers, question: q < 2 ? q + 1 : q };
    });
    if (q === 2) onNext();
  };

  return (
    <div>
      <StepHeader step={2} title="Three questions, before you arrive." className="mb-10 md:mb-12">
        {guideName} reads your answers the day before your session. No one else does. Write as much or as little as is
        true.
      </StepHeader>

      <div className="mb-10 flex items-center gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-px transition-all duration-700 ease-quiet",
              i === q ? "w-10 bg-copper-bright" : i < q ? "w-6 bg-bone/40" : "w-6 bg-bone/10",
            )}
          />
        ))}
        <span className="ml-2 text-xs tabular-nums text-bone-faint">{q + 1} of 3</span>
      </div>

      <FadeSwap viewKey={q}>
        <div className="max-w-3xl">
          <label htmlFor={`answer-${q}`} className="block font-serif text-[2rem] leading-tight text-bone md:text-[2.5rem]">
            {prompt.prompt}
          </label>
          <p id={`hint-${q}`} className="mt-3 text-[0.9375rem] leading-relaxed text-bone-faint">
            {prompt.hint}
          </p>
          <Textarea
            id={`answer-${q}`}
            aria-describedby={`hint-${q} count-${q}`}
            value={value}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canNext) {
                e.preventDefault();
                advance();
              }
            }}
            placeholder={skipped ? "You chose to bring this into the room." : ""}
            className="mt-8 font-serif text-[1.375rem] leading-relaxed"
            autoFocus
          />
          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-bone-faint">
            <button
              type="button"
              onClick={skip}
              className="underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
            >
              I'd rather bring this into the room
            </button>
            <span
              id={`count-${q}`}
              className={cn("tabular-nums transition-opacity duration-700", value.length > LIMIT * 0.7 ? "opacity-100" : "opacity-0")}
            >
              {LIMIT - value.length} characters left
            </span>
          </div>
        </div>
      </FadeSwap>

      <StepActions
        onBack={retreat}
        onNext={advance}
        canNext={canNext}
        nextLabel={q < 2 ? "Next question" : "Continue"}
        hint={<span>⌘ + Enter to continue</span>}
      />
    </div>
  );
}
