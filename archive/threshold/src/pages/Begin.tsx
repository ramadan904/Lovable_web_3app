import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Mark } from "@/components/brand/Mark";
import { Confirmation } from "@/components/ritual/Confirmation";
import { RitualProgress } from "@/components/ritual/StepFrame";
import { StepForm } from "@/components/ritual/StepForm";
import { StepGuide } from "@/components/ritual/StepGuide";
import { StepHold } from "@/components/ritual/StepHold";
import { StepLetter } from "@/components/ritual/StepLetter";
import { StepReflect } from "@/components/ritual/StepReflect";
import { StepThreshold } from "@/components/ritual/StepThreshold";
import { StepTime } from "@/components/ritual/StepTime";
import { FadeSwap } from "@/components/threshold/FadeSwap";
import { useGuides, useSessionTypes, useThresholds } from "@/hooks/useCatalogue";
import { busyKey } from "@/hooks/useSlots";
import { clearRitual, useRitual, type RitualDraft } from "@/hooks/useRitual";
import { api } from "@/lib/data";
import { REFLECTIVE_PROMPTS } from "@/lib/data/seed";
import { LETTER_SEAL_HOURS, fmt } from "@/lib/time";
import { BookingError, type Guide, type SessionType } from "@/lib/types";
import { pronounsOf } from "@/lib/utils";

interface Held {
  sessionId: string;
  guide: Guide;
  form: SessionType;
  start: Date;
  end: Date;
  tz: string;
  unlocks: Date | null;
  clientName: string;
}

/** Furthest step the draft can honestly stand on. */
function reachable(d: RitualDraft): number {
  if (!d.thresholdSlug && d.thresholdWords.trim().length < 3) return 0;
  if (!d.guideId) return 1;
  if (d.answers.some((a, i) => !a.trim() && !d.skipped[i])) return 2;
  if (!d.sessionType) return 3;
  if (!d.slotStart) return 4;
  if (!d.letter.trim() && !d.letterSkipped) return 5;
  return 6;
}

export default function Begin() {
  const [params] = useSearchParams();
  const guides = useGuides();
  const types = useSessionTypes();
  const thresholds = useThresholds();
  const qc = useQueryClient();

  const preGuide = params.get("guide");
  const preGuideId = useMemo(() => guides.data?.find((g) => g.slug === preGuide)?.id ?? null, [guides.data, preGuide]);
  const { draft, update } = useRitual({ threshold: params.get("threshold") });
  const [held, setHeld] = useState<Held | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Arriving from a Guide's page: remember who they chose.
  useEffect(() => {
    if (preGuideId && !draft.guideId && draft.step === 0) update({ guideId: preGuideId });
  }, [preGuideId, draft.guideId, draft.step, update]);

  const guide = guides.data?.find((g) => g.id === draft.guideId) ?? null;
  const form = types.data?.find((t) => t.key === draft.sessionType) ?? null;
  const threshold = thresholds.data?.find((t) => t.slug === draft.thresholdSlug);
  const firstName = guide?.name.split(" ")[0] ?? "Your Guide";

  // Never stand on a step whose foundations are missing (e.g. a stale draft).
  const step = Math.min(draft.step, reachable(draft));
  useEffect(() => {
    if (step !== draft.step) update({ step });
  }, [step, draft.step, update]);

  const go = useCallback((s: number) => update({ step: s }), [update]);
  const next = () => go(Math.min(step + 1, 6));
  const back = () => go(Math.max(step - 1, 0));

  const hold = async () => {
    if (!guide || !form || !draft.slotStart) return;
    setHolding(true);
    setHoldError(null);
    try {
      const sessionId = await api.book({
        guide_id: guide.id,
        threshold_slug: draft.thresholdSlug,
        threshold_words: draft.thresholdWords.trim() || null,
        session_type: form.key,
        starts_at: draft.slotStart,
        client_name: draft.clientName.trim(),
        client_timezone: draft.clientTz,
        answers: REFLECTIVE_PROMPTS.map((p, i) => ({
          position: p.position,
          prompt: p.prompt,
          answer: draft.skipped[i] ? null : draft.answers[i].trim() || null,
        })),
        letter: draft.letter.trim() && !draft.letterSkipped ? draft.letter : null,
      });
      const start = new Date(draft.slotStart);
      const end = new Date(start.getTime() + form.duration_min * 60_000);
      setHeld({
        sessionId,
        guide,
        form,
        start,
        end,
        tz: draft.clientTz,
        unlocks: draft.letter.trim() && !draft.letterSkipped ? new Date(end.getTime() + LETTER_SEAL_HOURS * 3600_000) : null,
        clientName: draft.clientName.trim(),
      });
      clearRitual();
      window.scrollTo({ top: 0 });
      void qc.invalidateQueries({ queryKey: ["mine"] });
      void qc.invalidateQueries({ queryKey: busyKey(guide.id) });
    } catch (err) {
      const code = err instanceof BookingError ? err.code : "unknown";
      const when = fmt(new Date(draft.slotStart), draft.clientTz, "EEEE d MMMM, HH:mm");
      const toTime = (notice: string) => {
        void qc.invalidateQueries({ queryKey: busyKey(guide.id) });
        update({ step: 4, slotStart: null, notice });
      };
      switch (code) {
        case "slot_taken":
          toTime(`While you were writing, ${when} was given to someone else. Nothing you wrote is lost — everything is exactly as you left it. These are the hours that remain.`);
          break;
        case "day_full":
          toTime(`${firstName} has just reached the limit of what ${guide ? pronounsOf(guide.pronouns).subject : "they"} ${guide && !pronounsOf(guide.pronouns).plural ? "holds" : "hold"} on that day. Nothing you wrote is lost. These are the hours that remain.`);
          break;
        case "too_soon":
          toTime(`${when} is now less than a day away, and Guides need a day to prepare. Nothing you wrote is lost.`);
          break;
        case "client_overlap":
          toTime(`You already have a session held at ${when}. Choose another hour.`);
          break;
        case "outside_availability":
        case "off_grid":
        case "too_far":
          toTime(`${firstName}'s hours have changed since you chose ${when}. These are the hours that remain.`);
          break;
        case "guide_unavailable":
          update({ step: 1, guideId: null, slotStart: null });
          break;
        case "auth_required":
          setHoldError("Your record needs you to sign in again. Nothing you wrote is lost.");
          break;
        default:
          setHoldError("We couldn't hold this time. Nothing has been booked, and nothing you wrote is lost. Please try again in a moment.");
      }
    } finally {
      setHolding(false);
    }
  };

  const sessionEnd = draft.slotStart && form ? new Date(new Date(draft.slotStart).getTime() + form.duration_min * 60_000) : null;

  const view = (() => {
    switch (step) {
      case 0:
        return <StepThreshold draft={draft} update={update} onNext={next} />;
      case 1:
        return <StepGuide draft={draft} update={update} onNext={next} onBack={back} />;
      case 2:
        return <StepReflect draft={draft} update={update} guideName={firstName} onNext={next} onBack={back} />;
      case 3:
        return <StepForm draft={draft} update={update} guideName={firstName} onNext={next} onBack={back} />;
      case 4:
        return guide && form ? (
          <StepTime draft={draft} update={update} guide={guide} form={form} onNext={next} onBack={back} onChangeGuide={() => go(1)} />
        ) : null;
      case 5:
        return <StepLetter draft={draft} update={update} guideName={firstName} sessionEnd={sessionEnd} onNext={next} onBack={back} />;
      default:
        return guide && form ? (
          <StepHold
            draft={draft}
            update={update}
            guide={guide}
            form={form}
            threshold={threshold}
            onBack={back}
            onHold={hold}
            holding={holding}
            error={holdError}
            onJump={go}
          />
        ) : null;
    }
  })();

  return (
    <div className="min-h-dvh">
      <a
        href="#ritual"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-charcoal-950"
      >
        Skip to the ritual
      </a>
      <header className={`sticky top-0 z-30 transition-colors duration-1000 ${held ? "bg-transparent" : "bg-charcoal-900/85 backdrop-blur-md"}`}>
        <div className="container flex h-20 items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-sm" aria-label="Threshold, home. Your place in the ritual is kept.">
            <Mark />
            <span className="hidden font-serif text-xl text-bone sm:inline">Threshold</span>
          </Link>
          {!held && <RitualProgress step={step} onJump={go} />}
          <Link
            to={held ? "/record" : "/"}
            className="text-sm text-bone-faint transition-colors duration-500 hover:text-bone-dim"
            title={held ? undefined : "Your place is kept on this device"}
          >
            {held ? "My thresholds" : "Leave"}
          </Link>
        </div>
      </header>

      <main id="ritual">
        {held ? (
          <Confirmation {...held} />
        ) : (
          <div className="container max-w-4xl px-6 pb-6 pt-10 md:px-10 md:pt-20">
            {guides.isError || thresholds.isError ? (
              <div className="py-24 text-center">
                <p className="font-serif text-3xl text-bone">Threshold couldn't be reached.</p>
                <p className="mt-3 text-bone-dim">Your place is kept. Please try again in a moment.</p>
                <button className="mt-8 text-sm text-copper-bright underline underline-offset-4" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            ) : (
              <FadeSwap viewKey={step} onSwap={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                {view}
              </FadeSwap>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
