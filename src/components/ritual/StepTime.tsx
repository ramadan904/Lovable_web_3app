import { StepActions, StepHeader } from "./StepFrame";
import { HourPicker } from "@/components/hour/HourPicker";
import { Button } from "@/components/ui/button";
import type { RitualDraft } from "@/hooks/useRitual";
import type { Guide, SessionType } from "@/lib/types";
import { spell } from "@/lib/utils";

export function StepTime({
  draft,
  update,
  guide,
  form,
  onNext,
  onBack,
  onChangeGuide,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  guide: Guide;
  form: SessionType;
  onNext: () => void;
  onBack: () => void;
  onChangeGuide: () => void;
}) {
  const firstName = guide.name.split(" ")[0];

  return (
    <div>
      <StepHeader step={4} title="Choose the hour.">
        {firstName} holds {guide.max_sessions_per_day === 1 ? "one threshold a day" : `no more than ${spell(guide.max_sessions_per_day)} thresholds a day`}, and keeps forty-five minutes of stillness before and after each one. These are the hours that remain.
      </StepHeader>

      <HourPicker
        guide={guide}
        durationMin={form.duration_min}
        practicalMin={form.key === "aftermath" ? 60 : 0}
        tz={draft.clientTz}
        onTzChange={(clientTz) => update({ clientTz })}
        value={draft.slotStart}
        onChange={(slotStart) => update({ slotStart })}
        notice={draft.notice}
        onNotice={(notice) => update({ notice })}
        emptyAction={
          <Button variant="outline" onClick={onChangeGuide}>
            Choose another Guide
          </Button>
        }
      />

      <StepActions onBack={onBack} onNext={onNext} canNext={!!draft.slotStart} />
    </div>
  );
}
