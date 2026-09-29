import { BUSINESS, SERVICES } from "./business";
import type { Job } from "./model";
import { portalLink } from "./messages";

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** A calendar file for the appointment, with a 2-hour alarm. */
export function icsFor(job: Job): string {
  const end = job.startMs + job.durationMin * 60_000;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fernhill Mobile Detail//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${job.code}@fernhill.app`, `DTSTAMP:${stamp(job.createdAt)}`, `DTSTART:${stamp(job.startMs)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${SERVICES[job.service].name} · ${BUSINESS.name}`)}`,
    `LOCATION:${esc(job.address)}`,
    `DESCRIPTION:${esc(`Booking ${job.code}. ${BUSINESS.owner} comes to you. Manage: ${portalLink(job.code)}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Fernhill detail today", "END:VALARM", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(job: Job) {
  const url = URL.createObjectURL(new Blob([icsFor(job)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `fernhill-${job.code}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A "add to Google Calendar" link. It's a plain link, so it works everywhere, including the hosted preview. */
export function googleCalendarUrl(job: Job): string {
  const end = job.startMs + job.durationMin * 60_000;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${SERVICES[job.service].name} · ${BUSINESS.name}`,
    dates: `${stamp(job.startMs)}/${stamp(end)}`,
    location: job.address,
    details: `Booking ${job.code}. ${BUSINESS.owner} comes to you. Manage: ${portalLink(job.code)}`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** The hosted single-file build runs in a frame that blocks downloads, so it hides the button. */
export const CAN_DOWNLOAD = import.meta.env.VITE_ROUTER !== "memory";
