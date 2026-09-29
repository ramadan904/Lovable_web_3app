import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS } from "./business";

const TZ = BUSINESS.tz;

export const HOUR = 3_600_000;
export const MIN = 60_000;
export const DAY = 24 * HOUR;

/** The local calendar date (yyyy-MM-dd) at Fernhill of an instant. */
export const localDate = (ms: number) => formatInTimeZone(ms, TZ, "yyyy-MM-dd");

/** Minutes after local midnight. */
export function localMinutes(ms: number): number {
  const [h, m] = formatInTimeZone(ms, TZ, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}

/** The instant of a local date and a number of minutes after local midnight. */
export function atLocal(date: string, minutes: number): number {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${date}T${h}:${m}:00`, TZ).getTime();
}

/** Calendar arithmetic on yyyy-MM-dd strings; independent of any timezone. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);

const f = (ms: number, pattern: string) => formatInTimeZone(ms, TZ, pattern);
export const fmtTime = (ms: number) => f(ms, "h:mm a");
export const fmtTimeShort = (ms: number) => f(ms, "h:mm").replace(/:00$/, "") + f(ms, " a").toLowerCase().trim();
export const fmtDay = (ms: number) => f(ms, "EEE, MMM d");
export const fmtDayLong = (ms: number) => f(ms, "EEEE, MMMM d");
export const fmtStamp = (ms: number) => f(ms, "EEE h:mm a");

export function fmtDate(date: string, pattern = "EEE, MMM d"): string {
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), "UTC", pattern);
}

/** "today", "tomorrow", "Thursday", or "Oct 12". */
export function relativeDay(date: string, todayDate: string): string {
  const n = daysBetween(todayDate, date);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1 && n < 7) return fmtDate(date, "EEEE");
  return fmtDate(date, "MMM d");
}

export function fmtRelative(fromMs: number, toMs: number): string {
  const diff = toMs - fromMs;
  const abs = Math.abs(diff);
  const h = Math.round(abs / HOUR);
  const text = abs < HOUR ? `${Math.max(1, Math.round(abs / MIN))} min` : h < 48 ? `${h} h` : `${Math.round(abs / DAY)} days`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

