import { LETTER_SEAL_HOURS } from "./time";
import type { Session } from "./types";

/*
 * Everything Threshold does so the Guide doesn't have to.
 *
 * Derived from a session alone, so it is always consistent with the
 * calendar: move a session and its schedule moves; release it and what was
 * pending is withdrawn. Delivery (email) is a separate concern — here we
 * describe what is handled and when.
 */

export type AutomationKind =
  | "confirmed"
  | "calendar"
  | "briefing"
  | "moved"
  | "preparation"
  | "reminder"
  | "briefing-ready"
  | "letter"
  | "released";

export type AutomationState = "done" | "scheduled" | "withdrawn";

export interface Automation {
  kind: AutomationKind;
  at: Date;
  audience: "client" | "guide";
  title: string;
  detail: string;
  state: AutomationState;
}

const HOUR = 3600_000;

export function automationsFor(
  session: Session,
  opts: { guideName: string; hasLetter?: boolean; forGuide?: boolean; now?: Date },
): Automation[] {
  const now = opts.now ?? new Date();
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  const created = new Date(session.created_at);
  const cancelled = session.status === "cancelled";
  const first = opts.guideName.split(" ")[0];

  const at = (d: Date): AutomationState => (cancelled && d > new Date(session.cancelled_at ?? now) ? "withdrawn" : d <= now ? "done" : "scheduled");

  const items: Automation[] = [
    {
      kind: "confirmed",
      at: created,
      audience: "client",
      title: "Booking confirmed",
      detail: "Held instantly, with a calendar file. No request, no reply, no back-and-forth.",
      state: "done",
    },
    {
      kind: "calendar",
      at: created,
      audience: "guide",
      title: "Calendar held, stillness protected",
      detail: `The hour and ${session.buffer_before_min} minutes either side closed to everyone else.`,
      state: "done",
    },
    {
      kind: "briefing",
      at: created,
      audience: "guide",
      title: "Briefing assembled",
      detail: "Threshold, form, time zone and the three answers, gathered before the client arrives.",
      state: "done",
    },
  ];

  if (session.rescheduled_at && session.rescheduled_from) {
    items.push({
      kind: "moved",
      at: new Date(session.rescheduled_at),
      audience: "guide",
      title: "Moved by the client",
      detail: "Calendar, stillness and every reminder updated to the new hour.",
      state: "done",
    });
  }

  items.push(
    {
      kind: "preparation",
      at: new Date(start.getTime() - 48 * HOUR),
      audience: "client",
      title: "Preparation note",
      detail: "What to bring, how the room works, and who to call if the day turns hard.",
      state: at(new Date(start.getTime() - 48 * HOUR)),
    },
    {
      kind: "briefing-ready",
      at: new Date(start.getTime() - 24 * HOUR),
      audience: "guide",
      title: "Briefing delivered",
      detail: `The client's answers, sent to ${first} the day before.`,
      state: at(new Date(start.getTime() - 24 * HOUR)),
    },
    {
      kind: "reminder",
      at: new Date(start.getTime() - 24 * HOUR),
      audience: "client",
      title: "Reminder",
      detail: `The time in their own time zone, and that ${first} will be there early.`,
      state: at(new Date(start.getTime() - 24 * HOUR)),
    },
  );

  // A letter's existence is the client's alone; it never appears on the Guide's side.
  if (opts.hasLetter && !opts.forGuide) {
    const unlocks = new Date(end.getTime() + LETTER_SEAL_HOURS * HOUR);
    items.push({
      kind: "letter",
      at: unlocks,
      audience: "client",
      title: "Letter unsealed",
      detail: "A quiet note that the letter you wrote is ready to open.",
      state: cancelled ? "done" : at(unlocks),
    });
  }

  if (cancelled && session.cancelled_at) {
    items.push({
      kind: "released",
      at: new Date(session.cancelled_at),
      audience: "guide",
      title: "Released by the client",
      detail: "The hour reopened to others. Pending reminders withdrawn.",
      state: "done",
    });
  }

  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface WeekLedger {
  held: number;
  messagesHandled: number;
  stillnessMinutes: number;
  briefings: number;
  moves: number;
}

/** What Threshold handled across a set of sessions — the owner-effort ledger. */
export function ledgerFor(sessions: (Session & { answers?: { answer: string | null }[] })[], now: Date = new Date()): WeekLedger {
  const live = sessions.filter((s) => s.status !== "cancelled");
  let messagesHandled = 0;
  for (const s of sessions) {
    // Everything that would otherwise be a message from the owner: confirmation,
    // preparation note, reminder, a move or a release.
    messagesHandled += automationsFor(s, { guideName: "", forGuide: true, now }).filter(
      (a) => a.audience === "client" && a.state !== "withdrawn",
    ).length;
    if (s.rescheduled_at) messagesHandled += 1;
    if (s.status === "cancelled") messagesHandled += 1;
  }
  return {
    held: live.length,
    messagesHandled,
    stillnessMinutes: live.reduce((m, s) => m + s.buffer_before_min + s.buffer_after_min, 0),
    briefings: live.filter((s) => (s.answers ?? []).some((a) => a.answer)).length,
    moves: sessions.filter((s) => s.rescheduled_at).length,
  };
}
