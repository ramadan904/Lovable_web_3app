import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { ESCROW_ABI, bookingId, canSelfCancel, centsToUnits, chainConfig, explainError, onchainState, settleBlocker, settlementFor, shortAddress } from "../chain";
import { DEPOSIT_CENTS } from "../business";
import { cancelJob, createJob, recordSettlement, type BookingInput } from "../ops";
import { emptyState } from "../seed";
import { HOUR, addDays, atLocal } from "../time";

const ESCROW = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";

describe("chainConfig", () => {
  it("is off until both an escrow and a token are set", () => {
    expect(chainConfig({})).toBeNull();
    expect(chainConfig({ VITE_ESCROW_ADDRESS: ESCROW })).toBeNull();
    expect(chainConfig({ VITE_ESCROW_ADDRESS: "nope", VITE_TOKEN_ADDRESS: TOKEN })).toBeNull();
  });
  it("defaults to Arbitrum Sepolia and 6-decimal USDC", () => {
    const cfg = chainConfig({ VITE_ESCROW_ADDRESS: ESCROW, VITE_TOKEN_ADDRESS: TOKEN })!;
    expect(cfg.chain.id).toBe(421614);
    expect(cfg.symbol).toBe("USDC");
    expect(cfg.decimals).toBe(6);
  });
  it("rejects a mistyped mixed-case address, whose checksum is wrong, instead of failing at payment time", () => {
    const good = getAddress("0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d"); // has letters, so a case flip changes the checksum
    expect(chainConfig({ VITE_ESCROW_ADDRESS: good, VITE_TOKEN_ADDRESS: TOKEN })).not.toBeNull();
    const typo = good.replace(/[a-f]/, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())); // flips one letter's case
    expect(typo).not.toBe(good);
    expect(chainConfig({ VITE_ESCROW_ADDRESS: typo, VITE_TOKEN_ADDRESS: TOKEN })).toBeNull();
  });
  it("supports Arbitrum One and rejects other chains", () => {
    expect(chainConfig({ VITE_ESCROW_ADDRESS: ESCROW, VITE_TOKEN_ADDRESS: TOKEN, VITE_CHAIN_ID: "42161" })!.chain.id).toBe(42161);
    expect(chainConfig({ VITE_ESCROW_ADDRESS: ESCROW, VITE_TOKEN_ADDRESS: TOKEN, VITE_CHAIN_ID: "1" })).toBeNull();
  });
});

describe("booking id and amounts", () => {
  it("hashes the booking code, ignoring case and spacing", () => {
    expect(bookingId("fh-4k7q ")).toBe(bookingId("FH-4K7Q"));
    expect(bookingId("FH-4K7Q")).toMatch(/^0x[0-9a-f]{64}$/);
    expect(bookingId("FH-4K7Q")).not.toBe(bookingId("FH-4K7R"));
  });
  it("is the keccak256 of the code, the same id the contract is keyed by", () => {
    // keccak256 of nothing is a published constant, so this checks the hash itself, not just our wrapper.
    expect(bookingId("")).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    // And a fixed id for a real code, so a change to how ids are derived is caught before it orphans deposits.
    expect(bookingId("FH-4K7Q")).toBe("0x5b46cf7f9a51de00db213afecb843283f84200bba7152231c6e24a5785cc39f6");
  });
  it("turns the $25 deposit into 25 USDC", () => {
    expect(centsToUnits(DEPOSIT_CENTS)).toBe(25_000_000n);
    expect(centsToUnits(2500, 18)).toBe(25n * 10n ** 18n);
    expect(centsToUnits(1, 6)).toBe(10_000n);
  });
  it("shortens addresses", () => {
    expect(shortAddress(ESCROW)).toBe("0x1111…1111");
  });
});

describe("the escrow ABI", () => {
  it("exposes every function the app calls", () => {
    const names = ESCROW_ABI.filter((x) => x.type === "function").map((x) => x.name).sort();
    expect(names).toEqual(["booking", "cancelFree", "capture", "complete", "deposit", "owner", "refund", "reclaim", "reschedule", "token"].sort());
  });
  it("maps contract states to the app's states", () => {
    expect([0, 1, 2, 3, 4, 9].map(onchainState)).toEqual(["none", "held", "refunded", "kept", "applied", "none"]);
  });
});

describe("what the escrow must do to match the app", () => {
  it("maps each deposit decision to one contract call", () => {
    expect(settlementFor({ depositState: "held" })).toBeNull();
    expect(settlementFor({ depositState: "refunded" })).toBe("refund");
    expect(settlementFor({ depositState: "kept" })).toBe("capture");
    expect(settlementFor({ depositState: "applied" })).toBe("complete");
  });
  const start = atLocal("2026-10-05", 9 * 60);
  it("lets a customer cancel on their own until exactly 24 hours before", () => {
    expect(canSelfCancel(start, start - 24 * HOUR)).toBe(true);
    expect(canSelfCancel(start, start - 24 * HOUR + 1)).toBe(false);
  });
  it("won't let the owner keep a deposit while the customer can still cancel free", () => {
    expect(settleBlocker("capture", start, start - 48 * HOUR)).toMatch(/still cancel free/);
    expect(settleBlocker("capture", start, start - 24 * HOUR + 1)).toBeNull();
  });
  it("holds the deposit until the job has started before it is completed", () => {
    expect(settleBlocker("complete", start, start - 1)).toMatch(/start time/);
    expect(settleBlocker("complete", start, start)).toBeNull();
  });
  it("always lets the owner refund, rain or not", () => {
    expect(settleBlocker("refund", start, start - HOUR)).toBeNull();
  });
});

describe("errors in plain words", () => {
  it("explains a rejected wallet prompt", () => {
    expect(explainError({ code: 4001, message: "User rejected" })).toMatch(/cancelled/);
    expect(explainError({ name: "UserRejectedRequestError" })).toMatch(/cancelled/);
  });
  it("explains contract reverts, including ones buried in the cause chain", () => {
    expect(explainError({ cause: { cause: { data: { errorName: "FreeWindowClosed" } } } })).toMatch(/24 hours/);
    expect(explainError({ shortMessage: "reverted with: NotOwner()" })).toMatch(/business wallet/);
  });
  it("explains a wallet with no gas, and falls back to the raw message", () => {
    expect(explainError({ message: "insufficient funds for gas * price + value" })).toMatch(/ETH/);
    expect(explainError({ shortMessage: "weird" })).toBe("weird");
    expect(explainError(undefined)).toMatch(/went wrong/);
  });
});

describe("an on-chain deposit in the booking engine", () => {
  const NOW = atLocal("2026-09-30", 10 * 60);
  const input = (over: Partial<BookingInput> = {}): BookingInput => ({
    customer: { name: "Maya Thornton", phone: "(503) 555-0121", email: "maya@example.com" },
    vehicle: { kind: "suv", label: "grey Outback" },
    service: "full", addons: [], zip: "97212", address: "3415 NE 15th Ave", parking: "garage",
    access: { gateCode: "", notes: "" }, startMs: atLocal(addDays("2026-09-30", 3), 9 * 60), ...over,
  });
  const dep = (id: `0x${string}`) => ({ id, chainId: 421614, escrow: ESCROW as `0x${string}`, customer: TOKEN as `0x${string}`, depositTx: "0xabc" as `0x${string}`, settleTx: null });

  it("a dry run of a booking gives the exact code the real booking gets, so the contract id can be known first", () => {
    const s = emptyState(NOW);
    const preview = createJob(s, input(), NOW).job;
    const real = createJob(s, input({ onchain: dep(bookingId(preview.code)) }), NOW).job;
    expect(real.code).toBe(preview.code);
    expect(real.onchain?.id).toBe(bookingId(real.code));
  });
  it("a demo booking has no on-chain deposit", () => {
    expect(createJob(emptyState(NOW), input(), NOW).job.onchain).toBeNull();
  });
  it("cancelling early marks the deposit refunded, which the owner's wallet then settles on-chain", () => {
    const s = emptyState(NOW);
    const { state, job } = createJob(s, input({ onchain: dep(bookingId("X")) }), NOW);
    const after = cancelJob(state, job.id, NOW);
    const j = after.jobs.find((x) => x.id === job.id)!;
    expect(j.depositState).toBe("refunded");
    expect(settlementFor(j)).toBe("refund");
    expect(j.onchain).not.toBeNull();
  });
  it("records the settlement transaction", () => {
    const { state, job } = createJob(emptyState(NOW), input({ onchain: dep(bookingId("X")) }), NOW);
    const after = recordSettlement(state, job.id, "0xdef");
    expect(after.jobs.find((x) => x.id === job.id)!.onchain?.settleTx).toBe("0xdef");
  });
});

describe("the app's ABI matches the compiled contract", () => {
  // contracts/escrow/FernhillEscrow.abi.sol is exported from the Rust source (see docs/ONCHAIN.md).
  // Stylus renames snake_case functions to camelCase, so a hand-written ABI can quietly point at selectors
  // that don't exist, and every call would revert on a live chain. This catches that.
  const sol = readFileSync(resolve(__dirname, "../../../contracts/escrow/FernhillEscrow.abi.sol"), "utf8");
  const exported = (kind: "function" | "error") =>
    [...sol.matchAll(new RegExp(`^\\s*${kind} (\\w+)\\(([^)]*)\\)`, "gm"))].map((m) => `${m[1]}(${m[2].split(",").map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).join(",")})`);

  const signature = (x: { name: string; inputs: readonly { type: string }[] }) => `${x.name}(${x.inputs.map((i) => i.type).join(",")})`;
  it("has the same functions, with the same argument types", () => {
    const app = ESCROW_ABI.filter((x) => x.type === "function").map(signature);
    expect(app.sort()).toEqual(exported("function").sort());
  });
  it("has the same errors", () => {
    const app = ESCROW_ABI.filter((x) => x.type === "error").map(signature);
    expect(app.sort()).toEqual(exported("error").sort());
  });
});
