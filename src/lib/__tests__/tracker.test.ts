import { describe, expect, it } from "vitest";
import { createJob } from "../ops";
import { emptyState } from "../seed";
import { DAY_START_MIN } from "../business";
import { etaFor, vanAt, ZONE_XY } from "../tracker";
import { addDays, atLocal, localMinutes } from "../time";

const NOW = atLocal("2026-09-30", 10 * 60);
const day = addDays("2026-09-30", 3); // Saturday

function twoJobs() {
  let s = emptyState(NOW);
  const mk = (name: string, zip: string, at: number, service: "express" | "full") =>
    createJob(s, {
      customer: { name, phone: "1", email: "a@b.co" }, vehicle: { kind: "sedan", label: "car" }, service, addons: [], zip,
      address: "1 Main", parking: "garage", access: { gateCode: "", notes: "" }, startMs: atLocal(day, at),
    }, NOW);
  const a = mk("A", "97212", 9 * 60, "full"); // NE, 150 min → 11:30
  s = a.state;
  const b = mk("B", "97202", 12 * 60 + 30, "express"); // SE, 20 min drive → arrives 11:50
  s = b.state;
  return { jobs: s.jobs, a: a.job, b: b.job };
}

describe("vanAt", () => {
  const { jobs } = twoJobs();
  it("starts the day at the base, then loads the van", () => {
    expect(vanAt(jobs, 7 * 60)).toMatchObject({ phase: "at_base_early", ...ZONE_XY.NE });
    expect(vanAt(jobs, DAY_START_MIN + 5).phase).toBe("loading");
  });
  it("drives to the first job, arriving at its zone", () => {
    const mid = vanAt(jobs, 8 * 60 + 50); // drive block is 8:50–9:00
    expect(mid.phase).toBe("driving");
    expect(mid.minutesLeft).toBe(10);
  });
  it("is on site while working and at the second zone after the drive", () => {
    expect(vanAt(jobs, 10 * 60)).toMatchObject({ phase: "working", jobIndex: 0 });
    const drive = vanAt(jobs, 11 * 60 + 40); // 11:30–11:50 NE → SE
    expect(drive.phase).toBe("driving");
    expect(drive.x).toBeGreaterThan(ZONE_XY.SE.x - 1);
    expect(drive.x).toBeLessThan(ZONE_XY.NE.x + 1);
    expect(vanAt(jobs, 12 * 60)).toMatchObject({ phase: "setting_up", jobIndex: 1, ...ZONE_XY.SE });
    expect(vanAt(jobs, 13 * 60)).toMatchObject({ phase: "working", jobIndex: 1 });
  });
  it("ends the day back at the base", () => {
    expect(vanAt(jobs, 17 * 60 + 29)).toMatchObject({ phase: "at_base_done", ...ZONE_XY.NE });
  });
  it("is with no jobs at the base all day", () => {
    expect(vanAt([], 12 * 60)).toMatchObject({ phase: "at_base_early", ...ZONE_XY.NE });
  });
  it("moves continuously: consecutive minutes never jump across the map", () => {
    let prev = vanAt(jobs, DAY_START_MIN);
    for (let m = DAY_START_MIN + 1; m <= 17 * 60 + 30; m++) {
      const v = vanAt(jobs, m);
      expect(Math.hypot(v.x - prev.x, v.y - prev.y)).toBeLessThan(6);
      prev = v;
    }
  });
});

describe("etaFor", () => {
  const { jobs, a, b } = twoJobs();
  it("tells the second customer how many jobs come first", () => {
    expect(etaFor(jobs, b.id, 8 * 60 + 30)).toMatchObject({ state: "jobs_ahead", jobsAhead: 1 });
    expect(etaFor(jobs, b.id, 7 * 60)).toMatchObject({ state: "later" });
  });
  it("counts down the drive, then the work, then done", () => {
    expect(etaFor(jobs, b.id, 11 * 60 + 40)).toMatchObject({ state: "on_the_way", minutesToArrival: 10 });
    expect(etaFor(jobs, b.id, 12 * 60)).toMatchObject({ state: "setting_up" });
    const w = etaFor(jobs, b.id, 12 * 60 + 40);
    expect(w.state).toBe("working");
    expect(w.progress).toBeGreaterThan(0);
    expect(etaFor(jobs, b.id, 14 * 60)).toMatchObject({ state: "done" });
    expect(etaFor(jobs, a.id, 10 * 60).headline).toMatch(/% done/);
  });
  it("uses the job's own start as the anchor", () => {
    expect(localMinutes(a.startMs)).toBe(9 * 60);
    expect(etaFor(jobs, a.id, 8 * 60 + 55)).toMatchObject({ state: "on_the_way", minutesToArrival: 5 });
  });
});
