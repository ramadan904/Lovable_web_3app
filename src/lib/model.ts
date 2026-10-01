import type { AddonKey, Parking, ServiceKey, VehicleKind, ZoneKey } from "./business";

export type JobStatus = "booked" | "confirmed" | "completed" | "cancelled" | "released" | "no_show";
export const ACTIVE: JobStatus[] = ["booked", "confirmed"];

export interface RainOffer {
  createdAt: number;
  /** When the earliest option is applied if the customer hasn't chosen. */
  autoAt: number;
  options: number[]; // start times (UTC ms)
}

/** A deposit held in the Fernhill escrow contract on Arbitrum. The app's `depositState` is the intent; the chain is the money. */
export interface OnchainDeposit {
  /** keccak256 of the booking code: the contract's booking id. No personal data goes on-chain. */
  id: `0x${string}`;
  chainId: number;
  escrow: `0x${string}`;
  /** The wallet that paid, and the only one that can cancel or reclaim. */
  customer: `0x${string}`;
  depositTx: `0x${string}`;
  /** The transaction that moved the money out of escrow (refund, keep or apply). */
  settleTx: `0x${string}` | null;
}

export interface Job {
  id: string;
  /** Short, human-readable code used in links: FH-4K7Q */
  code: string;
  status: JobStatus;
  createdAt: number;
  customer: { name: string; phone: string; email: string };
  vehicle: { kind: VehicleKind; label: string };
  service: ServiceKey;
  addons: AddonKey[];
  zip: string;
  zone: ZoneKey;
  address: string;
  parking: Parking;
  access: { gateCode: string; notes: string };
  startMs: number;
  durationMin: number;
  totalCents: number;
  /** Neighbour deal already taken off totalCents, locked at booking. */
  discountCents: number;
  /** Minutes of driving the deal saves Dario, for the ledger. */
  dealMin: number;
  depositCents: number;
  depositState: "held" | "refunded" | "kept" | "applied";
  /** Set when the deposit was paid in USDC through the escrow contract rather than as a demo. */
  onchain?: OnchainDeposit | null;
  /** Earlier start times, if the job has been moved. */
  movedFrom: number[];
  confirmedAt: number | null;
  closedAt: number | null;
  closedReason: string | null;
  rainOffer: RainOffer | null;
  ownerFlag: string | null;
  /** True once rain has touched this booking (offered or moved): it can then be cancelled for a full refund. */
  rainAffected: boolean;
  /** Minutes Bertha is running behind on the day: shifts the arrival and everything after it, never the booked slot. */
  delayMin: number;
  /** A repeat customer: after each visit the next one is booked automatically. */
  plan: { everyWeeks: number } | null;
  source: "web" | "inquiry" | "waitlist" | "plan";
  /** Demo only: seeded customers reply "C" on their own. */
  simReplies: boolean;
}

export type MessageKind =
  | "confirmation" | "prep" | "reminder" | "confirm_reply" | "nudge" | "released"
  | "rain_offer" | "rain_moved" | "moved" | "cancelled" | "waitlist_offer"
  | "omw" | "aftercare" | "inquiry_reply" | "inquiry_in" | "owner_reply" | "delay" | "plan_booked";

export interface Message {
  id: string;
  key: string;
  jobId: string | null;
  waitlistId: string | null;
  at: number;
  channel: "sms" | "email";
  direction: "out" | "in";
  kind: MessageKind;
  to: string;
  body: string;
}

export type EventKind =
  | "booked" | "confirmed" | "moved" | "rain_moved" | "cancelled" | "released"
  | "backfilled" | "completed" | "inquiry" | "waitlist_joined" | "owner_reply" | "delay" | "plan_booked";

export interface ActivityEvent {
  id: string;
  at: number;
  kind: EventKind;
  jobId: string | null;
  text: string;
}

export interface WaitlistEntry {
  id: string;
  createdAt: number;
  name: string;
  phone: string;
  email: string;
  vehicle: { kind: VehicleKind; label: string };
  service: ServiceKey;
  addons: AddonKey[];
  zip: string;
  zone: ZoneKey;
  address: string;
  parking: Parking;
  status: "waiting" | "offered" | "booked" | "expired";
  offer: { startMs: number; windowStart: number; windowEnd: number; expiresAt: number } | null;
  /** Demo only */
  simClaims: boolean;
}

export interface Inquiry {
  id: string;
  at: number;
  from: string;
  text: string;
  reply: string;
  suggested: number[];
  status: "answered" | "booked" | "needs_owner";
  jobId: string | null;
  note: string | null;
}

export interface State {
  v: 1;
  seq: number;
  seededAt: number;
  jobs: Job[];
  messages: Message[];
  events: ActivityEvent[];
  waitlist: WaitlistEntry[];
  inquiries: Inquiry[];
  /** Local dates (yyyy-MM-dd) where the demo has forced a storm. */
  stormDays: string[];
  /** Demo clock: added to the real time. */
  clockOffsetMs: number;
}

export class BookingError extends Error {
  code: "slot_taken" | "closed" | "day_full" | "too_soon" | "too_far" | "outside_area" | "invalid" | "not_found" | "too_late" | "not_open" | "needs_dry";
  constructor(code: BookingError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "BookingError";
  }
}
