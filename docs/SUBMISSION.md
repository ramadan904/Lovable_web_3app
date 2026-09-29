# Fernhill Mobile Detail: #LovableChallenge submission kit

Deadline: **Oct 1, 11:59pm PDT**. Check the [Contra challenge page](https://contra.com/community/topic/lovablechallenge) for the exact submission form before posting: this kit was written from the published brief.

## The required pieces

| Required | Status |
|---|---|
| Believable appointment business: name, location, quirks | Done: **Fernhill Mobile Detail**, Alberta Arts, NE Portland, Oregon. Solo owner Dario Reyes with one van. Quirks below |
| A build made in Lovable, project link set to **public** | **You:** see "Get it into Lovable" |
| Business name + one-line problem | Below |
| Demo video, under 3 minutes | **You:** script below, timed to 2:40 |
| Social post tagging @Lovable and #lovablechallenge | **You:** drafts below |
| Bonus: process video | Optional: outline below |

## One line

> **Fernhill Mobile Detail** (Portland, OR): a one-van detailer who was losing evenings and paid slots to text threads, rainouts and no-shows now gets booked, reminded, rain-rescheduled and backfilled without typing a word.

## The archetype

Dario Reyes runs Fernhill alone from a white Transit van called Bertha. He does up to three jobs a day, Tuesday to Saturday, at customers' homes across Portland, Beaverton and Tigard.

His real-world friction, which the build takes on directly:

- **It rains.** A driveway wash in a downpour is a bad job, so a wet forecast used to mean an evening of texting people to find new dry slots.
- **He can't answer while working.** A "can you do my car?" text sits for hours and the customer books someone else.
- **No-shows.** A first-time customer who doesn't show costs him a whole job (a whole paid slot).
- **Drive time and water.** A Beaverton job needs 35 minutes each way, and the tank only holds two jobs.
- **Codes and parking.** Gate codes arrive by text at 7 am, when he's already driving.

## Both halves of the brief

**Fix the front door**
- Ask in your own words → instant price, duration, and three real times → tap → booking prefilled.
- The calendar only shows times Dario can reach (drive time, refill stop, daily limit already counted), with forecast per day and a "best dry day".
- Confirmed instantly. A $25 deposit holds the slot. No request-and-approve.

**Fix the follow-through**
- Confirmation, prep note, one-tap-confirm reminder, second nudge, on-my-way and aftercare, all scheduled from the start time, so moving a job moves them.
- **Rain rescheduling:** 48 hours out, an outdoor job in a forecast storm is offered the nearest dry slots; if the customer doesn't pick, the first is taken.
- **No-show defence:** unconfirmed slots are released 3 hours out and offered to the waitlist, first whose job fits (checked against the drive), two hours to claim.
- **Self-serve** move and cancel until 24 hours ahead, gate codes editable by the customer, refunds automatic.
- **The rain promise is real**: "$25 holds the slot. Fully refundable if we have to move you for rain." At booking, on the confirmation and in the portal, an outdoor car is told it is weather-sensitive and shown dry alternatives one tap away. If rain touches the booking, cancelling is a full refund at any time.
- **Owner's daily tool**: "Needs you" comes with a drafted reply (send in one tap), exact metrics (messages, hours, no-shows recovered, revenue), "Weather moves this week", a waitlist that offers freed slots, and "Today's run" with drive times.
- **Neighbour deals**: route-density pricing. When a slot sits next to another job in the same area, Dario drives less, and the customer gets 50¢ off for every minute he saves. It fills the gaps in his route, cuts his driving, and gives customers a reason to pick the slot that's best for him.
- **"Where's Bertha?"**: a live van tracker on a map of Portland. Customers watch the van drive to them with a live ETA, so nobody texts "where are you?". Dario can scrub and replay his whole day. Privacy is built in: customers only ever see their own stop named.
- **"Handled for you"** ledger on Dario's console: messages sent, bookings taken, reschedules, gaps refilled, and a transparent estimate of hours saved. "Needs you" shows only what genuinely needs a human.

## Before / after

| | Before | With Fernhill |
|---|---|---|
| "Can you do my car?" | ~9 texts over 2 days | One message, an answer in seconds |
| Confirming a booking | Dario types, then waits | Customer taps a time |
| Rainy Tuesday | Evening of texts, reschedules | Offers sent, customers pick, first dry option taken if not |
| Reminders | When he remembers | Scheduled, and they move with the job |
| "Where are you?" | A text while he's driving | A live map with an ETA |
| No-shows | A wasted half-day | Deposit, confirm-tap, release at 3 h, waitlist refill |
| Gate codes | Texted at 7 am | On the morning sheet |
| Overbooking | Judgement | Impossible: the engine refuses |

## Mapped to the judging criteria

1. **Problem-solving impact:** an inquiry becomes a confirmed, deposit-backed booking in one sitting, with real availability. Verified by an end-to-end test that books through the UI.
2. **Owner-effort reduction:** measurable on `/owner`: every automation is a real, logged action. Rain moves, releases, waitlist refills and reminders all happen with zero owner input; the demo controls let you watch each one fire in order.
3. **Craft and execution:** 60+ unit tests on the scheduling rules, Playwright journeys on desktop and mobile, axe-core WCAG 2.1 AA audits on every page and booking step, no horizontal scroll on any page at phone width, reduced-motion respected, working empty/error/race states (a slot taken mid-booking returns you to the calendar without losing anything).
4. **Storytelling:** the landing page shows the same customer before and after; the owner console opens with "Nothing needs you right now."

## Demo video: 2:40

Record at 1440×900 (or a phone-width take for the mobile beat). Open **Demo controls** first, so viewers see where the storm button lives. Click **Reset** right before recording for a fresh week.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Landing hero | Let it sit | "This is Dario, a one-van car detailer in Portland. He loses evenings to texting, rainouts and no-shows. This is Fernhill, built with Lovable." |
| 0:12 | Ask box | Tap the Subaru example → **Get real times** | "A customer writes the way they'd text a friend. Fernhill reads it, prices it, checks Dario's drive time, and offers three real slots. In seconds." |
| 0:28 | Tap a time → Where step | Fill address, pick **Driveway** | "It knows her Outback with dog hair takes two and a half hours. She says the car is outside, and that matters later." |
| 0:45 | When step | Point at day tiles and rain chips | "Only reachable times. Wet days are flagged; a dry day is recommended." |
| 0:47 | When step, Southeast zip | Point at the "−$10" times | "And when Dario's already in her neighbourhood, the slot next to that job is cheaper. Every minute he doesn't drive is fifty cents off." |
| 0:55 | You step → **Book** | Name, phone, email → Book | "A twenty-five dollar deposit holds it. Confirmed instantly." |
| 1:05 | Confirmation | Scroll the queue | "Nothing left for anyone to do. Prep note, a one-tap confirm, a rain check, an on-my-way text are already queued." |
| 1:15 | `/owner` | Show greeting, ledger tiles | "Dario's side. 'Nothing needs you' except one thing that really does: a request he doesn't offer. Everything else is done." |
| 1:30 | Day sheet | Scroll the route | "His morning sheet: the route, drive times, a water refill before job three, gate codes, all filled in by customers." |
| 1:45 | **Demo controls → Storm** | Click | "Now heavy rain is forecast for his busiest day." |
| 1:52 | Messages → Rain filter | Point at rain offers | "Every customer with an outdoor car has been texted the nearest dry times. Covered cars are untouched." |
| 2:05 | Open a customer link | Tap a dry option | "She picks Thursday. Her reminders move with her. Dario did nothing." |
| 2:12 | Scroll to **Where's Bertha?** → **Play the day** | Let the van drive | "And instead of texting 'where are you?', she watches Bertha drive to her. Other customers' stops are anonymous." |
| 2:15 | Waitlist tab | Show an offer out | "Her old slot went to the first person on the waitlist whose job fits. Nobody phoned anybody." |
| 2:25 | **+6 hours** ×2 | Show a nudge/release | "And if someone never confirms, the slot is released three hours before, and refilled." |
| 2:35 | Ledger | Point at hours saved | "Hours of admin, gone. Fernhill Mobile Detail. Built with Lovable." |

## Social post drafts

**X**
> Meet Dario: one van, one man, a Portland rain problem. 🚐🌧️
> I built Fernhill Mobile Detail with @Lovable so a customer text becomes a booked, deposit-backed job with zero effort from him. When a storm's forecast, it re-books the outdoor jobs onto dry days by itself, and refills no-show gaps from a waitlist.
> [video] [link] #lovablechallenge

**LinkedIn**
> A car detailer in Portland loses his evenings to three things: texting back and forth, rainouts, and no-shows. For the #lovablechallenge I built Fernhill Mobile Detail with @Lovable around exactly those.
>
> The customer writes in plain English and gets a price and three real time slots (drive time already counted). A deposit holds the booking. The owner gets a morning sheet with the route, gate codes and drive times. When heavy rain is forecast, outdoor customers are offered dry slots automatically. Unconfirmed slots are released to a waitlist.
>
> The goal wasn't a pretty booking page: it was an owner who types nothing. Demo: [link]

## Get it into Lovable

I can't create or publish a Lovable project from here, so these steps are yours. Verify the GitHub steps in Lovable's current docs, since the flow changes:

1. Sign in to lovable.dev with the account that has the **challenge code** applied and is **Partner Program certified** (required for prize consideration).
2. Create a new project (any starter prompt). In **Settings → GitHub**, connect the project to a GitHub repository.
3. Copy this app's files into that repository's default branch and push. Lovable syncs from GitHub; wait for the build to go green in its preview.
4. Try the Lovable preview: the **Demo controls** button (bottom-right), landing page, `/book` and `/owner` should all work with no environment variables.
5. In Lovable: **Share → Publish**, and set the project visibility to **public**. Open the link in a private window and run the tour in the README.
6. Submit on Contra: business name, one-line problem, public link, video, social post link.

If the GitHub sync route is awkward under time pressure, a fallback is to paste the README's "What it does" and "The quirks" tables into a fresh Lovable prompt and ask it to rebuild; but the tested code here is the stronger entry.

## Bonus: process video (60 seconds)

- Show the failing test that found a real bug: the day strip pushing the whole page to 1,600px on a phone, found by an end-to-end run on a phone-sized viewport and now guarded by a "no horizontal scroll" test on every page.
- Show `engine.ts` `checkDay` and the test proving a Beaverton job can't start before 8:50.
- Show the seed test that makes sure the product looks alive whichever day it's opened.

## Honest limits (say them out loud if asked)

Texts and emails are composed and logged, not sent (production: Twilio and Resend). The deposit is simulated (production: Stripe). The forecast is illustrative (production: a weather API at the 48-hour check). Data lives in the browser (production: Postgres with an exclusion constraint on time ranges). Seeded customers reply automatically so both sides of a flow are visible in one demo.
