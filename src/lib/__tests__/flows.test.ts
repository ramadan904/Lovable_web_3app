import { describe, expect, it } from "vitest";
import { advance, tick, timelineFor } from "../automations";
import { findSlots } from "../engine";
import { parseInquiry } from "../inquiry";
import { cancelJob, chooseRainOption, claimOffer, confirmJob, createJob, joinWaitlist, moveJob, type BookingInput } from "../ops";
import { emptyState } from "../seed";
import { BookingError } from "../model";
import { HOUR, addDays, atLocal, localDate } from "../time";
import { forecastFor } from "../weather";

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

describe("the rain promise: '$25 holds the slot. Fully refundable if we have to move you for rain.'", () => {
  const outdoor = () => createJob(emptyState(NOW), input({ parking: "driveway", startMs: atLocal(day(3), 10 * 60) }), NOW);

  it("refunds a late cancellation once rain has touched the booking, but not otherwise", () => {
    const { state, job } = outdoor();
    const late = job.startMs - 5 * HOUR;
    // Without rain, cancelling inside 24 hours keeps the deposit.
    expect(cancelJob(state, job.id, late).jobs[0].depositState).toBe("kept");
    // A rain offer marks the booking; from then on cancelling is a full refund at any time.
    const stormy = tick({ ...state, stormDays: [localDate(job.startMs)] }, job.startMs - 40 * HOUR);
    expect(stormy.jobs[0].rainAffected).toBe(true);
    const cancelled = cancelJob(stormy, job.id, late);
    expect(cancelled.jobs[0].depositState).toBe("refunded");
    expect(cancelled.jobs[0].closedReason).toMatch(/rain/i);
    expect(cancelled.messages.find((m) => m.kind === "cancelled")?.body).toMatch(/in full/);
  });

  it("also marks a booking that was moved for rain", () => {
    const { state, job } = outdoor();
    const storm = { ...state, stormDays: [localDate(job.startMs)] };
    const s = advance(storm, job.startMs - 47 * HOUR, job.startMs - 30 * HOUR);
    expect(s.jobs[0].startMs).not.toBe(job.startMs);
    expect(s.jobs[0].rainAffected).toBe(true);
  });

  it("offers dry alternatives for a booking that doesn't exist yet", async () => {
    const { dryOptions } = await import("../engine");
    const s = { ...emptyState(NOW), stormDays: [day(3)] };
    const opts = dryOptions(s, { startMs: atLocal(day(3), 10 * 60), durationMin: 120, zone: "NE", parking: "driveway" }, NOW, 3);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((ms) => localDate(ms) !== day(3))).toBe(true);
  });
});

describe("one-tap drafted replies", () => {
  it("drafts a reply for a rain booking with no dry slot, and sending it clears the flag and messages the customer", async () => {
    const { draftForFlag } = await import("../drafts");
    const { sendOwnerReply } = await import("../ops");
    let { state, job } = createJob(emptyState(NOW), input({ parking: "driveway" }), NOW);
    state = { ...state, jobs: state.jobs.map((j) => ({ ...j, ownerFlag: "Rain is forecast and no dry slot is open." })) };
    job = state.jobs[0];
    const draft = draftForFlag(job);
    expect(draft).toMatch(/refunded in full/);
    expect(draft).toContain(job.code);
    const sent = sendOwnerReply(state, { jobId: job.id }, draft, NOW);
    expect(sent.jobs[0].ownerFlag).toBeNull();
    const m = sent.messages.find((x) => x.kind === "owner_reply")!;
    expect(m).toMatchObject({ direction: "out", to: job.customer.phone, body: draft });
    expect(sent.events.map((e) => e.kind)).toContain("owner_reply");
  });

  it("drafts a useful answer to an off-menu request, with a real link", async () => {
    const { draftForInquiry } = await import("../drafts");
    const { answerInquiry } = await import("../inquiry");
    const { sendOwnerReply } = await import("../ops");
    const { state, inquiry } = answerInquiry(emptyState(NOW), "(503) 555-0279", "Do you do ceramic coating? Just bought a Tesla, Pearl district", NOW);
    expect(inquiry.status).toBe("needs_owner");
    const draft = draftForInquiry(inquiry);
    expect(draft).toMatch(/ceramic coating/);
    expect(draft).toMatch(/fernhill\.app\/book\?/);
    const sent = sendOwnerReply(state, { inquiryId: inquiry.id }, draft, NOW);
    expect(sent.inquiries[0].status).toBe("answered");
    expect(sent.messages.some((m) => m.kind === "owner_reply" && m.to === "(503) 555-0279")).toBe(true);
  });
});

describe("the ledger's headline numbers", () => {
  it("counts recovered no-shows in dollars and money booked ahead", async () => {
    const { ledgerFor } = await import("../ledger");
    const { seedState } = await import("../seed");
    const now = atLocal("2026-09-30", 13 * 60);
    const l = ledgerFor(seedState(now), now);
    expect(l.recoveredCents).toBeGreaterThan(0);
    expect(l.aheadJobs).toBeGreaterThan(0);
    expect(l.aheadCents).toBeGreaterThan(0);
    expect(l.messages).toBeGreaterThan(10);
    expect(l.minutes).toBeGreaterThan(60);
  });
});

describe("running behind: one tap tells everyone still to come today", () => {
  const morning = () => atLocal(day(3), 7 * 60 + 30); // Saturday 7:30
  const twoJobsToday = () => {
    let s = emptyState(NOW);
    const a = createJob(s, input({ startMs: atLocal(day(3), 9 * 60), service: "express", vehicle: { kind: "sedan", label: "car" } }), NOW);
    s = a.state;
    const b = createJob(s, { ...input({ zip: "97202", startMs: atLocal(day(3), 12 * 60), service: "express", vehicle: { kind: "sedan", label: "car" } }), customer: { name: "Second Sam", phone: "(503) 555-0000", email: "s@x.co" } }, NOW);
    return { state: b.state, a: a.job, b: b.job };
  };

  it("shifts arrival for every job not yet started, texts each customer the new time, and leaves the booked slot alone", async () => {
    const { reportDelay } = await import("../ops");
    const { state, a, b } = twoJobsToday();
    const { state: s, notified } = reportDelay(state, 20, morning());
    expect(notified.sort()).toEqual(["Maya Thornton", "Second Sam"]);
    expect(s.jobs.map((j) => j.delayMin)).toEqual([20, 20]);
    expect(s.jobs.map((j) => j.startMs)).toEqual([a.startMs, b.startMs]); // the booked slot never moves
    const texts = s.messages.filter((m) => m.kind === "delay");
    expect(texts).toHaveLength(2);
    expect(texts[0].body).toMatch(/20 min behind/);
    expect(texts[0].body).toContain("9:20 AM"); // 9:00 + 20
    expect(s.events.map((e) => e.kind)).toContain("delay");
  });

  it("only warns jobs that haven't started: the one in progress is left alone", async () => {
    const { reportDelay } = await import("../ops");
    const { state } = twoJobsToday();
    const { notified } = reportDelay(state, 15, atLocal(day(3), 9 * 60 + 30)); // first job under way
    expect(notified).toEqual(["Second Sam"]);
  });

  it("stacks, moves the on-the-way text and the finish with the delay, and refuses absurd delays", async () => {
    const { reportDelay } = await import("../ops");
    const { plan } = await import("../automations");
    const { state, b } = twoJobsToday();
    let s = reportDelay(state, 20, morning()).state;
    s = reportDelay(s, 30, morning() + HOUR).state;
    const j = s.jobs.find((x) => x.id === b.id)!;
    expect(j.delayMin).toBe(50);
    const omw = plan(j).find((p) => p.kind === "omw")!;
    expect(omw.at).toBe(b.startMs + 50 * 60_000 - 30 * 60_000);
    expect(() => reportDelay(s, 90, morning() + 2 * HOUR)).toThrowError(/call people/);
  });

  it("errors when there is nothing left today, and a customer's own move clears the delay", async () => {
    const { reportDelay } = await import("../ops");
    const { state, a } = twoJobsToday();
    expect(() => reportDelay(state, 20, atLocal(day(3), 18 * 60))).toThrowError(/no jobs left today/);
    const delayed = reportDelay(state, 20, morning()).state;
    const moved = moveJob(delayed, a.id, atLocal(day(6), 9 * 60), morning() - 30 * HOUR); // Tuesday
    expect(moved.jobs.find((x) => x.id === a.id)!.delayMin).toBe(0);
  });

  it("the tracker and ETA follow the delay", async () => {
    const { reportDelay } = await import("../ops");
    const { withDelay, etaFor } = await import("../tracker");
    const { state, a } = twoJobsToday();
    const s = reportDelay(state, 20, morning()).state;
    const jobs = withDelay(s.jobs);
    expect(jobs[0].startMs).toBe(a.startMs + 20 * 60_000);
    // At 9:05 an on-time Bertha is already working; a 20-minute-late one hasn't even left the base.
    expect(etaFor(withDelay(state.jobs), a.id, 9 * 60 + 5).state).toBe("working");
    expect(etaFor(withDelay(s.jobs), a.id, 9 * 60 + 5).state).toBe("jobs_ahead");
    // ...and the customer is told the drive: 10 minutes out, arriving 9:20.
    expect(etaFor(withDelay(s.jobs), a.id, 9 * 60 + 12)).toMatchObject({ state: "on_the_way", minutesToArrival: 8 });
  });
});

describe("care plans: repeat customers rebook themselves", () => {
  const planJob = (over: Partial<BookingInput> = {}) => createJob(emptyState(NOW), input({ plan: 6, parking: "garage", service: "express", vehicle: { kind: "sedan", label: "car" }, startMs: atLocal(day(3), 9 * 60), ...over }), NOW);

  it("books the next visit the same weekday and time, N weeks on, at 10% off and with no deposit", async () => {
    const { scheduleNextVisit } = await import("../ops");
    const { state, job } = planJob();
    const s = structuredClone(state);
    const next = scheduleNextVisit(s, s.jobs[0], job.startMs + 2 * HOUR)!;
    expect(next).not.toBeNull();
    expect(localDate(next.startMs)).toBe(addDays(localDate(job.startMs), 42));
    expect(next.startMs).toBe(atLocal(addDays(localDate(job.startMs), 42), 9 * 60));
    expect(next.source).toBe("plan");
    expect(next.plan).toEqual({ everyWeeks: 6 });
    expect(next.depositCents).toBe(0);
    expect(next.discountCents).toBe(900); // 10% of $85 is $8.50, rounded to the dollar
    expect(next.totalCents).toBe(7600);
    expect(s.messages.some((m) => m.kind === "plan_booked" && m.jobId === next.id)).toBe(true);
  });

  it("finishing a plan visit books the next one automatically; a job without a plan books nothing", () => {
    // The customer taps Confirm the day before, as a real one would, so the visit isn't released.
    const finish = (booked: { state: ReturnType<typeof emptyState>; job: { id: string; startMs: number } }) => {
      const s = confirmJob(advance(booked.state, NOW, booked.job.startMs - 23 * HOUR), booked.job.id, booked.job.startMs - 23 * HOUR);
      return advance(s, booked.job.startMs - 23 * HOUR, booked.job.startMs + 6 * HOUR);
    };
    const done = finish(planJob());
    expect(done.jobs[0].status).toBe("completed");
    expect(done.jobs.filter((j) => j.source === "plan")).toHaveLength(1);
    const plain = finish(createJob(emptyState(NOW), input({ parking: "garage", startMs: atLocal(day(3), 9 * 60) }), NOW));
    expect(plain.jobs[0].status).toBe("completed");
    expect(plain.jobs.filter((j) => j.source === "plan")).toHaveLength(0);
  });

  it("takes the nearest open slot when the usual time is gone", async () => {
    const { scheduleNextVisit } = await import("../ops");
    const { state, job } = planJob();
    const target = addDays(localDate(job.startMs), 42);
    // Someone else holds 9:00 that day.
    const blocked = createJob(state, { ...input({ parking: "garage", service: "express", vehicle: { kind: "sedan", label: "car" }, startMs: atLocal(target, 9 * 60) }), customer: { name: "Other", phone: "9", email: "o@x.co" } }, atLocal(addDays(target, -3), 10 * 60));
    const s = structuredClone(blocked.state);
    const next = scheduleNextVisit(s, s.jobs[0], job.startMs + 2 * HOUR)!;
    expect(next.startMs).not.toBe(atLocal(target, 9 * 60));
    expect(Math.abs(next.startMs - atLocal(target, 9 * 60))).toBeLessThan(3 * 24 * HOUR);
  });

  it("lets the customer skip a visit (the plan carries on) or end the plan", async () => {
    const { scheduleNextVisit, skipVisit, endPlan } = await import("../ops");
    const { state, job } = planJob();
    const withNext = structuredClone(state);
    const next = scheduleNextVisit(withNext, withNext.jobs[0], job.startMs + 2 * HOUR)!;
    const skipped = skipVisit(withNext, next.id, job.startMs + 3 * HOUR);
    expect(skipped.jobs.find((j) => j.id === next.id)!.status).toBe("cancelled");
    const following = skipped.jobs.filter((j) => j.source === "plan" && j.status === "booked");
    expect(following).toHaveLength(1);
    expect(localDate(following[0].startMs)).toBe(addDays(localDate(next.startMs), 42));
    expect(skipped.messages.find((m) => m.kind === "cancelled" && m.jobId === next.id)!.body).toMatch(/Nothing was charged/);
    const ended = endPlan(skipped, following[0].id);
    expect(ended.jobs.find((j) => j.id === following[0].id)!.plan).toBeNull();
    expect(() => skipVisit(ended, following[0].id, job.startMs + 4 * HOUR)).toThrowError(/isn't on a care plan/);
  });
});

describe("ceramic sealant needs a dry day outdoors to cure", () => {
  // A deterministic forecast: find a day with 40–69% rain (wet enough to matter for sealant, dry enough for a normal wash).
  const middling = (() => { for (let i = 1; i < 60; i++) { const d = addDays("2026-10-06", i); if ([2, 3, 4, 5, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) { const f = forecastFor(d); if (f.rain >= 40 && f.rain < 70) return d; } } throw new Error("no middling day found"); })();
  const NOW2 = atLocal(addDays(middling, -6), 10 * 60);

  it("offers no slots on a 40%+ day for an outdoor job with sealant, but still offers them for a plain wash or a garage", async () => {
    const { slotsByDay } = await import("../engine");
    const s = emptyState(NOW2);
    const wet = (needsDry: boolean) => slotsByDay(s, 90, "NE", NOW2, undefined, { needsDry }).find((d) => d.date === middling)!;
    expect(wet(true).slots).toEqual([]);
    expect(wet(true).reason).toBe("wet");
    expect(wet(false).slots.length).toBeGreaterThan(0);
  });

  it("refuses to book it, and allows it in a garage", () => {
    const base = { startMs: atLocal(middling, 10 * 60), addons: ["sealant" as const], service: "express" as const, vehicle: { kind: "sedan" as const, label: "car" } };
    expect(() => createJob(emptyState(NOW2), input({ ...base, parking: "driveway" }), NOW2)).toThrowError(/dry day to cure/);
    expect(() => createJob(emptyState(NOW2), input({ ...base, parking: "garage" }), NOW2)).not.toThrow();
    expect(() => createJob(emptyState(NOW2), input({ ...base, parking: "driveway", addons: [] }), NOW2)).not.toThrow();
  });
});

describe("the natural-language box, end to end", () => {
  const ASK = "My dog wrecked my Outback. I'm in Sellwood. Friday morning?";
  const NOWFRI = atLocal("2026-09-29", 14 * 60); // Tuesday; Friday is 2 Oct

  it("reads the vehicle, add-on, place (with a zip), day and time of day from your exact example", () => {
    const p = parseInquiry(ASK, NOWFRI);
    expect(p).toMatchObject({ vehicle: "suv", service: "interior", zone: "SE", place: "Sellwood", zip: "97202", zipInferred: true, part: "morning", date: "2026-10-02", urgent: false });
    expect(p.addons).toContain("pet");
    expect(p.when).toBe("Friday morning");
  });

  it("notices urgency, and prefers a typed zip to a guessed one", () => {
    const a = parseInquiry("need my truck washed ASAP, muddy, Beaverton", NOWFRI);
    expect(a).toMatchObject({ vehicle: "truck", urgent: true, zone: "W", place: "Beaverton", zip: "97005", when: "as soon as possible" });
    const b = parseInquiry("suv wash in Sellwood 97214 tomorrow", NOWFRI);
    expect(b).toMatchObject({ zip: "97214", zipInferred: false, when: "tomorrow" });
  });

  it("puts everything into the booking link, including a zip, so nothing has to be retyped", async () => {
    const { bookingLink, understood } = await import("../inquiry");
    const p = parseInquiry(ASK, NOWFRI);
    const url = new URL(`http://x${bookingLink({ ...p, startMs: 1, ask: { message: ASK, when: p.when } })}`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ v: "suv", s: "interior", a: "pet", zip: "97202", src: "ask", w: "Friday morning", d: "2026-10-02" });
    expect(url.searchParams.get("m")).toBe(ASK);
    expect(understood(p).map((c) => c.label)).toEqual(["SUV or wagon", "Interior Reset", "Pet hair removal", "Sellwood (Southeast)", "Friday morning"]);
  });

  it("offers only real, dry, reachable times, every one of which can actually be booked", async () => {
    const { answerInquiry } = await import("../inquiry");
    const { seedState } = await import("../seed");
    const { forecastFor } = await import("../weather");
    const s = seedState(NOWFRI);
    const { inquiry } = answerInquiry(s, "x", ASK, NOWFRI);
    expect(inquiry.suggested.length).toBeGreaterThan(0);
    for (const ms of inquiry.suggested) {
      expect(forecastFor(localDate(ms), s.stormDays).rain).toBeLessThan(70); // dry
      const booked = () => createJob(s, input({ zip: "97202", service: "interior", addons: ["pet"], vehicle: { kind: "suv", label: "Outback" }, startMs: ms, parking: "driveway" }), NOWFRI);
      expect(booked, `slot ${new Date(ms).toISOString()}`).not.toThrow(); // drive time already counted
    }
  });

  it("says nothing was understood, rather than guessing, when there's no signal", () => {
    const p = parseInquiry("hi", NOWFRI);
    expect(p).toMatchObject({ vehicle: null, service: null, zone: null, when: null });
  });
});
