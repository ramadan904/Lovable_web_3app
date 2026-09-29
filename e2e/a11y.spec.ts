import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectBooked, trackErrors } from "./helpers";

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  trackErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("landing", async ({ page }) => { await page.goto("/"); await audit(page); });

test("landing with an answered inquiry", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Ask the way you'd text/).fill("minivan tomorrow morning 97007");
  await page.getByRole("button", { name: "Get real times" }).click();
  await expect(page.getByText("Fernhill replied instantly")).toBeVisible();
  await audit(page);
});

test("booking: every step", async ({ page }) => {
  await page.goto("/book");
  await audit(page);
  await page.getByRole("radio", { name: /Car/ }).first().check({ force: true });
  await page.getByRole("radio", { name: /Express Wash/ }).check({ force: true });
  await page.getByRole("button", { name: /Continue/ }).click();
  await audit(page);
  await page.getByLabel("Zip code").fill("97212");
  await page.getByLabel("Street address").fill("1 Main");
  await page.getByRole("radio", { name: /^Driveway/ }).check({ force: true });
  await page.getByRole("button", { name: /Continue/ }).click();
  await audit(page);
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await audit(page);
});

for (const tab of ["Day sheet", "Week", "Messages sent", "Inquiries", "Waitlist"]) {
  test(`owner: ${tab}`, async ({ page }) => {
    await page.goto("/owner");
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await audit(page);
  });
}

test("owner with demo controls open", async ({ page }) => {
  await page.goto("/owner");
  await page.getByRole("button", { name: "Open demo controls" }).click();
  await audit(page);
});

test("booking confirmation and manage page", async ({ page }) => {
  await page.goto("/book?v=sedan&s=express&zip=97212&p=garage");
  await page.getByLabel("Street address").fill("1 Main");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Your name").fill("A. Person");
  await page.getByLabel("Mobile number").fill("5035550100");
  await page.getByLabel("Email").fill("a@example.com");
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
  await audit(page);
});

test("not found", async ({ page }) => { await page.goto("/nope"); await audit(page); });

test.describe("layout", () => {
  const routes = ["/", "/book", "/book?v=suv&s=full&zip=97212&p=garage", "/owner", "/nope"];
  for (const route of routes) {
    test(`no horizontal page scroll: ${route}`, async ({ page }) => {
      await page.goto(route);
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
    });
  }

  test("no horizontal page scroll on the booking calendar step or the owner tabs", async ({ page }) => {
    await page.goto("/book?v=suv&s=full&zip=97212&p=garage");
    await page.getByLabel("Street address").fill("1 Main");
    await page.getByRole("button", { name: /Continue/ }).click();
    for (const tab of ["Week", "Messages sent", "Inquiries", "Waitlist"]) {
      await page.goto("/owner");
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw, tab).toBeLessThanOrEqual(cw);
    }
  });
});
