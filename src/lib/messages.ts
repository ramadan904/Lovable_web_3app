// Every word the business sends when nobody is at the keyboard.
import { BUSINESS, SERVICES, dollars } from "./business";
import type { Job, Message, MessageKind, WaitlistEntry } from "./model";
import { HOUR, fmtDay, fmtDayLong, fmtTime } from "./time";

export const APP_HOST = "fernhill.app";
export const manageLink = (job: Job) => `${APP_HOST}/b/${job.code}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

type Composed = { channel: Message["channel"]; direction: Message["direction"]; body: string };

const when = (ms: number) => `${fmtDay(ms)} at ${fmtTime(ms)}`;
const svc = (job: Job) => SERVICES[job.service].name;

export function composeForJob(kind: MessageKind, job: Job, extra: { options?: number[]; autoAt?: number; auto?: boolean; from?: number; refunded?: boolean; minutes?: number } = {}): Composed {
  const hi = `Hi ${first(job.customer.name)},`;
  const link = manageLink(job);
  switch (kind) {
    case "confirmation":
      return {
        channel: "email", direction: "out",
        body: `You're booked. ${svc(job)} for your ${job.vehicle.label}, ${when(job.startMs)}, at ${job.address}. Total ${dollars(job.totalCents)}${job.discountCents ? ` (includes a ${dollars(job.discountCents)} neighbour deal: ${BUSINESS.ownerFirst} is already nearby that day)` : ""}; your ${dollars(job.depositCents)} deposit is paid and comes off the total. ${BUSINESS.owner} brings water and power. Before we arrive, please clear out personal items and trash. Otherwise there's nothing to do until 24 hours before, when we'll ask you to tap Confirm. Change or cancel any time up to 24 hours ahead: ${link}`,
      };
    case "prep":
      return {
        channel: "sms", direction: "out",
        body: `${hi} ${BUSINESS.short} here. ${fmtDayLong(job.startMs)} at ${fmtTime(job.startMs)} is coming up. Please clear out personal items and trash, and text back if the gate code changes. We bring our own water and power. ${link}`,
      };
    case "reminder":
      return {
        channel: "sms", direction: "out",
        body: `${hi} tomorrow at ${fmtTime(job.startMs)}: ${svc(job)} for the ${job.vehicle.label}. Reply C or tap to confirm. If we don't hear back by ${fmtTime(job.startMs - 3 * HOUR)}, we release the slot to the waitlist. ${link}`,
      };
    case "confirm_reply":
      return { channel: "sms", direction: "in", body: "C" };
    case "nudge":
      return {
        channel: "sms", direction: "out",
        body: `${hi} still on for ${fmtTime(job.startMs)}? Tap to confirm: ${link}. We release unconfirmed slots at ${fmtTime(job.startMs - 3 * HOUR)}.`,
      };
    case "released":
      return {
        channel: "sms", direction: "out",
        body: `${hi} we didn't hear back, so we released your ${when(job.startMs)} slot to the waitlist (the deposit is kept, as in the booking terms). Rebook any time: ${APP_HOST}/book`,
      };
    case "rain_offer": {
      const opts = (extra.options ?? []).map((o, i) => `${i + 1}) ${when(o)}`).join("  ");
      return {
        channel: "sms", direction: "out",
        body: `${hi} heavy rain is forecast for ${fmtDayLong(job.startMs)}, and your car is outdoors, so we won't wash it in a downpour. Pick a dry time, free to move: ${opts}. Tap: ${link}. No answer? We'll take option 1 at ${fmtTime(extra.autoAt ?? job.startMs)}.`,
      };
    }
    case "rain_moved":
      return {
        channel: "sms", direction: "out",
        body: `${hi} you're moved to ${when(job.startMs)}, a dry window.${extra.auto ? " You didn't pick, so we took the first option." : ""} Your reminders moved with it. Change it: ${link}`,
      };
    case "moved":
      return {
        channel: "sms", direction: "out",
        body: `${hi} done: you're now ${when(job.startMs)}${extra.from ? ` (was ${when(extra.from)})` : ""}. Your reminders moved with it. ${link}`,
      };
    case "cancelled":
      return {
        channel: "sms", direction: "out",
        body: `${hi} your ${when(job.startMs)} appointment is cancelled.${job.depositCents === 0 ? " Nothing was charged." : extra.refunded ? ` Your ${dollars(job.depositCents)} deposit is on its way back in full.` : " The deposit is kept because it was inside 24 hours."} Rebook any time: ${APP_HOST}/book`,
      };
    case "delay":
      return {
        channel: "sms", direction: "out",
        body: `${hi} ${BUSINESS.van}'s running about ${extra.minutes ?? job.delayMin} min behind today, so ${BUSINESS.ownerFirst} will get to you around ${fmtTime(job.startMs + job.delayMin * 60_000)} instead of ${fmtTime(job.startMs)}. Nothing to do. You'll get a text when he's on the way, and you can watch the van live: ${link}`,
      };
    case "plan_booked":
      return {
        channel: "sms", direction: "out",
        body: `${hi} your next detail is booked: ${when(job.startMs)}, ${svc(job)} for the ${job.vehicle.label}, every ${job.plan?.everyWeeks ?? 6} weeks at your plan price of ${dollars(job.totalCents)}. No deposit needed. Skip or move it any time until 24 hours before: ${link}`,
      };
    case "omw":
      return {
        channel: "sms", direction: "out",
        body: `${hi} ${BUSINESS.owner} is on the way in ${BUSINESS.van}, the white Transit. Arriving around ${fmtTime(job.startMs + job.delayMin * 60_000)}. Watch the van live: ${link}${job.access.gateCode ? " He has your gate code." : ""}`.trim(),
      };
    case "aftercare":
      return {
        channel: "sms", direction: "out",
        body: `${hi} thanks. Your ${job.vehicle.label} should shed water for weeks. Care tips, and rebooking in 6 weeks for the same price: ${APP_HOST}/book. Two lines of review would help a one-van business a lot.`,
      };
    default:
      return { channel: "sms", direction: "out", body: "" };
  }
}

export function composeOffer(entry: WaitlistEntry, startMs: number, expiresAt: number): Composed {
  return {
    channel: "sms", direction: "out",
    body: `Hi ${first(entry.name)}, a time just opened: ${when(startMs)} for your ${SERVICES[entry.service].name}. Yours if you tap within 2 hours (until ${fmtTime(expiresAt)}): ${APP_HOST}/w/${entry.id}`,
  };
}
