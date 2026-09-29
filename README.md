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
- **"Where's Bertha?" live van tracker.** A schematic map of Portland with the day's route on it and the van driving along it, computed from the very same route the scheduler validates, so it can't disagree with the calendar. Customers see it on their booking page ("2 jobs before yours", "On the way, about 12 min from you", "Detailing your car: 60% done"), and the "on the way" text links to it. Other customers' stops are drawn as anonymous pins, so nobody sees anyone else's name. Dario gets the same map on his day sheet, with a scrubber and a **Play the day** button that replays the whole day (rain included). It replaces the "where are you?" text.
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
