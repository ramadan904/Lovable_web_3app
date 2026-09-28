import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/brand/PageShell";
import { GuideMark } from "@/components/brand/GuideMark";
import { EmptyState } from "@/components/threshold/EmptyState";
import { AutomationList, HandledTiles } from "@/components/threshold/Handled";
import { automationsFor, ledgerFor } from "@/lib/automations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAvailability, useGuides, useSessionTypes, useThresholds } from "@/hooks/useCatalogue";
import { useDemoEntry } from "@/hooks/useDemoEntry";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/data";
import {
  addDaysToKey,
  cityOf,
  dateKeyInZone,
  durationWords,
  fmt,
  fmtTime,
  fromMinutes,
  offsetLabel,
  toMinutes,
  weekdayOfKey,
  zonedInstant,
} from "@/lib/time";
import type { AvailabilityRule, Guide, GuideBriefing } from "@/lib/types";
import { cn, spell } from "@/lib/utils";

const HOUR_PX = 52;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function GuideCalendar() {
  const { user, ready } = useAuth();
  const guides = useGuides();
  const { enter, busy } = useDemoEntry();
  const guide = guides.data?.find((g) => g.id === user?.guide_id);

  if (!ready || (user?.guide_id && guides.isLoading)) {
    return (
      <PageShell>
        <div className="container py-16">
          <Skeleton className="mb-6 h-12 w-72" />
          <Skeleton className="h-[34rem] w-full rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (!user || !user.guide_id || !guide) {
    return (
      <PageShell>
        <EmptyState
          title="The Guide's calendar."
          action={
            <div className="flex flex-col items-center gap-4">
              <Button onClick={() => enter("guide")} disabled={!!busy}>
                {busy === "guide" && <Loader2 className="animate-spin" aria-hidden />}
                Enter as Mara, a demo Guide
              </Button>
              <Link to="/login?next=/guide" className="text-sm text-bone-faint underline decoration-bone/20 underline-offset-4 hover:text-bone-dim">
                Sign in with a Guide account
              </Link>
            </div>
          }
        >
          Guides see their week here: every session with its forty-five minutes of stillness either side, and the briefing each client wrote before
          arriving.
        </EmptyState>
      </PageShell>
    );
  }

  return <GuideWeek guide={guide} />;
}

function GuideWeek({ guide }: { guide: Guide }) {
  const tz = guide.timezone;
  const now = useNow(60_000);
  const todayKey = dateKeyInZone(now, tz);
  const mondayKey = addDaysToKey(todayKey, -((weekdayOfKey(todayKey) + 6) % 7));
  const [weekKey, setWeekKey] = useState(mondayKey);
  const [open, setOpen] = useState<GuideBriefing | null>(null);
  const [editing, setEditing] = useState(false);
  const types = useSessionTypes();
  const thresholds = useThresholds();
  const availability = useAvailability(guide.id);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToKey(weekKey, i)), [weekKey]);
  const from = zonedInstant(weekKey, "00:00", tz);
  const to = zonedInstant(addDaysToKey(weekKey, 7), "00:00", tz);

  const briefings = useQuery({
    queryKey: ["guide", "briefings", guide.id, weekKey],
    queryFn: () => api.guideBriefings(from, to),
    placeholderData: (prev) => prev,
  });

  const rules = availability.data ?? [];
  const sessions = (briefings.data ?? []).filter((s) => s.status !== "cancelled");
  const released = (briefings.data ?? []).filter((s) => s.status === "cancelled").length;

  const [startHour, endHour] = useMemo(() => {
    const mins = rules.flatMap((r) => [toMinutes(r.start_local), toMinutes(r.end_local)]);
    const lo = mins.length ? Math.floor(Math.min(...mins) / 60) - 1 : 7;
    const hi = mins.length ? Math.ceil(Math.max(...mins) / 60) + 1 : 20;
    return [Math.max(0, Math.min(lo, 8)), Math.min(24, Math.max(hi, 18))];
  }, [rules]);

  const minutesInDay = (d: Date, key: string) => (d.getTime() - zonedInstant(key, "00:00", tz).getTime()) / 60_000;
  const y = (mins: number) => ((mins - startHour * 60) / 60) * HOUR_PX;
  const heldThisWeek = sessions.filter((s) => new Date(s.starts_at) >= from && new Date(s.starts_at) < to);
  const typeOf = (k: string) => types.data?.find((t) => t.key === k);
  const thresholdOf = (slug: string | null) => thresholds.data?.find((t) => t.slug === slug);

  return (
    <PageShell>
      <div className="container pb-24 pt-8 md:pt-12">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-8">
          <div className="flex items-end gap-6">
            <GuideMark name={guide.name} presence={guide.presence} />
            <div>
              <p className="eyebrow mb-3">Guide calendar</p>
              <h1 className="font-serif text-4xl leading-none text-bone md:text-5xl">{guide.name.split(" ")[0]}'s week</h1>
              <p className="mt-3 text-sm text-bone-faint">
                All times in {cityOf(tz)} ({offsetLabel(tz, now)}) · at most {spell(guide.max_sessions_per_day)} a day · {guide.buffer_min} minutes of stillness either side,
                always
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekKey(addDaysToKey(weekKey, -7))}>
              <ChevronLeft />
            </Button>
            <button
              type="button"
              onClick={() => setWeekKey(mondayKey)}
              disabled={weekKey === mondayKey}
              className="min-w-[10rem] text-center text-sm text-bone-dim disabled:cursor-default"
            >
              {fmt(from, tz, "d MMM")} – {fmt(new Date(to.getTime() - 1), tz, "d MMM")}
              {weekKey !== mondayKey && <span className="block text-xs text-bone-faint underline underline-offset-4">Back to this week</span>}
            </button>
            <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekKey(addDaysToKey(weekKey, 7))}>
              <ChevronRight />
            </Button>
          </div>
        </header>

        <HandledTiles ledger={ledgerFor(briefings.data?.filter((s) => new Date(s.starts_at) >= from && new Date(s.starts_at) < to) ?? [], now)} demo={api.mode === "demo"} />

        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-bone-faint">
          <Legend swatch="bg-bone/[0.05] ring-1 ring-inset ring-bone/10" label="Available" />
          <Legend swatch="bg-copper" label="Session" />
          <Legend swatch="buffer-hatch" label="Stillness — prepare / rest (cannot be booked)" />
          <span className="ml-auto flex items-center gap-4">
            <span className="tabular-nums">
              {heldThisWeek.length} held{released ? ` · ${released} released` : ""}
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Availability
            </Button>
          </span>
        </div>

        {/* Week grid (md+) */}
        <div className="relative hidden overflow-hidden rounded-lg border border-bone/[0.08] md:block" aria-busy={briefings.isFetching}>
          {/* Loading is a line of light along the top edge — never a dimmed, harder-to-read calendar. */}
          <div
            className={cn("copper-line pointer-events-none absolute inset-x-0 top-0 z-20 h-px transition-opacity duration-700", briefings.isFetching ? "animate-breathe opacity-100" : "opacity-0")}
            aria-hidden
          />
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-bone/[0.08] bg-charcoal-850">
            <div />
            {days.map((k) => {
              const count = sessions.filter((s) => dateKeyInZone(new Date(s.starts_at), tz) === k).length;
              const full = count >= guide.max_sessions_per_day;
              return (
                <div key={k} className={cn("border-l border-bone/[0.06] px-3 py-3", k === todayKey && "bg-copper/[0.05]")}>
                  <p className={cn("text-xs", k === todayKey ? "text-copper-bright" : "text-bone-faint")}>{fmt(zonedInstant(k, "12:00", tz), tz, "EEE")}</p>
                  <p className="flex items-baseline justify-between font-serif text-2xl text-bone">
                    {Number(k.slice(8))}
                    {full && <span className="font-sans text-[0.625rem] uppercase tracking-wider text-copper-bright">Full</span>}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: (endHour - startHour) * HOUR_PX }}>
            <div className="relative">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-[0.625rem] tabular-nums text-bone-faint" style={{ top: i * HOUR_PX }}>
                  {i === 0 ? "" : fromMinutes((startHour + i) * 60)}
                </span>
              ))}
            </div>
            {days.map((k) => {
              const dayRules = rules.filter((r) => r.weekday === weekdayOfKey(k));
              const daySessions = sessions.filter((s) => dateKeyInZone(new Date(s.starts_at), tz) === k);
              const isPast = k < todayKey;
              return (
                <div key={k} className={cn("relative border-l border-bone/[0.06]", k === todayKey && "bg-copper/[0.025]")}>
                  {Array.from({ length: endHour - startHour }, (_, i) => (
                    <div key={i} className="absolute inset-x-0 border-t border-bone/[0.04]" style={{ top: i * HOUR_PX }} />
                  ))}
                  {dayRules.map((r) => (
                    <div
                      key={`${r.weekday}-${r.start_local}`}
                      className={cn("absolute inset-x-1 rounded-sm bg-bone/[0.035] ring-1 ring-inset ring-bone/[0.07]", isPast && "opacity-50")}
                      style={{ top: y(toMinutes(r.start_local)), height: y(toMinutes(r.end_local)) - y(toMinutes(r.start_local)) }}
                    />
                  ))}
                  {daySessions.map((s) => {
                    const start = new Date(s.starts_at);
                    const end = new Date(s.ends_at);
                    const sm = minutesInDay(start, k);
                    const em = minutesInDay(end, k);
                    const bs = sm - s.buffer_before_min;
                    const be = em + s.buffer_after_min;
                    const past = end < now;
                    return (
                      <div key={s.id}>
                        <div className={cn("buffer-hatch absolute inset-x-1.5 rounded-t-sm", past && "opacity-40")} style={{ top: y(bs), height: y(sm) - y(bs) }}>
                          <span className="absolute left-1.5 top-1 text-[0.5625rem] uppercase tracking-wider text-copper-bright/80">Prepare</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpen(s)}
                          className={cn(
                            "group absolute inset-x-1.5 overflow-hidden px-2 py-1.5 text-left transition-[background-color,box-shadow] duration-500 focus-visible:outline-offset-2",
                            past ? "bg-charcoal-700 text-bone-dim hover:bg-charcoal-700/70" : "bg-copper text-charcoal-950 hover:bg-copper-bright",
                          )}
                          style={{ top: y(sm), height: y(em) - y(sm) }}
                          aria-label={`${s.client_name}, ${fmtTime(start, tz)} to ${fmtTime(end, tz)}. Open briefing.`}
                        >
                          <span className="block text-[0.6875rem] font-medium tabular-nums">
                            {fmtTime(start, tz)}–{fmtTime(end, tz)}
                          </span>
                          <span className="block truncate font-serif text-base leading-tight">{s.client_name}</span>
                          <span className="block truncate text-[0.6875rem]">{thresholdOf(s.threshold_slug)?.name ?? "Threshold"}</span>
                        </button>
                        <div className={cn("buffer-hatch absolute inset-x-1.5 rounded-b-sm", past && "opacity-40")} style={{ top: y(em), height: y(be) - y(em) }}>
                          <span className="absolute bottom-1 left-1.5 text-[0.5625rem] uppercase tracking-wider text-copper-bright/80">Rest</span>
                        </div>
                      </div>
                    );
                  })}
                  {k === todayKey && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-copper-bright" style={{ top: y(minutesInDay(now, k)) }} aria-hidden>
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-copper-bright" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda (small screens) */}
        <div className="space-y-8 md:hidden">
          {days.map((k) => {
            const daySessions = sessions.filter((s) => dateKeyInZone(new Date(s.starts_at), tz) === k);
            const dayRules = rules.filter((r) => r.weekday === weekdayOfKey(k));
            return (
              <section key={k}>
                <h2 className={cn("mb-3 font-serif text-2xl", k === todayKey ? "text-copper-bright" : "text-bone")}>
                  {fmt(zonedInstant(k, "12:00", tz), tz, "EEEE d")}
                </h2>
                {daySessions.length === 0 ? (
                  <p className="text-sm text-bone-faint">{dayRules.length ? "Available, nothing held." : "Not available."}</p>
                ) : (
                  <div className="space-y-2">
                    {daySessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setOpen(s)}
                        className="w-full rounded-md border border-bone/10 p-4 text-left transition-colors duration-500 hover:border-copper/50"
                      >
                        <p className="text-xs tabular-nums text-bone-faint">
                          Prepare {fmtTime(new Date(+new Date(s.starts_at) - s.buffer_before_min * 60_000), tz)} ·{" "}
                          <span className="text-copper-bright">
                            {fmtTime(s.starts_at, tz)}–{fmtTime(s.ends_at, tz)}
                          </span>{" "}
                          · rest until {fmtTime(new Date(+new Date(s.ends_at) + s.buffer_after_min * 60_000), tz)}
                        </p>
                        <p className="mt-1 font-serif text-xl text-bone">{s.client_name}</p>
                        <p className="text-sm text-bone-faint">{thresholdOf(s.threshold_slug)?.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {!briefings.isLoading && heldThisWeek.length === 0 && (
          <p className="mt-8 text-center text-sm text-bone-faint">Nothing is held this week. The quiet is part of the work.</p>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent side="right">
          {open && <Briefing s={open} guide={guide} formName={typeOf(open.session_type)?.name} duration={typeOf(open.session_type)?.duration_min} thresholdName={thresholdOf(open.threshold_slug)?.name} now={now} />}
        </DialogContent>
      </Dialog>

      <AvailabilityEditor open={editing} onOpenChange={setEditing} guide={guide} rules={rules} />
    </PageShell>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-[2px]", swatch)} aria-hidden />
      {label}
    </span>
  );
}

function Briefing({
  s,
  guide,
  formName,
  duration,
  thresholdName,
  now,
}: {
  s: GuideBriefing;
  guide: Guide;
  formName?: string;
  duration?: number;
  thresholdName?: string;
  now: Date;
}) {
  const tz = guide.timezone;
  const start = new Date(s.starts_at);
  const end = new Date(s.ends_at);
  const past = end < now;
  return (
    <div>
      <p className="eyebrow">{past ? "Crossed" : "Briefing"}</p>
      <DialogTitle className="mt-4 text-5xl">{s.client_name}</DialogTitle>
      <DialogDescription className="text-base">
        {thresholdName ?? "A threshold in their own words"} · {formName} · {durationWords(duration ?? 90)}
      </DialogDescription>

      {s.rescheduled_from && (
        <p className="mt-6 text-sm text-bone-faint">
          Moved by {s.client_name} from {fmt(s.rescheduled_from, tz, "EEE d MMM, HH:mm")}. Nothing needed from you — your calendar and buffers were updated.
        </p>
      )}

      {s.threshold_words && (
        <blockquote className="mt-8 border-l border-copper/60 pl-5 font-serif text-xl italic leading-snug text-bone/90">“{s.threshold_words}”</blockquote>
      )}

      <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-bone/[0.07] py-6 text-sm">
        <div>
          <dt className="eyebrow">Your time</dt>
          <dd className="mt-1.5 text-bone">
            {fmt(start, tz, "EEE d MMM")}, {fmtTime(start, tz)}–{fmtTime(end, tz)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Their time</dt>
          <dd className="mt-1.5 text-bone">
            {fmtTime(start, s.client_timezone)} · {cityOf(s.client_timezone)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Prepare from</dt>
          <dd className="mt-1.5 tabular-nums text-bone-dim">{fmtTime(new Date(start.getTime() - s.buffer_before_min * 60_000), tz)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Rest until</dt>
          <dd className="mt-1.5 tabular-nums text-bone-dim">{fmtTime(new Date(end.getTime() + s.buffer_after_min * 60_000), tz)}</dd>
        </div>
      </dl>

      {s.session_type === "witnessed" && <p className="mt-6 text-sm text-bone-dim">They will bring one witness.</p>}
      {s.session_type === "aftermath" && <p className="mt-6 text-sm text-bone-dim">The final hour is practical: what must be done next.</p>}

      <h3 className="mb-6 mt-10 font-serif text-2xl text-bone">What they told you</h3>
      <dl className="space-y-7">
        {s.answers.map((a) => (
          <div key={a.position}>
            <dt className="text-xs text-bone-faint">{a.prompt}</dt>
            <dd className={cn("mt-2 font-serif text-[1.3125rem] leading-snug", a.answer ? "text-bone/90" : "italic text-bone-faint")}>
              {a.answer ?? "They chose to bring this into the room."}
            </dd>
          </div>
        ))}
        {s.answers.length === 0 && <p className="text-sm text-bone-faint">No answers were written.</p>}
      </dl>

      <h3 className="mb-6 mt-12 font-serif text-2xl text-bone">Handled for you</h3>
      <AutomationList items={automationsFor(s, { guideName: guide.name, forGuide: true, now })} tz={tz} />

      <p className="mt-12 flex items-start gap-3 rounded-md bg-bone/[0.03] p-4 text-sm leading-relaxed text-bone-faint">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        If they wrote a letter to their future self, it is sealed and private. Guides never see it.
      </p>
    </div>
  );
}

type DayRow = { enabled: boolean; start: string; end: string };

function AvailabilityEditor({
  open,
  onOpenChange,
  guide,
  rules,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guide: Guide;
  rules: AvailabilityRule[];
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const order = [1, 2, 3, 4, 5, 6, 0];
    setRows(
      order.map((wd) => {
        const r = rules.find((x) => x.weekday === wd);
        return { enabled: !!r, start: r?.start_local ?? "09:00", end: r?.end_local ?? "17:00" };
      }),
    );
  }, [open, rules]);

  const times = Array.from({ length: 33 }, (_, i) => fromMinutes(360 + i * 30)); // 06:00–22:00
  const minSpan = 90 + guide.buffer_min * 2;
  const tooShort = rows.some((r) => r.enabled && toMinutes(r.end) - toMinutes(r.start) < minSpan);

  const save = async () => {
    setSaving(true);
    try {
      const order = [1, 2, 3, 4, 5, 6, 0];
      await api.updateAvailability(
        guide.id,
        rows.flatMap((r, i) => (r.enabled ? [{ weekday: order[i], start_local: r.start, end_local: r.end }] : [])),
      );
      await qc.invalidateQueries({ queryKey: ["availability", guide.id] });
      await qc.invalidateQueries({ queryKey: ["busy", guide.id] });
      toast("Availability saved.", { description: "Sessions already held are unaffected." });
      onOpenChange(false);
    } catch (e) {
      toast("Availability couldn't be saved.", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <p className="eyebrow">Availability</p>
        <DialogTitle className="mt-4">When you are present</DialogTitle>
        <DialogDescription>
          In {cityOf(guide.timezone)} time. Each window must hold a session with its stillness: {guide.buffer_min} minutes before and after are
          fixed, and can't be changed.
        </DialogDescription>
        <div className="mt-10 space-y-1">
          {rows.map((r, i) => {
            const wd = [1, 2, 3, 4, 5, 6, 0][i];
            const short = r.enabled && toMinutes(r.end) - toMinutes(r.start) < minSpan;
            return (
              <div key={wd} className="flex flex-wrap items-center gap-4 border-b border-bone/[0.07] py-3">
                <label className="flex w-36 items-center gap-3 text-sm text-bone">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                    className="h-4 w-4 accent-[hsl(var(--copper))]"
                  />
                  {WEEKDAYS[wd]}
                </label>
                <div className={cn("flex items-center gap-2 text-sm transition-opacity duration-500", !r.enabled && "pointer-events-none opacity-30")}>
                  <TimeSelect label={`${WEEKDAYS[wd]} start`} value={r.start} options={times} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, start: v } : x)))} />
                  <span className="text-bone-faint">–</span>
                  <TimeSelect label={`${WEEKDAYS[wd]} end`} value={r.end} options={times} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, end: v } : x)))} />
                </div>
                {short && <span className="text-xs text-[hsl(8_60%_72%)]">Too short to hold a session</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || tooShort}>
            {saving && <Loader2 className="animate-spin" aria-hidden />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-bone/15 bg-charcoal-800 px-2 py-1.5 tabular-nums text-bone"
    >
      {!options.includes(value) && <option value={value}>{value}</option>}
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
