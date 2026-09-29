// "Handled for you": everything that used to be Dario's evening, counted.
import type { State } from "./model";
import { DAY } from "./time";

/** Minutes of owner time each automated action replaces. Deliberately conservative. */
export const MINUTES_SAVED = {
  message: 2, // typing and sending one text or email
  draft: 3, // writing a considered reply from scratch versus reading and tapping send
  booking: 8, // the phone or DM back-and-forth to take a booking
  move: 10, // negotiating a new time
  rain: 12, // checking the forecast, texting, finding a dry slot
  backfill: 15, // working through a waitlist to fill a cancellation
  inquiry: 6, // answering "can you do my car, and when?"
  plan: 10, // remembering a regular is due, finding them a slot, and texting them
  delay: 6, // one "running late" text per customer still to come
} as const;

export interface Ledger {
  messages: number;
  bookings: number;
  moves: number;
  rainMoves: number;
  released: number;
  backfilled: number;
  confirmed: number;
  inquiries: number;
  minutes: number;
  jobsDone: number;
  revenueCents: number;
  /** Minutes of driving saved, and dollars given back, by neighbour deals booked in the window. */
  driveSavedMin: number;
  dealCents: number;
  /** One-tap replies Dario sent from the "Needs you" queue. */
  ownerReplies: number;
  /** Money that would have been lost: released or cancelled slots that a waitlisted customer took instead. */
  recoveredCents: number;
  /** Confirmed jobs in the next 7 days, already booked. */
  aheadCents: number;
  aheadJobs: number;
  /** Care plans: customers on one, and visits booked for them automatically this week. */
  onPlan: number;
  repeatBooked: number;
  repeatCents: number;
  /** Times Dario told everyone he was running behind, and customers warned. */
  delaysReported: number;
}

export function ledgerFor(state: State, nowMs: number, days = 7): Ledger {
  const since = nowMs - days * DAY;
  const ev = state.events.filter((e) => e.at >= since && e.at <= nowMs);
  const count = (k: string) => ev.filter((e) => e.kind === k).length;
  const messages = state.messages.filter((m) => m.at >= since && m.at <= nowMs && m.direction === "out").length;
  const done = state.jobs.filter((j) => j.status === "completed" && (j.closedAt ?? 0) >= since);
  const l: Ledger = {
    messages,
    bookings: count("booked"),
    moves: count("moved"),
    rainMoves: count("rain_moved"),
    released: count("released"),
    backfilled: count("backfilled"),
    confirmed: count("confirmed"),
    inquiries: count("inquiry"),
    minutes: 0,
    jobsDone: done.length,
    revenueCents: done.reduce((n, j) => n + j.totalCents, 0),
    driveSavedMin: 0,
    dealCents: 0,
    ownerReplies: count("owner_reply"),
    recoveredCents: 0,
    aheadCents: 0,
    aheadJobs: 0,
    onPlan: 0,
    repeatBooked: 0,
    repeatCents: 0,
    delaysReported: count("delay"),
  };
  const planCustomers = new Set<string>();
  for (const j of state.jobs) {
    if (j.source === "waitlist" && j.createdAt >= since && j.createdAt <= nowMs && j.status !== "cancelled" && j.status !== "released") l.recoveredCents += j.totalCents;
    if (j.plan && j.status !== "cancelled" && j.status !== "released") planCustomers.add(j.customer.phone);
    if (j.source === "plan" && j.createdAt >= since && j.createdAt <= nowMs && j.status !== "cancelled") {
      l.repeatBooked += 1;
      l.repeatCents += j.totalCents;
    }
    if ((j.status === "booked" || j.status === "confirmed") && j.startMs > nowMs && j.startMs <= nowMs + days * DAY) {
      l.aheadCents += j.totalCents;
      l.aheadJobs += 1;
    }
  }
  for (const j of state.jobs) {
    if (j.createdAt >= since && j.createdAt <= nowMs && (j.dealMin ?? 0) > 0 && j.status !== "cancelled") {
      l.driveSavedMin += j.dealMin;
      l.dealCents += j.discountCents;
    }
  }
  l.onPlan = planCustomers.size;
  const delayTexts = state.messages.filter((m) => m.kind === "delay" && m.at >= since && m.at <= nowMs).length;
  l.minutes =
    l.messages * MINUTES_SAVED.message + l.bookings * MINUTES_SAVED.booking + l.moves * MINUTES_SAVED.move +
    l.rainMoves * MINUTES_SAVED.rain + l.backfilled * MINUTES_SAVED.backfill + l.inquiries * MINUTES_SAVED.inquiry +
    l.ownerReplies * MINUTES_SAVED.draft + l.repeatBooked * MINUTES_SAVED.plan + delayTexts * MINUTES_SAVED.delay;
  return l;
}
