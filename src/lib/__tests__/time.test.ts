import { describe, expect, it } from "vitest";
import { dateKeyInZone, fmtTime, generateSlots, groupByClientDay, placeSeedSession, zonedInstant } from "../time";

const LISBON = "Europe/Lisbon";
const rules = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_local: "09:00", end_local: "18:00" }));
const base = {
  timezone: LISBON,
  bufferMin: 45,
  maxPerDay: 2,
  rules,
  durationMin: 90,
  busy: [],
};

describe("generateSlots", () => {
  // Monday 5 October 2026, 08:00 Lisbon
  const now = zonedInstant("2026-10-05", "08:00", LISBON);

  it("keeps the whole held span, buffers included, inside the window", () => {
    const { slots } = generateSlots({ ...base, now });
    for (const s of slots) {
      const local = (d: Date) => fmtTime(d, LISBON);
      expect(local(s.blockedStart) >= "09:00").toBe(true);
      expect(local(s.blockedEnd) <= "18:00").toBe(true);
    }
    const tuesday = slots.filter((s) => s.guideDateKey === "2026-10-06").map((s) => fmtTime(s.start, LISBON));
    expect(tuesday).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]);
  });

  it("respects minimum notice", () => {
    const { slots } = generateSlots({ ...base, now });
    expect(slots.every((s) => s.start.getTime() >= now.getTime() + 24 * 3600_000)).toBe(true);
    expect(slots.some((s) => s.guideDateKey === "2026-10-05")).toBe(false);
  });

  it("never lets buffers touch another session's buffers", () => {
    const start = zonedInstant("2026-10-06", "11:00", LISBON);
    const end = new Date(start.getTime() + 90 * 60_000);
    const busy = [
      {
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        blocked_start: new Date(start.getTime() - 45 * 60_000).toISOString(),
        blocked_end: new Date(end.getTime() + 45 * 60_000).toISOString(),
      },
    ];
    const { slots } = generateSlots({ ...base, now, busy });
    const tuesday = slots.filter((s) => s.guideDateKey === "2026-10-06");
    const open = tuesday.filter((s) => s.state === "open").map((s) => fmtTime(s.start, LISBON));
    // 11:00 session holds 10:15–13:15; a new one needs its own 45 minutes, so 14:00 is the earliest.
    expect(open).toEqual(["14:00", "15:00"]);
    expect(tuesday.filter((s) => s.state === "held").map((s) => fmtTime(s.start, LISBON))).toEqual(["10:00", "11:00", "12:00", "13:00"]);
  });

  it("closes a day once the Guide's daily limit is reached", () => {
    const mk = (hhmm: string) => {
      const s = zonedInstant("2026-10-07", hhmm, LISBON);
      const e = new Date(s.getTime() + 90 * 60_000);
      return { starts_at: s.toISOString(), ends_at: e.toISOString(), blocked_start: new Date(+s - 2700_000).toISOString(), blocked_end: new Date(+e + 2700_000).toISOString() };
    };
    const { slots } = generateSlots({ ...base, maxPerDay: 1, now, busy: [mk("10:00")] });
    const wed = slots.filter((s) => s.guideDateKey === "2026-10-07");
    expect(wed.some((s) => s.state === "open")).toBe(false);
    expect(wed.some((s) => s.state === "full")).toBe(true);
  });

  it("handles the autumn clock change (Lisbon, 25 Oct 2026)", () => {
    const later = zonedInstant("2026-10-22", "08:00", LISBON);
    const { slots } = generateSlots({ ...base, now: later });
    const before = slots.find((s) => s.guideDateKey === "2026-10-23")!; // Friday, WEST (UTC+1)
    const after = slots.find((s) => s.guideDateKey === "2026-10-26")!; // Monday, WET (UTC+0)
    expect(fmtTime(before.start, LISBON)).toBe("10:00");
    expect(fmtTime(after.start, LISBON)).toBe("10:00");
    expect(before.start.toISOString()).toBe("2026-10-23T09:00:00.000Z");
    expect(after.start.toISOString()).toBe("2026-10-26T10:00:00.000Z");
  });

  it("groups by the client's calendar day, which may differ from the Guide's", () => {
    const melbourne = "Australia/Melbourne";
    const { slots } = generateSlots({ ...base, timezone: melbourne, now: zonedInstant("2026-10-05", "08:00", melbourne) });
    const s = slots.find((x) => x.guideDateKey === "2026-10-07" && fmtTime(x.start, melbourne) === "10:00")!;
    // 10:00 Wednesday in Melbourne is still Tuesday evening in New York.
    const ny = groupByClientDay([s], "America/New_York");
    expect([...ny.keys()]).toEqual(["2026-10-06"]);
    expect(dateKeyInZone(s.start, melbourne)).toBe("2026-10-07");
  });
});

describe("placeSeedSession", () => {
  it("finds the next open day forward, and the previous one backward", () => {
    const now = zonedInstant("2026-10-03", "12:00", LISBON); // Saturday
    const fwd = placeSeedSession({ timezone: LISBON, bufferMin: 45, rules, dayOffset: 1, localTime: "10:00", durationMin: 90, taken: [], now });
    expect(dateKeyInZone(fwd!, LISBON)).toBe("2026-10-05");
    const back = placeSeedSession({ timezone: LISBON, bufferMin: 45, rules, dayOffset: -1, localTime: "10:00", durationMin: 90, taken: [], now });
    expect(dateKeyInZone(back!, LISBON)).toBe("2026-10-02");
  });
});
