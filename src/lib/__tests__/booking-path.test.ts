// The promise behind "real times": nothing the calendar offers can fail to book, the limits are
// enforced by the engine (not just described), and the front page is never thin.
import { describe, expect, it } from "vitest";
import { ADDONS, MAX_JOBS_PER_DAY, SERVICES, VEHICLES, ZONES, quote, type ServiceKey, type VehicleKind, type ZoneKey } from "../business";
import { activeJobs, explainDay, slotsByDay, validate } from "../engine";
import { ZONE_ZIP } from "../business";
import { BookingError } from "../model";
import { createJob, type BookingInput } from "../ops";
import { seedState } from "../seed";
import { HOUR, localDate } from "../time";

const T0 = new Date("2026-09-30T17:00:00Z").getTime(); // a Wednesday morning in Portland
const nowAt = (i: number) => T0 + i * 7 * HOUR + (i % 5) * 13 * 60_000; // varied days, hours and minutes

const input = (over: Partial<BookingInput> & Pick<BookingInput, "startMs">): BookingInput => ({
  customer: { name: "Test Driver", phone: "(503) 555-0100", email: "t@example.com" },
  vehicle: { kind: "suv", label: "Outback" }, service: "full", addons: [], zip: "97212", address: "1 Test St",
  parking: "garage", access: { gateCode: "", notes: "" }, ...over,
});

const ZONE_LIST = Object.keys(ZONES) as ZoneKey[];
const VEHICLE_LIST = Object.keys(VEHICLES) as VehicleKind[];
const SERVICE_LIST = Object.keys(SERVICES) as ServiceKey[];

describe("every time the calendar offers can actually be booked", () => {
  it("across weeks, vehicles, services, add-ons and zones (first, middle and last time of each open day)", () => {
    let booked = 0;
    for (let i = 0; i < 14; i++) {
      const now = nowAt(i);
      const state = seedState(now);
      const vehicle = VEHICLE_LIST[i % VEHICLE_LIST.length];
      const service = SERVICE_LIST[i % SERVICE_LIST.length];
      const zone = ZONE_LIST[i % ZONE_LIST.length];
      const addons = i % 3 === 0 ? [] : [Object.keys(ADDONS)[i % Object.keys(ADDONS).length] as keyof typeof ADDONS];
      const q = quote(vehicle, service, addons, zone);
      for (const day of slotsByDay(state, q.durationMin, zone, now)) {
        const picks = [...new Set([day.slots[0], day.slots[Math.floor(day.slots.length / 2)], day.slots[day.slots.length - 1]])].filter(Boolean);
        for (const startMs of picks) {
          const go = () => createJob(state, input({ startMs, vehicle: { kind: vehicle, label: "Test" }, service, addons, zip: ZONE_ZIP[zone], parking: "garage" }), now);
          const made = go();
          // The $25 deposit is part of every booking: a slot is never held for free.
          expect(made.job.depositCents, "deposit is required").toBeGreaterThan(0);
          expect(made.job.depositState).toBe("held");
          expect(go, `${vehicle}/${service}/${zone}/${addons} at ${new Date(startMs).toISOString()}`).not.toThrow();
          booked++;
        }
      }
    }
    expect(booked).toBeGreaterThan(300);
  });
});

describe("the limits are enforced by the engine", () => {
  it("refuses a 4th job on a day, and the calendar stops offering that day", () => {
    const now = nowAt(0);
    let state = seedState(now);
    const q = quote("sedan", "express", [], "NE");
    // Fill the emptiest open day with three jobs, one at a time, always from the offered times.
    const day = slotsByDay(state, q.durationMin, "NE", now).filter((d) => d.slots.length).sort((a, b) => activeJobs(state).filter((j) => localDate(j.startMs) === a.date).length - activeJobs(state).filter((j) => localDate(j.startMs) === b.date).length)[0];
    const date = day.date;
    for (let n = activeJobs(state).filter((j) => localDate(j.startMs) === date).length; n < MAX_JOBS_PER_DAY; n++) {
      const offered = slotsByDay(state, q.durationMin, "NE", now).find((d) => d.date === date)!.slots;
      expect(offered.length).toBeGreaterThan(0);
      state = createJob(state, input({ startMs: offered[0], vehicle: { kind: "sedan", label: "x" }, service: "express" }), now).state;
    }
    const after = slotsByDay(state, q.durationMin, "NE", now).find((d) => d.date === date)!;
    expect(after.slots).toEqual([]);
    expect(after.reason).toBe("full");
    // Even a hand-made request for a time that used to be free is refused.
    const stale = day.slots[day.slots.length - 1];
    expect(() => createJob(state, input({ startMs: stale, vehicle: { kind: "sedan", label: "x" }, service: "express" }), now)).toThrow(BookingError);
  });
});

describe("the front page is never thin", () => {
  it("always has at least three dry openings for the sample quote, whatever time it is", () => {
    for (let i = 0; i < 60; i++) {
      const now = nowAt(i) + i * 3 * HOUR;
      const state = seedState(now);
      const q = quote("suv", "full", [], "NE");
      const open = slotsByDay(state, q.durationMin, "NE", now).filter((d) => d.slots.length && !d.forecast.wet);
      expect(open.length, `now=${new Date(now).toISOString()}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the crossed-out times tell the truth", () => {
  it("a time is offered exactly when the engine will book it, and every refusal carries a reason", () => {
    let refused = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const now = nowAt(i);
      const state = seedState(now);
      const zone = ZONE_LIST[i % ZONE_LIST.length];
      const q = quote(VEHICLE_LIST[i % VEHICLE_LIST.length], SERVICE_LIST[i % SERVICE_LIST.length], [], zone);
      for (const day of slotsByDay(state, q.durationMin, zone, now)) {
        for (const v of explainDay(state, q.durationMin, zone, day.date, now)) {
          const verdict = validate(state, { startMs: v.startMs, durationMin: q.durationMin, zone }, now);
          expect(v.why === null, `${new Date(v.startMs).toISOString()} ${v.why}`).toBe(verdict === null);
          if (v.why) { refused++; seen.add(v.why); expect(v.detail && v.detail.length > 10).toBeTruthy(); }
        }
      }
    }
    expect(refused).toBeGreaterThan(50);
    expect(seen.has("booked") && seen.has("drive")).toBe(true); // both kinds really occur in a normal week
  });

  it("a day with three jobs refuses every time as 'limit', and a 4th booking is refused by the engine too", () => {
    const now = nowAt(0);
    let state = seedState(now);
    const q = quote("sedan", "express", [], "NE");
    const date = slotsByDay(state, q.durationMin, "NE", now).filter((d) => d.slots.length).sort((a, b) => activeJobs(state).filter((j) => localDate(j.startMs) === a.date).length - activeJobs(state).filter((j) => localDate(j.startMs) === b.date).length)[0].date;
    for (let n = activeJobs(state).filter((j) => localDate(j.startMs) === date).length; n < MAX_JOBS_PER_DAY; n++) {
      const open = slotsByDay(state, q.durationMin, "NE", now).find((d) => d.date === date)!.slots[0];
      state = createJob(state, input({ startMs: open, vehicle: { kind: "sedan", label: "x" }, service: "express" }), now).state;
    }
    const verdicts = explainDay(state, q.durationMin, "NE", date, now);
    expect(verdicts.length).toBeGreaterThan(0);
    expect(verdicts.every((v) => v.why === "limit")).toBe(true);
    expect(verdicts[0].detail).toMatch(/3 jobs/);
    expect(() => createJob(state, input({ startMs: verdicts[0].startMs, vehicle: { kind: "sedan", label: "x" }, service: "express" }), now)).toThrow(BookingError);
  });

  it("a time too soon after a job in another part of town is refused for drive time, with the numbers, and cannot be booked", () => {
    const now = nowAt(0);
    let state = seedState(now);
    const q = quote("sedan", "express", [], "SW");
    // Find a day with exactly one job, then look for a SW time the engine refuses only because of the drive.
    const days = slotsByDay(state, q.durationMin, "SW", now).filter((d) => d.open);
    let found = false;
    for (const d of days) {
      for (const v of explainDay(state, q.durationMin, "SW", d.date, now)) {
        if (v.why === "drive") {
          found = true;
          expect(v.detail).toMatch(/drive/i);
          expect(v.detail).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
          expect(() => createJob(state, input({ startMs: v.startMs, zone: undefined, zip: "97219", vehicle: { kind: "sedan", label: "x" }, service: "express" } as never), now)).toThrow(BookingError);
          break;
        }
      }
      if (found) break;
    }
    expect(found, "a normal week has at least one drive-time refusal").toBe(true);
    void state;
  });
});
