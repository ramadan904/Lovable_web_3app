// The scheduling engine. Pure functions over State, so the same rules run in the
// browser, in tests, and (unchanged) could run in an edge function.
import {
  DAY_END_MIN, DAY_START_MIN, GRID_MIN, HOME_ZONE, HORIZON_DAYS, LOAD_MIN, MAX_JOBS_PER_DAY,
  MIN_NOTICE_H, OPEN_WEEKDAYS, CURE_RAIN_LIMIT, RAIN_LIMIT, REFILL_MIN, ZONES, isCovered, quote, rainLimitFor, travelMin,
  type AddonKey, type Parking, type ZoneKey,
} from "./business";
import { ACTIVE, type Job, type State, type WaitlistEntry } from "./model";
import { HOUR, MIN, addDays, atLocal, localDate, localMinutes, weekdayOf } from "./time";
import { forecastFor, type Forecast } from "./weather";

export interface Placement {
  startMs: number;
  durationMin: number;
  zone: ZoneKey;
}

export type DayProblem = "closed" | "day_full" | "off_grid" | "too_early" | "travel" | "too_late" | "wrong_day";
export type DayCheck = { ok: true } | { ok: false; reason: DayProblem };

/**
 * Can one day's jobs, in start order, actually be driven?
 *  - the day opens at 8:00, the van is loaded by 8:15, then Dario drives to job one
 *  - between jobs: the drive between the two zones
 *  - before the third job: a water refill (the tank holds two)
 *  - after the last job: the drive home, before 5:30 pm
 */
export function checkDay(date: string, placements: Placement[]): DayCheck {
  if (!OPEN_WEEKDAYS.includes(weekdayOf(date))) return { ok: false, reason: "closed" };
  if (placements.length > MAX_JOBS_PER_DAY) return { ok: false, reason: "day_full" };
  const sorted = [...placements].sort((a, b) => a.startMs - b.startMs);
  let prevEnd = 0;
  let prevZone: ZoneKey = HOME_ZONE;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (localDate(p.startMs) !== date) return { ok: false, reason: "wrong_day" };
    const start = localMinutes(p.startMs);
    if (start % GRID_MIN !== 0) return { ok: false, reason: "off_grid" };
    if (i === 0) {
      if (start < DAY_START_MIN + LOAD_MIN + travelMin(HOME_ZONE, p.zone)) return { ok: false, reason: "too_early" };
    } else {
      const need = prevEnd + travelMin(prevZone, p.zone) + (i === 2 ? REFILL_MIN : 0);
      if (start < need) return { ok: false, reason: "travel" };
    }
    prevEnd = start + p.durationMin;
    prevZone = p.zone;
  }
  if (sorted.length && prevEnd + travelMin(prevZone, HOME_ZONE) > DAY_END_MIN) return { ok: false, reason: "too_late" };
  return { ok: true };
}

export const activeJobs = (state: State) => state.jobs.filter((j) => ACTIVE.includes(j.status));

export function placementsOn(state: State, date: string, excludeId?: string): Placement[] {
  return activeJobs(state)
    .filter((j) => j.id !== excludeId && localDate(j.startMs) === date)
    .map((j) => ({ startMs: j.startMs, durationMin: j.durationMin, zone: j.zone }));
}

export type SlotProblem = DayProblem | "too_soon" | "too_far";

/** Would this job fit in this place, given every other job on the calendar? */
export function validate(state: State, cand: Placement, nowMs: number, excludeId?: string, opts: { ignoreHorizon?: boolean } = {}): SlotProblem | null {
  if (cand.startMs < nowMs + MIN_NOTICE_H * HOUR) return "too_soon";
  if (!opts.ignoreHorizon && cand.startMs > nowMs + HORIZON_DAYS * 24 * HOUR) return "too_far";
  const date = localDate(cand.startMs);
  const res = checkDay(date, [...placementsOn(state, date, excludeId), cand]);
  return res.ok ? null : res.reason;
}

export function findSlots(
  state: State, durationMin: number, zone: ZoneKey, date: string, nowMs: number, excludeId?: string, opts: { ignoreHorizon?: boolean } = {},
): number[] {
  if (!OPEN_WEEKDAYS.includes(weekdayOf(date))) return [];
  const out: number[] = [];
  for (let m = DAY_START_MIN; m + durationMin <= DAY_END_MIN; m += GRID_MIN) {
    const startMs = atLocal(date, m);
    if (validate(state, { startMs, durationMin, zone }, nowMs, excludeId, opts) === null) out.push(startMs);
  }
  return out;
}

export interface DaySlots {
  date: string;
  open: boolean;
  slots: number[];
  forecast: Forecast;
  /** Why there is nothing to book. */
  reason: "closed" | "full" | "past" | "wet" | null;
}

/** Every day in the booking horizon, with its open slots and forecast. */
export function slotsByDay(
  state: State, durationMin: number, zone: ZoneKey, nowMs: number, excludeId?: string, opts: { needsDry?: boolean; dryOnly?: boolean } = {},
): DaySlots[] {
  const today = localDate(nowMs);
  const days: DaySlots[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    const forecast = forecastFor(date, state.stormDays);
    const open = OPEN_WEEKDAYS.includes(weekdayOf(date));
    // Sealant outdoors needs a dry day to cure, so a wet day offers nothing.
    const tooWet = (opts.needsDry && forecast.rain >= CURE_RAIN_LIMIT) || (opts.dryOnly && forecast.rain >= RAIN_LIMIT);
    const slots = open && !tooWet ? findSlots(state, durationMin, zone, date, nowMs, excludeId) : [];
    days.push({ date, open, slots, forecast, reason: !open ? "closed" : tooWet ? "wet" : slots.length ? null : "full" });
  }
  return days;
}

/** Outdoor work in the rain is off the table. Covered spots never move. */
export const isRainRisk = (state: State, startMs: number, parking: Parking, addons?: readonly AddonKey[]) =>
  !isCovered(parking) && forecastFor(localDate(startMs), state.stormDays).rain >= rainLimitFor(addons, parking);

/** The nearest dry options for a job that has to move, nearest day and same time of day first. */
export type Movable = Pick<Job, "startMs" | "durationMin" | "zone" | "parking"> & { id?: string; addons?: AddonKey[] };

export function dryOptions(state: State, job: Movable, nowMs: number, count = 3): number[] {
  const today = localDate(nowMs);
  const origDate = localDate(job.startMs);
  const origMin = localMinutes(job.startMs);
  const picks: { startMs: number; score: number }[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    if (date === origDate) continue;
    if (isRainRisk(state, atLocal(date, DAY_START_MIN), job.parking, job.addons)) continue;
    const slots = findSlots(state, job.durationMin, job.zone, date, nowMs, job.id);
    if (!slots.length) continue;
    const best = [...slots].sort((a, b) => Math.abs(localMinutes(a) - origMin) - Math.abs(localMinutes(b) - origMin))[0];
    const dayDistance = Math.abs(i - Math.round((atLocal(origDate, 12 * 60) - atLocal(today, 12 * 60)) / (24 * HOUR)));
    // Prefer days after the storm over days before it, and nearer days over farther ones.
    const after = date > origDate ? 0 : 0.5;
    picks.push({ startMs: best, score: dayDistance + after + Math.abs(localMinutes(best) - origMin) / 600 });
  }
  return picks.sort((a, b) => a.score - b.score).slice(0, count).map((p) => p.startMs).sort((a, b) => a - b);
}

/**
 * A freed window looking for a customer: the first waitlist entry whose job fits it.
 */
export function backfillCandidate(
  state: State, window: { start: number; end: number }, nowMs: number, skip: string[] = [],
): { entry: WaitlistEntry; startMs: number } | null {
  const waiting = state.waitlist.filter((w) => w.status === "waiting" && !skip.includes(w.id)).sort((a, b) => a.createdAt - b.createdAt);
  for (const entry of waiting) {
    const durationMin = quote(entry.vehicle.kind, entry.service, entry.addons, entry.zone).durationMin;
    for (let t = window.start; t < window.end; t += GRID_MIN * MIN) {
      if (localMinutes(t) % GRID_MIN !== 0) continue;
      if (isRainRisk(state, t, entry.parking, entry.addons)) break;
      if (validate(state, { startMs: t, durationMin, zone: entry.zone }, nowMs) === null) return { entry, startMs: t };
    }
  }
  return null;
}

export { forecastFor };

/** Every minute of driving Dario doesn't do is this much off the customer's bill. */
export const DEAL_CENTS_PER_MIN = 50;

export interface Deal {
  discountCents: number;
  /** Driving Dario saves versus a separate round trip from the base. */
  savedMin: number;
  neighbour: Job;
}

/**
 * Route-density pricing. If the slot sits directly before or after a job in the same zone,
 * Dario makes one trip instead of two, and the customer gets the saving as a discount.
 */
export function neighbourDeal(state: State, cand: Placement, excludeId?: string): Deal | null {
  if (cand.zone === HOME_ZONE) return null;
  const date = localDate(cand.startMs);
  const day = activeJobs(state)
    .filter((j) => j.id !== excludeId && localDate(j.startMs) === date)
    .sort((a, b) => a.startMs - b.startMs);
  const before = [...day].reverse().find((j) => j.startMs + j.durationMin * MIN <= cand.startMs);
  const after = day.find((j) => j.startMs >= cand.startMs + cand.durationMin * MIN);
  const neighbour = [before, after].find((j) => j && j.zone === cand.zone);
  if (!neighbour) return null;
  const savedMin = 2 * (travelMin(HOME_ZONE, cand.zone) - travelMin(cand.zone, cand.zone));
  if (savedMin < 10) return null;
  return { discountCents: savedMin * DEAL_CENTS_PER_MIN, savedMin, neighbour };
}

export interface RouteBlock {
  kind: "load" | "drive" | "refill" | "job" | "home";
  startMin: number;
  endMin: number;
  /** job index in the day's order, for job and drive blocks */
  index: number;
  from?: ZoneKey;
  to?: ZoneKey;
}

/** The day as Dario lives it: load the van, drive, work, refill, drive, go home. */
export function routeBlocks(jobs: Job[]): RouteBlock[] {
  const sorted = [...jobs].sort((a, b) => a.startMs - b.startMs);
  const out: RouteBlock[] = [];
  let prevZone: ZoneKey = HOME_ZONE;
  let prevEnd = DAY_START_MIN;
  sorted.forEach((j, i) => {
    const start = localMinutes(j.startMs);
    const drive = travelMin(prevZone, j.zone);
    if (i === 0) {
      out.push({ kind: "load", startMin: DAY_START_MIN, endMin: DAY_START_MIN + LOAD_MIN, index: 0 });
      out.push({ kind: "drive", startMin: start - drive, endMin: start, index: 0, from: HOME_ZONE, to: j.zone });
    } else {
      out.push({ kind: "drive", startMin: prevEnd, endMin: prevEnd + drive, index: i, from: prevZone, to: j.zone });
      if (i === 2) out.push({ kind: "refill", startMin: prevEnd + drive, endMin: prevEnd + drive + REFILL_MIN, index: i });
    }
    out.push({ kind: "job", startMin: start, endMin: start + j.durationMin, index: i });
    prevZone = j.zone;
    prevEnd = start + j.durationMin;
  });
  if (sorted.length) out.push({ kind: "home", startMin: prevEnd, endMin: prevEnd + travelMin(prevZone, HOME_ZONE), index: sorted.length, from: prevZone, to: HOME_ZONE });
  return out;
}

// Why a time is not on offer ------------------------------------------------------------------------
export type WhyNot = "booked" | "drive" | "limit" | "early";
export interface TimeVerdict {
  startMs: number;
  /** null: it can be booked. */
  why: WhyNot | null;
  /** One plain sentence saying what stops it. */
  detail: string | null;
}

const clockLabel = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${min < 720 ? "AM" : "PM"}`;

/**
 * Every start time on a day, each either bookable or refused with the reason. The refusals are the rules
 * made visible: another job in the way, not enough time to drive between jobs, the three-job limit.
 * (Times too close to now, or that could not finish before the day ends, are left out.)
 */
export function explainDay(state: State, durationMin: number, zone: ZoneKey, date: string, nowMs: number, excludeId?: string): TimeVerdict[] {
  if (!OPEN_WEEKDAYS.includes(weekdayOf(date))) return [];
  const others = placementsOn(state, date, excludeId).sort((a, b) => a.startMs - b.startMs);
  const out: TimeVerdict[] = [];
  for (let m = DAY_START_MIN; m + durationMin <= DAY_END_MIN; m += GRID_MIN) {
    const startMs = atLocal(date, m);
    const problem = validate(state, { startMs, durationMin, zone }, nowMs, excludeId);
    if (problem === null) { out.push({ startMs, why: null, detail: null }); continue; }
    if (problem === "too_soon" || problem === "too_far") continue;
    const end = m + durationMin;
    const overlap = others.find((p) => m < localMinutes(p.startMs) + p.durationMin && localMinutes(p.startMs) < end);
    if (others.length >= MAX_JOBS_PER_DAY) {
      out.push({ startMs, why: "limit", detail: `Dario already has ${MAX_JOBS_PER_DAY} jobs this day, his limit (one van, one water tank).` });
    } else if (overlap) {
      out.push({ startMs, why: "booked", detail: `Another job is on the road or at work then (${clockLabel(localMinutes(overlap.startMs))} to ${clockLabel(localMinutes(overlap.startMs) + overlap.durationMin)}).` });
    } else if (problem === "too_early") {
      out.push({ startMs, why: "early", detail: "Dario loads the van and drives here first, so he can't arrive this early." });
    } else if (problem === "travel") {
      const prev = [...others].reverse().find((p) => localMinutes(p.startMs) < m);
      const next = others.find((p) => localMinutes(p.startMs) > m);
      const prevEnd = prev ? localMinutes(prev.startMs) + prev.durationMin : 0;
      const prevIndex = prev ? others.indexOf(prev) + 1 : 0;
      const needed = prev ? prevEnd + travelMin(prev.zone, zone) + (prevIndex === 2 ? REFILL_MIN : 0) : 0;
      out.push({
        startMs, why: "drive",
        detail: prev && m < needed
          ? `Dario finishes his ${ZONES[prev.zone].name} job at ${clockLabel(prevEnd)}; the drive${prevIndex === 2 ? " and a water refill" : ""} means he can't be here before ${clockLabel(needed)}.`
          : next ? `He couldn't finish and drive to his next job at ${clockLabel(localMinutes(next.startMs))}.` : "There isn't time to drive between jobs.",
      });
    }
  }
  return out;
}
