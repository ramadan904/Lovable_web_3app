import { describe, expect, it } from "vitest";
import { tick } from "../automations";
import { checkDay, placementsOn } from "../engine";
import { ledgerFor } from "../ledger";
import { seedState } from "../seed";
import { DAY, HOUR, atLocal, addDays, localDate } from "../time";

// The seed must be valid whatever day the product is opened on.
const NOWS = Array.from({ length: 21 }, (_, i) => atLocal(addDays("2026-09-28", i), 10 * 60 + (i % 5) * 90));

describe("seed", () => {
  it.each(NOWS.map((n) => [localDate(n), n] as const))("is valid when opened on %s", (_label, now) => {
    const s = seedState(now);
    const dates = new Set(s.jobs.map((j) => localDate(j.startMs)));
    for (const d of dates) expect(checkDay(d, placementsOn({ ...s, jobs: s.jobs.filter((j) => ["booked", "confirmed", "completed"].includes(j.status)) }, d))).toEqual({ ok: true });
    const codes = s.jobs.map((j) => j.code);
    expect(new Set(codes).size).toBe(codes.length);
    const ids = s.messages.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has upcoming work, a waitlist, handled inquiries and a non-empty ledger", () => {
    const now = NOWS[2];
    const s = seedState(now);
    expect(s.jobs.filter((j) => j.startMs > now).length).toBeGreaterThanOrEqual(6);
    expect(s.waitlist.length).toBe(3);
    expect(s.inquiries.length).toBe(4);
    expect(s.inquiries.some((q) => q.status === "needs_owner")).toBe(true);
    const l = ledgerFor(s, now);
    expect(l.messages).toBeGreaterThan(10);
    expect(l.minutes).toBeGreaterThan(60);
  });

  it("at least one upcoming day has two outdoor jobs for the storm demo", () => {
    let ok = 0;
    for (const now of NOWS) {
      const s = seedState(now);
      const by = new Map<string, number>();
      for (const j of s.jobs) {
        if (j.startMs > now && (j.parking === "driveway" || j.parking === "street") && ["booked", "confirmed"].includes(j.status)) by.set(localDate(j.startMs), (by.get(localDate(j.startMs)) ?? 0) + 1);
      }
      if ([...by.values()].some((n) => n >= 2)) ok++;
    }
    expect(ok).toBeGreaterThan(NOWS.length * 0.6);
  });

  it("is stable when ticked again", () => {
    const now = NOWS[4];
    const s = seedState(now);
    const again = tick(s, now);
    expect(again.messages.length).toBe(s.messages.length);
    expect(again).toBe(s);
    void DAY; void HOUR;
  });
});

describe("seed: the product looks alive on day one", () => {
  it("has history for every kind of owner-effort saving", async () => {
    const { ledgerFor } = await import("../ledger");
    const now = NOWS[2];
    const l = ledgerFor(seedState(now), now);
    expect(l.moves).toBeGreaterThanOrEqual(1);
    expect(l.rainMoves).toBeGreaterThanOrEqual(1);
    expect(l.released).toBeGreaterThanOrEqual(1);
    expect(l.backfilled).toBeGreaterThanOrEqual(1);
  });

  it.each(NOWS.filter((_, i) => i % 3 === 0).map((n) => [localDate(n), n] as const))("a long job (SUV full refresh with pet hair) has real openings (and at least one dry day) within 8 days when opened on %s", async (_l, now) => {
    const { slotsByDay } = await import("../engine");
    const days = slotsByDay(seedState(now), 225, "NE", now).slice(0, 8);
    expect(days.filter((d) => d.slots.length).length).toBeGreaterThanOrEqual(2);
    expect(days.filter((d) => d.slots.length && !d.forecast.wet).length).toBeGreaterThanOrEqual(1);
  });
});
