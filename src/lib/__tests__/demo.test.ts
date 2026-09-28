import { beforeEach, describe, expect, it } from "vitest";
import { createDemoApi } from "../data/demo";
import { DEMO_USERS, SEED_SESSIONS } from "../data/seed";
import { matchGuides, matchThresholds } from "../matching";
import { generateSlots } from "../time";
import { BookingError } from "../types";

describe("demo store", () => {
  let api: ReturnType<typeof createDemoApi>;
  beforeEach(async () => {
    api = createDemoApi();
    await api.resetDemo?.();
  });

  it("seeds every session on a real open day", async () => {
    const guides = await api.listGuides();
    let total = 0;
    for (const g of guides) total += (await api.busyRanges(g.id, new Date(Date.now() - 40 * 864e5), new Date(Date.now() + 60 * 864e5))).length;
    expect(total).toBe(SEED_SESSIONS.length);
  });

  it("keeps letters sealed until 48 hours after the session", async () => {
    await api.signIn(DEMO_USERS.client.email, DEMO_USERS.client.password);
    const letters = await api.myLetters();
    expect(letters).toHaveLength(2);
    expect(letters.filter((l) => l.is_open && l.body)).toHaveLength(1);
    expect(letters.filter((l) => !l.is_open && l.body === null)).toHaveLength(1);
  });

  it("books an open slot end-to-end, and refuses the same hour twice", async () => {
    const guides = await api.listGuides();
    const mara = guides.find((g) => g.slug === "mara")!;
    const rules = await api.listAvailability(mara.id);
    const busy = await api.busyRanges(mara.id, new Date(), new Date(Date.now() + 40 * 864e5));
    const slot = generateSlots({ timezone: mara.timezone, bufferMin: 45, maxPerDay: 2, rules, durationMin: 90, busy, now: new Date() }).slots.find(
      (s) => s.state === "open",
    )!;

    await api.signUp("guest@example.com", "a-long-password", "Guest");
    const input = {
      guide_id: mara.id,
      threshold_slug: "career",
      threshold_words: null,
      session_type: "solo" as const,
      starts_at: slot.start.toISOString(),
      client_name: "Guest",
      client_timezone: "Europe/London",
      answers: [{ position: 1, prompt: "What is ending?", answer: "Work." }],
      letter: "Dear me.",
    };
    const id = await api.book(input);
    expect(id).toBeTruthy();
    const letters = await api.myLetters();
    expect(letters[0].is_open).toBe(false);

    await api.signUp("second@example.com", "a-long-password", "Second");
    await expect(api.book(input)).rejects.toMatchObject({ code: "slot_taken" } satisfies Partial<BookingError>);
  });

  it("returns the letter unopened when a session is released", async () => {
    await api.signIn(DEMO_USERS.client.email, DEMO_USERS.client.password);
    const upcoming = (await api.mySessions()).find((s) => new Date(s.starts_at) > new Date())!;
    await api.cancelSession(upcoming.id);
    const letter = (await api.myLetters()).find((l) => l.session_id === upcoming.id)!;
    expect(letter.is_open).toBe(true);
  });
});

describe("matching", () => {
  it("offers between three and five Guides", async () => {
    const api = createDemoApi();
    const guides = await api.listGuides();
    const thresholds = await api.listThresholds();
    for (const t of thresholds) {
      const m = matchGuides(guides, t.slug, "", thresholds);
      expect(m.length).toBeGreaterThanOrEqual(3);
      expect(m.length).toBeLessThanOrEqual(5);
      expect(m.every((g) => g.thresholds.includes(t.slug))).toBe(true);
    }
    expect(matchGuides(guides, null, "something I can't name", thresholds).length).toBeGreaterThanOrEqual(3);
  });

  it("hears a threshold in the client's own words", async () => {
    const thresholds = await createDemoApi().listThresholds();
    expect(matchThresholds("my husband and I are signing the divorce papers", thresholds)[0].slug).toBe("divorce");
    expect(matchThresholds("I'm retiring after 30 years as a surgeon", thresholds)[0].slug).toBe("career");
  });
});
