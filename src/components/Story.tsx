import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEPS, storyStore, useStory } from "@/lib/story";

const STEP_MS = 11_000;

/** The captioned panel that narrates the guided story. It sits over the real app, which stays usable underneath. */
export function Story() {
  const s = useStory();
  const navigate = useNavigate();
  const { search } = useLocation();
  const step = STEPS[s.step];
  const last = s.step === STEPS.length - 1;

  // A shared link like /?story=1 starts the story.
  useEffect(() => {
    if (new URLSearchParams(search).get("story") === "1" && !storyStore.get().active) storyStore.start();
  }, [search]);

  // Take the visitor to whatever the current step is about.
  useEffect(() => {
    if (!s.active) return;
    navigate(s.route);
    if (!step.focus) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(step.focus!);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90 });
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.active, s.tick]);

  useEffect(() => {
    if (!s.active || !s.auto || last) return;
    const t = window.setTimeout(storyStore.next, STEP_MS);
    return () => window.clearTimeout(t);
  }, [s.active, s.auto, s.step, last]);

  useEffect(() => {
    if (!s.active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") storyStore.exit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.active]);

  if (!s.active) return null;
  const ghost = "border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background";
  return (
    <section aria-label="Guided story" className="fixed inset-x-3 bottom-3 z-50 rounded-lg border border-foreground/20 bg-foreground p-4 text-background shadow-lift sm:inset-x-auto sm:left-4 sm:w-[27rem]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-background/80">Story · {s.step + 1} of {STEPS.length}</p>
        <button type="button" onClick={storyStore.exit} className="-m-1 rounded-full p-1 text-background/80 hover:bg-background/10 hover:text-background" aria-label="Close the story">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/20" role="progressbar" aria-label="Story progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={s.step + 1}>
        <div className="iris-bar h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${((s.step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div aria-live="polite">
        <h2 className="mt-3 font-display text-lg font-bold leading-snug">{step.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-background/90">{s.body}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {last ? (
          <>
            <Button variant="sun" size="sm" onClick={() => navigate(storyStore.tryIt())}>Try it yourself <ArrowRight /></Button>
            <Button variant="outline" size="sm" className={ghost} onClick={storyStore.start}><RotateCcw /> Watch again</Button>
          </>
        ) : (
          <>
            <Button variant="sun" size="sm" onClick={storyStore.next}>Next <ArrowRight /></Button>
            <Button variant="outline" size="sm" className={ghost} onClick={storyStore.toggleAuto} aria-pressed={s.auto}>
              {s.auto ? <><Pause /> Pause</> : <><Play /> Auto-play</>}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
