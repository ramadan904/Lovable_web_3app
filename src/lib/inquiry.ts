// The front door. A customer writes the way people write ("my dog wrecked my
// Outback, I'm in Sellwood, Friday morning?") and gets back real times, a real
// price, and a link that opens the booking already filled in.
import {
  ADDONS, NEIGHBORHOODS, NEIGHBORHOOD_ZIPS, SERVICES, VEHICLES, ZONES, ZONE_ZIP, dollars, hoursLabel, quote, zoneForZip,
  type AddonKey, type Parking, type ServiceKey, type VehicleKind, type ZoneKey,
} from "./business";
import { findSlots, isRainRisk, neighbourDeal } from "./engine";
import { APP_HOST } from "./messages";
import type { Inquiry, State } from "./model";
import { pushEvent, pushMessage } from "./ops";
import { addDays, atLocal, fmtDate, fmtDay, fmtTime, localDate, localMinutes, weekdayOf } from "./time";

export interface ParsedInquiry {
  vehicle: VehicleKind | null;
  service: ServiceKey | null;
  addons: AddonKey[];
  zone: ZoneKey | null;
  /** The zip the customer gave, or a typical one for the place they named. */
  zip: string | null;
  /** True when we worked the zip out from a place name, so the form should let them check it. */
  zipInferred: boolean;
  /** The place they named, as they'd say it: "Sellwood". */
  place: string | null;
  /** They want the earliest possible time ("asap", "urgent", "today"). */
  urgent: boolean;
  /** How they said when, in words: "Friday morning", "before Saturday", "as soon as possible". */
  when: string | null;
  date: string | null;
  before: string | null;
  part: "morning" | "afternoon" | null;
  parking: Parking | null;
  outOfScope: string | null;
}

const VEHICLE_WORDS: [RegExp, VehicleKind][] = [
  [/\b(trucks?|f-?150|f-?250|silverado|tacoma|tundra|ram|tahoe|suburban|expedition|4runner|land cruiser|wrangler)\b/i, "truck"],
  [/\b(minivans?|vans?|sienna|odyssey|pacifica|transit|sprinter|caravan)\b/i, "van"],
  [/\b(suvs?|crossovers?|wagons?|subarus?|outbacks?|foresters?|crosstreks?|rav-?4|cr-?v|highlanders?|explorers?|cx-?5|rogue|tucson|sportage|equinox|model y)\b/i, "suv"],
  [/\b(sedans?|coupes?|hatchbacks?|civics?|corollas?|camrys?|accords?|prius|mazda ?3|golf|jetta|tesla|model 3|mini|miata|cars?)\b/i, "sedan"],
];

const NOUN: Record<VehicleKind, string> = { sedan: "car", suv: "SUV", truck: "truck", van: "van" };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseInquiry(text: string, nowMs: number): ParsedInquiry {
  const t = text.toLowerCase();
  const today = localDate(nowMs);

  let vehicle: VehicleKind | null = null;
  for (const [re, kind] of VEHICLE_WORDS) if (re.test(text)) { vehicle = kind; break; }

  const addons: AddonKey[] = [];
  if (/\b(dog|dogs|pet|pets|fur|hair|cat)\b/.test(t)) addons.push("pet");
  if (/\b(mud|muddy|salt|slush|dirt road|gravel)\b/.test(t)) addons.push("mud");
  if (/\b(headlights?|foggy lights?|cloudy lights?)\b/.test(t)) addons.push("headlights");
  if (/\b(smell|smoke|smoky|odor|stink|stinks|vomit|puke|mildew|musty)\b/.test(t)) addons.push("odor");
  if (/\b(sealant|beading|ceramic spray)\b/.test(t)) addons.push("sealant");

  let service: ServiceKey | null = null;
  const inside = /\b(inside|interior|seats?|vacuum|crumbs|spill|carpet|mats?|upholstery|dog|dogs|pet|smell)\b/.test(t);
  const outside = /\b(outside|exterior|wash|washed|bird|pollen|tree sap)\b/.test(t);
  if (/\b(sell|selling|trade[- ]?in|showroom|clay|swirls?|spotless|deep clean|concours)\b/.test(t)) service = "showroom";
  else if ((inside && outside) || /\b(everything|inside and out|full|whole|both|detail)\b/.test(t)) service = "full";
  else if (inside) service = "interior";
  else if (outside) service = "express";

  let zone: ZoneKey | null = null;
  const zipMatch = text.match(/\b(97\d{3})\b/);
  let zip: string | null = zipMatch ? zipMatch[1] : null;
  let zipInferred = false;
  let place: string | null = null;
  if (zip) zone = zoneForZip(zip);
  if (!zone) {
    // Longest names first, so "south waterfront" wins over "south".
    for (const [word, z] of Object.entries(NEIGHBORHOODS).sort((a, b) => b[0].length - a[0].length)) {
      if (new RegExp(`\\b${word.replace(".", "\\.")}\\b`).test(t)) {
        zone = z;
        place = word.replace(/\b\w/g, (c) => c.toUpperCase());
        // A broad area word ("southeast") has no zip of its own; a named neighbourhood does.
        zip = NEIGHBORHOOD_ZIPS[word] ?? ZONE_ZIP[z];
        zipInferred = true;
        break;
      }
    }
  }

  let date: string | null = null;
  let before: string | null = null;
  const dayHit = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t) || new RegExp(`\\b${d.slice(0, 3)}\\b`).test(t));
  const nextOccurrence = (wd: number) => {
    for (let i = 1; i <= 14; i++) if (weekdayOf(addDays(today, i)) === wd) return addDays(today, i);
    return null;
  };
  if (/\btomorrow\b/.test(t)) date = addDays(today, 1);
  else if (/\b(weekend)\b/.test(t)) date = nextOccurrence(6);
  else if (dayHit >= 0) {
    const d = nextOccurrence(dayHit);
    if (/\b(before|by)\b/.test(t.slice(Math.max(0, t.indexOf(DAYS[dayHit].slice(0, 3)) - 12), t.indexOf(DAYS[dayHit].slice(0, 3))))) before = d;
    else date = d;
  }
  const part = /\b(morning|am|early)\b/.test(t) ? "morning" : /\b(afternoon|after lunch|after work|evening)\b/.test(t) ? "afternoon" : null;
  const parking: Parking | null = /\b(garage)\b/.test(t) ? "garage" : /\b(carport|covered)\b/.test(t) ? "carport" : /\b(driveway|street|apartment|outside)\b/.test(t) ? "driveway" : null;

  const urgent = /\b(asap|urgent|urgently|right away|as soon as|soonest|earliest|today|tonight|emergency|last minute)\b/.test(t);
  const dayName = (d: string) => fmtDate(d, "EEEE");
  const when = date
    ? `${/\btomorrow\b/.test(t) ? "tomorrow" : /\b(weekend)\b/.test(t) ? "this weekend" : dayName(date)}${part ? ` ${part}` : ""}`
    : before
      ? `before ${dayName(before)}${part ? `, ${part}s preferred` : ""}`
      : urgent
        ? "as soon as possible"
        : part
          ? `${part}s`
          : null;
  const scope = t.match(/\b(ceramic coating|paint correction|ppf|paint protection film|tint|dent|scratch(es)? repair|wrap|engine bay|boat|rv|motorcycle)\b/);
  return { vehicle, service, addons, zone, zip, zipInferred, place, urgent, when, date, before, part, parking, outOfScope: scope ? scope[0] : null };
}

/** The booking link that opens the flow already filled in. */
export function bookingLink(p: { vehicle?: VehicleKind | null; service?: ServiceKey | null; addons?: AddonKey[]; zip?: string | null; zone?: ZoneKey | null; parking?: Parking | null; startMs?: number; date?: string | null; ask?: { message: string; when?: string | null } }): string {
  const q = new URLSearchParams();
  if (p.vehicle) q.set("v", p.vehicle);
  if (p.service) q.set("s", p.service);
  if (p.addons?.length) q.set("a", p.addons.join(","));
  if (p.zip) q.set("zip", p.zip);
  else if (p.zone) q.set("zip", ZONE_ZIP[p.zone]);
  if (p.parking) q.set("p", p.parking);
  if (p.date) q.set("d", p.date);
  if (p.startMs) q.set("t", String(p.startMs));
  if (p.ask) {
    q.set("src", "ask");
    q.set("m", p.ask.message.slice(0, 160));
    if (p.ask.when) q.set("w", p.ask.when);
  }
  const s = q.toString();
  return `/book${s ? `?${s}` : ""}`;
}

/** The plain-language "here is what I understood" list, so the customer can see it was heard. */
export function understood(p: ParsedInquiry): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (p.vehicle) out.push({ key: "vehicle", label: VEHICLES[p.vehicle].name });
  if (p.service) out.push({ key: "service", label: SERVICES[p.service].name });
  for (const a of p.addons) out.push({ key: `addon-${a}`, label: ADDONS[a].name });
  if (p.zone) out.push({ key: "place", label: p.place ? `${p.place} (${ZONES[p.zone].name})` : ZONES[p.zone].name });
  if (p.when) out.push({ key: "when", label: p.when.charAt(0).toUpperCase() + p.when.slice(1) });
  if (p.urgent) out.push({ key: "urgent", label: "Urgent: earliest dry slots" });
  return out;
}

export interface Suggestion {
  startMs: number;
}

/** Up to three real openings that match what the person asked for. */
export function suggest(state: State, p: ParsedInquiry, nowMs: number, durationMin: number, zone: ZoneKey): number[] {
  return suggestDetailed(state, p, nowMs, durationMin, zone).picks;
}

export function suggestDetailed(state: State, p: ParsedInquiry, nowMs: number, durationMin: number, zone: ZoneKey): { picks: number[]; widened: boolean } {
  const today = localDate(nowMs);
  const picks: number[] = [];
  const outdoor = p.parking ? p.parking === "driveway" || p.parking === "street" : true;
  for (let i = 0; i <= 14 && picks.length < 3; i++) {
    const date = addDays(today, i);
    if (p.date && date !== p.date) continue;
    if (p.before && date >= p.before) break;
    const slots = findSlots(state, durationMin, zone, date, nowMs).filter((ms) => {
      const m = localMinutes(ms);
      if (p.part === "morning" && m >= 12 * 60) return false;
      if (p.part === "afternoon" && m < 12 * 60) return false;
      return !(outdoor && isRainRisk(state, ms, "driveway", p.addons));
    });
    // Prefer the slot that earns a neighbour deal: cheaper for them, less driving for Dario.
    const withDeal = slots.find((ms) => neighbourDeal(state, { startMs: ms, durationMin, zone }));
    if (slots.length) picks.push(p.urgent ? slots[0] : withDeal ?? slots[0]);
  }
  // Nothing that matches the asked-for day or deadline: widen to the next open days.
  if (!picks.length && (p.date || p.before || p.part)) {
    return { picks: suggestDetailed(state, { ...p, date: null, before: null, part: null }, nowMs, durationMin, zone).picks, widened: true };
  }
  return { picks, widened: false };
}

export function answerInquiry(state: State, from: string, text: string, nowMs: number): { state: State; inquiry: Inquiry } {
  const s = structuredClone(state);
  const p = parseInquiry(text, nowMs);
  const id = `q${++s.seq}`;
  let reply: string;
  let status: Inquiry["status"] = "answered";
  let suggested: number[] = [];
  let note: string | null = null;

  if (p.outOfScope) {
    status = "needs_owner";
    note = `Asked about ${p.outOfScope}, which isn't on the menu.`;
    reply = `Thanks for asking. ${p.outOfScope[0].toUpperCase()}${p.outOfScope.slice(1)} isn't something Bertha's set up for, so I've passed your message to Dario, who'll reply himself today. If you'd like a wash or interior in the meantime, this shows real times: ${APP_HOST}${bookingLink({ vehicle: p.vehicle, zip: p.zip, ask: { message: text, when: p.when } })}`;
  } else {
    const vehicle = p.vehicle ?? "suv";
    const service = p.service ?? "full";
    const zone = p.zone;
    const q = quote(vehicle, service, p.addons, zone);
    const svc = SERVICES[service].name;
    const what = `${svc} for ${p.vehicle ? `your ${NOUN[vehicle]}` : "a car"}${p.addons.length ? ` with ${p.addons.map((a) => ADDONS[a].name.toLowerCase()).join(" and ")}` : ""}`;
    if (zone) {
      const found = suggestDetailed(state, p, nowMs, q.durationMin, zone);
      suggested = found.picks;
      const times = suggested
        .map((ms) => {
          const d = neighbourDeal(state, { startMs: ms, durationMin: q.durationMin, zone });
          return `${fmtDay(ms)} ${fmtTime(ms)}${d ? ` (${dollars(d.discountCents)} off, Dario's already nearby)` : ""}`;
        })
        .join(" · ");
      const ask = p.date ? "that day" : p.before ? `before ${fmtDay(atLocal(p.before, 12 * 60))}` : "then";
      reply = suggested.length
        ? `Yes, we come to you in ${ZONES[zone].name}${p.place ? ` (${p.place})` : ""}. ${what}: ${dollars(q.totalCents)}, about ${hoursLabel(q.durationMin)}. ${found.widened ? `Nothing dry is free ${ask}, so here are the next openings: ` : p.urgent ? "Earliest dry times: " : "Open times, dry-forecast with the drive already counted: "}${times}. Tap one to hold it (a ${dollars(2500)} deposit comes off the total): ${APP_HOST}${bookingLink({ vehicle: p.vehicle, service: p.service ?? service, addons: p.addons, zip: p.zip, zone, parking: p.parking, startMs: suggested[0], ask: { message: text, when: p.when } })}`
        : `Yes, we come to you in ${ZONES[zone].name}${p.place ? ` (${p.place})` : ""}. ${what}: ${dollars(q.totalCents)}, about ${hoursLabel(q.durationMin)}. Nothing dry is open in the next two weeks, so join the waitlist and you'll be texted when a slot frees up: ${APP_HOST}${bookingLink({ vehicle: p.vehicle, service, addons: p.addons, zip: p.zip, zone, ask: { message: text, when: p.when } })}`;
    } else {
      reply = `Yes, we come to you. ${what}: from ${dollars(q.totalCents)}, about ${hoursLabel(q.durationMin)}. Tell us your zip and you'll see real open times, with rain flagged: ${APP_HOST}${bookingLink({ vehicle: p.vehicle, service: p.service, addons: p.addons, ask: { message: text, when: p.when } })}`;
    }
  }
  const inquiry: Inquiry = { id, at: nowMs, from, text, reply, suggested, status, jobId: null, note };
  s.inquiries.unshift(inquiry);
  pushMessage(s, { key: `${id}:in`, at: nowMs, kind: "inquiry_in", channel: "sms", direction: "in", to: "Fernhill", body: text });
  pushMessage(s, { key: `${id}:out`, at: nowMs + 20_000, kind: "inquiry_reply", channel: "sms", direction: "out", to: from, body: reply });
  pushEvent(s, nowMs, "inquiry", null, status === "needs_owner" ? `Inquiry from ${from} passed to Dario` : `Inquiry from ${from} answered in seconds`);
  return { state: s, inquiry };
}
