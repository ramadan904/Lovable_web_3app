import { expect, test, type Page } from "@playwright/test";

async function walkToHold(page: Page, threshold = "Leaving a defining career") {
  await page.goto("/begin");
  await page.getByText(threshold).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Guides hold/);
  const guides = page.locator('label:has(input[name="guide"])');
  await expect(guides.first()).toBeVisible();
  const count = await guides.count();
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(5);
  await guides.first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("What is ending?").fill("Thirty years of teaching.");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByText("I'd rather bring this into the room").click();
  await page.getByLabel("What should your Guide know before you arrive?").fill("I will be quiet at first.");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Solo", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Choose the hour." })).toBeVisible();
  const slot = page.getByRole("radio").first();
  await expect(slot).toBeVisible();
  await slot.click();
  await expect(page.getByText("The shape of your hour")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Your letter to your future self").fill("Dear me,\n\nYou walked out, and nothing fell down.");
  await page.getByRole("button", { name: "Seal the letter" }).click();
  await expect(page.getByRole("heading", { name: "Everything is ready." })).toBeVisible();
}

test("a guest can walk the whole ritual and hold a time", async ({ page }) => {
  await walkToHold(page);
  await page.getByLabel(/call you/).fill("Ada");
  await page.getByLabel("Email").fill(`ada+${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Hold this time" }).click();

  await expect(page.getByRole("heading", { name: "It is held, Ada." })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Your letter is sealed/)).toBeVisible();

  await page.getByRole("link", { name: "Go to my thresholds" }).click();
  await expect(page.getByRole("heading", { name: "Ada." })).toBeVisible();
  await expect(page.getByText("Sealed", { exact: true })).toBeVisible();
});

test("the draft survives leaving and returning", async ({ page }) => {
  await page.goto("/begin");
  await page.getByText("Becoming an empty-nester").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Guides hold/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Continue where you left off/ })).toBeVisible();
  await page.goto("/begin");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Guides hold/);
});

test("an hour taken by someone else mid-ritual returns you to the hour, words intact", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Enter as Inês/ }).click();
  await page.waitForURL("**/record");
  await walkToHold(page, "Finalizing a divorce");

  // Someone else is given that exact hour, in the shared store.
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("threshold.demo.db")!);
    const draft = JSON.parse(localStorage.getItem("threshold.ritual")!);
    const s = new Date(draft.slotStart);
    const e = new Date(s.getTime() + 90 * 60_000);
    db.sessions.push({
      id: crypto.randomUUID(), client_id: "00000000-0000-4000-8000-0000000000c1", guide_id: draft.guideId,
      threshold_slug: "divorce", threshold_words: null, session_type: "solo", status: "held",
      starts_at: s.toISOString(), ends_at: e.toISOString(), buffer_before_min: 45, buffer_after_min: 45,
      client_name: "Someone", client_timezone: "UTC", created_at: new Date().toISOString(), cancelled_at: null,
    });
    localStorage.setItem("threshold.demo.db", JSON.stringify(db));
  });

  await page.getByRole("button", { name: "Hold this time" }).click();
  await expect(page.getByRole("heading", { name: "Choose the hour." })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("status")).toContainText("was given to someone else");
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("threshold.ritual")!));
  expect(draft.letter).toContain("nothing fell down");
  expect(draft.answers[0]).toBe("Thirty years of teaching.");
});

test("releasing a session returns its letter unopened", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Enter as Inês/ }).click();
  await page.waitForURL("**/record");
  await page.getByRole("button", { name: "Release this time" }).first().click();
  await page.getByRole("button", { name: "Release", exact: true }).click();
  await expect(page.getByText("Returned to you, unopened")).toBeVisible();
});

test("a Guide sees buffers and briefings, never letters", async ({ page, isMobile }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Enter as Mara/ }).click();
  await page.waitForURL("**/guide");
  await expect(page.getByRole("heading", { name: "Mara's week" })).toBeVisible();
  const session = isMobile ? page.locator("main button:has(p)").first() : page.locator('button[aria-label*="Open briefing"]').first();
  if ((await session.count()) === 0) await page.getByRole("button", { name: "Next week" }).click();
  await session.click();
  await expect(page.getByRole("heading", { name: "What they told you" })).toBeVisible();
  await expect(page.getByText("Guides never see it.")).toBeVisible();
});
