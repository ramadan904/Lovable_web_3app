import { expect, type Page } from "@playwright/test";

const seen = new WeakMap<Page, string[]>();

/** Record page errors so a failed booking can say why, not just that it failed. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  seen.set(page, errors);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_CERT|ERR_FAILED|ERR_NAME|ERR_INTERNET/.test(m.text())) errors.push(`console: ${m.text()}`); });
}

/** Waits for the booking confirmation; on failure, explains what the page showed instead. */
export async function expectBooked(page: Page) {
  try {
    await expect(page.getByText("You're booked", { exact: true })).toBeVisible();
  } catch (e) {
    const alerts = await page.getByRole("alert").allTextContents().catch(() => []);
    const toasts = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
    const headings = await page.getByRole("heading").allTextContents().catch(() => []);
    const button = await page.getByRole("button", { name: /Book it|Booking/ }).allTextContents().catch(() => []);
    throw new Error(
      `Booking did not complete. url=${page.url()} alerts=${JSON.stringify(alerts)} toasts=${JSON.stringify(toasts)} ` +
        `headings=${JSON.stringify(headings)} button=${JSON.stringify(button)} errors=${JSON.stringify(seen.get(page) ?? [])}\n${(e as Error).message}`,
    );
  }
}
