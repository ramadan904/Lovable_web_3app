// "Handled for you": everything that used to be Dario's evening, counted.
import type { State } from "./model";
import { DAY } from "./time";

/** Minutes of owner time each automated action replaces. Deliberately conservative. */
export const MINUTES_SAVED = {
  message: 2, // typing and sending one text or email
  booking: 8, // the phone or DM back-and-forth to take a booking
  move: 10, // negotiating a new time
  rain: 12, // checking the forecast, texting, finding a dry slot
  backfill: 15, // working through a waitlist to fill a cancellation
  inquiry: 6, // answering "can you do my car, and when?"
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
  };
  l.minutes =
    l.messages * MINUTES_SAVED.message + l.bookings * MINUTES_SAVED.booking + l.moves * MINUTES_SAVED.move +
    l.rainMoves * MINUTES_SAVED.rain + l.backfilled * MINUTES_SAVED.backfill + l.inquiries * MINUTES_SAVED.inquiry;
  return l;
}
