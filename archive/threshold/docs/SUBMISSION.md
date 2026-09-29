# Threshold — #LovableChallenge submission kit

Everything needed to submit: the write-up, how it maps to the judging criteria, a timed walkthrough script, and a pre-flight checklist.

> **Deadline:** Oct 1, 11:59pm PDT. Check the [challenge guidelines](https://contra.com/community/topic/lovablechallenge/guidelines) for the exact submission format before posting — this kit was written from the published brief and judging criteria.

---

## Title

**Threshold — booking for the moments that don't reverse**

## One-line pitch

An appointment platform for irreversible life thresholds — a divorce made final, a terminal diagnosis, the week before surgery — that turns *"can I book with you?"* into *"you're booked"* in one quiet sitting, with nothing left for the practitioner to do.

## The business archetype

A practice of **Threshold Guides**: facilitators (former chaplains, nurses, mediators, lawyers) who sit with people through permanent life changes. Like a therapist or coach, their inquiries are emotionally loaded, and every back-and-forth email costs both sides. Unlike most booking tools, the product has to protect the *practitioner's* capacity: stillness before and after each session, and a hard daily limit.

## Approach: both halves of the brief

**Fixing the front door**
- Soft matching shows only the 3–5 Guides who hold the client's threshold.
- Clients see **only real open hours**, in their own time zone (clock changes included), with the Guide's day drawn to scale.
- Three reflective questions replace the first two emails ("tell me more about what you're going through…").
- The booking is **confirmed instantly**, with a calendar file. There's no request to approve.
- If another client takes the hour mid-booking, the client is returned to the hour picker with a calm explanation and nothing they wrote is lost.

**Fixing the follow-through**
- **Self-serve rescheduling and release** up to 24 h before the session, under the same rules as booking. The calendar, the buffers and the letter's seal all follow on their own.
- The **preparation note** (48 h before) and **reminder** (24 h before) are scheduled automatically. They move when the session moves and are withdrawn if it's released.
- A **briefing** is assembled for the Guide from the client's answers.
- The **"Handled for you this week"** ledger shows the Guide what they didn't have to do: sessions held with no back-and-forth, messages they didn't write, hours of stillness protected, briefings ready.

## Before / after

| | Before (email) | With Threshold |
|---|---|---|
| Messages to confirm | ~6 over 5 days | **0 from the Guide** |
| Client tells their story | Twice, in pieces | **Once**, before arrival |
| Time zones | Guessed | Shown for both sides |
| Buffer between clients | Whatever's left | **45 min either side, enforced by the database** |
| Guide's daily limit | Willpower | **Enforced** |
| Rescheduling | Another thread | **Self-served**, rules intact |
| Reminders | Remembered, maybe | **Scheduled** |

## Mapped to the judging criteria

**1. Problem-solving impact: does an inquiry become a confirmed booking?**
Yes, in one sitting. The whole path from threshold → Guide → questions → form → hour → letter → hold ends in an instant confirmation. A guest can go through everything before being asked to create an account.

**2. Owner-effort reduction**
The Guide never schedules, confirms, reminds, reschedules or re-asks. The rules they care about (buffers, daily limit, availability windows) are **enforced in Postgres**: an exclusion constraint on buffered time ranges plus an atomic `book_session` / `reschedule_session` RPC. They're not just hidden in the UI. The Guide's calendar opens with a weekly ledger of what was handled.

**3. Craft & execution**
- The ritual is complete end-to-end, with loading, empty and error states on every step.
- **Zero WCAG 2.1 AA violations** (axe-core) on every route and step, desktop and mobile. Reduced motion is respected.
- Supabase with row-level security. Letters are unreadable, **even by their author**, until 48 h after the session. **Guides can never read them**, and never even learn that one exists.
- Tests:
  - 60+ database assertions
  - 19 unit tests
  - 30 Playwright end-to-end and accessibility tests on desktop and mobile
  - All run in CI on every push
- It runs instantly as a seeded demo, or against a real Supabase project; both were verified in a browser.

**4. Storytelling**
The landing page leads with the idea in one line, then shows **the same inquiry twice**: an email thread vs. Threshold. The **For Guides** section states the owner's side plainly. A demo guide gives four one-tap paths through the product.

---

## 90-second walkthrough script

Record at 1440×900. Open the **Demo guide** pill (bottom-left) before you start, so viewers see where each path begins.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Landing hero | Let the doorway draw in | "Some moments only happen once. Threshold is booking for them." |
| 0:06 | Scroll to *The same inquiry, twice* | Pause on both cards | "Today this takes six emails over five days. The client tells their story twice, and there's no pause between clients." |
| 0:16 | **Begin** | Pick *Finalizing a divorce* | "With Threshold, the client just starts." |
| 0:22 | Guides | Pick Mara | "Only the three Guides who hold this threshold. Scarcity on purpose." |
| 0:28 | Three questions | Type one answer, skip one | "Told once, read by the Guide before they meet." |
| 0:36 | Form → Hour | Pick *Witnessed*, then a day and hour | "Real availability in your own time zone. Every session has forty-five minutes of stillness either side, enforced by the database." |
| 0:50 | Letter | Type two lines, **Seal** | "A letter to your future self, sealed until two days after." |
| 0:56 | Hold | Name, email, **Hold this time** | "One tap." |
| 1:00 | Confirmation | Let the words arrive | "It is held. No one had to reply." |
| 1:06 | My thresholds | Open *What happens next*, click **Move this time**, move it | "Plans change. The client moves it themselves. The reminders move with it." |
| 1:18 | Demo guide → *See a Guide's week* | Show the tiles, open a briefing | "The Guide's side: what was handled this week, and a briefing before every session. They never see the letter." |
| 1:28 | Back to hero | — | "Threshold. Built with Lovable." |

## Short description (for the post body)

> Threshold is an appointment platform for irreversible life thresholds: finalizing a divorce, a terminal diagnosis, the week before surgery. Booking is a seven-step ritual: choose the threshold, meet only the 3–5 Guides who hold it, answer three questions, pick a form and a real open hour, and write a letter to your future self that stays sealed until two days after. It's confirmed instantly. For the Guide there's nothing to do. There are no scheduling emails, and 45-minute buffers and a daily limit are enforced by the database. Clients reschedule themselves, reminders go out on schedule, and every session arrives with a briefing. Built with Lovable, on React, Tailwind, shadcn/ui and Supabase with row-level security.

## Pre-flight checklist

- [ ] Connect the repo to a Lovable project and publish it. The app runs as a seeded demo with no backend configured.
- [ ] Open the published link in a private window and walk the 60-second path from the README.
- [ ] Optional: connect Supabase (Lovable Cloud or your own project), apply `supabase/migrations/*`, then `supabase/seed.sql`.
- [ ] Record the walkthrough above.
- [ ] Post on Contra with the link, video, repo and screenshots from `docs/screenshots/`, following the guidelines page.
