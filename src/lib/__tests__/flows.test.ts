import { describe, expect, it } from "vitest";
import { advance, tick, timelineFor } from "../automations";
import { findSlots } from "../engine";
import { parseInquiry } from "../inquiry";
import { cancelJob, chooseRainOption, claimOffer, confirmJob, createJob, joinWaitlist, moveJob, type BookingInput } from "../ops";
import { emptyState } from "../seed";
import { BookingError } from "../model";
import { HOUR, addDays, atLocal, localDate } from "../time";

const NOW = atLocal("2026-09-30", 10 * 60); // Wednesday
const day = (n: number) => addDays("2026-09-30", n);

const input = (over: Partial<BookingInput> = {}): BookingInput => ({
  customer: { name: "Maya Thornton", phone: "(503) 555-0121", email: "maya@example.com" },
  vehicle: { kind: "suv", label: "grey Outback" },
  service: "full", addons: [], zip: "97212", address: "3415 NE 15th Ave", parking: "garage",
  access: { gateCode: "", notes: "" }, startMs: atLocal(day(3), 9 * 60), ...over,
});

// day(3) is Saturday 3 Oct; day(1) Thursday 1 Oct.
describe("booking", () => {
  it("books a valid slot, confirms by email and sets the price", () => {
    const { state, job } = createJob(emptyState(NOW), input(), NOW);
    expect(job.status).toBe("booked");
    expect(job.durationMin).toBe(195); // 150 × 1.25 = 187.5 → 195
    expect(job.totalCents).toBe(25000); // $210 × 1.2 = $252 → $250
    expect(state.messages.map((m) => m.kind)).toEqual(["confirmation"]);
    expect(state.messages[0].channel).toBe("email");
  });

  it("refuses a slot that was just taken, and one that breaks the drive time", () => {
    const { state } = createJob(emptyState(NOW), input(), NOW);
    expect(() => createJob(state, input({ customer: { name: "Other", phone: "1", email: "o@x.com" } }), NOW)).toThrowError(BookingError);
    // 9:00 job ends 12:15. NE→SE is 20 min: 12:30 is too tight; 13:00 works.
    expect(() => createJob(state, input({ zip: "97202", startMs: atLocal(day(3), 12 * 60 + 30) }), NOW)).toThrowError(/just taken/);
    expect(() => createJob(state, input({ zip: "97202", startMs: atLocal(day(3), 13 * 60) }), NOW)).not.toThrow();
  });

  it("refuses zips outside the service area", () => {
    expect(() => createJob(emptyState(NOW), input({ zip: "98660" }), NOW)).toThrowError(/don't reach/);
  });

  it("auto-confirms bookings made inside 24 hours", () => {
    const { job } = createJob(emptyState(NOW), input({ startMs: atLocal(day(1), 9 * 60) }), NOW);
    expect(job.status).toBe("confirmed");
  });
});

describe("changes", () => {
  it("lets the customer move themselves up to 24 hours ahead, and rolls the reminders", () => {
    const { state, job } = createJob(emptyState(NOW), input(), NOW);
    const moved = moveJob(state, job.id, atLocal(day(2), 10 * 60), NOW);
    const j = moved.jobs[0];
    expect(j.startMs).toBe(atLocal(day(2), 10 * 60));
    expect(j.movedFrom).toEqual([job.startMs]);
    // The plan is derived from the start, so the reminder is now due a day before the new time.
    const later = tick(moved, atLocal(day(1), 10 * 60 + 5));
    const reminder = later.messages.find((m) => m.kind === "reminder");
    expect(reminder?.at).toBe(atLocal(day(2), 10 * 60) - 24 * HOUR);
  });

  it("does not allow self-serve moves inside 24 hours", () => {
    const { state, job } = createJob(emptyState(NOW), input({ startMs: atLocal(day(1), 9 * 60) }), NOW);
    expect(() => moveJob(state, job.id, atLocal(day(2), 9 * 60), NOW)).toThrowError(/24 hours/);
  });

  it("refunds a timely cancellation and keeps the deposit for a late one", () => {
    const a = createJob(emptyState(NOW), input(), NOW);
    expect(cancelJob(a.state, a.job.id, NOW).jobs[0].depositState).toBe("refunded");
    const b = createJob(emptyState(NOW), input({ startMs: atLocal(day(1), 9 * 60) }), NOW);
    expect(cancelJob(b.state, b.job.id, NOW).jobs[0].depositState).toBe("kept");
  });
});

describe("waitlist backfill", () => {
  it("offers a cancelled slot to the first waitlisted customer whose job fits, then lets them claim it", () => {
    let s = emptyState(NOW);
    const first = createJob(s, input(), NOW);
    s = first.state;
    s = joinWaitlist(s, { customer: { name: "Priya Nair", phone: "(503) 555-0238", email: "p@x.com" }, vehicle: { kind: "suv", label: "CR-V" }, service: "interior", addons: [], zip: "97214", address: "1440 SE 34th Ave", parking: "garage" }, NOW).state;
    s = cancelJob(s, first.job.id, NOW);
    const entry = s.waitlist[0];
    expect(entry.status).toBe("offered");
    expect(s.messages.some((m) => m.kind === "waitlist_offer")).toBe(true);
    const claimed = claimOffer(s, entry.id, NOW + HOUR);
    expect(claimed.job.source).toBe("waitlist");
    expect(claimed.state.waitlist[0].status).toBe("booked");
    expect(() => claimOffer(claimed.state, entry.id, NOW + HOUR)).toThrowError(/already been taken/);
  });

  it("passes an unclaimed offer to the next person after two hours", () => {
    let s = emptyState(NOW);
    const first = createJob(s, input(), NOW);
    s = first.state;
    const add = (name: string, createdAt: number) => {
      const r = joinWaitlist(s, { customer: { name, phone: "1", email: "x@x.com" }, vehicle: { kind: "sedan", label: "car" }, service: "express", addons: [], zip: "97212", address: "1 Main", parking: "garage" }, createdAt);
      s = r.state;
    };
    add("Alpha", NOW - 3 * HOUR);
    add("Beta", NOW - 2 * HOUR);
    s = cancelJob(s, first.job.id, NOW);
    expect(s.waitlist.find((w) => w.name === "Alpha")!.status).toBe("offered");
    s = tick(s, NOW + 3 * HOUR);
    expect(s.waitlist.find((w) => w.name === "Alpha")!.status).toBe("expired");
    expect(s.waitlist.find((w) => w.name === "Beta")!.status).toBe("offered");
  });
});

describe("no-show defence", () => {
  it("reminds at 24 hours, nudges at 6, and releases at 3 when nobody confirms", () => {
    const { state, job } = createJob(emptyState(NOW), input({ startMs: atLocal(day(3), 9 * 60) }), NOW);
    const after = advance(state, NOW, job.startMs - 2 * HOUR);
    const kinds = after.messages.map((m) => m.kind);
    expect(kinds).toContain("prep");
    expect(kinds).toContain("reminder");
    expect(kinds).toContain("nudge");
    expect(kinds).toContain("released");
    expect(after.jobs[0].status).toBe("released");
    expect(after.jobs[0].depositState).toBe("kept");
  });

  it("does not release a customer who confirmed", () => {
    const { state, job } = createJob(emptyState(NOW), input(), NOW);
    let s = advance(state, NOW, job.startMs - 23 * HOUR);
    s = confirmJob(s, job.id, job.startMs - 23 * HOUR);
    s = advance(s, job.startMs - 23 * HOUR, job.startMs - HOUR);
    expect(s.jobs[0].status).toBe("confirmed");
    expect(s.messages.map((m) => m.kind)).not.toContain("released");
    expect(s.messages.map((m) => m.kind)).not.toContain("nudge");
  });

  it("marks the job done and sends care tips afterwards", () => {
    const { state, job } = createJob(emptyState(NOW), input(), NOW);
    let s = advance(state, NOW, job.startMs - 25 * HOUR);
    s = confirmJob(s, job.id, job.startMs - 25 * HOUR);
    s = advance(s, job.startMs - 25 * HOUR, job.startMs + (job.durationMin / 60 + 3) * HOUR);
    expect(s.jobs[0].status).toBe("completed");
    expect(s.messages.map((m) => m.kind)).toContain("aftercare");
  });
});

describe("rain", () => {
  const outdoor = () => createJob(emptyState(NOW), input({ parking: "driveway", startMs: atLocal(day(2), 10 * 60), zip: "97212" }), NOW);

  it("offers dry options to an outdoor booking when a storm is forecast, and moves it when the customer chooses", () => {
    const { state, job } = outdoor();
    const storm = { ...state, stormDays: [localDate(job.startMs)] };
    const s = tick(storm, job.startMs - 40 * HOUR);
    const j = s.jobs[0];
    expect(j.rainOffer?.options.length).toBeGreaterThan(0);
    expect(s.messages.map((m) => m.kind)).toContain("rain_offer");
    const moved = chooseRainOption(s, job.id, 0, job.startMs - 39 * HOUR);
    expect(moved.jobs[0].startMs).not.toBe(job.startMs);
    expect(localDate(moved.jobs[0].startMs)).not.toBe(localDate(job.startMs));
    expect(moved.events.map((e) => e.kind)).toContain("rain_moved");
  });

  it("takes the first dry option automatically when the customer doesn't answer", () => {
    const { state, job } = outdoor();
    const storm = { ...state, stormDays: [localDate(job.startMs)] };
    const s = advance(storm, job.startMs - 47 * HOUR, job.startMs - 30 * HOUR);
    expect(localDate(s.jobs[0].startMs)).not.toBe(localDate(job.startMs));
    expect(s.jobs[0].rainOffer).toBeNull();
    expect(s.messages.find((m) => m.kind === "rain_moved")?.body).toMatch(/You didn't pick/);
  });

  it("never moves a covered booking", () => {
    const { state, job } = createJob(emptyState(NOW), input({ parking: "garage", startMs: atLocal(day(2), 10 * 60) }), NOW);
    const s = advance({ ...state, stormDays: [localDate(job.startMs)] }, job.startMs - 47 * HOUR, job.startMs - 30 * HOUR);
    expect(s.jobs[0].startMs).toBe(job.startMs);
    expect(s.messages.map((m) => m.kind)).not.toContain("rain_offer");
  });

  it("shows a timeline of what is queued", () => {
    const { state, job } = createJob(emptyState(NOW), input(), NOW);
    const t = timelineFor(state, job, NOW);
    expect(t.map((x) => x.kind)).toEqual(["prep", "reminder", "nudge", "release", "omw", "aftercare"]);
    expect(t.every((x) => x.state === "upcoming")).toBe(true);
  });
});

describe("the front door", () => {
  it("reads a messy message", () => {
    const p = parseInquiry("hey do u do subarus? filthy inside from my dog, need it before saturday, im in sellwood", NOW);
    expect(p.vehicle).toBe("suv");
    expect(p.service).toBe("interior");
    expect(p.addons).toContain("pet");
    expect(p.zone).toBe("SE");
    expect(p.before).toBe(day(3)); // Saturday
  });
  it("reads a zip, a day and a time of day", () => {
    const p = parseInquiry("Can I get my minivan cleaned tomorrow morning? 97007", NOW);
    expect(p.vehicle).toBe("van");
    expect(p.zone).toBe("W");
    expect(p.date).toBe(day(1));
    expect(p.part).toBe("morning");
  });
  it("flags what isn't on the menu", () => {
    expect(parseInquiry("Do you do ceramic coating?", NOW).outOfScope).toBe("ceramic coating");
  });
});

describe("slot search stays consistent with validation", () => {
  it("every slot findSlots returns can be booked", () => {
    let s = emptyState(NOW);
    s = createJob(s, input({ startMs: atLocal(day(3), 9 * 60) }), NOW).state;
    for (const ms of findSlots(s, 120, "SE", day(3), NOW)) {
      expect(() => createJob(s, input({ zip: "97202", service: "interior", vehicle: { kind: "sedan", label: "x" }, startMs: ms }), NOW)).not.toThrow();
    }
  });
});

describe("inquiry replies stay honest", () => {
  it("says so when the deadline can't be met, and offers the next real openings", async () => {
    const { answerInquiry } = await import("../inquiry");
    const { seedState } = await import("../seed");
    const { inquiry } = answerInquiry(seedState(NOW), "x", "SUV interior with dog hair, before tomorrow, in Sellwood", NOW);
    expect(inquiry.suggested.length).toBeGreaterThan(0);
    expect(inquiry.reply).not.toMatch(/Nothing dry is open in the next two weeks/);
    expect(inquiry.reply).toMatch(/next openings|Open times/);
    expect(inquiry.reply).toMatch(/your SUV/);
  });
});

describe("neighbour deals (route-density pricing)", () => {
  const seFull = (startMs: number): BookingInput => input({ zip: "97202", startMs, service: "express", vehicle: { kind: "sedan", label: "car" } });

  it("gives the slot right after a same-zone job a discount worth 50¢ per minute Dario doesn't drive", async () => {
    const { neighbourDeal } = await import("../engine");
    let s = emptyState(NOW);
    s = createJob(s, seFull(atLocal(day(3), 9 * 60)), NOW).state; // SE, 60 min → 10:00
    // Straight after, same zone: one trip instead of two. SE is 20 min from base, 10 within the zone.
    const d = neighbourDeal(s, { startMs: atLocal(day(3), 10 * 60 + 30), durationMin: 60, zone: "SE" });
    expect(d).toMatchObject({ savedMin: 20, discountCents: 1000 });
    // Same zone but not adjacent in the day's order (another job sits between them): no deal.
    const s2 = createJob(s, { ...seFull(atLocal(day(3), 11 * 60 + 30)), zip: "97212" }, NOW).state; // NE job in between
    expect(neighbourDeal(s2, { startMs: atLocal(day(3), 13 * 60 + 30), durationMin: 60, zone: "SE" })).toBeNull();
  });

  it("gives no deal in the home zone, in a different zone, or on an empty day", async () => {
    const { neighbourDeal } = await import("../engine");
    let s = emptyState(NOW);
    expect(neighbourDeal(s, { startMs: atLocal(day(3), 9 * 60), durationMin: 60, zone: "SE" })).toBeNull();
    s = createJob(s, seFull(atLocal(day(3), 9 * 60)), NOW).state;
    expect(neighbourDeal(s, { startMs: atLocal(day(3), 10 * 60 + 30), durationMin: 60, zone: "NE" })).toBeNull();
    expect(neighbourDeal(s, { startMs: atLocal(day(3), 10 * 60 + 30), durationMin: 60, zone: "SW" })).toBeNull();
  });

  it("takes the deal off the price at booking and keeps it if the job later moves", () => {
    let s = emptyState(NOW);
    s = createJob(s, seFull(atLocal(day(3), 9 * 60)), NOW).state;
    const { state, job } = createJob(s, seFull(atLocal(day(3), 10 * 60 + 30)), NOW);
    expect(job.discountCents).toBe(1000);
    expect(job.dealMin).toBe(20);
    expect(job.totalCents).toBe(8500 - 1000); // express sedan is $85
    expect(state.messages.find((m) => m.jobId === job.id)?.body).toMatch(/neighbour deal/);
    const moved = moveJob(state, job.id, atLocal(day(2), 9 * 60), NOW);
    expect(moved.jobs.find((j) => j.id === job.id)!.totalCents).toBe(7500);
  });

  it("the first booking of the day pays full price", () => {
    const { job } = createJob(emptyState(NOW), seFull(atLocal(day(3), 9 * 60)), NOW);
    expect(job.discountCents).toBe(0);
    expect(job.totalCents).toBe(8500);
  });
});
