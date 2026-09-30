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
- **Details only a real mobile business has**: a one-tap "running behind" that texts everyone still to come and shifts their live ETA; care plans that rebook regulars automatically (10% off, no deposit, skip or stop any time); and a cure-time rule for ceramic sealant, which is only offered outdoors on dry days.
- **A palette that follows the weather**: the app is warm fern and paper on a dry day and cools to an overcast grey-blue on a wet one, with a thin pearl-paint sheen (teal to rose, like a freshly sealed panel) as its signature. Press Storm and watch the whole app change. Every colour is checked for contrast in both moods.
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

## For judges who never press play

Put this in the submission text: **open the app, then tap "Watch the 90-second story"**, or add `?story=1` to the link (on GitHub Pages: `.../Lovable_web_3app/#/?story=1`). It is a captioned, nine-step run over the real app (text to booking, the deposit, the owner's morning, a storm, customers moving themselves, the live van map, a running-late text, the result) with Next and Auto-play. It works on a phone and needs no sign-in.

## Before you post

The share card (`public/og.png`) is picked up from the link's page. It uses the address in `VITE_SITE_URL`, which defaults to the Lovable one (fernhill-spotlight.lovable.app). If your Lovable link is what you post, set `VITE_SITE_URL` to it in that project's build settings so the preview image and canonical link point there. Paste your link into the LinkedIn Post Inspector or an X draft first to see the card; both cache, so check before you publish.

## Demo video: about 2:20 (under the 3-minute limit)

**Before you press record (1 minute):** open your public link with `?demo=1` on the end (or press **Alt+D**). A small **Demo controls** button appears at the bottom right; customers never see it. Open it, click **Reset** (a fresh week), close the panel, then press **Alt+D** to hide it again. Then go to the landing page. Zoom the browser to 110% so text is readable in the recording. Do the whole thing in one take; no cuts needed.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Landing page | Let it sit for two seconds | "This is Dario, a one-man, one-van car detailer in Portland. Rain, texting back and forth and no-shows eat his evenings. This is Fernhill." |
| 0:12 | Text box | Type: *My dog wrecked my Outback. I'm in Sellwood. Friday morning?* Press **Get real times** | "A customer just texts the way they'd text a friend. Fernhill reads the car, the service, the neighbourhood and the day." |
| 0:25 | Reply | Point at the chips and the three times | "Real prices, and only times Dario can actually reach, with his drive between jobs already counted." Click **Continue to booking**. |
| 0:38 | Where step | Type a street, tap **Driveway**, Continue | "It's a driveway, so weather matters." |
| 0:48 | When step | Point at the greyed-out rainy days, then the strip under the times | "Rainy days are blocked for an outdoor car. And this strip shows why this time works: the jobs already booked, the drive, even the water refill. A fourth job in a day is refused." |
| 1:05 | Review and pay | Scroll the summary and price breakdown | "Before paying: exactly what she's booking, that it's weather-sensitive, and a twenty-five dollar deposit that comes off the total and is refunded if we move her for rain." Fill name, phone, email, press **Book it**. |
| 1:25 | Confirmation | Point at the receipt boxes, then **Add to calendar** | "Confirmed. Date, address, deposit paid, the rain plan, and her own booking page to come back to." |
| 1:40 | `/owner` | Show **Just booked** | "Dario's side: her booking is already here, checked against his limits. Job number, the drive, the deposit, the rain plan. Nothing for him to do." |
| 1:55 | Backstage | Press **Alt+D**, open Demo controls, click **Storm hits the busiest outdoor day** (or use the guided story's storm step instead) | "Now a storm is forecast. Watch the whole app change." |
| 2:05 | Owner page | Point at the rain colours, then **Weather moves this week** | "Every outdoor customer was offered dry days automatically. Covered cars are untouched. Dario typed nothing." |
| 2:15 | Close | Back to the landing page | "Fernhill Mobile Detail. Built for the Lovable Challenge." |

**Tips**
- If you say a line badly, keep going. One honest take beats a stiff one.
- Don't mention the demo controls by name; call it "a storm".
- If anything goes wrong mid-take, click **Reset** in Demo controls and start again.
- Upload the video, then paste its link in the post and in your Contra submission.

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
