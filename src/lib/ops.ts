// State transitions. Every function takes a State and returns a new one; the UI
// and the automations both go through here, so the rules are enforced once.
import {
  BUSINESS, DEPOSIT_CENTS, FREE_CHANGE_H, RAIN_AUTO_H, WAITLIST_OFFER_H, quote, zoneForZip,
  type AddonKey, type Parking, type ServiceKey, type VehicleKind, type ZoneKey,
} from "./business";
import { backfillCandidate, dryOptions, validate } from "./engine";
import { composeForJob, composeOffer } from "./messages";
import { ACTIVE, BookingError, type ActivityEvent, type Job, type Message, type MessageKind, type State, type WaitlistEntry } from "./model";
import { HOUR, fmtDay, fmtTime, localDate } from "./time";

export interface BookingInput {
  customer: { name: string; phone: string; email: string };
  vehicle: { kind: VehicleKind; label: string };
  service: ServiceKey;
  addons: AddonKey[];
  zip: string;
  address: string;
  parking: Parking;
  access: { gateCode: string; notes: string };
  startMs: number;
  source?: Job["source"];
  simReplies?: boolean;
}

const clone = (s: State): State => structuredClone(s);

function nextSeq(s: State): number {
  s.seq += 1;
  return s.seq;
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function codeFor(seq: number, existing: Set<string>): string {
  let n = Math.imul(seq + 1, 2654435761) >>> 0;
  for (;;) {
    let out = "";
    let x = n;
    for (let i = 0; i < 4; i++) {
      out += ALPHABET[x % ALPHABET.length];
      x = Math.floor(x / ALPHABET.length);
    }
    const code = `FH-${out}`;
    if (!existing.has(code)) return code;
    n = Math.imul(n, 1664525) + 1013904223;
    n >>>= 0;
  }
}

export function pushMessage(
  s: State,
  m: { key: string; jobId?: string | null; waitlistId?: string | null; at: number; kind: MessageKind; to: string; channel: Message["channel"]; direction: Message["direction"]; body: string },
): void {
  if (s.messages.some((x) => x.key === m.key)) return;
  s.messages.push({ id: `m${nextSeq(s)}`, jobId: m.jobId ?? null, waitlistId: m.waitlistId ?? null, ...m });
}

export function pushEvent(s: State, at: number, kind: ActivityEvent["kind"], jobId: string | null, text: string): void {
  s.events.push({ id: `e${nextSeq(s)}`, at, kind, jobId, text });
}

const jobKey = (job: Job, kind: MessageKind, salt: string | number = job.startMs) => `${job.id}:${kind}:${salt}`;

export function sendForJob(s: State, job: Job, kind: MessageKind, at: number, extra?: Parameters<typeof composeForJob>[2]): void {
  const c = composeForJob(kind, job, extra);
  pushMessage(s, {
    key: jobKey(job, kind, kind === "rain_offer" || kind === "moved" || kind === "rain_moved" ? `${job.startMs}:${at}` : job.startMs),
    jobId: job.id, at, kind, channel: c.channel, direction: c.direction,
    to: c.direction === "in" ? BUSINESS.short : c.channel === "email" ? job.customer.email : job.customer.phone,
    body: c.body,
  });
}

const findJob = (s: State, id: string): Job => {
  const job = s.jobs.find((j) => j.id === id || j.code === id);
  if (!job) throw new BookingError("not_found", "We couldn't find that booking.");
  return job;
};
export const getJob = (s: State, idOrCode: string): Job | undefined => s.jobs.find((j) => j.id === idOrCode || j.code.toLowerCase() === idOrCode.toLowerCase());

function problemToError(p: NonNullable<ReturnType<typeof validate>>): BookingError {
  switch (p) {
    case "too_soon": return new BookingError("too_soon", "That time is too soon. We need at least 12 hours' notice.");
    case "too_far": return new BookingError("too_far", "That's further ahead than we book.");
    case "closed": return new BookingError("closed", "We don't work that day.");
    default: return new BookingError("slot_taken", "That time was just taken. Here's what's open now.");
  }
}

export function createJob(state: State, input: BookingInput, nowMs: number): { state: State; job: Job } {
  const s = clone(state);
  const zone = zoneForZip(input.zip);
  if (!zone) throw new BookingError("outside_area", "We don't reach that zip code yet. Join the waitlist and we'll tell you when we do.");
  if (!input.customer.name.trim() || !input.customer.phone.trim() || !input.address.trim()) throw new BookingError("invalid", "Please fill in your name, phone and address.");
  const q = quote(input.vehicle.kind, input.service, input.addons, zone);
  const problem = validate(s, { startMs: input.startMs, durationMin: q.durationMin, zone }, nowMs);
  if (problem) throw problemToError(problem);

  const seq = nextSeq(s);
  const soon = input.startMs - nowMs < FREE_CHANGE_H * HOUR;
  const job: Job = {
    id: `j${seq}`,
    code: codeFor(seq, new Set(s.jobs.map((j) => j.code))),
    status: soon ? "confirmed" : "booked",
    createdAt: nowMs,
    customer: { ...input.customer },
    vehicle: { ...input.vehicle },
    service: input.service,
    addons: [...input.addons],
    zip: input.zip.trim().slice(0, 5),
    zone,
    address: input.address.trim(),
    parking: input.parking,
    access: { ...input.access },
    startMs: input.startMs,
    durationMin: q.durationMin,
    totalCents: q.totalCents,
    depositCents: DEPOSIT_CENTS,
    depositState: "held",
    movedFrom: [],
    confirmedAt: soon ? nowMs : null,
    closedAt: null,
    closedReason: null,
    rainOffer: null,
    ownerFlag: null,
    source: input.source ?? "web",
    simReplies: input.simReplies ?? false,
  };
  s.jobs.push(job);
  sendForJob(s, job, "confirmation", nowMs);
  pushEvent(s, nowMs, "booked", job.id, `${job.customer.name} booked ${SERVICES_NAME(job)} for ${fmtDay(job.startMs)} at ${fmtTime(job.startMs)}`);
  return { state: s, job };
}

const SERVICES_NAME = (job: Job) => job.service === "express" ? "an Express Wash" : job.service === "interior" ? "an Interior Reset" : job.service === "full" ? "a Full Refresh" : "a Showroom Detail";

/** Offer the freed window to the waitlist. */
export function offerBackfill(s: State, window: { start: number; end: number }, nowMs: number, skip: string[] = []): void {
  const hit = backfillCandidate(s, window, nowMs, skip);
  if (!hit) return;
  const expiresAt = Math.min(nowMs + WAITLIST_OFFER_H * HOUR, hit.startMs - 4 * HOUR);
  if (expiresAt <= nowMs) return;
  const entry = s.waitlist.find((w) => w.id === hit.entry.id)!;
  entry.status = "offered";
  entry.offer = { startMs: hit.startMs, windowStart: window.start, windowEnd: window.end, expiresAt };
  const c = composeOffer(entry, hit.startMs, expiresAt);
  pushMessage(s, { key: `${entry.id}:offer:${hit.startMs}:${nowMs}`, waitlistId: entry.id, at: nowMs, kind: "waitlist_offer", channel: c.channel, direction: c.direction, to: entry.phone, body: c.body });
}

export function moveJob(state: State, id: string, newStartMs: number, nowMs: number, by: "customer" | "rain" | "auto_rain" = "customer"): State {
  const s = clone(state);
  const job = findJob(s, id);
  if (!ACTIVE.includes(job.status)) throw new BookingError("not_open", "That booking is no longer active.");
  if (by === "customer" && job.startMs - nowMs < FREE_CHANGE_H * HOUR) {
    throw new BookingError("too_late", `Changes are free up to ${FREE_CHANGE_H} hours ahead. ${BUSINESS.ownerFirst} is already planning that day, so please call ${BUSINESS.phone}.`);
  }
  const problem = validate(s, { startMs: newStartMs, durationMin: job.durationMin, zone: job.zone }, nowMs, job.id);
  if (problem) throw problemToError(problem);
  const oldStart = job.startMs;
  const window = { start: oldStart, end: oldStart + job.durationMin * 60_000 };
  job.movedFrom.push(oldStart);
  job.startMs = newStartMs;
  job.rainOffer = null;
  job.ownerFlag = null;
  const soon = newStartMs - nowMs < FREE_CHANGE_H * HOUR;
  job.status = soon ? "confirmed" : "booked";
  job.confirmedAt = soon ? nowMs : null;
  sendForJob(s, job, by === "customer" ? "moved" : "rain_moved", nowMs, { from: oldStart, auto: by === "auto_rain" });
  pushEvent(s, nowMs, by === "customer" ? "moved" : "rain_moved", job.id,
    by === "customer" ? `${job.customer.name} moved ${fmtDay(oldStart)} → ${fmtDay(newStartMs)} at ${fmtTime(newStartMs)}` : `Rain: ${job.customer.name} moved ${fmtDay(oldStart)} → ${fmtDay(newStartMs)} at ${fmtTime(newStartMs)}${by === "auto_rain" ? " (no reply, first option taken)" : ""}`);
  if (localDate(oldStart) !== localDate(newStartMs) || oldStart !== newStartMs) offerBackfill(s, window, nowMs);
  return s;
}

export function cancelJob(state: State, id: string, nowMs: number, reason = "Cancelled by customer"): State {
  const s = clone(state);
  const job = findJob(s, id);
  if (!ACTIVE.includes(job.status)) throw new BookingError("not_open", "That booking is no longer active.");
  const refunded = job.startMs - nowMs >= FREE_CHANGE_H * HOUR;
  job.status = "cancelled";
  job.closedAt = nowMs;
  job.closedReason = reason;
  job.depositState = refunded ? "refunded" : "kept";
  job.rainOffer = null;
  sendForJob(s, job, "cancelled", nowMs, { refunded });
  pushEvent(s, nowMs, "cancelled", job.id, `${job.customer.name} cancelled ${fmtDay(job.startMs)} at ${fmtTime(job.startMs)}`);
  offerBackfill(s, { start: job.startMs, end: job.startMs + job.durationMin * 60_000 }, nowMs);
  return s;
}

export function confirmJob(state: State, id: string, nowMs: number): State {
  const s = clone(state);
  const job = findJob(s, id);
  if (job.status !== "booked") return s;
  job.status = "confirmed";
  job.confirmedAt = nowMs;
  sendForJob(s, job, "confirm_reply", nowMs);
  pushEvent(s, nowMs, "confirmed", job.id, `${job.customer.name} confirmed ${fmtDay(job.startMs)}`);
  return s;
}

export function releaseJob(s: State, job: Job, at: number): void {
  job.status = "released";
  job.closedAt = at;
  job.closedReason = "No confirmation";
  job.depositState = "kept";
  sendForJob(s, job, "released", at);
  pushEvent(s, at, "released", job.id, `${job.customer.name} never confirmed; slot released`);
  offerBackfill(s, { start: job.startMs, end: job.startMs + job.durationMin * 60_000 }, at);
}

/** The storm arrives: offer every outdoor customer the nearest dry times. */
export function makeRainOffer(s: State, job: Job, nowMs: number): void {
  const options = dryOptions(s, job, nowMs, 3);
  if (!options.length) {
    job.ownerFlag = `Rain is forecast for ${fmtDay(job.startMs)} and no dry slot is open. ${job.customer.name} needs a call.`;
    return;
  }
  const autoAt = Math.max(nowMs + HOUR, Math.min(nowMs + RAIN_AUTO_H * HOUR, job.startMs - 14 * HOUR));
  job.rainOffer = { createdAt: nowMs, autoAt, options };
  sendForJob(s, job, "rain_offer", nowMs, { options, autoAt });
}

export function chooseRainOption(state: State, id: string, index: number, nowMs: number, by: "customer" | "auto_rain" = "customer"): State {
  const job = findJob(state, id);
  const start = job.rainOffer?.options[index];
  if (start == null) throw new BookingError("invalid", "That option isn't available any more.");
  return moveJob(state, id, start, nowMs, by === "auto_rain" ? "auto_rain" : "rain");
}

export interface WaitlistInput {
  customer: { name: string; phone: string; email: string };
  vehicle: { kind: VehicleKind; label: string };
  service: ServiceKey;
  addons: AddonKey[];
  zip: string;
  address: string;
  parking: Parking;
  simClaims?: boolean;
}

export function joinWaitlist(state: State, input: WaitlistInput, nowMs: number): { state: State; entry: WaitlistEntry } {
  const s = clone(state);
  const zone = zoneForZip(input.zip);
  if (!zone) throw new BookingError("outside_area", "We don't reach that zip code yet.");
  const entry: WaitlistEntry = {
    id: `w${nextSeq(s)}`, createdAt: nowMs, name: input.customer.name, phone: input.customer.phone, email: input.customer.email,
    vehicle: input.vehicle, service: input.service, addons: input.addons, zip: input.zip.trim().slice(0, 5), zone,
    address: input.address, parking: input.parking, status: "waiting", offer: null, simClaims: input.simClaims ?? false,
  };
  s.waitlist.push(entry);
  pushEvent(s, nowMs, "waitlist_joined", null, `${entry.name} joined the waitlist`);
  return { state: s, entry };
}

export function claimOffer(state: State, waitlistId: string, nowMs: number): { state: State; job: Job } {
  const entry = state.waitlist.find((w) => w.id === waitlistId);
  if (!entry) throw new BookingError("not_found", "We couldn't find that offer.");
  if (entry.status !== "offered" || !entry.offer) throw new BookingError("not_open", "This offer has already been taken or has expired.");
  if (entry.offer.expiresAt < nowMs) throw new BookingError("not_open", "This offer has expired.");
  const { state: s, job } = createJob(state, {
    customer: { name: entry.name, phone: entry.phone, email: entry.email }, vehicle: entry.vehicle, service: entry.service, addons: entry.addons,
    zip: entry.zip, address: entry.address, parking: entry.parking, access: { gateCode: "", notes: "" }, startMs: entry.offer.startMs, source: "waitlist",
  }, nowMs);
  const e = s.waitlist.find((w) => w.id === waitlistId)!;
  e.status = "booked";
  pushEvent(s, nowMs, "backfilled", job.id, `Waitlist: ${entry.name} took the freed ${fmtDay(job.startMs)} ${fmtTime(job.startMs)} slot`);
  return { state: s, job };
}

export const zoneOf = (zip: string): ZoneKey | null => zoneForZip(zip);
