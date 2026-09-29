import { Lock } from "lucide-react";
import { StepActions, StepHeader } from "./StepFrame";
import { Textarea } from "@/components/ui/textarea";
import type { RitualDraft } from "@/hooks/useRitual";
import { LETTER_SEAL_HOURS, fmt } from "@/lib/time";
import { wordCount } from "@/lib/utils";

export function StepLetter({
  draft,
  update,
  guideName,
  sessionEnd,
  onNext,
  onBack,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  guideName: string;
  sessionEnd: Date | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const unlocks = sessionEnd ? new Date(sessionEnd.getTime() + LETTER_SEAL_HOURS * 3600_000) : null;
  const words = wordCount(draft.letter);
  const canNext = draft.letter.trim().length > 0 || draft.letterSkipped;

  return (
    <div>
      <StepHeader step={5} title="Write to the person you will be on the other side.">
        It will be sealed the moment you hold this time
        {unlocks && (
          <>
            , and will open on <span className="text-bone">{fmt(unlocks, draft.clientTz, "EEEE d MMMM 'at' HH:mm")}</span>
          </>
        )}{" "}
        — forty-eight hours after your session ends. Not before, not even for you. {guideName} will never read it.
      </StepHeader>

      <div className="relative mx-auto max-w-3xl">
        <div className="pointer-events-none absolute -inset-x-6 -top-10 h-40 threshold-glow opacity-60" aria-hidden />
        <div className="relative rounded-lg border border-bone/[0.08] bg-[hsl(38_8%_10.5%)] px-7 py-10 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] md:px-14 md:py-14">
          <label htmlFor="letter" className="sr-only">
            Your letter to your future self
          </label>
          <Textarea
            id="letter"
            value={draft.letter}
            onChange={(e) => update({ letter: e.target.value.slice(0, 8000), letterSkipped: false })}
            placeholder={"Dear —\n\nBy the time you read this…"}
            className="min-h-[22rem] border-0 font-serif text-[1.3125rem] leading-[1.75] hover:border-0 focus-visible:border-0"
            aria-describedby="letter-meta"
          />
          <div id="letter-meta" className="mt-6 flex items-center justify-between border-t border-bone/[0.07] pt-5 text-xs text-bone-faint">
            <span className="flex items-center gap-2">
              <Lock className="h-3 w-3" aria-hidden /> Sealed when you hold the time
            </span>
            <span className="tabular-nums">
              {words} {words === 1 ? "word" : "words"}
            </span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-bone-faint">
          Kept only on this device until you hold the time. Then it is sealed in your record.
        </p>
      </div>

      <StepActions
        onBack={onBack}
        onNext={onNext}
        canNext={canNext}
        nextLabel={draft.letter.trim() ? "Seal the letter" : "Continue"}
      >
        {!draft.letter.trim() && (
          <button
            type="button"
            onClick={() => {
              update({ letterSkipped: true });
              onNext();
            }}
            className="text-sm text-bone-faint underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
          >
            Arrive without a letter
          </button>
        )}
      </StepActions>
    </div>
  );
}
