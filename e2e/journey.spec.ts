import { expect, test, type Page } from "@playwright/test";
import { expectBooked, trackErrors } from "./helpers";

/** Book a Full Refresh for an SUV in a garage (so weather never interferes). */
const TIME = /^\d{1,2}:\d{2} [AP]M$/;
/** Days that have open times, in the picker's order. */
const dayButtons = (page: Page) => page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /times/ });

async function bookThroughUi(page: Page, name = "Test Driver", dayIndex = 0) {
  await page.goto("/book");
  await page.getByRole("radio", { name: /SUV or wagon/ }).check({ force: true });
  await page.getByRole("radio", { name: /Full Refresh/ }).check({ force: true });
  await page.getByRole("button", { name: /Continue/ }).click();

  await page.getByLabel("Zip code").fill("97212");
  await page.getByLabel("Street address").fill("3999 NE Test St");
  await page.getByRole("radio", { name: /^Garage/ }).check({ force: true });
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
    for (const label of ["Service", "Vehicle", "Where", "Parking", "Time window", "Price"]) await expect(review.getByText(label, { exact: true })).toBeVisible();
    await expect(review.getByText(/covered, not weather-sensitive/)).toBeVisible();
    await expect(review.getByText(/to about \d{1,2}:\d{2} [AP]M/)).toBeVisible();
    await expect(page.getByText("$25 holds the slot. Fully refundable if we have to move you for rain.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Weather status" })).toContainText("Not weather-sensitive");
  });

  test("an outdoor car on a rainy day is shown dry alternatives, switchable in one tap", async ({ page }) => {
    await page.goto("/book?v=sedan&s=express&zip=97212&p=driveway");
    await page.getByLabel("Street address").fill("1 Rain St");
    await page.getByRole("button", { name: /Continue/ }).click();
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
    await expect(next).toContainText("One-tap confirm");
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
  await dayButtons(page).nth(2).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Your name").fill("Refund Rae");
  await page.getByLabel("Mobile number").fill("(503) 555-0100");
  await page.getByLabel("Email").fill("rae@example.com");
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
  const url = page.url();
  // A storm on her day, then time passes to well inside 24 hours (she never picks a dry option).
  const start = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("fernhill:demo:v3")!);
    const j = s.jobs.find((x: { customer: { name: string } }) => x.customer.name === "Refund Rae");
    return j.startMs as number;
  });
  await page.evaluate((ms) => {
    const s = JSON.parse(localStorage.getItem("fernhill:demo:v3")!);
    const d = new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    s.stormDays = [d];
    localStorage.setItem("fernhill:demo:v3", JSON.stringify(s));
  }, start);
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
