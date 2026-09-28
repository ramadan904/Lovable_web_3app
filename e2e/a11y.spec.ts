import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"];

async function expectAccessible(page: Page) {
  // Let finite entrances finish (the breathing seal is infinite by design).
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.flatMap((v) => v.nodes.slice(0, 4).map((n) => `${v.id}: ${n.target.join(" ")} — ${n.any[0]?.message ?? n.failureSummary}`)),
  ).toEqual([]);
}

for (const path of ["/", "/guides", "/login", "/record", "/guide", "/nowhere"]) {
  test(`no WCAG AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);
  });
}

test("no WCAG AA violations through the ritual", async ({ page }) => {
  await page.goto("/begin");
  await expectAccessible(page);
  await page.getByText("Receiving a terminal diagnosis").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('label:has(input[name="guide"])').first()).toBeVisible();
  await expectAccessible(page);
  await page.locator('label:has(input[name="guide"])').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  for (const prompt of ["What is ending?", "What are you afraid to lose — or afraid to keep?", "What should your Guide know before you arrive?"]) {
    await page.getByLabel(prompt).fill("Words.");
    await page.getByRole("button", { name: /Next question|Continue/ }).click();
  }
  await page.getByText("Solo", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio").first().click();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expectAccessible(page);
  await page.getByText("Arrive without a letter").click();
  await expect(page.getByRole("heading", { name: "Everything is ready." })).toBeVisible();
  await expectAccessible(page);
});

test("no WCAG AA violations in a client record, a letter and a Guide's week", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Enter as Inês/ }).click();
  await page.waitForURL("**/record");
  await expect(page.getByRole("heading", { name: "Inês." })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/letters/30000000-0000-4000-8000-000000000001");
  await expect(page.getByText("Take your time. It will stay here.")).toBeVisible();
  await expectAccessible(page);
  await page.goto("/login");
  await page.getByRole("button", { name: /Enter as Mara/ }).click();
  await page.waitForURL("**/guide");
  await expect(page.getByRole("heading", { name: "Mara's week" })).toBeVisible();
  await expectAccessible(page);
});
