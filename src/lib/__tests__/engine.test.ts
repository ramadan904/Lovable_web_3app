import { describe, expect, it } from "vitest";
import { checkDay, findSlots, validate } from "../engine";
import { emptyState } from "../seed";
import { atLocal, localMinutes } from "../time";

// Wednesday 30 Sep 2026, 10:00 in Portland.
const NOW = atLocal("2026-09-30", 10 * 60);
const P = (date: string, at: string, durationMin: number, zone: "NE" | "SE" | "N" | "NW" | "SW" | "W") => {
  const [h, m] = at.split(":").map(Number);
  return { startMs: atLocal(date, h * 60 + m), durationMin, zone };
};

describe("checkDay", () => {
  it("is closed on Monday and Sunday", () => {
    expect(checkDay("2026-10-05", [])).toEqual({ ok: false, reason: "closed" });
    expect(checkDay("2026-10-04", [])).toEqual({ ok: false, reason: "closed" });
    expect(checkDay("2026-10-06", [])).toEqual({ ok: true });
  });

  it("needs load time and the drive before the first job", () => {
    // Westside is 35 min from home base: 8:00 + 15 + 35 = 8:50, so 8:30 is too early and 9:00 works.
    expect(checkDay("2026-10-06", [P("2026-10-06", "8:30", 60, "W")])).toEqual({ ok: false, reason: "too_early" });
    expect(checkDay("2026-10-06", [P("2026-10-06", "9:00", 60, "W")])).toEqual({ ok: true });
    // Home base is 10 min away: 8:25 is the earliest, so 8:30 on the grid works.
    expect(checkDay("2026-10-06", [P("2026-10-06", "8:30", 60, "NE")])).toEqual({ ok: true });
  });

  it("puts the drive between jobs on the clock", () => {
    const a = P("2026-10-06", "9:00", 120, "NE"); // ends 11:00
    // NE to SE is 20 minutes, so 11:00 is too tight and 11:30 works.
    expect(checkDay("2026-10-06", [a, P("2026-10-06", "11:00", 60, "SE")])).toEqual({ ok: false, reason: "travel" });
    expect(checkDay("2026-10-06", [a, P("2026-10-06", "11:30", 60, "SE")])).toEqual({ ok: true });
    // Same neighbourhood back-to-back needs only the 10 minutes of parking.
    expect(checkDay("2026-10-06", [a, P("2026-10-06", "11:30", 60, "NE")])).toEqual({ ok: true });
  });

  it("adds a water refill before the third job", () => {
    const a = P("2026-10-06", "8:30", 60, "NE"); // ends 9:30
    const b = P("2026-10-06", "10:00", 60, "NE"); // ends 11:00
    // Third job: 11:00 + 10 travel + 30 refill = 11:40, so 11:30 fails and 12:00 works.
    expect(checkDay("2026-10-06", [a, b, P("2026-10-06", "11:30", 60, "NE")])).toEqual({ ok: false, reason: "travel" });
    expect(checkDay("2026-10-06", [a, b, P("2026-10-06", "12:00", 60, "NE")])).toEqual({ ok: true });
  });

  it("never allows a fourth job", () => {
    const jobs = ["8:30", "10:00", "12:00", "14:00"].map((t) => P("2026-10-06", t, 60, "NE"));
    expect(checkDay("2026-10-06", jobs)).toEqual({ ok: false, reason: "day_full" });
  });

  it("gets Dario home before 5:30 pm", () => {
    // 15:00 + 150 min = 17:30; the drive home from the Westside makes it too late.
    expect(checkDay("2026-10-06", [P("2026-10-06", "15:00", 150, "W")])).toEqual({ ok: false, reason: "too_late" });
    expect(checkDay("2026-10-06", [P("2026-10-06", "14:00", 150, "NE")])).toEqual({ ok: true });
  });

  it("only allows the 30-minute grid", () => {
    expect(checkDay("2026-10-06", [P("2026-10-06", "9:15", 60, "NE")])).toEqual({ ok: false, reason: "off_grid" });
  });
});

describe("findSlots and validate", () => {
  const s = emptyState(NOW);
  it("respects 12 hours' notice", () => {
    expect(validate(s, P("2026-09-30", "15:00", 60, "NE"), NOW)).toBe("too_soon");
    expect(validate(s, P("2026-10-01", "10:00", 60, "NE"), NOW)).toBeNull();
  });
  it("lists the grid on an open day and nothing on a closed one", () => {
    const slots = findSlots(s, 60, "NE", "2026-10-02", NOW);
    expect(slots.length).toBeGreaterThan(10);
    expect(slots.every((ms) => localMinutes(ms) % 30 === 0)).toBe(true);
    expect(findSlots(s, 60, "NE", "2026-10-05", NOW)).toEqual([]);
  });
  it("does not offer a job that could not finish by close", () => {
    const slots = findSlots(s, 300, "NE", "2026-10-02", NOW);
    const last = slots[slots.length - 1];
    // 5 hours + 10 minutes home must fit before 17:30, so the last start is 12:00.
    expect(localMinutes(last)).toBe(12 * 60);
  });
});
