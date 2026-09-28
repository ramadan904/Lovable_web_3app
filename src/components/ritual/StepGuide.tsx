import { useEffect, useMemo } from "react";
import { StepActions, StepHeader } from "./StepFrame";
import { GuideMark } from "@/components/brand/GuideMark";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuides, useThresholds } from "@/hooks/useCatalogue";
import { useGuideSlots } from "@/hooks/useSlots";
import { useNow } from "@/hooks/useNow";
import type { RitualDraft } from "@/hooks/useRitual";
import { PRESENCE } from "@/lib/data/seed";
import { matchGuides } from "@/lib/matching";
import { cityOf, fmt, fmtTime } from "@/lib/time";
import type { Guide } from "@/lib/types";
import { cn, spell } from "@/lib/utils";

export function StepGuide({
  draft,
  update,
  onNext,
  onBack,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const guides = useGuides();
  const thresholds = useThresholds();
  const threshold = thresholds.data?.find((t) => t.slug === draft.thresholdSlug);

  const matched = useMemo(
    () => (guides.data && thresholds.data ? matchGuides(guides.data, draft.thresholdSlug, draft.thresholdWords, thresholds.data) : []),
    [guides.data, thresholds.data, draft.thresholdSlug, draft.thresholdWords],
  );

  // A Guide chosen earlier (or from the Guides page) who isn't a match here is kept visible, first.
  const shown = useMemo(() => {
    const chosen = guides.data?.find((g) => g.id === draft.guideId);
    if (chosen && !matched.some((g) => g.id === chosen.id)) return [chosen, ...matched].slice(0, 5);
    return matched;
  }, [matched, guides.data, draft.guideId]);

  useEffect(() => {
    if (draft.guideId && guides.data && !guides.data.some((g) => g.id === draft.guideId)) update({ guideId: null, slotStart: null });
  }, [draft.guideId, guides.data, update]);

  const loading = guides.isLoading || thresholds.isLoading;
  const count = shown.length;

  return (
    <div>
      <StepHeader
        step={1}
        title={
          loading ? (
            <span className="text-bone/60">Finding who holds this…</span>
          ) : (
            <>
              {spell(count).replace(/^./, (c) => c.toUpperCase())} Guides hold {threshold ? "this threshold" : "thresholds like yours"}.
            </>
          )
        }
      >
        We show only a few, on purpose. Choose the one whose words you can imagine hearing on the day.
      </StepHeader>

      <fieldset>
        <legend className="sr-only">Guides</legend>
        <div className="space-y-4">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-6 rounded-lg border border-bone/[0.07] p-6 md:p-8">
                <Skeleton className="h-[4.5rem] w-14" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              </div>
            ))}
          {shown.map((g, i) => (
            <GuideOption
              key={g.id}
              guide={g}
              index={i}
              selected={draft.guideId === g.id}
              clientTz={draft.clientTz}
              onSelect={() => update({ guideId: g.id, slotStart: draft.guideId === g.id ? draft.slotStart : null })}
              onEnter={onNext}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-12 grid gap-x-10 gap-y-4 border-t border-bone/[0.07] pt-8 text-sm sm:grid-cols-2">
        {Object.entries(PRESENCE).map(([k, p]) => (
          <p key={k} className="text-bone-faint">
            <span className="text-bone-dim">{p.name}.</span> {p.line}
          </p>
        ))}
      </div>

      <StepActions onBack={onBack} onNext={onNext} canNext={!!draft.guideId} />
    </div>
  );
}

function GuideOption({
  guide,
  index,
  selected,
  clientTz,
  onSelect,
  onEnter,
}: {
  guide: Guide;
  index: number;
  selected: boolean;
  clientTz: string;
  onSelect: () => void;
  onEnter: () => void;
}) {
  const now = useNow(60_000);
  const { result, isLoading } = useGuideSlots(guide, 90);
  const next = result?.slots.find((s) => s.state === "open");
  const firstName = guide.name.split(" ")[0];

  return (
    <label
      className={cn(
        "group relative block cursor-pointer rounded-lg border p-6 transition-[border-color,background-color,box-shadow] duration-700 ease-quiet animate-rise-in md:p-8",
        "has-[:focus-visible]:border-copper/60",
        selected
          ? "border-copper/50 bg-copper/[0.04] shadow-[0_0_80px_-30px_hsl(var(--copper)/0.5)]"
          : "border-bone/[0.08] hover:border-bone/20 hover:bg-bone/[0.015]",
      )}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <input
        type="radio"
        name="guide"
        value={guide.id}
        checked={selected}
        onChange={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
        className="sr-only"
      />
      <div className="flex gap-5 md:gap-8">
        <GuideMark name={guide.name} presence={guide.presence} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="font-serif text-[1.75rem] leading-tight text-bone md:text-[2rem]">
              {guide.name}
              {guide.pronouns && <span className="ml-3 font-sans text-xs text-bone-faint">{guide.pronouns}</span>}
            </h2>
            <p className="text-xs tabular-nums text-bone-faint">
              {guide.location} · {fmtTime(now, guide.timezone)} there now
            </p>
          </div>
          <p className="mt-1 text-sm text-bone-dim">
            <span className="text-copper-bright">{PRESENCE[guide.presence].name}</span>
            <span className="mx-2 text-bone-ghost">·</span>
            {guide.years_holding} years holding thresholds
          </p>

          <blockquote className="mt-5 max-w-2xl font-serif text-xl italic leading-snug text-bone/90 md:text-[1.375rem]">
            “{guide.statement}”
          </blockquote>

          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-700 ease-quiet",
              selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 md:grid-rows-[1fr] md:opacity-100",
            )}
          >
            <div className="overflow-hidden">
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-bone-dim">{guide.background}</p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={`About ${firstName}`}>
                {guide.tags.map((t) => (
                  <li key={t} className="rounded-full border border-bone/10 px-3 py-1 text-xs text-bone-faint">
                    {t}
                  </li>
                ))}
                <li className="rounded-full border border-bone/10 px-3 py-1 text-xs text-bone-faint">{guide.languages.join(" · ")}</li>
              </ul>
            </div>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-bone-faint">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", next ? "bg-copper/80" : "bg-bone/20")} aria-hidden />
            {isLoading ? (
              <span className="skeleton inline-block h-4 w-48 align-middle" aria-hidden />
            ) : next ? (
              <>
                Next open hour{" "}
                <span className="text-bone-dim">
                  {fmt(next.start, clientTz, "EEE d MMM")}, {fmtTime(next.start, clientTz)}
                </span>
                <span className="text-bone-ghost">({cityOf(clientTz)})</span>
              </>
            ) : (
              <>No open hours in the next four weeks</>
            )}
            <span className="text-bone-ghost">·</span>
            {guide.max_sessions_per_day === 1 ? "one threshold a day" : `at most ${spell(guide.max_sessions_per_day)} a day`}
          </p>
        </div>
      </div>
    </label>
  );
}
