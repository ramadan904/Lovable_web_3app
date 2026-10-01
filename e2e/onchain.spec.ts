import { expect, test, type Page } from "@playwright/test";
import { bookingId } from "../src/lib/chain";
import { BUSINESS, CUSTOMER, ESCROW, FakeChain, STATES, installChain } from "./fakeChain";
import { expectBooked, trackErrors } from "./helpers";

/**
 * Paying the deposit in USDC through the escrow contract, in a real browser: a real wallet prompt flow against a
 * simulated Arbitrum Sepolia (see fakeChain.ts). The app and its build are the real ones.
 */
const STORE_KEY = "fernhill:demo:v4";
const TIME = /^\d{1,2}:\d{2} [AP]M$/;
const USDC_25 = 25_000_000n;
const dayButtons = (page: Page) => page.locator("fieldset button[aria-pressed]:not([disabled])").filter({ hasText: /\d times?/ });

let chain: FakeChain;

test.beforeEach(async ({ page }) => {
  trackErrors(page);
  chain = new FakeChain();
  await installChain(page, chain);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

/** Fill the booking form up to the payment step and stop there. A later day, so the free-cancel window is open. */
async function toPayment(page: Page) {
  await page.goto("/book");
  await page.getByRole("radio", { name: /SUV or wagon/ }).check({ force: true });
  await page.getByRole("radio", { name: /Full Refresh/ }).check({ force: true });
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Zip code").fill("97212");
  await page.getByLabel("Street address").fill("3999 NE Test St");
  await page.getByRole("radio", { name: /^Garage/ }).check({ force: true });
  await page.getByRole("button", { name: /Continue/ }).click();
  await dayButtons(page).nth(2).click();
  const firstTime = page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first();
  await firstTime.click();
  await expect(firstTime).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Your name").fill("Wallet Customer");
  await page.getByLabel("Mobile number").fill("(503) 555-0100");
  await page.getByLabel("Email").fill("driver@example.com");
}

async function bookOnChain(page: Page): Promise<string> {
  await toPayment(page);
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);
  const code = page.url().match(/\/b\/(FH-[A-Z0-9]{4})/)![1];
  return code;
}

/** Change a stored job, as if time had passed or the app had decided something, then look at it fresh. */
async function editJob(page: Page, code: string, patch: Record<string, unknown>) {
  await page.evaluate(([key, c, p]) => {
    const s = JSON.parse(localStorage.getItem(key as string)!);
    Object.assign(s.jobs.find((j: { code: string }) => j.code === c), p);
    localStorage.setItem(key as string, JSON.stringify(s));
  }, [STORE_KEY, code, patch] as const);
}

const signAs = (page: Page, account: string) => page.evaluate((a) => sessionStorage.setItem("__account", a), account);

test("the deposit is paid in USDC: approve, deposit, and the booking follows", async ({ page }) => {
  await toPayment(page);
  const usdc = page.getByRole("radio", { name: /in USDC on Arbitrum Sepolia/ });
  await expect(usdc).toBeChecked(); // the default when a wallet is there
  await expect(page.getByRole("button", { name: /Book it · pay \$25 in USDC/ })).toBeVisible();
  await page.getByRole("button", { name: /Book it/ }).click();
  await expectBooked(page);

  const code = page.url().match(/\/b\/(FH-[A-Z0-9]{4})/)![1];
  expect(chain.count("approve")).toBe(1);
  expect(chain.count("deposit")).toBe(1);
  const [id, entry] = chain.only();
  expect(id).toBe(bookingId(code)); // the contract's id is the hash of the booking code, so no personal data is on-chain
  expect(entry).toMatchObject({ customer: CUSTOMER, amount: USDC_25, state: STATES.held });
  expect(chain.bal(ESCROW)).toBe(USDC_25);
  expect(chain.bal(CUSTOMER)).toBe(75_000_000n);

  // The booking page reads the deposit's state from the chain.
  await expect(page.getByRole("heading", { name: "Your deposit is in escrow" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Held in escrow" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Deposit transaction/ })).toHaveAttribute("href", /arbiscan\.io\/tx\/0x/);
});

test("a customer who cancels gets the USDC back from the contract, with no one else's help", async ({ page }) => {
  const code = await bookOnChain(page);
  await page.locator("#change").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled. Your USDC is back in your wallet.")).toBeVisible();

  expect(chain.count("cancelFree")).toBe(1);
  expect(chain.only()[1].state).toBe(STATES.refunded);
  expect(chain.bal(CUSTOMER)).toBe(100_000_000n);
  expect(chain.bal(ESCROW)).toBe(0n);
  await page.goto(`/b/${code}`);
  await expect(page.getByRole("status").filter({ hasText: "Refunded to your wallet" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Settlement transaction/ })).toBeVisible();
});

test("moving a booking moves the contract's time too, so the free-cancel window follows", async ({ page }) => {
  const code = await bookOnChain(page);
  const before = chain.only()[1].start;
  await page.getByRole("button", { name: "Pick another time" }).click();
  await dayButtons(page).nth(3).click();
  await page.locator("fieldset button[aria-pressed]").filter({ hasText: TIME }).first().click();
  await page.getByRole("button", { name: /^Move to / }).click();
  await expect(page.getByText("Moved. Your reminders moved too.")).toBeVisible();

  expect(chain.count("reschedule")).toBe(1);
  const after = chain.only()[1].start;
  expect(after).toBeGreaterThan(before);
  const stored = await page.evaluate(([key, c]) => JSON.parse(localStorage.getItem(key as string)!).jobs.find((j: { code: string }) => j.code === c).startMs, [STORE_KEY, code] as const);
  expect(BigInt(Math.floor(stored / 1000))).toBe(after); // app and chain agree on when the job is
});

test("closing the wallet prompt books nothing", async ({ page }) => {
  await toPayment(page);
  chain.rejectNext = true;
  await page.getByRole("button", { name: /Book it/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You cancelled the request in your wallet." })).toBeVisible();
  await expect(page).toHaveURL(/\/book/);
  expect(chain.count("deposit")).toBe(0);
  await expect(page.getByRole("button", { name: /Book it/ })).toBeEnabled(); // and they can try again
});

test("a wallet without enough USDC is told what's missing, before anything is signed", async ({ page }) => {
  chain.balances.set(CUSTOMER, 5_000_000n);
  await toPayment(page);
  await page.getByRole("button", { name: /Book it/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /You need 25 USDC.*has 5/ })).toBeVisible();
  expect(chain.txs).toHaveLength(0);
});

test("Dario takes the deposit as payment once the job is done, with his own wallet", async ({ page }) => {
  const code = await bookOnChain(page);
  const [, entry] = chain.only();
  // The job has been done: the app says so, and the chain's clock is past the start time.
  await editJob(page, code, { status: "completed", depositState: "applied", closedAt: Date.now() });
  chain.skewSec = Number(entry.start) - Math.floor(Date.now() / 1000) + 3600;

  await signAs(page, CUSTOMER);
  await page.goto("/owner");
  await page.getByRole("button", { name: "Connect business wallet" }).click();
  await expect(page.getByText("This isn't the business wallet.")).toBeVisible(); // the contract would refuse, so the card says so up front
  await signAs(page, BUSINESS);
  await page.reload();
  await page.getByRole("button", { name: "Connect business wallet" }).click();
  await expect(page.getByText("This isn't the business wallet.")).toBeHidden();

  await expect(page.getByText("Job done:")).toBeVisible();
  await page.getByRole("button", { name: "Take as payment" }).click();
  await expect(page.getByText("Deposit collected as part of the price.")).toBeVisible();
  expect(chain.only()[1].state).toBe(STATES.applied);
  expect(chain.bal(BUSINESS)).toBe(USDC_25);
  expect(chain.bal(ESCROW)).toBe(0n);

  await page.goto(`/b/${code}`);
  await expect(page.getByRole("status").filter({ hasText: "Paid to the business as part of the price" })).toBeVisible();
});

test("Dario is told why a deposit can't be taken yet, and the contract agrees", async ({ page }) => {
  const code = await bookOnChain(page);
  await editJob(page, code, { status: "completed", depositState: "applied", closedAt: Date.now() });
  await signAs(page, BUSINESS);
  await page.goto("/owner");
  await page.getByRole("button", { name: "Connect business wallet" }).click();
  await expect(page.getByText(/once the job's start time has passed/).first()).toBeVisible();
  await page.getByRole("button", { name: "Take as payment" }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: /start time has passed/ })).toBeVisible();
  expect(chain.count("complete")).toBe(0);
  expect(chain.only()[1].state).toBe(STATES.held);
});

test("Dario can keep a no-show's deposit only after the free window closes", async ({ page }) => {
  const code = await bookOnChain(page);
  const [, entry] = chain.only();
  await editJob(page, code, { status: "released", depositState: "kept", closedAt: Date.now(), closedReason: "No confirmation" });
  await signAs(page, BUSINESS);

  // Two days out, the customer can still cancel free, so the contract won't let him keep it.
  await page.goto("/owner");
  await page.getByRole("button", { name: "Connect business wallet" }).click();
  await expect(page.getByText(/can still cancel free until 24 hours before/).first()).toBeVisible();
  await page.getByRole("button", { name: "Keep deposit" }).click();
  expect(chain.count("capture")).toBe(0);

  // Twelve hours before the job, the window has closed.
  chain.skewSec = Number(entry.start) - Math.floor(Date.now() / 1000) - 12 * 3600;
  await page.reload();
  await page.getByRole("button", { name: "Connect business wallet" }).click();
  await page.getByRole("button", { name: "Keep deposit" }).click();
  await expect(page.getByText("Deposit kept.")).toBeVisible();
  expect(chain.only()[1].state).toBe(STATES.kept);
  expect(chain.bal(BUSINESS)).toBe(USDC_25);
});
