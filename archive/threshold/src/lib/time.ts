import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { AvailabilityRule, BusyRange } from "./types";

/*
 * Time is the most fragile thing Threshold handles. Everything here works in
 * absolute instants (Date) and converts to wall-clock time only at the edges:
 * Guide-local for availability, client-local for display.
 */

export const MIN_NOTICE_HOURS = 24;
export const HORIZON_DAYS = 28;
export const LETTER_SEAL_HOURS = 48;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// ---------------------------------------------------------------------------
// Calendar-date keys ("2026-10-14") — timezone-free arithmetic
// ---------------------------------------------------------------------------

export function dateKeyInZone(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The instant at which a wall-clock time occurs in a zone. */
export function zonedInstant(key: string, hhmm: string, tz: string): Date {
  return fromZonedTime(`${key}T${hhmm}:00`, tz);
}

// ---------------------------------------------------------------------------
// Slot generation
// ---------------------------------------------------------------------------

export type SlotState = "open" | "held" | "full";

export interface Slot {
  start: Date;
  end: Date;
  blockedStart: Date;
  blockedEnd: Date;
  state: SlotState;
  guideDateKey: string;
}

export interface GuideWindow {
  guideDateKey: string;
  start: Date;
  end: Date;
}

export interface SlotParams {
  timezone: string;
  bufferMin: number;
  maxPerDay: number;
  rules: Pick<AvailabilityRule, "weekday" | "start_local" | "end_local">[];
  durationMin: number;
  busy: BusyRange[];
  now: Date;
  minNoticeHours?: number;
  horizonDays?: number;
  stepMin?: number;
  alignMin?: number;
}

export interface SlotResult {
  slots: Slot[];
  windows: GuideWindow[];
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/**
 * Every candidate start for a Guide, with its state.
 *
 * Rules that mirror the database's book_session():
 *  - the whole held span [start - buffer, end + buffer) must sit inside one
 *    availability window, in the Guide's local time;
 *  - it may not touch another held span (buffers never overlap buffers);
 *  - a Guide holds at most `maxPerDay` sessions per local day;
 *  - nothing sooner than the minimum notice, nothing beyond the horizon.
 */
export function generateSlots(p: SlotParams): SlotResult {
  const step = p.stepMin ?? 60;
  const align = p.alignMin ?? 30;
  const notice = (p.minNoticeHours ?? MIN_NOTICE_HOURS) * HOUR;
  const horizon = (p.horizonDays ?? HORIZON_DAYS) * 24 * HOUR;
  const earliest = p.now.getTime() + notice;
  const latest = p.now.getTime() + horizon;

  const busy = p.busy.map((b) => ({
    start: new Date(b.blocked_start).getTime(),
    end: new Date(b.blocked_end).getTime(),
    dayKey: dateKeyInZone(new Date(b.starts_at), p.timezone),
  }));
  const perDay = new Map<string, number>();
  for (const b of busy) perDay.set(b.dayKey, (perDay.get(b.dayKey) ?? 0) + 1);

  const slots: Slot[] = [];
  const windows: GuideWindow[] = [];
  const firstKey = dateKeyInZone(p.now, p.timezone);
  const days = (p.horizonDays ?? HORIZON_DAYS) + 2;

  for (let i = 0; i <= days; i++) {
    const key = addDaysToKey(firstKey, i);
    const weekday = weekdayOfKey(key);
    for (const rule of p.rules.filter((r) => r.weekday === weekday)) {
      const winStartMin = toMinutes(rule.start_local);
      const winEndMin = toMinutes(rule.end_local);
      windows.push({
        guideDateKey: key,
        start: zonedInstant(key, rule.start_local, p.timezone),
        end: zonedInstant(key, rule.end_local, p.timezone),
      });

      let startMin = Math.ceil((winStartMin + p.bufferMin) / align) * align;
      for (; startMin + p.durationMin + p.bufferMin <= winEndMin; startMin += step) {
        const start = zonedInstant(key, fromMinutes(startMin), p.timezone);
        const t = start.getTime();
        if (t < earliest || t > latest) continue;
        const end = new Date(t + p.durationMin * MINUTE);
        const blockedStart = new Date(t - p.bufferMin * MINUTE);
        const blockedEnd = new Date(end.getTime() + p.bufferMin * MINUTE);

        let state: SlotState = "open";
        if (busy.some((b) => overlaps(blockedStart.getTime(), blockedEnd.getTime(), b.start, b.end))) state = "held";
        else if ((perDay.get(key) ?? 0) >= p.maxPerDay) state = "full";

        slots.push({ start, end, blockedStart, blockedEnd, state, guideDateKey: key });
      }
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { slots, windows };
}

/** Group open slots by the calendar date the *client* will experience them on. */
export function groupByClientDay(slots: Slot[], clientTz: string): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = dateKeyInZone(s.start, clientTz);
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return map;
}

/**
 * Deterministically place a seeded session on a real open day for its Guide.
 * Positive offsets search forward, negative offsets search backward, so the
 * demo always has sessions that respect availability and buffers.
 */
export function placeSeedSession(args: {
  timezone: string;
  bufferMin: number;
  rules: Pick<AvailabilityRule, "weekday" | "start_local" | "end_local">[];
  dayOffset: number;
  localTime: string;
  durationMin: number;
  taken: { start: number; end: number }[];
  now: Date;
}): Date | null {
  const today = dateKeyInZone(args.now, args.timezone);
  const dir = args.dayOffset < 0 ? -1 : 1;
  const startMin = toMinutes(args.localTime);
  for (let i = 0; i < 21; i++) {
    const key = addDaysToKey(today, args.dayOffset + dir * i);
    const wd = weekdayOfKey(key);
    const fits = args.rules.some(
      (r) =>
        r.weekday === wd &&
        toMinutes(r.start_local) <= startMin - args.bufferMin &&
        toMinutes(r.end_local) >= startMin + args.durationMin + args.bufferMin,
    );
    if (!fits) continue;
    const start = zonedInstant(key, args.localTime, args.timezone);
    const bStart = start.getTime() - args.bufferMin * MINUTE;
    const bEnd = start.getTime() + (args.durationMin + args.bufferMin) * MINUTE;
    if (args.taken.some((t) => overlaps(bStart, bEnd, t.start, t.end))) continue;
    if (dir > 0 && start.getTime() <= args.now.getTime()) continue;
    return start;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function allTimezones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list && list.length) return list;
  } catch {
    /* fall through */
  }
  return [
    "UTC", "Europe/Lisbon", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid",
    "Africa/Nairobi", "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
    "Australia/Melbourne", "Australia/Sydney", "America/New_York", "America/Toronto", "America/Chicago",
    "America/Denver", "America/Los_Angeles", "America/Mexico_City", "America/Sao_Paulo",
  ];
}

export function cityOf(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

export function offsetLabel(tz: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

export function fmt(date: Date | string, tz: string, pattern: string): string {
  return formatInTimeZone(typeof date === "string" ? new Date(date) : date, tz, pattern);
}

export const fmtTime = (d: Date | string, tz: string) => fmt(d, tz, "HH:mm");
export const fmtDayLong = (d: Date | string, tz: string) => fmt(d, tz, "EEEE d MMMM");
export const fmtDayShort = (d: Date | string, tz: string) => fmt(d, tz, "EEE d MMM");

/** "in 3 days", "in 5 hours", "tomorrow" — quiet, approximate, never to the second. */
export function relativeFromNow(target: Date | string, now: Date = new Date()): string {
  const t = typeof target === "string" ? new Date(target) : target;
  const diff = t.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const say = (n: number, unit: string) => {
    const s = `${n} ${unit}${n === 1 ? "" : "s"}`;
    return past ? `${s} ago` : `in ${s}`;
  };
  if (abs < HOUR) return past ? "moments ago" : "within the hour";
  if (abs < 24 * HOUR) return say(Math.round(abs / HOUR), "hour");
  const days = Math.round(abs / (24 * HOUR));
  if (days === 1) return past ? "yesterday" : "tomorrow";
  if (days < 21) return say(days, "day");
  return say(Math.round(days / 7), "week");
}

export function durationWords(mins: number): string {
  const words: Record<number, string> = {
    45: "forty-five minutes",
    60: "an hour",
    90: "ninety minutes",
    120: "two hours",
    150: "two and a half hours",
  };
  return words[mins] ?? `${mins} minutes`;
}
