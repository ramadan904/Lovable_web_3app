// "Where's Bertha?" Where the van is at any minute of a working day, derived from the
// same route blocks the scheduler validates, so the map can never disagree with the calendar.
import { DAY_END_MIN, DAY_START_MIN, HOME_ZONE, type ZoneKey } from "./business";
import { routeBlocks } from "./engine";
import type { Job } from "./model";

/** A schematic map of Fernhill's territory, in a 100 × 76 box. Not to scale. */
export const ZONE_XY: Record<ZoneKey, { x: number; y: number }> = {
  W: { x: 9, y: 44 },
  NW: { x: 28, y: 22 },
  N: { x: 52, y: 15 },
  NE: { x: 76, y: 28 },
  SE: { x: 74, y: 57 },
  SW: { x: 33, y: 60 },
};

export type Phase = "at_base_early" | "loading" | "driving" | "setting_up" | "working" | "refilling" | "between" | "driving_home" | "at_base_done";

export interface VanPos {
  x: number;
  y: number;
  phase: Phase;
  /** index (in the day's order) of the job the van is at or heading to, or null */
  jobIndex: number | null;
  /** 0..1 progress through the current block */
  progress: number;
  from: ZoneKey | null;
  to: ZoneKey | null;
  /** minutes until the current block ends */
  minutesLeft: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (z: ZoneKey) => ZONE_XY[z];

/** Where the van is at `minute` (minutes after local midnight) for one day's jobs. */
export function vanAt(dayJobs: Job[], minute: number): VanPos {
  const jobs = [...dayJobs].sort((a, b) => a.startMs - b.startMs);
  const blocks = routeBlocks(jobs);
  let zone: ZoneKey = HOME_ZONE;
  let phase: Phase = "at_base_early";
  let jobIndex: number | null = null;
  const still = (): VanPos => ({ ...at(zone), phase, jobIndex, progress: 1, from: null, to: null, minutesLeft: 0 });

  for (const b of blocks) {
    if (minute < b.startMin) {
      const next = blocks.find((x) => x.startMin > minute);
      const v = still();
      v.minutesLeft = next ? next.startMin - minute : 0;
      return v;
    }
    const progress = (minute - b.startMin) / Math.max(1, b.endMin - b.startMin);
    if (minute < b.endMin) {
      const left = b.endMin - minute;
      switch (b.kind) {
        case "load":
          return { ...at(HOME_ZONE), phase: "loading", jobIndex: null, progress, from: null, to: null, minutesLeft: left };
        case "drive":
        case "home": {
          const a = at(b.from!);
          const z = at(b.to!);
          return {
            x: lerp(a.x, z.x, progress), y: lerp(a.y, z.y, progress),
            phase: b.kind === "home" ? "driving_home" : "driving", jobIndex: b.kind === "home" ? null : b.index,
            progress, from: b.from!, to: b.to!, minutesLeft: left,
          };
        }
        case "refill":
          return { ...at(zone), phase: "refilling", jobIndex: b.index, progress, from: null, to: null, minutesLeft: left };
        case "job":
          return { ...at(jobs[b.index].zone), phase: "working", jobIndex: b.index, progress, from: null, to: null, minutesLeft: left };
      }
    }
    // this block is behind us: remember where it left the van
    switch (b.kind) {
      case "load": zone = HOME_ZONE; phase = "at_base_early"; jobIndex = null; break;
      case "drive": zone = b.to!; phase = "setting_up"; jobIndex = b.index; break;
      case "refill": phase = "setting_up"; jobIndex = b.index; break;
      case "job": zone = jobs[b.index].zone; phase = "between"; jobIndex = b.index; break;
      case "home": zone = HOME_ZONE; phase = "at_base_done"; jobIndex = null; break;
    }
  }
  return { ...still(), minutesLeft: 0 };
}

export type EtaState = "later" | "jobs_ahead" | "on_the_way" | "setting_up" | "working" | "done";

export interface Eta {
  state: EtaState;
  /** whole jobs that Bertha still has to finish before this one */
  jobsAhead: number;
  /** minutes until arrival, while on the way */
  minutesToArrival: number;
  /** 0..1 while working */
  progress: number;
  headline: string;
}

/** What one customer should be told, at `minute`, about their own job. */
export function etaFor(dayJobs: Job[], jobId: string, minute: number): Eta {
  const jobs = [...dayJobs].sort((a, b) => a.startMs - b.startMs);
  const idx = jobs.findIndex((j) => j.id === jobId);
  const blocks = routeBlocks(jobs);
  const drive = blocks.find((b) => b.kind === "drive" && b.index === idx);
  const work = blocks.find((b) => b.kind === "job" && b.index === idx);
  const base = { jobsAhead: 0, minutesToArrival: 0, progress: 0 };
  if (idx < 0 || !drive || !work) return { ...base, state: "later", headline: "Bertha isn't scheduled for this booking today." };

  if (minute >= work.endMin) return { ...base, progress: 1, state: "done", headline: "All done. Enjoy the clean car." };
  if (minute >= work.startMin) {
    const p = (minute - work.startMin) / (work.endMin - work.startMin);
    return { ...base, progress: p, state: "working", headline: `Detailing your car: ${Math.round(p * 100)}% done` };
  }
  if (minute >= drive.endMin) return { ...base, state: "setting_up", headline: "Bertha has arrived and is setting up" };
  if (minute >= drive.startMin) {
    const left = drive.endMin - minute;
    return { ...base, minutesToArrival: left, state: "on_the_way", headline: `On the way. About ${left} min from you` };
  }
  const ahead = jobs.slice(0, idx).filter((_, i) => blocks.some((b) => b.kind === "job" && b.index === i && b.endMin > minute)).length;
  if (minute < DAY_START_MIN) return { ...base, jobsAhead: ahead, state: "later", headline: "Bertha starts the day at 8:00" };
  if (ahead === 0) return { ...base, state: "jobs_ahead", headline: "You're next. Bertha is getting ready" };
  return { ...base, jobsAhead: ahead, state: "jobs_ahead", headline: `${ahead} ${ahead === 1 ? "job" : "jobs"} before yours` };
}

export const DAY_RANGE = { start: DAY_START_MIN, end: DAY_END_MIN };

const PHASE_TEXT: Record<Phase, string> = {
  at_base_early: "at the base in Alberta Arts",
  loading: "loading up and checking the water",
  driving: "driving",
  setting_up: "setting up on site",
  working: "detailing",
  refilling: "refilling the tank",
  between: "packing up",
  driving_home: "driving home",
  at_base_done: "back at the base",
};

/** A sentence for screen readers and captions. */
export function describeVan(v: VanPos, zoneName: (z: ZoneKey) => string): string {
  if (v.phase === "driving" || v.phase === "driving_home") return `Bertha is driving from ${zoneName(v.from!)} to ${zoneName(v.to!)}, ${v.minutesLeft} min to go`;
  return `Bertha is ${PHASE_TEXT[v.phase]}`;
}
