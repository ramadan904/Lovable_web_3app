# Fernhill Mobile Detail

**A booking system for a one-van car detailer in Portland, Oregon, that turns "can you do my car?" into "you're booked" without the owner typing a word.**

Built for the **#LovableChallenge** ("Built for small business"). React + Vite + TypeScript + Tailwind + shadcn-style primitives.

## The business

| | |
|---|---|
| **Name** | Fernhill Mobile Detail |
| **Owner** | Dario Reyes, solo, with one van called Bertha |
| **Where** | Alberta Arts, NE Portland. Serves Portland, Beaverton and Tigard |
| **Hours** | Tuesday to Saturday, 8:00 to 5:30. Monday is van maintenance and admin |
| **Ticket** | $85 to $460 per job, one to four hours |

### The quirks that make it real

Each one is a rule the booking engine enforces (`src/lib/engine.ts`), not copy on a page.

| Quirk | What the system does about it |
|---|---|
| **It rains in Portland.** Outdoor washing in a downpour is a bad job | Customers say if the car is covered. Outdoor bookings are watched: at 48 hours, if the forecast is 70%+ rain, the customer is texted the nearest dry slots and moved free. If they don't pick, the first option is taken after 6 hours. Covered cars are never touched |
| **Solo owner, one van** | Max three jobs a day. The calendar never offers a fourth |
| **The water tank holds two jobs** | A 30-minute refill stop is required before the third job, and is on the clock |
| **Drive time is work time** | A zone-to-zone drive matrix. Load time before the first job, the drive home after the last. A Beaverton job can't start at 8:30 |
| **Vehicle size and add-ons set the duration** | A pet-hair SUV takes about twice as long as a sedan wash. Price and time are computed together, then fed to the calendar |
| **High no-show rate** | $25 deposit, a one-tap confirm the day before, a second nudge at 6 h, and an unconfirmed slot is released at 3 h to the waitlist |
| **Gates, codes, awkward parking** | Customers enter them once, can update them any time, and they appear on Dario's morning sheet |

## What it does

**Fixes the front door**
- **Ask in your own words.** A message like *"hey do u do subarus? filthy inside from my dog, need it before saturday, im in sellwood"* is parsed (vehicle, service, add-ons, neighbourhood, deadline) and answered instantly with a price, duration, and three real open times. Tapping one opens the booking already filled in.
- **Only real availability.** The booking calendar lists only slots Dario can actually reach, with the forecast beside each day and a "best dry day" hint.
- **Instant confirmation.** No request to approve. A booking holds the moment the deposit is paid.

**Fixes the follow-through** (Dario's side, `/owner`)
- **Automations that run without him:** confirmation, prep note (48 h), reminder with one-tap confirm (24 h), nudge (6 h), release (3 h), on-my-way, aftercare. They are derived from the start time, so **moving a job moves its reminders**.
- **Rain rescheduling**, above.
- **Self-serve changes:** customers move or cancel themselves until 24 h before, under the same rules as booking. Refunds are automatic.
- **Waitlist backfill:** a freed slot goes to the first waitlisted customer whose job fits it (checked against the drive), with a 2-hour window, then to the next.
- **A morning day sheet:** the route in order, drive minutes, refill stop, addresses, gate codes and notes, and who has not confirmed.
- **Neighbour deals (route-density pricing).** If a slot sits directly before or after a job in the same zone, Dario makes one trip instead of two, and the customer gets the saving as a discount: every minute he doesn't drive is 50¢ off (a Southeast slot next to another Southeast job saves 20 min, so $10). Discounted times are marked on the calendar, come off the total, appear in the inquiry replies ("$10 off, Dario's already nearby"), and are locked in at booking (a later move or rain reschedule never takes it away). Dario's ledger counts the driving minutes saved. The pricing rule is one tested function, `neighbourDeal` in `src/lib/engine.ts`.
- **The real forecast, if you want it.** Demo controls has "Use the live Portland forecast", which swaps the steady demo forecast for real rain chances and highs from Open-Meteo (free, no key, 16 days). Slots, rain checks, the header and the app's rain colours all follow it; a storm forced from the Demo controls still wins; if the service can't be reached, the demo forecast stays and the panel says so. It is off by default so recordings repeat exactly. Code: `setLiveWeather` in `src/lib/weather.ts`.
- **It doesn't go blank.** A top-level error boundary shows "Bertha hit a pothole" with Reload and Start a fresh week, and saved data of the wrong shape is dropped and reseeded instead of trusted.
- **A share card.** `public/og.png` and Open Graph / Twitter tags, so a post with the link shows the headline and the van. The tags use an absolute URL: set `VITE_SITE_URL` to your final address (default: the GitHub Pages one).
- **Refusals shown, with the reason.** On the "When" step every time the engine refuses is crossed out and labelled (Booked, Drive time, 3 of 3, Van loading), with a note in plain words ("Dario finishes his Southeast job at 1:30 PM; the drive means he can't be here before 1:50 PM."). `explainDay()` in `src/lib/engine.ts` produces it, and a test proves a time is offered exactly when the engine will book it. Wet days are blocked for outdoor cars; the review step says the $25 deposit is required ("No deposit, no slot").
- **The limits, shown as well as enforced.** On the "When" step a strip draws the chosen day: jobs already booked, the driving between them, the water refill before job three, and where the customer's time fits, with a plain sentence ("1 of 3 jobs already booked, so yours would be job 2. Dario finishes his Southeast job at 1:30 PM, then drives 10 min to you."). Days at the limit read "Full · 3 of 3". The chosen time shows its rain chance. All of it comes from `routeBlocks()`, the function that builds Dario's own day sheet. `src/lib/__tests__/booking-path.test.ts` books hundreds of offered times across weeks, vehicles, services and zones, proves a 4th job is refused, and proves the front page always has at least three dry openings.
- **Backstage stays backstage.** Demo controls appear on the Owner view; elsewhere they come up with Alt+D or `?demo=1`. The customer's path (landing, booking, confirmation) has none.
- **A guided story.** "Watch the 90-second story" on the landing page (or "Play the 90-second story" in Demo controls, or any link ending `?story=1`) narrates nine steps over the real app: the customer's text, the deposit, Dario's morning, a storm turning the app to its rain colours, customers moving themselves, the live van map, a running-late text, and the result. Each step runs the same actions as the Demo controls, so nothing is faked. Code: `src/lib/story.ts` (steps and state) and `src/components/Story.tsx` (the captioned panel).
- **Message to booking, end to end.** The landing-page box reads a text like "My dog wrecked my Outback. I'm in Sellwood. Friday morning?" and shows what it understood (vehicle, service, add-ons, place, day, urgency) as chips, then the real open times with drive time already counted. "Continue to booking" opens `/book` pre-filled (a zip is inferred from the neighbourhood and flagged as a guess), showing dry days first. "ASAP" and "urgent" jump to the earliest dry slots. Parser and link builder: `src/lib/inquiry.ts`.
- **Review and deposit.** Step 4 of `/book` ("Review & pay") lists service, vehicle, address, parking and its weather sensitivity, the time window and duration, and a price breakdown with the $25 deposit split from what's due on the day. It carries the promise "$25 deposit holds the slot. Fully refundable if we have to move you for rain." Code: `ReviewCard` in `src/pages/Book.tsx`.
- **Confirmation and customer portal.** `/b/<code>?new=1` is the confirmation; `/b/<code>` is the same page later: booking reference, "What happens next" (prep note, confirmation reminder, on-the-way text), Add to calendar (.ics, plus a Google Calendar link), Reschedule, Cancel, and a copyable portal link. Code: `src/pages/Manage.tsx`.
- **"Where's Bertha?" live van tracker.** A schematic map of Portland with the day's route on it and the van driving along it, computed from the very same route the scheduler validates, so it can't disagree with the calendar. Customers see it on their booking page ("2 jobs before yours", "On the way, about 12 min from you", "Detailing your car: 60% done"), and the "on the way" text links to it. Other customers' stops are drawn as anonymous pins, so nobody sees anyone else's name. Dario gets the same map on his day sheet, with a scrubber and a **Play the day** button that replays the whole day (rain included). It replaces the "where are you?" text.
- **Rain, made visible.** Every booking says whether the address is weather-sensitive (garage or carport: never moved; driveway or street: watched). At booking, on the confirmation and in the customer portal, an outdoor car on a rainy day is shown the next dry times and can switch in one tap. Forty-eight hours out, a forecast storm triggers an automatic offer, and the first dry option is taken if the customer doesn't reply. The promise on the deposit is real: **$25 holds the slot, and it is fully refundable if rain has changed the booking**, even inside 24 hours (`cancelJob` in `src/lib/ops.ts`).
- **Booking review and confirmation.** Before the deposit, a review card shows service, vehicle, address, parking type, exact time window, price and duration. After booking: the booking code, one-tap Add to calendar / Reschedule / Cancel, and a "What happens next" list (prep note, one-tap confirm, on-the-way text, rain watch).
- **Customer portal** at `/b/<code>` (the link in every text): one-tap confirm, one-tap nearest alternatives, reschedule, cancel, edit the gate code, live van map.
- **Owner's daily tool** (`/owner`): a **Needs you** queue where every item comes with a drafted reply (edit first, or send in one tap); exact headline numbers (messages you didn't write, hours saved, no-shows recovered in slots and dollars, revenue earned and booked ahead); **Weather moves this week**; a **Waitlist** card that offers a freed slot to the next person; and **Today's run**, the day in one strip with every drive time already calculated.
- **Running behind, in one tap.** Bertha is late? On "Today's run" Dario taps +10 / +20 / +30 min. Every customer still to come today gets a text with a recalculated arrival, their live map and ETA shift, and the on-the-way text moves with it. The booked slot itself never changes. Reports stack, are capped at two hours (past that it's kinder to call), and a customer's own move clears the delay.
- **Care plans for regulars.** At booking, "Keep it clean": repeat every 4, 6 or 8 weeks, 10% off every visit after the first, no deposit after the first. When a visit is finished the next one is booked automatically, on the same weekday and time if free, otherwise the nearest open slot within three days (`scheduleNextVisit` in `src/lib/ops.ts`). Customers can skip a visit (the plan carries on) or end the plan; Dario's ledger counts regulars and repeat visits booked for him.
- **Sealant cure rule.** Ceramic spray sealant needs about four dry hours to cure, so outdoors it is only offered on days under 40% rain (a normal wash moves at 70%). Wet days are greyed out with the reason; in a garage or carport any day works, and rain offers for these jobs use the stricter limit.
- **"Handled for you":** a weekly ledger of messages sent, bookings taken, reschedules and gaps refilled, with a transparent estimate of hours saved. Nothing is hidden: the "Needs you" list only shows what truly needs a human (for example a request for ceramic coating, which isn't on the menu).

## Run it

```bash
npm install
npm run dev        # http://localhost:8080
```

There is no backend to configure. The app runs on a seeded in-browser store, generated relative to today so it is alive whenever it is opened.

### Demo controls (bottom-right, on every page)

| Button | What happens |
|---|---|
| **Storm hits the busiest outdoor day** | Forecasts heavy rain on the day with the most outdoor jobs, fast-forwards to the 48-hour rain check, and sends the offers |
| **+6 hours** | Runs the clock forward. Reminders, nudges and releases happen in order |
| **Next job morning** | Jumps to 7:30 am on the next day with work |
| **Reset** | A fresh week |

### Tour (about two minutes)

1. `/` Type into "Ask the way you'd text a friend" (or tap an example). Tap one of the times.
2. Finish the booking (garage or driveway, pick a time, deposit). You land on the confirmation, with the queued automations.
3. `/owner` See your booking appear on the day sheet and the week, and the messages sent in Dario's name.
4. Open **Demo controls**, then **Storm hits...**. Open the **Messages sent** tab, filter to **Rain**, and open a customer's booking link to choose a dry day.
5. Press **+6 hours** a few times, or **Next job morning**, and watch unconfirmed bookings get nudged, released and offered to the waitlist.

## Deploy

The app is static, so any static host works.

- **GitHub Pages (included).** `.github/workflows/pages.yml` builds with `npm run build:pages` (relative paths, hash routing, so deep links and reloads work under `https://<owner>.github.io/<repo>/`) and publishes on every push to `main` or the working branch. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Pages on a private repository needs a paid GitHub plan, and the `github-pages` environment may only allow deployments from the default branch (Settings → Environments).
- **Vercel (config included).** `vercel.json` sets the Vite build and a rewrite so every route serves `index.html` (real paths like `/book` and `/b/FH-XXXX` work on reload). At vercel.com/new, import the GitHub repo and deploy the branch you want live; no environment variables are needed. Note that Vercel's production branch defaults to the repository's default branch.
- **Anywhere else.** `npm run build` (normal paths, needs a "serve index.html for every route" rule) or `npm run build:pages` (works from any folder).
- **Single-file page.** `npm run build:artifact` bundles everything into one HTML file, used for the hosted preview.

## Architecture

```
src/lib/business.ts     the business: services, zones, drive matrix, hours, policies
src/lib/engine.ts       the scheduling rules: checkDay, validate, findSlots, dryOptions, backfill
src/lib/ops.ts          state transitions: book, move, cancel, confirm, rain, waitlist
src/lib/automations.ts  the timeline of scheduled steps and the tick that runs them
src/lib/inquiry.ts      the front door: parse a message, build a reply and a prefilled link
src/lib/tracker.ts      where the van is at any minute of the day, and each customer's ETA
src/lib/ledger.ts       "handled for you" counts and time-saved estimates
src/lib/seed.ts         a believable week, generated relative to today
src/lib/store.ts        persisted store + demo clock
```

All rules are pure functions over a `State` object, so the same code that runs in the browser is what the tests exercise. Every place that changes a booking goes through `validate()`, so a slot the calendar shows is a slot the server would accept.

### What is simulated

Being honest about the boundary of the demo:

- **No text or email is sent.** Messages are composed and logged; production would send them through Twilio and Resend.
- **No card is charged.** The deposit is a state flag; production would use Stripe.
- **The forecast is illustrative** (a deterministic Portland-like pattern, stable per date). Production would read a real weather API at the 48-hour check.
- **Data lives in the visitor's browser** (`localStorage`). Production would move `State` into Postgres; the rules would move with it unchanged, and bookings would gain an exclusion constraint on time ranges.
- **Seeded customers reply on their own** ("C" to confirm, picking a rain option, claiming a waitlist offer) so that both sides of each flow are visible in a single demo.

## Colour

Every colour is tied to something real in Portland, and the palette reacts to the weather.

| Token | Where it comes from |
|---|---|
| Fern / primary | Douglas-fir needles on a wet morning |
| Paper | Unbleached shop-invoice paper |
| Sun amber | A rare dry-day sun (and, in rain, sodium streetlights on a wet road) |
| Rain | The Willamette under cloud |
| Pearl (`iris-1..4`: teal, azure, violet, Rose City rose) | Pearl paint and water beading on a freshly sealed panel |

- **Pearl sheen, used sparingly:** one gradient headline phrase, a thin bar under the header, the van's stripe, gradient hairlines on the ask box, the booking code and the owner's key tile, and soft glows behind the hero.
- **Weather-reactive palette.** When it's raining in Portland (today's forecast is wet, or the demo's storm is within two days), `<html data-weather="rain">` switches the CSS variables in `src/index.css`: the warm paper cools to overcast grey-blue, the fir goes to wet-asphalt petrol, rain streaks fall behind the hero, and the header shows the day's forecast. The amber stays. Pressing **Storm** in the demo controls flips the whole app, live.
- **Accessible by test.** `src/lib/__tests__/palette.test.ts` reads the real tokens and asserts WCAG contrast for every text and background pairing, and for the pearl text, in both moods. Playwright also runs axe audits in rain mode.

## Tests

```bash
npm test        # 75+ unit tests: drive/refill/day-limit rules, booking races, rain, waitlist, seed validity on 21 different "today"s
npm run e2e     # Playwright: full journeys and axe-core WCAG 2.1 AA audits, desktop + mobile
npm run lint    # tsc --noEmit
```

Unit tests cover, among others: a Westside job cannot start before 8:50, the third job needs the refill stop, a fourth job is refused, a slot taken mid-booking fails cleanly, moves are refused inside 24 hours, a cancelled slot is offered to a waitlisted customer and passed on after two hours, a storm moves outdoor jobs and never touches covered ones, and the seed is valid whichever day the app is opened.

## A bug worth remembering

CI caught a crash that only newer Chrome triggers: a route-change effect written as `useEffect(() => window.scrollTo(...))` returned whatever `scrollTo` returns. Newer browsers return a Promise, React tried to call it as a cleanup function on the next navigation, and the whole page went blank (right after every booking). Effects now use braces, and `e2e/journey.spec.ts` simulates the Promise-returning `scrollTo` so it can't come back.

## Accessibility

Native radios and checkboxes for every choice, labelled fields with inline errors, focus moved to each step's heading, a skip link, `aria-live` results, visible focus rings, reduced-motion respected, and an axe-core audit on every page and every booking step in CI.

---

Every person, address and phone number in the demo is fictional. *Built with [Lovable](https://lovable.dev).*
