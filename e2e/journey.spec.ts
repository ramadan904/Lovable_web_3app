import { expect, test, type Page } from "@playwright/test";
import { expectBooked, trackErrors } from "./helpers";

/** Book a Full Refresh for an SUV in a garage (so weather never interferes). */
/** The browser storage key of the demo state: bump it in src/lib/store.ts and here together. */
const STORE_KEY = "fernhill:demo:v4";
const TIME = /^\d{1,2}:\d{2} [AP]M$/;
/** Days that have open times, in the picker's order. */
const dayButtons = (page: Page) => page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /\d times?/ });

async function bookThroughUi(page: Page, name = "Test Driver", dayIndex = 0) {
  await page.goto("/book");
  await page.getByRole("radio", { name: /SUV or wagon/ }).locator("xpath=ancestor::label").click();
  await page.getByRole("radio", { name: /Full Refresh/ }).locator("xpath=ancestor::label").click();
  await page.getByRole("button", { name: /Continue/ }).click();

  await page.getByLabel("Zip code").fill("97212");
  await page.getByLabel("Street address").fill("3999 NE Test St");
  await page.getByRole("radio", { name: /^Garage/ }).locator("xpath=ancestor::label").click();
  await page.getByRole("button", { name: /Continue/ }).click();

  // Real availability: pick the first open time on the chosen day.
  if (dayIndex > 0) await dayButtons(page).nth(dayIndex).click();
  const firstTime = page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first();
  await firstTime.click();
  await expect(firstTime).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Continue/ }).click();

  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Mobile number").fill("(503) 555-0100");
  await page.getByLabel("Email").fill("driver@example.com");
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
}

/** Use a demo control. On phones the panel closes itself after each action, so open it on demand. */
async function demo(page: Page, name: RegExp) {
  const open = page.getByRole("button", { name: "Open demo controls" });
  const target = page.getByRole("button", { name });
  // The controls are backstage: on the owner's page they are always there; elsewhere Alt+D brings them up.
  await page.getByRole("banner").waitFor(); // the app has drawn (and is not mid-reload)
  if (!page.url().includes("/owner") && !(await open.isVisible()) && !(await target.isVisible())) await page.keyboard.press("Alt+D");
  await open.or(target).first().waitFor();
  if (await open.isVisible()) await open.click();
  await target.click();
}

test.beforeEach(async ({ page }) => {
  trackErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("a customer books end to end and Dario finds it on his sheet, having typed nothing", async ({ page }) => {
  // A later day, so the 24-hour reminder is part of the plan (inside 24 hours there is none).
  await bookThroughUi(page, "Test Driver", 1);
  await expect(page).toHaveURL(/\/b\/FH-[A-Z0-9]{4}\?new=1/);
  // The confirmation email is already in their thread and the automations are queued.
  await expect(page.getByText("Booking confirmation")).toBeVisible();
  await expect(page.getByText("Reminder with one-tap confirm")).toBeVisible();

  await page.goto("/owner");
  await page.getByRole("tab", { name: /Messages sent/ }).click();
  await expect(page.getByText(/3999 NE Test St/).first()).toBeVisible();
});

test("the front door turns a messy message into real times and a prefilled booking", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Ask the way you'd text/).fill("hey do u do subarus? filthy inside from my dog, need it before saturday, im in sellwood");
  await page.getByRole("button", { name: "Get real times" }).click();
  const reply = page.getByRole("status").filter({ hasText: "Fernhill replied instantly" });
  await expect(reply).toContainText("Southeast");
  await expect(reply).toContainText("Interior Reset");
  await expect(reply).toContainText("pet hair removal");
  await reply.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/book\?.*v=suv.*s=interior.*a=pet/);
  // Vehicle and service are already chosen, so it starts at "Where".
  await expect(page.getByRole("heading", { name: "Where do we find you?" })).toBeVisible();
});

test("a customer moves and then cancels on their own; a waitlisted neighbour is offered the slot", async ({ page }) => {
  await bookThroughUi(page, "Move Me", 1);
  await page.locator("#change").getByRole("button", { name: "Pick another time" }).click();
  await dayButtons(page).nth(3).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).nth(1).click();
  await page.getByRole("button", { name: /^Move to/ }).click();
  await expect(page.getByText("Moved by customer")).toBeVisible();

  await page.locator("#change").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Cancellation")).toBeVisible();
});

test("a storm moves outdoor customers to dry days without Dario", async ({ page }) => {
  await page.goto("/owner");
  await demo(page, /Storm hits the busiest outdoor day/);
  await expect(page.getByText(/Heavy rain forecast for/)).toBeVisible();
  await page.getByRole("tab", { name: /Messages sent/ }).click();
  await page.getByRole("button", { name: "Rain", exact: true }).click();
  await expect(page.getByText("Rain offer").first()).toBeVisible();

  // Time passes: customers pick dry options, or the first one is taken for them.
  await demo(page, /\+6 hours/);
  await demo(page, /\+6 hours/);
  await expect(page.getByText("Moved for rain").first()).toBeVisible();
});

test("an unconfirmed booking is nudged, then released to the waitlist", async ({ page }) => {
  await bookThroughUi(page, "Ghost Customer", 2);
  // Never answer the reminders. Advance job-day by job-day until this booking's day arrives.
  const released = page.getByText("Released", { exact: true });
  for (let i = 0; i < 16 && !(await released.isVisible()); i++) {
    await demo(page, /Next job morning/);
    await page.waitForTimeout(100);
  }
  await expect(released).toBeVisible();
  await expect(page.getByText("Slot released")).toBeVisible();
  await expect(page.getByText("Second nudge")).toBeVisible();
});

test("the calendar never offers a time that breaks the drive rules", async ({ page }) => {
  // A Westside job needs 35 min of driving before the first job: nothing at 8:00 or 8:30.
  await page.goto("/book?v=sedan&s=express&zip=97005&p=garage");
  await page.getByLabel("Street address").fill("1 Test Rd");
  await page.getByRole("button", { name: /Continue/ }).click();
  const times: string[] = [];
  const days = await dayButtons(page).count();
  for (let i = 0; i < Math.min(days, 6); i++) {
    await dayButtons(page).nth(i).click();
    times.push(...(await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).allTextContents()));
  }
  expect(times.length).toBeGreaterThan(10);
  expect(times).not.toContain("8:00 AM");
  expect(times).not.toContain("8:30 AM");
});

test.describe("Where's Bertha?", () => {
  const FIRST_NAMES = /Maya|Jordan|Sam\b|Renata|Ben\b|Lila|Marcus|Hannah|Owen/;

  test("Dario can scrub and play back his whole day on the map", async ({ page }) => {
    await page.goto("/owner");
    const map = page.getByRole("region", { name: "Where's Bertha?" });
    await expect(map).toBeVisible();
    const scrub = map.getByRole("slider", { name: /Scrub through the day/ });
    await scrub.fill("560"); // 9:20 am
    await expect(map.getByText(/Bertha is (driving|detailing|setting up|loading|at the base)/).first()).toBeVisible();
    const chip = map.getByText(/Preview of the day|Replay|Live/).first();
    const before = await chip.textContent();
    await map.getByRole("button", { name: "Play the day" }).click();
    await expect(async () => expect(await chip.textContent()).not.toBe(before)).toPass({ timeout: 5000 });
    await map.getByRole("button", { name: "Pause" }).click();
  });

  test("a customer sees their own stop and ETA, and no other customer's name", async ({ page }) => {
    await bookThroughUi(page, "Privacy Pat", 1);
    const map = page.getByRole("region", { name: "Where's Bertha?" });
    await expect(map).toBeVisible();
    await expect(map.getByText(/job before yours|jobs before yours|You're next|starts the day at 8:00|On the way|arrived|Detailing/).first()).toBeVisible();
    const drawn = (await map.locator("svg[role=img] text").allTextContents()).join(" ");
    expect(drawn).toContain("You");
    expect(drawn).not.toMatch(FIRST_NAMES);
    expect(await map.locator("svg[role=img]").getAttribute("aria-label")).not.toMatch(FIRST_NAMES);
    // Their own ETA follows the scrubber: at 8:00 nothing has started.
    await map.getByRole("slider").fill("470");
    await expect(map.getByText(/Bertha is (loading|at the base)/).first()).toBeVisible();
  });

  test("on the morning of the job the map is live and follows the demo clock", async ({ page }) => {
    await bookThroughUi(page, "Live Larry", 1);
    // Like a real customer: confirm when the reminder arrives, while the day approaches in 6-hour steps.
    const live = page.getByText(/Live · /);
    const confirm = page.getByRole("button", { name: /Yes, I'll be there/ });
    for (let i = 0; i < 30 && !(await live.isVisible()); i++) {
      if (await confirm.isVisible()) await confirm.click();
      await demo(page, /\+6 hours/);
    }
    await expect(live).toBeVisible();
  });
});

test("every fast-forward click moves the demo clock on screen straight away", async ({ page }) => {
  await page.goto("/owner");
  const read = async () => {
    const open = page.getByRole("button", { name: "Open demo controls" });
    const panel = page.getByRole("region", { name: "Demo controls" });
    await open.or(panel).first().waitFor();
    if (await open.isVisible()) await open.click();
    return (await page.getByRole("region", { name: "Demo controls" }).getByText(/It's \w{3} \d/).textContent()) ?? "";
  };
  const seen = new Set<string>([await read()]);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /\+6 hours/ }).click();
    await expect(async () => expect(seen.has(await read())).toBe(false)).toPass({ timeout: 3000 });
    seen.add(await read());
  }
  expect(seen.size).toBe(4);
});

test("a neighbour deal shows on the calendar, comes off the price, and follows the booking", async ({ page }) => {
  await page.goto("/book?v=sedan&s=express&zip=97202&p=garage");
  await page.getByLabel("Street address").fill("1 Deal St");
  await page.getByRole("button", { name: /Continue/ }).click();

  // Look through the days for a slot next to another Southeast job.
  const dealChip = page.locator("fieldset button[aria-pressed]").filter({ hasText: /−\$\d+/ });
  const days = dayButtons(page);
  const n = await days.count();
  let found = false;
  for (let i = 0; i < n && !found; i++) {
    await days.nth(i).click();
    if ((await dealChip.count()) > 0) found = true;
  }
  expect(found, "some day has a neighbour-deal slot").toBe(true);
  await expect(page.getByText("Neighbour deal.")).toBeVisible();

  const chip = dealChip.first();
  const label = (await chip.getAttribute("aria-label")) ?? "";
  const off = Number(label.match(/\$(\d+) off/)?.[1]);
  await chip.click();
  const summary = page.getByRole("complementary", { name: "Your booking" });
  await expect(summary.getByText("Neighbour deal")).toBeVisible();
  await expect(summary.getByText(`−$${off}`)).toBeVisible();
  await expect(summary.getByText(`$${85 - off}`, { exact: true })).toBeVisible(); // express sedan is $85

  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Your name").fill("Deal Dana");
  await page.getByLabel("Mobile number").fill("(503) 555-0100");
  await page.getByLabel("Email").fill("dana@example.com");
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
  await expect(page.getByText(`−$${off} neighbour deal`)).toBeVisible();
});

test("in-app navigation survives browsers whose scrollTo() returns a Promise", async ({ page }) => {
  // Newer Chrome does this; an effect that returned it made React crash on the next navigation.
  await page.addInitScript(() => {
    const original = window.scrollTo.bind(window);
    (window as unknown as { scrollTo: (...a: unknown[]) => Promise<void> }).scrollTo = (...a: unknown[]) => {
      (original as (...b: unknown[]) => void)(...a);
      return Promise.resolve();
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: /Owner view/ }).first().click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Dario/ })).toBeVisible();
  await page.getByRole("link", { name: /Book a detail/ }).first().click();
  await expect(page.getByRole("heading", { name: /Real times/ })).toBeVisible();
  await page.getByRole("link", { name: "Fernhill Mobile Detail, home" }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
});


/** Book a garage job so weather never interferes, stopping at the review step. */
async function toReview(page: Page, query = "v=sedan&s=express&zip=97212&p=garage", dayIndex = 1) {
  await page.goto(`/book?${query}`);
  await page.getByLabel("Street address").fill("1 Review St");
  await page.getByRole("button", { name: /Continue/ }).click();
  await dayButtons(page).nth(dayIndex).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
}

test.describe("Booking review and the rain promise", () => {
  test("the last step shows a full review, the deposit promise, and says the garage is not weather-sensitive", async ({ page }) => {
    await toReview(page);
    const review = page.getByRole("region", { name: "Review your booking" });
    await expect(review).toBeVisible();
    for (const label of ["Service", "Vehicle", "Where", "Parking", "Time window"]) await expect(review.getByText(label, { exact: true })).toBeVisible();
    await expect(review.getByRole("group", { name: "Price breakdown" })).toBeVisible();
    await expect(review.getByText(/covered, not weather-sensitive/)).toBeVisible();
    await expect(review.getByText(/to about \d{1,2}:\d{2} [AP]M/)).toBeVisible();
    await expect(page.getByText("$25 deposit holds the slot. Fully refundable if we have to move you for rain.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Weather status" })).toContainText("Not weather-sensitive");
  });

  test("an outdoor car on a rainy day is shown dry alternatives, switchable in one tap", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&zip=97212&p=driveway");
    await page.getByLabel("Street address").fill("1 Rain St");
    await page.getByRole("button", { name: /Continue/ }).click();
    // Wet days are blocked for an outdoor car by default; this customer chooses to see them anyway.
    await page.getByRole("checkbox", { name: /Dry days only/ }).uncheck();
    // Find a day forecast wet (the tile is announced "Rain likely") that still has times.
    const wetDay = page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /Rain likely/ });
    test.skip((await wetDay.count()) === 0, "no rainy day with open times in this three-week window");
    await wetDay.first().click();
    await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
    const before = await page.getByRole("complementary", { name: "Your booking" }).textContent();
    await page.getByRole("button", { name: /Continue/ }).click();
    const weather = page.getByRole("region", { name: "Weather status" });
    await expect(weather).toContainText("Weather-sensitive");
    await expect(weather).toContainText(/Rain is likely on/);
    const alt = weather.getByRole("button", { name: /^Switch to / });
    await expect(alt.first()).toBeVisible();
    expect(await alt.count()).toBeLessThanOrEqual(3);
    await alt.first().click();
    await expect(page.getByRole("region", { name: "Review your booking" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Your booking" })).not.toHaveText(before ?? "");
  });
});

test.describe("Confirmation and the customer portal", () => {
  test("the confirmation shows the code, what happens next, and one-tap reschedule and cancel", async ({ page }) => {
    await bookThroughUi(page, "Portal Pat", 1);
    await expect(page.getByText("Booking code", { exact: true })).toBeVisible();
    await expect(page.getByText(/^FH-[A-Z0-9]{4}$/).first()).toBeVisible();
    const next = page.getByRole("region", { name: "What happens next" });
    await expect(next).toContainText("Prep note");
    await expect(next).toContainText(/48 hours|Prep note (Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
    await expect(next).toContainText("Confirmation reminder");
    await expect(next).toContainText("On-the-way text");
    await expect(next).toContainText("Rain watch");
    await expect(page.getByRole("region", { name: "Weather status" })).toContainText("Not weather-sensitive");
    // Reschedule opens the picker; Cancel opens the refund prompt. Both from the banner.
    await page.getByRole("button", { name: "Reschedule", exact: true }).click();
    await expect(page.locator("#change").getByText("Pick a day")).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    await expect(page.getByText(/deposit is refunded/)).toBeVisible();
  });

  test("the portal offers one-tap alternatives and confirms with one tap after the reminder", async ({ page }) => {
    await bookThroughUi(page, "Tap Tessa", 2);
    const alts = page.getByRole("list", { name: "One-tap alternatives" });
    await expect(alts.getByRole("button").first()).toBeVisible();
    await alts.getByRole("button").first().click();
    await expect(page.getByText("Moved by customer")).toBeVisible();
    // Let the reminder fire, then confirm in one tap.
    // Moving to a nearer slot can land inside 24 hours, which is confirmed on the spot; otherwise the
    // reminder arrives and one tap confirms.
    const confirm = page.getByRole("button", { name: /Yes, I'll be there/ });
    const confirmed = page.locator("span.chip", { hasText: /^Confirmed$/ });
    for (let i = 0; i < 20 && !(await confirm.isVisible()) && !(await confirmed.isVisible()); i++) await demo(page, /\+6 hours/);
    if (await confirm.isVisible()) await confirm.click();
    await expect(confirmed.first()).toBeVisible();
  });
});

test.describe("The owner's daily tool", () => {
  test("Needs you comes with a drafted reply that sends in one tap", async ({ page }) => {
    await page.goto("/owner");
    const needs = page.getByRole("region", { name: /Needs you/ });
    await expect(needs).toBeVisible();
    await expect(needs.getByText("Drafted reply").first()).toBeVisible();
    await expect(needs).toContainText(/ceramic coating/i);
    await needs.getByRole("button", { name: "Send this reply" }).first().click();
    await expect(page.getByRole("region", { name: /Needs you/ })).toHaveCount(0);
    await page.getByRole("tab", { name: /Messages sent/ }).click();
    await expect(page.getByText("Reply from Dario").first()).toBeVisible();
  });

  test("the metrics panel shows exact numbers for messages, hours, recovered no-shows and revenue", async ({ page }) => {
    await page.goto("/owner");
    const panel = page.getByRole("region", { name: "Handled for you this week" });
    for (const label of ["Messages you didn't have to write", "Hours saved", "No-shows recovered", "Revenue this week"]) {
      await expect(panel.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(panel).toContainText(/\$[\d,]+ rescued from the waitlist/);
    await expect(panel).toContainText(/booked over the next 7 days/);
  });

  test("Today's run shows the drives between jobs, and weather moves and the waitlist are on the page", async ({ page }) => {
    await page.goto("/owner");
    const run = page.getByRole("region", { name: /Today's run|Run for/ });
    await expect(run).toBeVisible();
    await expect(run).toContainText(/min driving in total/);
    await expect(run.getByRole("list", { name: "Stops and drives in order" }).getByText(/min to /).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Weather moves this week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waitlist", exact: true }).first()).toBeVisible();
  });

  test("a cancellation is offered to the waitlist and shows on the page", async ({ page }) => {
    await page.goto("/owner");
    await page.getByRole("button", { name: /Try it: a customer cancels/ }).click();
    await expect(page.getByText("Offer out").first()).toBeVisible();
  });

  test("a storm shows up under Weather moves, and the demo can skip to the end of the day", async ({ page }) => {
    await page.goto("/owner");
    await demo(page, /Storm hits the busiest outdoor day/);
    await expect(page.getByText(/waiting on a reply|moved for rain/).first()).toBeVisible();
    await demo(page, /\+1 hour/);
    await demo(page, /End of day/);
    await expect(page.getByText(/Jumped to 5:30 pm/)).toBeVisible();
  });
});

test("cancelling after rain has changed the booking is a full refund, even inside 24 hours", async ({ page }) => {
  await page.goto("/book?v=sedan&s=express&zip=97212&p=driveway");
  await page.getByLabel("Street address").fill("1 Refund St");
  await page.getByRole("button", { name: /Continue/ }).click();
  // The nearest dry day: wet days are blocked for an outdoor car, and the storm below is forced onto this one.
  await dayButtons(page).nth(0).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Your name").fill("Refund Rae");
  await page.getByLabel("Mobile number").fill("(503) 555-0100");
  await page.getByLabel("Email").fill("rae@example.com");
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
  const url = page.url();
  // A storm on her day, then time passes to well inside 24 hours (she never picks a dry option).
  const start = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    const j = s.jobs.find((x: { customer: { name: string } }) => x.customer.name === "Refund Rae");
    return j.startMs as number;
  }, STORE_KEY);
  await page.evaluate(([ms, key]) => {
    const s = JSON.parse(localStorage.getItem(key as string)!);
    const d = new Date(ms as number).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    s.stormDays = [d];
    localStorage.setItem(key as string, JSON.stringify(s));
  }, [start, STORE_KEY] as const);
  await page.goto(url.split("?")[0]);
  await page.evaluate(() => window.location.reload());
  for (let i = 0; i < 24; i++) {
    if (await page.getByRole("heading", { name: /Rain is forecast for your day/ }).isVisible()) break;
    await demo(page, /\+6 hours/);
  }
  await expect(page.getByRole("heading", { name: /Rain is forecast for your day/ })).toBeVisible();
  await page.locator("#change").getByRole("button", { name: /Cancel/ }).first().click();
  await expect(page.getByText(/refunded/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/deposit is on its way back in full/)).toBeVisible();
});

test("the app changes colour with the weather: a storm turns it to the rain palette, with rain in the header", async ({ page }) => {
  await page.goto("/owner");
  await demo(page, /Storm hits the busiest outdoor day/);
  await expect(page.locator("html")).toHaveAttribute("data-weather", "rain");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Rain paper is a cool grey-blue: blue channel above red.
  const [r, , b] = (bg.match(/\d+/g) ?? []).map(Number);
  expect(b).toBeGreaterThan(r);
  await expect(page.getByLabel("Weather in Portland")).toContainText(/Heavy rain/);
  // The pearl sheen is there in both moods: one gradient headline word on the landing page.
  await page.goto("/");
  await expect(page.locator(".iris-text").first()).toBeVisible();
});

test.describe("Running behind", () => {
  test("one tap on Today's run texts every customer still to come, and the day's arrivals shift", async ({ page }) => {
    await page.goto("/owner");
    await demo(page, /Next job morning/);
    const run = page.getByRole("region", { name: /Today's run|Run for/ });
    const group = run.getByRole("group", { name: "Running behind" });
    await expect(group).toBeVisible();
    await group.getByRole("button", { name: "+20 min" }).click();
    await expect(page.getByText(/told: running 20 min behind/)).toBeVisible();
    await expect(group).toContainText("Running about 20 min behind");
    await page.getByRole("tab", { name: /Messages sent/ }).click();
    await expect(page.getByText("Running late").first()).toBeVisible();
    await expect(page.getByText(/running about 20 min behind today/).first()).toBeVisible();
  });

  test("the customer sees the new arrival on their booking page, and their live ETA shifts", async ({ page }) => {
    await page.goto("/owner");
    await demo(page, /Dario runs 20 min behind/);
    await expect(page.getByText(/told: running 20 min behind/)).toBeVisible();
    const code = await page.evaluate((key) => {
      const s = JSON.parse(localStorage.getItem(key)!);
      return s.jobs.find((j: { delayMin: number; status: string }) => j.delayMin > 0 && ["booked", "confirmed"].includes(j.status)).code as string;
    }, STORE_KEY);
    await page.goto(`/b/${code}`);
    const notice = page.getByRole("status", { name: "Running late" });
    await expect(notice).toContainText(/running about 20 min behind today/);
    await expect(notice).toContainText(/around/);
  });
});

test.describe("Care plans", () => {
  test("choosing a plan at booking shows it in the review and gives the customer a plan card they can end", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&zip=97212&p=garage");
    await page.getByLabel("Street address").fill("1 Plan St");
    await page.getByRole("button", { name: /Continue/ }).click();
    await dayButtons(page).nth(1).click();
    await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("radio", { name: /Every 6 weeks/ }).locator("xpath=ancestor::label").click();
    const review = page.getByRole("region", { name: "Review your booking" });
    await expect(review.getByText("Care plan", { exact: true })).toBeVisible();
    await expect(review).toContainText(/Every 6 weeks/);
    await page.getByLabel("Your name").fill("Plan Priya");
    await page.getByLabel("Mobile number").fill("(503) 555-0100");
    await page.getByLabel("Email").fill("priya@example.com");
    await page.getByRole("button", { name: /Book it/ }).click();
    await expectBooked(page);
    await expect(page.getByRole("region", { name: "What happens next" })).toContainText("Care plan");
    await expect(page.getByRole("heading", { name: /Your care plan: every 6 weeks/ })).toBeVisible();
    await page.getByRole("button", { name: "End my plan" }).click();
    await expect(page.getByRole("heading", { name: /Your care plan/ })).toHaveCount(0);
  });

  test("the owner sees regulars on a plan and repeat visits booked for them", async ({ page }) => {
    await page.goto("/owner");
    const panel = page.getByRole("region", { name: "Handled for you this week" });
    await expect(panel).toContainText(/regulars on a care plan/);
    await expect(panel).toContainText(/repeat visits? booked this week/);
  });
});

test.describe("Ceramic sealant needs a dry day to cure", () => {
  test("outdoors, the calendar explains it and greys out wet days; in a garage there's no restriction", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&a=sealant&zip=97212&p=driveway");
    await page.getByLabel("Street address").fill("1 Cure St");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText(/needs about four dry hours to cure/)).toBeVisible();
    const wet = page.locator("fieldset button[aria-pressed][disabled]").filter({ hasText: /Needs dry/ });
    test.skip((await wet.count()) === 0, "no 40%+ rain day in this three-week window");
    await expect(wet.first()).toBeDisabled();

    await page.goto("/book?v=sedan&s=express&a=sealant&zip=97212&p=garage");
    await page.getByLabel("Street address").fill("1 Cure St");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText(/needs about four dry hours to cure/)).toHaveCount(0);
    await expect(page.locator("fieldset button[aria-pressed][disabled]").filter({ hasText: /Needs dry/ })).toHaveCount(0);
  });
});


test.describe("Natural language to a confirmed booking", () => {
  const ASK = "My dog wrecked my Outback. I'm in Sellwood. Friday morning?";

  test("your example becomes a filled-in booking with real dry times, carried all the way to the confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Ask the way you'd text/).fill(ASK);
    await page.getByRole("button", { name: "Get real times" }).click();

    // What we understood, in plain words.
    const understood = page.getByRole("list", { name: "What we understood" }).first();
    for (const chip of ["SUV or wagon", "Interior Reset", "Pet hair removal", "Sellwood (Southeast)", "Friday morning"]) await expect(understood).toContainText(chip);
    await expect(page.getByText(/dry-forecast, drive time already counted/)).toBeVisible();
    await page.getByRole("link", { name: /Continue to booking/ }).click();

    // The form is already filled in: car, service, add-on, and a zip for Sellwood.
    await expect(page.getByRole("region", { name: "What we read from your message" })).toContainText(ASK);
    await expect(page.getByRole("heading", { name: "Where do we find you?" })).toBeVisible();
    await expect(page.getByLabel("Zip code")).toHaveValue("97202");
    await expect(page.getByText(/We used .*97202.* for Sellwood/)).toBeVisible();
    await page.getByLabel("Street address").fill("1 Umatilla St");
    await page.getByRole("radio", { name: /^Driveway/ }).locator("xpath=ancestor::label").click();
    await page.getByRole("button", { name: /Continue/ }).click();

    // Only dry days are shown, with the slot they were offered already chosen or one tap away.
    await expect(page.getByRole("checkbox", { name: /Dry days only/ })).toBeChecked();
    const rainy = page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /Rain likely/ });
    await expect(rainy).toHaveCount(0);
    // A neighbour-deal time also carries its discount ("2:00 PM −$10"), so match on the start of the label.
    const time = page.locator("fieldset button[aria-pressed]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M/ }).first();
    await time.click();
    await page.getByRole("button", { name: /Continue/ }).click();

    // Review & pay: a clear breakdown, the deposit broken out, the exact promise.
    await expect(page.getByRole("heading", { name: "Review and pay the deposit" })).toBeVisible();
    const review = page.getByRole("region", { name: "Review your booking" });
    await expect(review).toContainText("Interior Reset");
    await expect(review).toContainText(/Pet hair removal/);
    await expect(review).toContainText(/Driveway · outdoors, weather-sensitive/);
    await expect(review).toContainText(/to about \d{1,2}:\d{2} [AP]M/);
    const price = review.getByRole("group", { name: "Price breakdown" });
    await expect(price.getByText("Total", { exact: true })).toBeVisible();
    await expect(price).toContainText("Due now");
    await expect(price).toContainText("$25");
    await expect(price).toContainText("Due on the day");
    await expect(page.getByText("$25 deposit holds the slot. Fully refundable if we have to move you for rain.")).toBeVisible();
    await page.getByLabel("Your name").fill("Nat Lang");
    await page.getByLabel("Mobile number").fill("(503) 555-0100");
    await page.getByLabel("Email").fill("nat@example.com");
    await page.getByRole("button", { name: /Book it/ }).click();

    // Confirmation: reference, what happens next, one-tap actions, and a link to come back to.
    await expectBooked(page);
    await expect(page.getByText("Booking code", { exact: true })).toBeVisible();
    const banner = page.getByRole("region", { name: "Your booking page" });
    // The link is a real address for wherever the app is hosted, so pasting it into a browser opens the booking.
    const code = new URL(page.url()).pathname.match(/\/b\/(FH-[A-Z0-9]{4})/)![1];
    await expect(banner).toContainText(`${new URL(page.url()).origin}/b/${code}`);
    await expect(banner.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Add to calendar|Google Calendar/ }).first()).toHaveAttribute("href", /calendar\.google\.com\/calendar\/render/);
    await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "What happens next" })).toContainText("Confirmation reminder");
  });

  test("a message we can't read says so instead of guessing, and offers a way forward", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Ask the way you'd text/).fill("hi");
    await page.getByRole("button", { name: "Get real times" }).click();
    await expect(page.getByText(/couldn't spot a vehicle, a place or a day/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue/ })).toBeVisible();
  });

  test("urgent requests get the earliest dry times", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Ask the way you'd text/).fill("need my truck washed ASAP, muddy, Beaverton");
    await page.getByRole("button", { name: "Get real times" }).click();
    await expect(page.getByRole("list", { name: "What we understood" }).first()).toContainText("Urgent: earliest dry slots");
    await expect(page.getByText(/Earliest dry times/)).toBeVisible();
  });
});

test.describe("The guided story", () => {
  test("plays from the landing page through the storm to the end, and hands the visitor a fresh week", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "Watch the 90-second story" }).click();
    const panel = page.getByRole("region", { name: "Guided story" });
    await expect(panel).toContainText("Meet Dario");
    await expect(panel).toContainText("1 of 9");

    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("A customer texts once");
    await expect(page).toHaveURL(/\/book\?.*src=ask/);
    await expect(page.getByRole("region", { name: "What we read from your message" })).toBeVisible();

    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("A deposit that feels safe");
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/owner/);
    await expect(page.getByRole("heading", { name: "Handled for you this week" })).toBeVisible();

    // The storm: the whole app turns to its rain colours.
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText(/Heavy rain is forecast for/);
    await expect(page.locator("html")).toHaveAttribute("data-weather", "rain");

    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Customers move themselves");

    // The customer's live view of the van, then Bertha running late.
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Where's Bertha?");
    await expect(page).toHaveURL(/\/b\/FH-[A-Z0-9]{4}/);
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Running 20 minutes behind");
    await expect(page.getByRole("status", { name: "Running late" })).toBeVisible();

    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Hours of admin, gone");
    await expect(panel.getByRole("button", { name: "Next" })).toHaveCount(0);
    await panel.getByRole("button", { name: /Try it yourself/ }).click();
    await expect(page).toHaveURL(/\/book/);
    await expect(panel).toHaveCount(0);
    // A fresh week: the forced storm is gone (the ordinary forecast for today may still be wet).
    const storms = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stormDays.length as number, STORE_KEY);
    expect(storms).toBe(0);
    expect(errors).toEqual([]);
  });

  test("a shared /?story=1 link starts it, and Escape closes it", async ({ page }) => {
    await page.goto("/?story=1");
    const panel = page.getByRole("region", { name: "Guided story" });
    await expect(panel).toContainText("Meet Dario");
    await panel.getByRole("button", { name: "Auto-play" }).click();
    await expect(panel.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

  test("the panel fits a phone, and closing it leaves the owner's demo controls reachable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Watch the 90-second story" }).click();
    const panel = page.getByRole("region", { name: "Guided story" });
    const box = await panel.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    await panel.getByRole("button", { name: "Close the story" }).click();
    await expect(panel).toHaveCount(0);
    await page.goto("/owner");
    await expect(page.getByRole("button", { name: "Open demo controls" })).toBeVisible(); // backstage, where it belongs
  });
});

test.describe("Resilience and the live forecast", () => {
  /** A forecast reply that says heavy rain every day around now. */
  const openMeteo = (rain: number) => {
    const days: string[] = [];
    for (let i = -2; i < 17; i++) days.push(new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10));
    return { daily: { time: days, precipitation_probability_max: days.map(() => rain), temperature_2m_max: days.map(() => 52) } };
  };

  test("the live forecast can be switched on (real rain chances flow through) and off again", async ({ page }) => {
    await page.route("**/api.open-meteo.com/**", (route) => route.fulfill({ json: openMeteo(91) }));
    await page.goto("/?demo=1");
    const open = page.getByRole("button", { name: "Open demo controls" });
    if (await open.isVisible()) await open.click();
    await expect(page.getByText(/Off: a steady demo forecast/)).toBeVisible();
    await page.getByRole("button", { name: "Use the live Portland forecast" }).click();
    await expect(page.getByText(/Real rain chances from Open-Meteo for the next \d+ days/)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-weather", "rain"); // 91% today: the whole app is in its rain mood
    await page.getByRole("button", { name: "Using the live Portland forecast" }).click();
    await expect(page.getByText(/Off: a steady demo forecast/)).toBeVisible();
  });

  test("if the forecast service is unreachable, the demo carries on and says why", async ({ page }) => {
    await page.route("**/api.open-meteo.com/**", (route) => route.abort());
    await page.goto("/?demo=1");
    const open = page.getByRole("button", { name: "Open demo controls" });
    if (await open.isVisible()) await open.click();
    await page.getByRole("button", { name: "Use the live Portland forecast" }).click();
    await expect(page.getByText(/Couldn't reach the forecast service/)).toBeVisible();
    await page.goto("/book");
    await expect(page.getByRole("heading", { name: "Real times. Rain handled. No texting back and forth." })).toBeVisible();
  });

  test("damaged saved data is dropped quietly, and a real crash shows a way back rather than a blank page", async ({ page }) => {
    // Saved data that isn't the right shape: reseeded without a fuss.
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ v: 1, seededAt: Date.now(), clockOffsetMs: 0, jobs: "oops" })), STORE_KEY);
    await page.goto("/owner");
    await expect(page.getByRole("heading", { name: "Handled for you this week" })).toBeVisible();

    // Data that looks right but is missing a customer: the page can't draw it, so the boundary catches it.
    await page.evaluate((key) => {
      const s = JSON.parse(localStorage.getItem(key)!);
      delete s.jobs[0].customer;
      localStorage.setItem(key, JSON.stringify(s));
    }, STORE_KEY);
    page.on("pageerror", () => {});
    await page.goto("/owner");
    await expect(page.getByRole("heading", { name: "Bertha hit a pothole" })).toBeVisible();
    await page.getByRole("button", { name: "Start a fresh week" }).click();
    await expect(page.getByRole("heading", { name: "Handled for you this week" })).toBeVisible();
  });
});

test.describe("The customer's path has no backstage chrome", () => {
  const demoButton = (page: Page) => page.getByRole("button", { name: "Open demo controls" });

  test("no demo controls on the way to a booking or on the confirmation; they live on the owner's page, or come up on request", async ({ page }) => {
    for (const path of ["/", "/book"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(demoButton(page)).toHaveCount(0);
    }
    await bookThroughUi(page, "Path Tester");
    await expect(demoButton(page)).toHaveCount(0); // not even on the confirmation
    await page.goto("/owner");
    await expect(demoButton(page)).toBeVisible();

    await page.goto("/");
    await page.keyboard.press("Alt+D");
    await expect(demoButton(page)).toBeVisible();
    await page.keyboard.press("Alt+D");
    await expect(demoButton(page)).toHaveCount(0);
    await page.goto("/?demo=1");
    await expect(demoButton(page)).toBeVisible();
    await page.goto("/?demo=0");
    await expect(demoButton(page)).toHaveCount(0);
  });
});

test.describe("A booking that works first time, and shows its working", () => {
  const ASK = "My dog wrecked my Outback. I'm in Sellwood. Friday morning?";

  test("the text box is on screen without scrolling", async ({ page }) => {
    await page.goto("/");
    const box = await page.getByLabel(/Ask the way you'd text/).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  });

  test("the time offered from the text box is still chosen after the address, and the day's working is on show", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Ask the way you'd text/).fill(ASK);
    await page.getByRole("button", { name: "Get real times" }).click();
    await page.getByRole("link", { name: /Continue to booking/ }).click();
    await page.getByLabel("Street address").fill("1 Umatilla St");
    await page.getByRole("radio", { name: /^Driveway/ }).locator("xpath=ancestor::label").click();
    await page.getByRole("button", { name: /Continue/ }).click();

    // Their time survived choosing where the car is parked: it is highlighted, with its rain chance beside it.
    const picked = page.locator("fieldset button[aria-pressed=true]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M/ });
    await expect(picked).toHaveCount(1);
    await expect(page.getByText(/You picked .* at \d{1,2}:\d{2} [AP]M: \d+% chance of rain/)).toBeVisible();

    // The limits are visible: how many jobs that day, the drive, and what "Full" means.
    const fit = page.getByRole("figure", { name: "How this day fits together" });
    await expect(fit).toContainText(/\d of 3 jobs already booked, so yours would be job \d/);
    await expect(fit).toContainText(/drives \d+ min/);
    await expect(page.getByText(/means Dario already has 3 jobs that day/)).toBeVisible();
    const full = page.locator("fieldset button[aria-pressed]:disabled").filter({ hasText: /Full/ }).first();
    await expect(full).toBeDisabled();

    // Straight on to the review with nothing lost.
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Review and pay the deposit" })).toBeVisible();
  });

  test("the confirmation reads like a final receipt, and the owner's cards show the deposit", async ({ page }) => {
    await bookThroughUi(page, "Receipt Reader");
    const glance = page.getByRole("list", { name: "Your booking at a glance" }).or(page.getByLabel("Your booking at a glance"));
    await expect(glance).toContainText("3999 NE Test St");
    await expect(glance).toContainText("Paid");
    await expect(glance).toContainText(/\$25/);
    await expect(glance).toContainText(/due after the job/);
    await expect(glance).toContainText("Covered: rain can't move you");
    await page.goto("/owner");
    await expect(page.getByText(/\$25 deposit paid/).first()).toBeVisible();
  });

  test("the whole path, from the first sentence to a confirmation, is quick and never stalls", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/");
    await page.getByLabel(/Ask the way you'd text/).fill(ASK);
    await page.getByRole("button", { name: "Get real times" }).click();
    await page.getByRole("link", { name: /Continue to booking/ }).click();
    await page.getByLabel("Street address").fill("1 Umatilla St");
    await page.getByRole("radio", { name: /^Garage/ }).locator("xpath=ancestor::label").click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click(); // their time is already chosen
    await page.getByLabel("Your name").fill("Quick Quinn");
    await page.getByLabel("Mobile number").fill("(503) 555-0100");
    await page.getByLabel("Email").fill("q@example.com");
    await page.getByRole("button", { name: /Book it/ }).click();
    await expectBooked(page);
    expect(Date.now() - t0, "a full booking from the text box should take a few seconds of machine time").toBeLessThan(15_000);
  });
});

test("on a short window the reply is scrolled into view, so 'Get real times' visibly does something", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto("/");
  await page.getByLabel(/Ask the way you'd text/).fill("sellwood");
  await page.getByRole("button", { name: "Get real times" }).click();
  const reply = page.getByRole("status").filter({ hasText: "Fernhill replied instantly" });
  await expect(reply).toBeVisible();
  await expect.poll(async () => reply.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight * 0.7; }), { timeout: 5000 }).toBe(true);
});

test.describe("The constraints hold, and the owner sees the result", () => {
  test("for a car parked outdoors, wet days are blocked by default and can be shown on request", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&zip=97212&p=driveway");
    await page.getByLabel("Street address").fill("1 Rain Rd");
    await page.getByRole("button", { name: /Continue/ }).click();
    const box = page.getByRole("checkbox", { name: /Dry days only/ });
    await expect(box).toBeChecked();
    // No day you can pick is a wet one.
    await expect(page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /Rain likely/ })).toHaveCount(0);
    // A wet day is still on the calendar, greyed out and labelled.
    await expect(page.locator("fieldset button[aria-pressed]:disabled").filter({ hasText: /^.*Rain/ }).first()).toBeVisible();
    await box.uncheck();
    await expect(page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /Rain likely/ }).first()).toBeVisible();
  });

  test("a garage never blocks on rain, so there is no dry-days switch", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&zip=97212&p=garage");
    await page.getByLabel("Street address").fill("1 Dry Rd");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("checkbox", { name: /Dry days only/ })).toHaveCount(0);
  });

  test("a new booking shows on the owner's page with its limits already applied", async ({ page }) => {
    await bookThroughUi(page, "Owner Olive");
    await page.goto("/owner");
    const card = page.getByRole("region", { name: /Just booked/ });
    await expect(card).toContainText("Owner Olive");
    await expect(card).toContainText(/Job \d of 3 that day/);
    await expect(card).toContainText(/min/);
    await expect(card).toContainText("$25 deposit paid");
    await expect(card).toContainText("Nothing to do");
  });
});

test.describe("A judge's booking: real clicks, nothing hidden, at any window size", () => {
  const sizes = [
    { name: "a short preview pane", width: 900, height: 560 },
    { name: "a small phone", width: 360, height: 640 },
    { name: "this device", width: 0, height: 0 },
  ];
  for (const size of sizes) {
    test(`car and service, where, when, deposit, confirmation on ${size.name}`, async ({ page }) => {
      if (size.width) await page.setViewportSize({ width: size.width, height: size.height });
      const vp = page.viewportSize()!;
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const primary = () => page.getByRole("button", { name: /^(Continue|Book it)/ });
      /** The next step is always on screen, inside the window, without scrolling. */
      const nextIsOnScreen = async (label: string) => {
        const box = await primary().boundingBox();
        expect(box, `${label}: button exists`).not.toBeNull();
        expect(box!.y, `${label}: top on screen`).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height, `${label}: bottom on screen`).toBeLessThanOrEqual(vp.height + 1);
        expect(box!.x, `${label}: left on screen`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${label}: right on screen`).toBeLessThanOrEqual(vp.width + 1);
      };

      await page.goto("/book");
      // Empty tap: the reason is shown, on screen.
      await primary().click();
      const alert = page.getByRole("alert");
      await expect(alert).toContainText("Pick what you drive");
      const ab = await alert.boundingBox();
      expect(ab!.y).toBeGreaterThanOrEqual(0);
      expect(ab!.y + ab!.height).toBeLessThanOrEqual(vp.height + 1);

      // 1. Car and service, by clicking what's drawn (no forced clicks).
      await page.getByText("SUV or wagon", { exact: true }).click();
      await page.getByText("Full Refresh", { exact: true }).first().click();
      await nextIsOnScreen("car and service");
      await primary().click();

      // 2. Where.
      await page.getByLabel("Zip code").fill("97212");
      await page.getByLabel("Street address").fill("3999 NE Test St");
      await page.getByText("Driveway", { exact: true }).click();
      await nextIsOnScreen("where");
      await primary().click();

      // 3. When: rain and drive time on show, wet days blocked, a time chosen.
      await expect(page.getByRole("heading", { name: "When suits you?" })).toBeVisible();
      await page.locator("fieldset button[aria-pressed]:not([disabled])").first().click();
      const time = page.locator("fieldset button[aria-pressed]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M/ }).first();
      await time.scrollIntoViewIfNeeded();
      await time.click();
      await expect(page.getByText(/You picked .* \d+% chance of rain/)).toBeVisible();
      await expect(page.getByRole("figure", { name: "How this day fits together" })).toContainText(/of 3 jobs already booked/);
      await nextIsOnScreen("when");
      await primary().click();

      // 4. Review and pay the deposit.
      await expect(page.getByRole("heading", { name: /Review and pay/ })).toBeVisible();
      await expect(page.getByText("$25 deposit holds the slot. Fully refundable if we have to move you for rain.")).toBeVisible();
      await page.getByLabel("Your name").fill("Judge Jones");
      await page.getByLabel("Mobile number").fill("(503) 555-0100");
      await page.getByLabel("Email").fill("judge@example.com");
      await nextIsOnScreen("pay");
      await primary().click();

      // Confirmation: final, specific, not a generic screen.
      await expect(page.getByText("You're booked", { exact: true })).toBeVisible({ timeout: 10_000 });
      const glance = page.getByLabel("Your booking at a glance");
      await expect(glance).toContainText("3999 NE Test St");
      await expect(glance).toContainText("Paid");
      await expect(glance).toContainText(/\$25/);
      await expect(glance).toContainText(/Rain plan/i);
      await expect(page.getByText(/FH-[A-Z0-9]{4}/).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), "no sideways scroll").toBe(false);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("The customer's own screens prove the rules", () => {
  async function toWhen(page: Page, parking: "garage" | "driveway" = "garage") {
    await page.goto(`/book?v=suv&s=full&zip=97212&p=${parking}`);
    await page.getByLabel("Street address").fill("3999 NE Rule St");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByRole("heading", { name: "When suits you?" })).toBeVisible();
  }

  test("times that can't be booked are crossed out with the reason, and the legend explains each kind", async ({ page }) => {
    await toWhen(page);
    // Some day has other jobs on it: pick the busiest open day the calendar offers.
    const days = page.locator("fieldset button[aria-pressed]:not([disabled])");
    const count = await days.count();
    let sawBooked = false, sawDrive = false;
    for (let i = 0; i < Math.min(count, 8) && !(sawBooked && sawDrive); i++) {
      await days.nth(i).click();
      sawBooked ||= (await page.getByRole("img", { name: /not available: Booked/ }).count()) > 0;
      sawDrive ||= (await page.getByRole("img", { name: /not available: Drive time/ }).count()) > 0;
    }
    expect(sawBooked, "a day shows a time refused because another job is there").toBe(true);
    expect(sawDrive, "a day shows a time refused for drive time").toBe(true);
    const blocked = page.getByRole("img", { name: /not available/ }).first();
    await expect(blocked).toHaveAttribute("aria-label", /\d{1,2}:\d{2} [AP]M, not available: .+/);
    await expect(page.getByText("Why some times are crossed out")).toBeVisible();
    // A crossed-out time is not a button: it cannot be chosen.
    expect(await page.locator("button[aria-pressed]").filter({ has: page.locator("span.line-through") }).count()).toBe(0);
  });

  test("a full day is marked as at its limit and cannot be picked", async ({ page }) => {
    await toWhen(page);
    await expect(page.getByText(/means Dario already has 3 jobs that day/)).toBeVisible();
    const full = page.locator("fieldset button[aria-pressed]:disabled").filter({ hasText: /Full/ }).first();
    await expect(full).toBeVisible();
    await expect(full).toBeDisabled();
  });

  test("the deposit is required: the review says so, and pressing Enter without details books nothing", async ({ page }) => {
    await toWhen(page);
    await page.locator("fieldset button[aria-pressed]:not([disabled])").first().click();
    await page.locator("fieldset button[aria-pressed]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M/ }).first().click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Required to hold the slot")).toBeVisible();
    await expect(page.getByText(/No deposit, no slot/)).toBeVisible();
    await expect(page.getByText("$25 deposit holds the slot. Fully refundable if we have to move you for rain.")).toBeVisible();
    // No way to skip it: submitting with no details does not book anything.
    await page.getByLabel("Your name").press("Enter");
    await expect(page.getByRole("alert")).toContainText(/name, a mobile number/);
    await expect(page).toHaveURL(/\/book/);
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).jobs.filter((j: { customer: { name: string } }) => j.customer.name === "").length, STORE_KEY)).toBe(0);
  });
});
