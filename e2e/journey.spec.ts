import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByText("You're booked", { exact: true })).toBeVisible();
}

/** Use a demo control. On phones the panel closes itself after each action, so open it on demand. */
async function demo(page: Page, name: RegExp) {
  const open = page.getByRole("button", { name: "Open demo controls" });
  if (await open.isVisible()) await open.click();
  await page.getByRole("button", { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("a customer books end to end and Dario finds it on his sheet, having typed nothing", async ({ page }) => {
  await bookThroughUi(page);
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
  await page.getByRole("button", { name: "Move to another time" }).click();
  await dayButtons(page).nth(3).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).nth(1).click();
  await page.getByRole("button", { name: /^Move to/ }).click();
  await expect(page.getByText("Moved by customer")).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
