// The on-chain side of the deposit: constants, the escrow's ABI and the rules it enforces,
// as pure functions. Nothing here touches a wallet, so it is all unit-tested.
import { keccak256, parseAbi, toHex, type Address, type Chain } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { FREE_CHANGE_H } from "./business";
import type { Job } from "./model";
import { HOUR } from "./time";

export const ESCROW_ABI = parseAbi([
  "function deposit(bytes32 id, uint256 amount, uint64 startTime)",
  "function cancelFree(bytes32 id)",
  "function reschedule(bytes32 id, uint64 newStart)",
  "function refund(bytes32 id)",
  "function capture(bytes32 id)",
  "function complete(bytes32 id)",
  "function reclaim(bytes32 id)",
  "function booking(bytes32 id) view returns (address, uint256, uint64, uint8)",
  "function owner() view returns (address)",
  "function token() view returns (address)",
  "error NotOwner()",
  "error NotCustomer()",
  "error AlreadyInitialised()",
  "error ZeroAmount()",
  "error StartInPast()",
  "error AlreadyExists()",
  "error NotHeld()",
  "error FreeWindowClosed()",
  "error FreeWindowStillOpen()",
  "error JobNotStarted()",
  "error TooEarlyToReclaim()",
  "error BadReschedule()",
  "error TransferFailed()",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const CHAINS: Record<number, Chain> = { [arbitrumSepolia.id]: arbitrumSepolia, [arbitrum.id]: arbitrum };

export interface ChainConfig {
  chain: Chain;
  escrow: Address;
  token: Address;
  symbol: string;
  decimals: number;
}

const isAddress = (v: string | undefined): v is Address => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

/** On-chain deposits are on only when an escrow and a token are configured (see docs/ONCHAIN.md). */
export function chainConfig(env: Partial<ImportMetaEnv> = import.meta.env): ChainConfig | null {
  if (!isAddress(env.VITE_ESCROW_ADDRESS) || !isAddress(env.VITE_TOKEN_ADDRESS)) return null;
  const chain = CHAINS[Number(env.VITE_CHAIN_ID ?? arbitrumSepolia.id)];
  if (!chain) return null;
  return {
    chain,
    escrow: env.VITE_ESCROW_ADDRESS,
    token: env.VITE_TOKEN_ADDRESS,
    symbol: env.VITE_TOKEN_SYMBOL || "USDC",
    decimals: Number(env.VITE_TOKEN_DECIMALS ?? 6),
  };
}

/** The contract's booking id: the booking code, hashed. No name, phone or address leaves the browser. */
export const bookingId = (code: string): `0x${string}` => keccak256(toHex(code.trim().toUpperCase()));

/** $25.00 (2500 cents) is 25_000_000 units of a 6-decimal stablecoin. */
export const centsToUnits = (cents: number, decimals = 6): bigint => BigInt(cents) * 10n ** BigInt(decimals - 2);

export const explorerTx = (cfg: Pick<ChainConfig, "chain">, tx: string): string => `${cfg.chain.blockExplorers?.default.url ?? "https://arbiscan.io"}/tx/${tx}`;
export const explorerAddress = (cfg: Pick<ChainConfig, "chain">, a: string): string => `${cfg.chain.blockExplorers?.default.url ?? "https://arbiscan.io"}/address/${a}`;
export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

export type OnchainState = "none" | "held" | "refunded" | "kept" | "applied";
const STATES: OnchainState[] = ["none", "held", "refunded", "kept", "applied"];
export const onchainState = (n: number): OnchainState => STATES[n] ?? "none";

/** What the escrow has to do to match the app's decision about a job's deposit. */
export type Settlement = "refund" | "capture" | "complete";

export function settlementFor(job: Pick<Job, "depositState">): Settlement | null {
  switch (job.depositState) {
    case "refunded": return "refund";
    case "kept": return "capture";
    case "applied": return "complete";
    default: return null;
  }
}

/** The customer can cancel on their own, with no one's permission, until the free window closes. */
export const canSelfCancel = (startMs: number, nowMs: number): boolean => startMs - nowMs >= FREE_CHANGE_H * HOUR;

/**
 * The contract's own timing rules, checked up front so the owner is told why a settlement
 * can't go through yet instead of paying gas for a revert. `nowMs` is the chain's clock, not the demo's.
 */
export function settleBlocker(kind: Settlement, startMs: number, nowMs: number): string | null {
  if (kind === "capture" && startMs - nowMs >= FREE_CHANGE_H * HOUR) {
    return "The customer can still cancel free until 24 hours before the job, so the contract won't let you keep this yet.";
  }
  if (kind === "complete" && nowMs < startMs) {
    return "The contract releases the deposit to you once the job's start time has passed.";
  }
  return null;
}

/** Contract errors, in words a customer or Dario can act on. */
const REVERTS: Record<string, string> = {
  NotOwner: "Only the business wallet can do that.",
  NotCustomer: "Only the wallet that paid the deposit can do that.",
  ZeroAmount: "The deposit can't be zero.",
  StartInPast: "That time has already passed.",
  AlreadyExists: "A deposit for this booking already exists.",
  NotHeld: "This deposit has already been settled.",
  FreeWindowClosed: "Free cancellation closed 24 hours before the job.",
  FreeWindowStillOpen: "The customer can still cancel free, so the deposit can't be kept yet.",
  JobNotStarted: "The job hasn't started yet.",
  TooEarlyToReclaim: "You can reclaim a week after the job, if it hasn't been settled.",
  BadReschedule: "The business wallet can only move a job later, by up to 14 days.",
  TransferFailed: "The token transfer failed. Check your balance and approval.",
};

interface Walkable { name?: string; code?: number; shortMessage?: string; message?: string; data?: { errorName?: string }; cause?: unknown; walk?: (fn?: (e: unknown) => boolean) => unknown }

export function explainError(e: unknown): string {
  const seen: Walkable[] = [];
  for (let cur = e as Walkable | undefined; cur && seen.length < 8; cur = cur.cause as Walkable | undefined) seen.push(cur);
  for (const err of seen) {
    if (err.code === 4001 || err.name === "UserRejectedRequestError") return "You cancelled the request in your wallet.";
    const name = err.data?.errorName;
    if (name && REVERTS[name]) return REVERTS[name];
  }
  const text = seen.map((x) => x.shortMessage ?? x.message ?? "").join(" ");
  for (const [name, msg] of Object.entries(REVERTS)) if (text.includes(`${name}()`) || text.includes(`'${name}'`)) return msg;
  if (/insufficient funds for gas/i.test(text)) return "Your wallet needs a little ETH on Arbitrum Sepolia for gas.";
  return seen[0]?.shortMessage ?? seen[0]?.message ?? "Something went wrong with the transaction.";
}
