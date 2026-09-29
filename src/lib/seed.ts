// A believable week at Fernhill, generated relative to "now" so the product
// is alive whenever it is opened. Every job is checked against the same rules
// customers face (see __tests__/seed.test.ts).
import { CONFIRM_NUDGE_H, OPEN_WEEKDAYS, RELEASE_H, quote, zoneForZip, type AddonKey, type Parking, type ServiceKey, type VehicleKind } from "./business";
import { tick } from "./automations";
import { checkDay, neighbourDeal, placementsOn } from "./engine";
import type { Job, State } from "./model";
import { answerInquiry } from "./inquiry";
import { pushEvent, sendForJob } from "./ops";
import { DAY, HOUR, MIN, addDays, atLocal, fmtDay, fmtTime, localDate, weekdayOf } from "./time";
import { forecastFor } from "./weather";

interface Spec {
  day: number; // index into the open-day list
  at: string; // "9:30"
  name: string;
  phone: string;
  vehicle: [VehicleKind, string];
  service: ServiceKey;
  addons?: AddonKey[];
  address: string;
  zip: string;
  parking: Parking;
  gate?: string;
  notes?: string;
  sim?: boolean;
  /** Apply the neighbour-deal rule as it would have applied at booking. */
  deal?: boolean;
}

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const FUTURE: Spec[] = [
  // Day 0 — a comfortable two-job day
  { day: 0, at: "9:00", name: "Maya Thornton", phone: "(503) 555-0121", vehicle: ["suv", "grey Subaru Outback"], service: "full", addons: ["pet"], address: "3415 NE 15th Ave", zip: "97212", parking: "driveway", gate: "", notes: "Side gate is open. The dog is friendly but loud.", sim: true },
  { day: 4, at: "14:00", name: "Jordan Ellis", phone: "(503) 555-0134", vehicle: ["sedan", "black Honda Civic"], service: "interior", address: "5620 SE Milwaukie Ave", zip: "97202", parking: "garage", gate: "#4471", notes: "Garage door code. Park Bertha on the street.", sim: true },
  // Day 1 — the rain-sensitive day: two outdoor jobs, one under cover
  { day: 1, at: "9:00", name: "Sam Okoye", phone: "(503) 555-0148", vehicle: ["truck", "white Toyota Tacoma"], service: "express", addons: ["mud"], address: "8210 N Lombard St", zip: "97203", parking: "driveway", notes: "Truck is in the gravel lot behind the shop.", sim: true },
  { day: 1, at: "11:30", name: "Renata Vasquez", phone: "(503) 555-0152", vehicle: ["sedan", "red Mazda 3"], service: "full", address: "1209 NW Overton St", zip: "97209", parking: "street", gate: "Lobby code 2290", notes: "Street parking only. Resident permit on the dash.", sim: false },
  { day: 1, at: "15:00", name: "Ben Kowalski", phone: "(503) 555-0167", vehicle: ["sedan", "silver Prius"], service: "express", address: "6810 SW Capitol Hwy", zip: "97219", parking: "garage", gate: "", notes: "Ring the bell for the garage.", sim: true },
  // Day 2
  { day: 2, at: "10:00", name: "Lila Chen", phone: "(503) 555-0173", vehicle: ["suv", "blue Toyota RAV4"], service: "full", addons: ["sealant"], address: "2718 SE Clinton St", zip: "97202", parking: "carport", notes: "Selling it next month. Wants it spotless.", sim: true },
  // Day 3
  { day: 3, at: "9:30", name: "Marcus Webb", phone: "(503) 555-0189", vehicle: ["van", "white Ford Transit"], service: "full", address: "12810 SW Canyon Rd, Beaverton", zip: "97005", parking: "driveway", gate: "Gate 1880", notes: "Business van. Gate code after 8 am.", sim: false },
  { day: 3, at: "14:00", name: "Hannah Frost", phone: "(503) 555-0195", vehicle: ["sedan", "green Mini Cooper"], service: "interior", addons: ["odor"], address: "4433 NE Alberta St", zip: "97211", parking: "street", notes: "Spilled a smoothie two weeks ago.", sim: true },
  // Day 4
  { day: 4, at: "10:00", name: "Owen Park", phone: "(503) 555-0201", vehicle: ["suv", "black Tesla Model Y"], service: "full", address: "7730 N Willamette Blvd", zip: "97203", parking: "garage", gate: "#0915", sim: true },
];

/** Which of the coming open days each template lands on. */
const SLOT_IDX = [0, 1, 3, 4, 6];

const PAST: Spec[] = [
  { day: -1, at: "9:00", name: "Tessa Molina", phone: "(503) 555-0212", vehicle: ["sedan", "yellow VW Golf"], service: "full", address: "5011 SE Hawthorne Blvd", zip: "97215", parking: "driveway", sim: true },
  { day: -2, at: "10:00", name: "Andre Silva", phone: "(503) 555-0226", vehicle: ["truck", "grey Ford F-150"], service: "full", addons: ["mud"], address: "9012 N Lombard St", zip: "97203", parking: "driveway", sim: true },
  { day: -2, at: "14:30", name: "Priya Nair", phone: "(503) 555-0238", vehicle: ["suv", "silver Honda CR-V"], service: "interior", address: "1810 NE Fremont St", zip: "97212", parking: "garage", sim: true },
  { day: -3, at: "9:30", name: "Cole Bennett", phone: "(503) 555-0244", vehicle: ["sedan", "blue Subaru WRX"], service: "express", address: "3921 SE Division St", zip: "97202", parking: "street", sim: true },
  { day: -1, at: "13:00", name: "Leo Grant", phone: "(503) 555-0301", vehicle: ["sedan", "white Kia Soul"], service: "express", address: "4433 NE Alberta St", zip: "97211", parking: "street", sim: false },
  { day: -1, at: "13:00", name: "Sofia Marín", phone: "(503) 555-0312", vehicle: ["sedan", "red Fiat 500"], service: "express", address: "1820 NE Prescott St", zip: "97211", parking: "garage", sim: true },
  { day: -3, at: "11:00", name: "Dev Patel", phone: "(503) 555-0324", vehicle: ["sedan", "grey Hyundai Elantra"], service: "interior", address: "3915 SE Division St", zip: "97202", parking: "garage", sim: true, deal: true },
  { day: -4, at: "15:00", name: "Yuki Tanaka", phone: "(503) 555-0335", vehicle: ["sedan", "white Mini Cooper"], service: "express", address: "2211 NW Northrup St", zip: "97210", parking: "street", sim: true, deal: true },
  { day: -4, at: "11:00", name: "Ingrid Solberg", phone: "(503) 555-0256", vehicle: ["van", "grey Honda Odyssey"], service: "full", addons: ["pet"], address: "2140 NW Lovejoy St", zip: "97210", parking: "garage", sim: true },
];

function openDays(today: string, from: number, count: number): string[] {
  const out: string[] = [];
  for (let i = from; out.length < count && Math.abs(i) < 60; i += from < 0 ? -1 : 1) {
    const d = addDays(today, i);
    if (OPEN_WEEKDAYS.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

export function emptyState(nowMs: number): State {
  return { v: 1, seq: 0, seededAt: nowMs, jobs: [], messages: [], events: [], waitlist: [], inquiries: [], stormDays: [], clockOffsetMs: 0 };
}

function addSeedJob(s: State, spec: Spec, date: string, createdAt: number): Job {
  const zone = zoneForZip(spec.zip)!;
  const addons = spec.addons ?? [];
  const q = quote(spec.vehicle[0], spec.service, addons, zone);
  const seq = ++s.seq;
  const job: Job = {
    id: `j${seq}`, code: `FH-${(1000 + seq * 37).toString(36).toUpperCase().padStart(4, "K").slice(-4)}`,
    status: "booked", createdAt,
    customer: { name: spec.name, phone: spec.phone, email: `${spec.name.split(" ")[0].toLowerCase()}@example.com` },
    vehicle: { kind: spec.vehicle[0], label: spec.vehicle[1] }, service: spec.service, addons, zip: spec.zip, zone,
    address: spec.address, parking: spec.parking, access: { gateCode: spec.gate ?? "", notes: spec.notes ?? "" },
    startMs: atLocal(date, mins(spec.at)), durationMin: q.durationMin, totalCents: q.totalCents, discountCents: 0, dealMin: 0, depositCents: 2500, depositState: "held",
    movedFrom: [], confirmedAt: null, closedAt: null, closedReason: null, rainOffer: null, ownerFlag: null, rainAffected: false,
    source: "web", simReplies: spec.sim ?? false,
  };
  s.jobs.push(job);
  sendForJob(s, job, "confirmation", createdAt);
  pushEvent(s, createdAt, "booked", job.id, `${job.customer.name} booked ${fmtDay(job.startMs)} at ${fmtTime(job.startMs)}`);
  return job;
}

export function seedState(nowMs: number): State {
  const s = emptyState(nowMs);
  const today = localDate(nowMs);

  // Past week, played forward by the automations so the ledger and log are real.
  const pastDays = openDays(today, -1, 4);
  PAST.forEach((spec) => {
    const date = pastDays[Math.min(-spec.day - 1, pastDays.length - 1)];
    const startMs = atLocal(date, mins(spec.at));
    if (startMs >= nowMs - 3 * HOUR) return;
    const job = addSeedJob(s, spec, date, startMs - (3 + (s.seq % 3)) * DAY);
    job.simReplies = spec.name !== "Leo Grant" && spec.name !== "Sofia Marín";
  });

  // Neighbour deals: priced by the same rule customers get (the neighbour is on the same day and zone).
  for (const spec of PAST) {
    if (!spec.deal) continue;
    const job = s.jobs.find((j) => j.customer.name === spec.name);
    if (!job) continue;
    const d = neighbourDeal(s, { startMs: job.startMs, durationMin: job.durationMin, zone: job.zone }, job.id);
    if (d) {
      job.discountCents = d.discountCents;
      job.dealMin = d.savedMin;
      job.totalCents -= d.discountCents;
      job.createdAt = job.startMs - DAY;
      s.messages = s.messages.filter((m) => !(m.jobId === job.id && m.kind === "confirmation"));
      s.events = s.events.filter((e) => !(e.jobId === job.id && e.kind === "booked"));
      sendForJob(s, job, "confirmation", job.createdAt);
      pushEvent(s, job.createdAt, "booked", job.id, `${job.customer.name} booked ${fmtDay(job.startMs)} at ${fmtTime(job.startMs)} (neighbour deal)`);
    }
  }

  // A week of history, so "handled for you" starts from real numbers -------------
  const byName = (n: string) => s.jobs.find((j) => j.customer.name === n);
  // 1. A slot nobody confirmed, released, and refilled from the waitlist.
  const leo = byName("Leo Grant");
  const sofia = byName("Sofia Marín");
  if (leo && sofia) {
    const releaseAt = leo.startMs - RELEASE_H * HOUR;
    sendForJob(s, leo, "reminder", leo.startMs - 24 * HOUR);
    sendForJob(s, leo, "nudge", leo.startMs - CONFIRM_NUDGE_H * HOUR);
    leo.status = "released";
    leo.closedAt = releaseAt;
    leo.closedReason = "No confirmation";
    leo.depositState = "kept";
    sendForJob(s, leo, "released", releaseAt);
    pushEvent(s, releaseAt, "released", leo.id, `${leo.customer.name} never confirmed; slot released`);
    sofia.createdAt = releaseAt + 25 * MIN;
    sofia.source = "waitlist";
    sofia.status = "confirmed";
    sofia.confirmedAt = sofia.createdAt;
    s.messages = s.messages.filter((m) => !(m.jobId === sofia.id && m.kind === "confirmation"));
    s.events = s.events.filter((e) => !(e.jobId === sofia.id && e.kind === "booked"));
    sendForJob(s, sofia, "confirmation", sofia.createdAt);
    pushEvent(s, sofia.createdAt, "backfilled", sofia.id, `Waitlist: ${sofia.customer.name} took the freed ${fmtDay(sofia.startMs)} ${fmtTime(sofia.startMs)} slot`);
  }
  // 2. A customer who moved their own session.
  const cole = byName("Cole Bennett");
  if (cole) {
    const from = cole.startMs - 7 * DAY;
    cole.movedFrom.push(from);
    const at = cole.startMs - 30 * HOUR;
    sendForJob(s, cole, "moved", at, { from });
    pushEvent(s, at, "moved", cole.id, `${cole.customer.name} moved ${fmtDay(from)} → ${fmtDay(cole.startMs)} at ${fmtTime(cole.startMs)}`);
  }
  // 3. Rain: an outdoor job offered dry times, and the customer picked one.
  const andre = byName("Andre Silva");
  if (andre) {
    const from = andre.startMs - DAY;
    andre.movedFrom.push(from);
    andre.rainAffected = true;
    const offerAt = andre.startMs - 50 * HOUR;
    sendForJob(s, andre, "rain_offer", offerAt, { options: [andre.startMs, andre.startMs + DAY, andre.startMs + 2 * DAY], autoAt: offerAt + 6 * HOUR });
    sendForJob(s, andre, "rain_moved", offerAt + 90 * MIN, { from });
    pushEvent(s, offerAt + 90 * MIN, "rain_moved", andre.id, `Rain: ${andre.customer.name} moved ${fmtDay(from)} → ${fmtDay(andre.startMs)} at ${fmtTime(andre.startMs)}`);
  }

  // Upcoming week. The rain-sensitive template lands on the first dry open day.
  const future = openDays(today, 0, 10).filter((d) => atLocal(d, 17 * 60) > nowMs + 14 * HOUR);
  const dryIdx = future.findIndex((d, i) => i >= 1 && i <= 4 && forecastFor(d).rain < 45);
  const order = future.map((_, i) => i);
  if (dryIdx > 1) {
    const [x] = order.splice(dryIdx, 1);
    order.splice(1, 0, x);
  }
  FUTURE.forEach((spec) => {
    // Leave gaps: customers should find real openings in the first week.
    const date = future[order[SLOT_IDX[spec.day]]];
    if (!date) return;
    // Outdoor work never goes on a day that is forecast wet: customers wouldn't have booked it.
    const parking = forecastFor(date).wet && (spec.parking === "driveway" || spec.parking === "street") ? "garage" : spec.parking;
    const startMs = atLocal(date, mins(spec.at));
    const createdAt = Math.min(nowMs - 2 * HOUR, startMs - (2 + (s.seq % 4)) * DAY);
    addSeedJob(s, { ...spec, parking }, date, createdAt);
  });

  // A waitlist with people who really want the next opening.
  const w = (name: string, phone: string, kind: VehicleKind, label: string, service: ServiceKey, zip: string, address: string, parking: Parking, sim: boolean, ageH: number) => {
    const zone = zoneForZip(zip)!;
    s.waitlist.push({
      id: `w${++s.seq}`, createdAt: nowMs - ageH * HOUR, name, phone, email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      vehicle: { kind, label }, service, addons: [], zip, zone, address, parking, status: "waiting", offer: null, simClaims: sim,
    });
  };
  w("Priya Nair", "(503) 555-0238", "suv", "silver Honda CR-V", "full", "97214", "1440 SE 34th Ave", "garage", true, 40);
  w("Tom Bellamy", "(503) 555-0263", "sedan", "black Audi A4", "interior", "97232", "2905 NE Weidler St", "driveway", false, 22);
  w("Grace Okafor", "(503) 555-0271", "truck", "green Chevy Silverado", "express", "97217", "5822 N Interstate Ave", "driveway", false, 9);

  // Inquiries the front door already handled this morning.
  const texts: [string, string][] = [
    ["(503) 555-0121", "hey do u do subarus? filthy inside from my dog, need it before saturday, im in sellwood"],
    ["(503) 555-0184", "Can I get my minivan cleaned tomorrow morning? 97007"],
    ["(503) 555-0279", "Do you do ceramic coating? Just bought a Tesla, Pearl district"],
    ["(503) 555-0291", "how much for a wash + vacuum on a sedan, Alberta area, thursday afternoon"],
  ];
  const hoursAgo = [9, 6, 2, 0.4];
  let st: State = s;
  texts.forEach(([from, text], i) => {
    st = answerInquiry(st, from, text, nowMs - hoursAgo[i] * HOUR).state;
  });
  // The first one turned into a real booking.
  const maya = st.jobs.find((j) => j.customer.name === "Maya Thornton");
  if (maya) {
    maya.source = "inquiry";
    const first = st.inquiries.find((q) => q.text.startsWith("hey do u do subarus"));
    if (first) { first.status = "booked"; first.jobId = maya.id; }
  }

  st.seededAt = nowMs;
  return tick(st, nowMs);
}

export { checkDay, placementsOn };
