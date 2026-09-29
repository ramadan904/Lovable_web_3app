import { describe, expect, it } from "vitest";
import { automationsFor, ledgerFor } from "../automations";
import type { Session } from "../types";

const now = new Date("2026-10-01T09:00:00Z");
const base: Session = {
  id: "s1",
  client_id: "c",
  guide_id: "g",
  threshold_slug: "divorce",
  threshold_words: null,
  session_type: "solo",
  status: "held",
  starts_at: "2026-10-06T10:00:00Z",
  ends_at: "2026-10-06T11:30:00Z",
  buffer_before_min: 45,
  buffer_after_min: 45,
  client_name: "R.",
  client_timezone: "Europe/London",
  created_at: "2026-09-30T12:00:00Z",
  cancelled_at: null,
  rescheduled_from: null,
  rescheduled_at: null,
};

describe("automationsFor", () => {
  it("schedules the preparation note 48h and the reminder 24h before", () => {
    const items = automationsFor(base, { guideName: "Mara O", now });
    const prep = items.find((a) => a.kind === "preparation")!;
    const rem = items.find((a) => a.kind === "reminder")!;
    expect(prep.at.toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(rem.at.toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(prep.state).toBe("scheduled");
    expect(items.find((a) => a.kind === "confirmed")!.state).toBe("done");
  });

  it("follows the session when it moves", () => {
    const moved = { ...base, starts_at: "2026-10-08T14:00:00Z", ends_at: "2026-10-08T15:30:00Z", rescheduled_from: base.starts_at, rescheduled_at: "2026-10-01T08:00:00Z" };
    const items = automationsFor(moved, { guideName: "Mara", now });
    expect(items.find((a) => a.kind === "reminder")!.at.toISOString()).toBe("2026-10-07T14:00:00.000Z");
    expect(items.some((a) => a.kind === "moved" && a.state === "done")).toBe(true);
  });

  it("withdraws what was pending when a session is released", () => {
    const released = { ...base, status: "cancelled" as const, cancelled_at: "2026-10-01T08:30:00Z" };
    const items = automationsFor(released, { guideName: "Mara", now });
    expect(items.find((a) => a.kind === "reminder")!.state).toBe("withdrawn");
    expect(items.some((a) => a.kind === "released")).toBe(true);
  });

  it("never reveals a letter on the Guide's side", () => {
    expect(automationsFor(base, { guideName: "Mara", hasLetter: true, now }).some((a) => a.kind === "letter")).toBe(true);
    expect(automationsFor(base, { guideName: "Mara", hasLetter: true, forGuide: true, now }).some((a) => a.kind === "letter")).toBe(false);
  });
});

describe("ledgerFor", () => {
  it("counts what the owner didn't have to do", () => {
    const moved = { ...base, id: "s2", rescheduled_from: base.starts_at, rescheduled_at: "2026-10-01T08:00:00Z", answers: [{ answer: "Yes" }] };
    const l = ledgerFor([{ ...base, answers: [{ answer: null }] }, moved], now);
    expect(l.held).toBe(2);
    expect(l.stillnessMinutes).toBe(180);
    expect(l.briefings).toBe(1);
    expect(l.moves).toBe(1);
    // confirmation + preparation + reminder each, plus the move
    expect(l.messagesHandled).toBe(7);
  });
});
