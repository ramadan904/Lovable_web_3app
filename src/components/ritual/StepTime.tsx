import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, RefreshCw } from "lucide-react";
import { StepActions, StepHeader } from "./StepFrame";
import { SpanDiagram } from "@/components/threshold/SpanDiagram";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuideSlots } from "@/hooks/useSlots";
import { useNow } from "@/hooks/useNow";
import type { RitualDraft } from "@/hooks/useRitual";
import {
  HORIZON_DAYS,
  addDaysToKey,
  allTimezones,
  cityOf,
  dateKeyInZone,
  fmt,
  fmtTime,
  groupByClientDay,
  offsetLabel,
  weekdayOfKey,
  zonedInstant,
  type Slot,
} from "@/lib/time";
import type { BusyRange, Guide, SessionType } from "@/lib/types";
import { cn, spell } from "@/lib/utils";

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
  const tz = draft.clientTz;
  const now = useNow(60_000);
  const { result, busy, isLoading, isError, isFetching, refetch } = useGuideSlots(guide, form.duration_min);
  const firstName = guide.name.split(" ")[0];

  const open = useMemo(() => result?.slots.filter((s) => s.state === "open") ?? [], [result]);
  const byDay = useMemo(() => groupByClientDay(open, tz), [open, tz]);
  const selectedSlot = open.find((s) => s.start.toISOString() === draft.slotStart) ?? null;

  const todayKey = dateKeyInZone(now, tz);
  const [dayKey, setDayKey] = useState<string | null>(() =>
    draft.slotStart ? dateKeyInZone(new Date(draft.slotStart), tz) : null,
  );

  // Choose a sensible day once slots arrive: the chosen slot's day, else the first open day.
  useEffect(() => {
    if (!result) return;
    if (dayKey && byDay.has(dayKey)) return;
    const first = [...byDay.keys()].sort()[0] ?? null;
    if (draft.slotStart && !selectedSlot) return; // handled below
    setDayKey((k) => (k && byDay.has(k) ? k : first));
  }, [result, byDay, dayKey, draft.slotStart, selectedSlot]);

  // If the chosen hour has been held by someone else meanwhile, say so and let it go.
  useEffect(() => {
    if (!result || !draft.slotStart || selectedSlot) return;
    const was = new Date(draft.slotStart);
    const stillListed = result.slots.some((s) => s.start.getTime() === was.getTime());
    update({
      slotStart: null,
      notice:
        draft.notice ??
        (stillListed
          ? `${fmt(was, tz, "EEEE d MMMM, HH:mm")} has just been given to someone else, or now sits inside another session's stillness. These are the hours that remain.`
          : `${fmt(was, tz, "EEEE d MMMM, HH:mm")} is no longer open — Guides need at least a day to prepare. These are the hours that remain.`),
    });
    setDayKey(dateKeyInZone(was, tz));
  }, [result, draft.slotStart, selectedSlot, draft.notice, tz, update]);

  const daySlots = dayKey ? byDay.get(dayKey) ?? [] : [];
  const heldThatDay = useMemo(
    () => (dayKey && result ? result.slots.filter((s) => s.state !== "open" && dateKeyInZone(s.start, tz) === dayKey).length : 0),
    [result, dayKey, tz],
  );

  const sameZone = offsetLabel(tz, now) === offsetLabel(guide.timezone, now) && cityOf(tz) === cityOf(guide.timezone);
  const dstShift = selectedSlot && offsetLabel(tz, now) !== offsetLabel(tz, selectedSlot.start);

  return (
    <div>
      <StepHeader step={4} title="Choose the hour.">
        {firstName} holds {guide.max_sessions_per_day === 1 ? "one threshold a day" : `no more than ${spell(guide.max_sessions_per_day)} thresholds a day`}, and keeps forty-five minutes of stillness before and after each one. These are the hours that remain.
      </StepHeader>

      {draft.notice && (
        <div role="status" className="mb-10 flex items-start justify-between gap-6 border-l border-copper pl-5 animate-fade-in">
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-bone-dim">{draft.notice}</p>
          <button type="button" onClick={() => update({ notice: null })} className="shrink-0 text-xs text-bone-faint hover:text-bone-dim">
            Dismiss
          </button>
        </div>
      )}

      <TimezoneBar tz={tz} onChange={(next) => update({ clientTz: next })} guide={guide} sameZone={sameZone} />

      {isError ? (
        <div className="rounded-lg border border-bone/10 p-10 text-center">
          <p className="font-serif text-2xl text-bone">The calendar didn't answer.</p>
          <p className="mt-2 text-sm text-bone-dim">Nothing is lost. Try again in a moment.</p>
          <Button variant="outline" className="mt-6" onClick={() => refetch()}>
            <RefreshCw aria-hidden /> Try again
          </Button>
        </div>
      ) : isLoading || !result ? (
        <CalendarSkeleton />
      ) : open.length === 0 ? (
        <div className="rounded-lg border border-bone/10 px-6 py-14 text-center md:px-12">
          <p className="font-serif text-3xl text-bone">{firstName} has no open hours in the next four weeks.</p>
          <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-bone-dim">
            Every hour is held, or sits inside someone else's stillness. Another Guide may be able to meet you sooner.
          </p>
          <Button variant="outline" className="mt-8" onClick={onChangeGuide}>
            Choose another Guide
          </Button>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
          <MonthGrid
            todayKey={todayKey}
            dayKey={dayKey}
            byDay={byDay}
            onSelect={(k) => setDayKey(k)}
            tz={tz}
            refreshing={isFetching}
          />

          <div aria-live="polite">
            {dayKey && (
              <div key={dayKey} className="animate-fade-in">
                <h2 className="font-serif text-[2rem] leading-tight text-bone">{fmt(zonedInstant(dayKey, "12:00", tz), tz, "EEEE d MMMM")}</h2>
                {daySlots.length === 0 ? (
                  <p className="mt-3 text-[0.9375rem] text-bone-dim">No open hours on this day. Choose a day marked with light.</p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-bone-faint">
                      {daySlots.length === 1 ? "One hour remains" : `${spell(daySlots.length).replace(/^./, (c) => c.toUpperCase())} hours remain`}
                      {heldThatDay > 0 && " — others are held, or fall inside someone's stillness"}.
                    </p>
                    <div role="radiogroup" aria-label="Open hours" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {daySlots.map((s) => (
                        <SlotButton
                          key={s.start.toISOString()}
                          slot={s}
                          tz={tz}
                          guideTz={guide.timezone}
                          guideCity={guide.location}
                          sameZone={sameZone}
                          selected={draft.slotStart === s.start.toISOString()}
                          onSelect={() => update({ slotStart: s.start.toISOString(), notice: null })}
                        />
                      ))}
                    </div>
                  </>
                )}

                <DayShape dayKey={dayKey} tz={tz} busy={busy ?? []} windows={result.windows} selected={selectedSlot} />

                {selectedSlot && (
                  <div className="mt-10 animate-rise-in">
                    <p className="eyebrow mb-4">The shape of your hour</p>
                    <SpanDiagram
                      durationMin={form.duration_min}
                      practicalMin={form.key === "aftermath" ? 60 : 0}
                      times={{
                        prepare: fmtTime(selectedSlot.blockedStart, tz),
                        start: fmtTime(selectedSlot.start, tz),
                        end: fmtTime(selectedSlot.end, tz),
                        rest: fmtTime(selectedSlot.blockedEnd, tz),
                      }}
                    />
                    <p className="mt-6 text-sm leading-relaxed text-bone-faint">
                      {firstName} begins preparing at {fmtTime(selectedSlot.blockedStart, tz)}. Your session closes at{" "}
                      {fmtTime(selectedSlot.end, tz)}, and no one is seen until {fmtTime(selectedSlot.blockedEnd, tz)}.
                      {!sameZone && (
                        <>
                          {" "}
                          For {firstName} in {guide.location}, it will be {fmt(selectedSlot.start, guide.timezone, "EEEE")} at{" "}
                          {fmtTime(selectedSlot.start, guide.timezone)}.
                        </>
                      )}
                      {dstShift && (
                        <>
                          {" "}
                          Your clocks change before this date ({offsetLabel(tz, now)} → {offsetLabel(tz, selectedSlot.start)}); the time shown already
                          accounts for it.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <StepActions onBack={onBack} onNext={onNext} canNext={!!selectedSlot} />
    </div>
  );
}

function TimezoneBar({ tz, onChange, guide, sameZone }: { tz: string; onChange: (tz: string) => void; guide: Guide; sameZone: boolean }) {
  const [editing, setEditing] = useState(false);
  const zones = useMemo(() => {
    const list = allTimezones();
    return list.includes(tz) ? list : [tz, ...list];
  }, [tz]);

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-bone/[0.07] py-4 text-sm">
      <Globe2 className="h-4 w-4 text-bone-faint" aria-hidden />
      {editing ? (
        <label className="flex flex-wrap items-center gap-3">
          <span className="text-bone-faint">Show times in</span>
          <select
            autoFocus
            value={tz}
            onChange={(e) => {
              onChange(e.target.value);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            className="rounded-md border border-bone/15 bg-charcoal-850 px-3 py-2 text-bone focus-visible:border-copper"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")} ({offsetLabel(z)})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <span className="text-bone-dim">
            Times shown in <span className="text-bone">{cityOf(tz)}</span> <span className="text-bone-faint">({offsetLabel(tz)})</span>
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-bone-faint underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
          >
            Change
          </button>
        </>
      )}
      {!sameZone && (
        <span className="text-bone-faint md:ml-auto">
          {guide.name.split(" ")[0]} is in {guide.location} ({offsetLabel(guide.timezone)})
        </span>
      )}
    </div>
  );
}

function MonthGrid({
  todayKey,
  dayKey,
  byDay,
  onSelect,
  tz,
  refreshing,
}: {
  todayKey: string;
  dayKey: string | null;
  byDay: Map<string, Slot[]>;
  onSelect: (k: string) => void;
  tz: string;
  refreshing: boolean;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  // Weeks start on Monday. Pad back to the Monday on/before today.
  const lead = (weekdayOfKey(todayKey) + 6) % 7;
  const start = addDaysToKey(todayKey, -lead);
  const total = Math.ceil((lead + HORIZON_DAYS + 1) / 7) * 7;
  const keys = Array.from({ length: total }, (_, i) => addDaysToKey(start, i));
  const lastKey = addDaysToKey(todayKey, HORIZON_DAYS);
  const focusKey = dayKey ?? [...byDay.keys()].sort()[0] ?? todayKey;

  const move = (from: string, delta: number) => {
    let k = addDaysToKey(from, delta);
    for (let i = 0; i < 40 && k >= todayKey && k <= lastKey; i++) {
      if (byDay.has(k)) {
        onSelect(k);
        refs.current.get(k)?.focus();
        return;
      }
      k = addDaysToKey(k, delta > 0 ? 1 : -1);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="eyebrow">
          {fmt(zonedInstant(todayKey, "12:00", tz), tz, "MMMM")}
          {fmt(zonedInstant(todayKey, "12:00", tz), tz, "M") !== fmt(zonedInstant(lastKey, "12:00", tz), tz, "M") &&
            ` – ${fmt(zonedInstant(lastKey, "12:00", tz), tz, "MMMM")}`}
        </p>
        <span className={cn("text-[0.6875rem] text-bone-faint transition-opacity duration-700", refreshing ? "opacity-100" : "opacity-0")}>
          Checking for changes…
        </span>
      </div>
      <div role="grid" aria-label="Days with open hours" className="grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} role="columnheader" className="pb-2 text-center text-[0.6875rem] text-bone-faint">
            {d}
          </div>
        ))}
        {keys.map((k) => {
          const inRange = k >= todayKey && k <= lastKey;
          const count = byDay.get(k)?.length ?? 0;
          const selected = k === dayKey;
          const day = Number(k.slice(8));
          return (
            <div role="gridcell" key={k} className="aspect-square">
              {inRange ? (
                <button
                  ref={(el) => {
                    if (el) refs.current.set(k, el);
                    else refs.current.delete(k);
                  }}
                  type="button"
                  tabIndex={k === focusKey ? 0 : -1}
                  disabled={count === 0}
                  aria-pressed={selected}
                  aria-label={`${fmt(zonedInstant(k, "12:00", tz), tz, "EEEE d MMMM")}: ${count === 0 ? "no open hours" : `${count} open ${count === 1 ? "hour" : "hours"}`}`}
                  onClick={() => onSelect(k)}
                  onKeyDown={(e) => {
                    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
                    if (d) {
                      e.preventDefault();
                      move(k, d);
                    }
                  }}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center justify-center rounded-md text-sm tabular-nums transition-[background-color,color,box-shadow] duration-500 ease-quiet",
                    count === 0 && "cursor-default text-bone-ghost",
                    count > 0 && !selected && "text-bone hover:bg-bone/[0.05]",
                    selected && "bg-copper/[0.12] text-bone shadow-[inset_0_0_0_1px_hsl(var(--copper)/0.7)]",
                  )}
                >
                  {day === 1 && <span className="absolute inset-x-3 top-1 h-px bg-bone/25" aria-hidden />}
                  {day}
                  <span className="mt-1 flex h-1 gap-0.5" aria-hidden>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-copper/80" />
                    ))}
                  </span>
                </button>
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm text-bone-ghost/50" aria-hidden>
                  {k < todayKey ? "" : Number(k.slice(8))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotButton({
  slot,
  tz,
  guideTz,
  guideCity,
  sameZone,
  selected,
  onSelect,
}: {
  slot: Slot;
  tz: string;
  guideTz: string;
  guideCity: string;
  sameZone: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const clientDay = dateKeyInZone(slot.start, tz);
  const guideDay = dateKeyInZone(slot.start, guideTz);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group rounded-md border px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-500 ease-quiet",
        selected
          ? "border-copper/70 bg-copper/[0.08] shadow-[0_0_50px_-20px_hsl(var(--copper)/0.6)]"
          : "border-bone/10 hover:border-bone/30 hover:bg-bone/[0.02]",
      )}
    >
      <span className="block font-serif text-[1.75rem] leading-none tabular-nums text-bone">{fmtTime(slot.start, tz)}</span>
      <span className="mt-2 block text-xs text-bone-faint">until {fmtTime(slot.end, tz)}</span>
      {!sameZone && (
        <span className="mt-1 block text-xs text-bone-faint">
          {fmtTime(slot.start, guideTz)} in {guideCity}
          {guideDay !== clientDay && <span className="text-copper-bright/80"> ({fmt(slot.start, guideTz, "EEE")})</span>}
        </span>
      )}
    </button>
  );
}

/**
 * The Guide's day, drawn to scale in the client's time: when they are present,
 * what is already held (with its stillness), and where your hour would sit.
 */
function DayShape({
  dayKey,
  tz,
  busy,
  windows,
  selected,
}: {
  dayKey: string;
  tz: string;
  busy: BusyRange[];
  windows: { start: Date; end: Date }[];
  selected: Slot | null;
}) {
  const dayStart = zonedInstant(dayKey, "00:00", tz).getTime();
  const dayEnd = zonedInstant(addDaysToKey(dayKey, 1), "00:00", tz).getTime();
  const clip = <T extends { s: number; e: number }>(x: T) => ({ ...x, s: Math.max(x.s, dayStart), e: Math.min(x.e, dayEnd) });

  const win = windows.map((w) => ({ s: w.start.getTime(), e: w.end.getTime() })).filter((w) => w.e > dayStart && w.s < dayEnd).map(clip);
  const held = busy
    .map((b) => ({ s: +new Date(b.blocked_start), e: +new Date(b.blocked_end), cs: +new Date(b.starts_at), ce: +new Date(b.ends_at) }))
    .filter((b) => b.e > dayStart && b.s < dayEnd)
    .map(clip);
  if (win.length === 0) return null;

  const HOUR = 3600_000;
  const lo = Math.floor(Math.min(...win.map((w) => w.s)) / HOUR) * HOUR;
  const hi = Math.ceil(Math.max(...win.map((w) => w.e)) / HOUR) * HOUR;
  const span = hi - lo;
  const x = (t: number) => `${((Math.min(Math.max(t, lo), hi) - lo) / span) * 100}%`;
  const w = (a: number, b: number) => `${((Math.min(b, hi) - Math.max(a, lo)) / span) * 100}%`;
  const ticks = Array.from({ length: Math.round(span / HOUR) + 1 }, (_, i) => lo + i * HOUR);

  return (
    <figure className="mt-10">
      <figcaption className="eyebrow mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span>The Guide's day</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-bone/[0.06] ring-1 ring-bone/10" /> present
        </span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-bone/20" /> held for someone
        </span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="buffer-hatch h-2.5 w-2.5 rounded-[2px]" /> stillness
        </span>
      </figcaption>
      <div className="relative h-12 w-full overflow-hidden rounded-md bg-charcoal-850" aria-hidden>
        {win.map((v, i) => (
          <div key={i} className="absolute inset-y-0 bg-bone/[0.05]" style={{ left: x(v.s), width: w(v.s, v.e) }} />
        ))}
        {held.map((b, i) => (
          <div key={i}>
            <div className="buffer-hatch absolute inset-y-2 opacity-60" style={{ left: x(b.s), width: w(b.s, b.e) }} />
            <div className="absolute inset-y-2 bg-bone/20" style={{ left: x(b.cs), width: w(b.cs, b.ce) }} />
          </div>
        ))}
        {selected && (
          <div className="animate-fade-in">
            <div className="buffer-hatch absolute inset-y-1" style={{ left: x(+selected.blockedStart), width: w(+selected.blockedStart, +selected.blockedEnd) }} />
            <div className="absolute inset-y-1 bg-copper/85" style={{ left: x(+selected.start), width: w(+selected.start, +selected.end) }} />
          </div>
        )}
      </div>
      <div className="relative mt-2 h-4 text-[0.625rem] tabular-nums text-bone-faint" aria-hidden>
        {ticks.map((t, i) =>
          i % 2 === 0 ? (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>
              {fmtTime(new Date(t), tz)}
            </span>
          ) : null,
        )}
      </div>
      <p className="sr-only">
        {held.length === 0 ? "Nothing else is held on this day." : `${held.length} other ${held.length === 1 ? "session is" : "sessions are"} held on this day, each with forty-five minutes of stillness either side.`}
      </p>
    </figure>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14" aria-busy="true" aria-label="Loading open hours">
      <div>
        <Skeleton className="mb-6 h-3 w-28" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md opacity-60" style={{ animationDelay: `${(i % 7) * 60}ms` }} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-3 gap-3 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="mt-8 h-12 w-full rounded-md" />
      </div>
    </div>
  );
}
