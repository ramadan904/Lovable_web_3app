// The app's data layer: one small store, persisted in the browser. The same
// functions the tests exercise are the ones the UI calls.
import { useSyncExternalStore } from "react";
import { advance, tick } from "./automations";
import { answerInquiry } from "./inquiry";
import { cancelJob, chooseRainOption, claimOffer, confirmJob, createJob, joinWaitlist, moveJob, type BookingInput, type WaitlistInput } from "./ops";
import { seedState } from "./seed";
import type { Job, State } from "./model";
import { HOUR, addDays, atLocal, localDate, weekdayOf } from "./time";
import { OPEN_WEEKDAYS, isCovered } from "./business";
import { activeJobs } from "./engine";

const KEY = "fernhill:demo:v1";
const MAX_AGE_MS = 6 * 24 * HOUR;

let memory: string | null = null;
const read = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return memory; }
};
const write = (v: string) => {
  memory = v;
  try { localStorage.setItem(KEY, v); } catch { /* private mode: memory only */ }
};

function load(): State {
  try {
    const raw = read();
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.v === 1 && Date.now() + s.clockOffsetMs - s.seededAt < MAX_AGE_MS) return s;
    }
  } catch { /* fall through to a fresh seed */ }
  return seedState(Date.now());
}

let state: State = load();
const listeners = new Set<() => void>();

const persist = () => write(JSON.stringify(state));
const emit = () => { persist(); listeners.forEach((l) => l()); };

export const getState = () => state;
export const nowMs = () => Date.now() + state.clockOffsetMs;
const set = (next: State) => { state = next; emit(); };

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

// Actions ---------------------------------------------------------------------
export const actions = {
  book(input: BookingInput): Job {
    const { state: next, job } = createJob(state, input, nowMs());
    set(next);
    return job;
  },
  move(id: string, startMs: number) { set(moveJob(state, id, startMs, nowMs(), "customer")); },
  cancel(id: string) { set(cancelJob(state, id, nowMs())); },
  confirm(id: string) { set(confirmJob(state, id, nowMs())); },
  chooseRain(id: string, index: number) { set(chooseRainOption(state, id, index, nowMs(), "customer")); },
  joinWaitlist(input: WaitlistInput) { const { state: next, entry } = joinWaitlist(state, input, nowMs()); set(next); return entry; },
  claim(waitlistId: string): Job { const { state: next, job } = claimOffer(state, waitlistId, nowMs()); set(next); return job; },
  inquire(from: string, text: string) { const { state: next, inquiry } = answerInquiry(state, from, text, nowMs()); set(next); return inquiry; },
  updateAccess(id: string, gateCode: string, notes: string) {
    const next = structuredClone(state);
    const job = next.jobs.find((j) => j.id === id);
    if (job) job.access = { gateCode, notes };
    set(next);
  },
  dismissFlag(id: string) {
    const next = structuredClone(state);
    const job = next.jobs.find((j) => j.id === id);
    if (job) job.ownerFlag = null;
    set(next);
  },
  resolveInquiry(id: string) {
    const next = structuredClone(state);
    const q = next.inquiries.find((i) => i.id === id);
    if (q) { q.status = "answered"; q.note = null; }
    set(next);
  },

  // Demo controls -----------------------------------------------------------
  /** Jump the clock forward. Everything scheduled in between happens, in order. */
  fastForward(hours: number) {
    const from = nowMs();
    const to = from + hours * HOUR;
    // Always a new object: advance() returns the same one when nothing was due.
    set({ ...advance(state, from, to), clockOffsetMs: state.clockOffsetMs + (to - from) });
  },
  /** Jump to 7:30 am on the next working day that has a job. */
  jumpToNextJobMorning() {
    const from = nowMs();
    const today = localDate(from);
    let target: number | null = null;
    for (let i = 0; i <= 10 && target === null; i++) {
      const d = addDays(today, i);
      const t = atLocal(d, 7 * 60 + 30);
      if (t > from && OPEN_WEEKDAYS.includes(weekdayOf(d)) && activeJobs(state).some((j) => localDate(j.startMs) === d)) target = t;
    }
    if (target === null) return;
    set({ ...advance(state, from, target), clockOffsetMs: state.clockOffsetMs + (target - from) });
  },
  /**
   * An atmospheric river is forecast for the day with the most outdoor work. Rain checks
   * look 48 hours ahead, so the demo clock jumps to just inside that window.
   */
  stormOnBusiestOutdoorDay(): { date: string; jumpedHours: number } | null {
    const from = nowMs();
    const counts = new Map<string, Job[]>();
    for (const j of activeJobs(state)) {
      if (j.startMs < from + 4 * HOUR || isCovered(j.parking)) continue;
      const d = localDate(j.startMs);
      counts.set(d, [...(counts.get(d) ?? []), j]);
    }
    const best = [...counts.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0];
    if (!best) return null;
    const [date, jobs] = best;
    const earliest = Math.min(...jobs.map((j) => j.startMs));
    const target = Math.max(from, earliest - 46 * HOUR);
    const next = structuredClone(state);
    next.stormDays = [...new Set([...next.stormDays, date])];
    set({ ...advance(next, from, target), clockOffsetMs: next.clockOffsetMs + (target - from) });
    return { date, jumpedHours: Math.round((target - from) / HOUR) };
  },
  clearStorm() { set({ ...state, stormDays: [] }); },
  reset() { set(seedState(Date.now())); },
};

// Real-time heartbeat: the automations run while the page is open.
if (typeof window !== "undefined") {
  window.setInterval(() => {
    const next = tick(state, nowMs());
    if (next !== state) set(next);
  }, 30_000);
  // Catch up immediately (a returning visitor's messages may be due).
  set(tick(state, nowMs()));
}
