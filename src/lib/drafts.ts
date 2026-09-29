// One-tap drafted replies for the "Needs you" queue. Dario reads, edits if he wants, and sends.
import { ADDONS, BUSINESS, SERVICES, dollars, quote } from "./business";
import { APP_HOST } from "./messages";
import { bookingLink, parseInquiry } from "./inquiry";
import type { Inquiry, Job } from "./model";
import { fmtDayLong } from "./time";

const first = (n: string) => n.trim().split(/\s+/)[0] || "there";

/** A booking the system couldn't fix on its own, usually rain with no dry slot free. */
export function draftForFlag(job: Job): string {
  return (
    `Hi ${first(job.customer.name)}, it's ${BUSINESS.ownerFirst} at Fernhill. Heavy rain is forecast for ${fmtDayLong(job.startMs)} and ` +
    `I can't find a dry slot this week that fits your ${SERVICES[job.service].name}. I'll put you first on the waitlist for the next dry opening and text you the moment one frees up. ` +
    `If you'd rather not wait, you can cancel from your booking link (${APP_HOST}/b/${job.code}) and your ${dollars(job.depositCents)} deposit is refunded in full. Sorry about the weather!`
  );
}

/** A message that asked for something off the menu. */
export function draftForInquiry(q: Inquiry): string {
  const p = parseInquiry(q.text, q.at);
  const thing = p.outOfScope ?? "that";
  const quoted = quote(p.vehicle ?? "suv", "full", ["sealant"], p.zone);
  const link = `${APP_HOST}${bookingLink({ vehicle: p.vehicle, service: "full", addons: ["sealant"], zip: p.zip, zone: p.zone })}`;
  const why =
    thing === "ceramic coating" || thing === "paint correction"
      ? "it needs a controlled indoor space and a multi-day cure, and Bertha's a van"
      : "it's outside what Bertha's set up for";
  return (
    `Hi! Thanks for asking. I don't offer ${thing}: ${why}. ` +
    `What I can do is a Full Refresh with a ${ADDONS.sealant.name.toLowerCase()}, which keeps water beading for months (very handy in Portland): ` +
    `about ${dollars(quoted.totalCents)}. Real open times, with rain flagged: ${link}. ${BUSINESS.ownerFirst}`
  );
}

