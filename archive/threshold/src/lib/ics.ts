/** A calendar file for the held time. Written by hand: small, exact, UTC. */
export function buildIcs(args: {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
}): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Threshold//Booking Ritual//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${args.uid}@threshold`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(args.start)}`,
    `DTEND:${stamp(args.end)}`,
    `SUMMARY:${esc(args.title)}`,
    `DESCRIPTION:${esc(args.description)}`,
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your threshold is tomorrow.",
    "TRIGGER:-PT24H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
