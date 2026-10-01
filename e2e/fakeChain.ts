// A stand-in for Arbitrum Sepolia, enough to drive the real app in a real browser: the JSON-RPC the app reads
// from, and the wallet it sends transactions through. It enforces the same rules as the Stylus contract
// (contracts/escrow/src/lib.rs); those rules are unit-tested there, and the ABI is checked against the compiled
// contract in src/lib/__tests__/chain.test.ts, so what this proves is the app's own flow.
import type { Page } from "@playwright/test";
import { decodeFunctionData, encodeErrorResult, encodeFunctionResult, keccak256, toHex, type Hex } from "viem";
import { ERC20_ABI, ESCROW_ABI } from "../src/lib/chain";

export const ESCROW = "0xe5c1000000000000000000000000000000000001";
export const TOKEN = "0x05dc000000000000000000000000000000000002";
export const CUSTOMER = "0xc0000000000000000000000000000000000000c1";
export const BUSINESS = "0xd000000000000000000000000000000000000d00";
export const STATES = { none: 0, held: 1, refunded: 2, kept: 3, applied: 4 } as const;
const DAY = 86_400;
const ABI = [...ESCROW_ABI, ...ERC20_ABI];

interface Entry { customer: string; amount: bigint; start: bigint; state: number }
export interface Tx { from: string; to: string; fn: string; args: readonly unknown[]; hash: Hex }

class Revert extends Error {
  constructor(public errorName: string) { super(`execution reverted: ${errorName}`); }
}

export class FakeChain {
  /** Added to the real clock, to jump past a job's start or into its last 24 hours. */
  skewSec = 0;
  balances = new Map<string, bigint>([[CUSTOMER, 100_000_000n]]);
  allowances = new Map<string, bigint>();
  bookings = new Map<string, Entry>();
  txs: Tx[] = [];
  /** The next wallet prompt is rejected, as if the person pressed Cancel. */
  rejectNext = false;

  now = () => BigInt(Math.floor(Date.now() / 1000) + this.skewSec);
  bal = (a: string) => this.balances.get(a.toLowerCase()) ?? 0n;
  only = (): [string, Entry] => { const e = [...this.bookings.entries()]; if (e.length !== 1) throw new Error(`expected one booking, found ${e.length}`); return e[0]; };
  count = (fn: string) => this.txs.filter((t) => t.fn === fn).length;

  private move(from: string, to: string, amt: bigint) {
    if (this.bal(from) < amt) throw new Revert("TransferFailed");
    this.balances.set(from, this.bal(from) - amt);
    this.balances.set(to, this.bal(to) + amt);
  }

  /** Runs a call as `from`. Reads and simulations don't keep their changes; sends do. */
  private run(from: string, to: string, data: Hex, commit: boolean): Hex {
    const { functionName: fn, args = [] } = decodeFunctionData({ abi: ABI, data }) as { functionName: string; args?: readonly unknown[] };
    const f = from.toLowerCase();
    const out = (v: unknown): Hex => encodeFunctionResult({ abi: ABI, functionName: fn as never, result: v as never });

    if (to.toLowerCase() === TOKEN) {
      if (fn === "balanceOf") return out(this.bal(args[0] as string));
      if (fn === "allowance") return out(this.allowances.get(`${(args[0] as string).toLowerCase()}>${(args[1] as string).toLowerCase()}`) ?? 0n);
      if (fn === "approve") { if (commit) this.allowances.set(`${f}>${(args[0] as string).toLowerCase()}`, args[1] as bigint); return out(true); }
      throw new Error(`token: unsupported ${fn}`);
    }
    if (fn === "owner") return out(BUSINESS);
    if (fn === "token") return out(TOKEN);
    const id = args[0] as string;
    const b = this.bookings.get(id);
    if (fn === "booking") return out(b ? [b.customer, b.amount, b.start, b.state] : ["0x0000000000000000000000000000000000000000", 0n, 0n, 0]);

    const now = this.now();
    const held = (): Entry => { if (!b || b.state !== STATES.held) throw new Revert("NotHeld"); return b; };
    const isOwner = f === BUSINESS;
    const settle = (state: number, pay: string) => { const e = held(); if (commit) { e.state = state; this.move(ESCROW, pay, e.amount); } };

    switch (fn) {
      case "deposit": {
        const [, amount, start] = args as [string, bigint, bigint];
        if (amount === 0n) throw new Revert("ZeroAmount");
        if (start <= now) throw new Revert("StartInPast");
        if (b && b.state !== 0) throw new Revert("AlreadyExists");
        if ((this.allowances.get(`${f}>${ESCROW}`) ?? 0n) < amount) throw new Revert("TransferFailed");
        if (commit) { this.move(f, ESCROW, amount); this.bookings.set(id, { customer: f, amount, start, state: STATES.held }); }
        return "0x";
      }
      case "cancelFree": {
        const e = held();
        if (f !== e.customer) throw new Revert("NotCustomer");
        if (now + BigInt(DAY) > e.start) throw new Revert("FreeWindowClosed");
        settle(STATES.refunded, e.customer);
        return "0x";
      }
      case "reschedule": {
        const e = held();
        const next = args[1] as bigint;
        if (next <= now) throw new Revert("StartInPast");
        if (f === e.customer) { if (now + BigInt(DAY) > e.start) throw new Revert("FreeWindowClosed"); }
        else if (isOwner) { if (next <= e.start || next > e.start + BigInt(14 * DAY)) throw new Revert("BadReschedule"); }
        else throw new Revert("NotCustomer");
        if (commit) e.start = next;
        return "0x";
      }
      case "refund": { if (!isOwner) throw new Revert("NotOwner"); settle(STATES.refunded, held().customer); return "0x"; }
      case "capture": {
        if (!isOwner) throw new Revert("NotOwner");
        if (now + BigInt(DAY) <= held().start) throw new Revert("FreeWindowStillOpen");
        settle(STATES.kept, BUSINESS);
        return "0x";
      }
      case "complete": {
        if (!isOwner) throw new Revert("NotOwner");
        if (now < held().start) throw new Revert("JobNotStarted");
        settle(STATES.applied, BUSINESS);
        return "0x";
      }
      default: throw new Error(`escrow: unsupported ${fn}`);
    }
  }

  /** eth_sendTransaction from the page's wallet. */
  send(tx: { from: string; to: string; data: Hex }): Hex {
    if (this.rejectNext) { this.rejectNext = false; throw Object.assign(new Error("User rejected the request."), { code: 4001 }); }
    this.run(tx.from, tx.to, tx.data, true);
    const { functionName, args = [] } = decodeFunctionData({ abi: ABI, data: tx.data }) as { functionName: string; args?: readonly unknown[] };
    const hash = keccak256(toHex(`tx${this.txs.length}${tx.data}`));
    this.txs.push({ from: tx.from.toLowerCase(), to: tx.to.toLowerCase(), fn: functionName, args, hash });
    return hash;
  }

  /** The JSON-RPC the app's read client talks to. */
  rpc(method: string, params: unknown[]): unknown {
    const zeros = `0x${"0".repeat(512)}`;
    const block = (n: number) => ({
      number: toHex(n), hash: keccak256(toHex(n)), parentHash: keccak256(toHex(n - 1)), timestamp: toHex(this.now()), transactions: [],
      gasLimit: "0x1c9c380", gasUsed: "0x0", miner: ESCROW, nonce: "0x0000000000000000", difficulty: "0x0", totalDifficulty: "0x0", size: "0x1",
      extraData: "0x", sha3Uncles: keccak256("0x"), logsBloom: zeros, stateRoot: keccak256("0x01"), receiptsRoot: keccak256("0x02"),
      transactionsRoot: keccak256("0x03"), baseFeePerGas: "0x1", uncles: [],
    });
    const find = (hash: unknown) => { const i = this.txs.findIndex((t) => t.hash === hash); return i < 0 ? null : { i, t: this.txs[i] }; };
    switch (method) {
      case "eth_chainId": return "0x66eee";
      case "eth_blockNumber": return toHex(1000 + this.txs.length);
      case "eth_getBlockByNumber": return block(1000 + this.txs.length);
      case "eth_gasPrice": case "eth_maxPriorityFeePerGas": case "eth_estimateGas": return "0x1";
      case "eth_getTransactionCount": return "0x1";
      case "eth_getTransactionReceipt": {
        const hit = find(params[0]);
        if (!hit) return null;
        return {
          transactionHash: hit.t.hash, transactionIndex: "0x0", blockHash: keccak256(toHex(1000 + hit.i)), blockNumber: toHex(1000 + hit.i + 1),
          from: hit.t.from, to: hit.t.to, cumulativeGasUsed: "0x5208", gasUsed: "0x5208", effectiveGasPrice: "0x1", contractAddress: null,
          logs: [], logsBloom: zeros, status: "0x1", type: "0x2",
        };
      }
      case "eth_getTransactionByHash": {
        const hit = find(params[0]);
        if (!hit) return null;
        return {
          hash: hit.t.hash, nonce: "0x0", blockHash: keccak256(toHex(1000 + hit.i)), blockNumber: toHex(1000 + hit.i + 1), transactionIndex: "0x0",
          from: hit.t.from, to: hit.t.to, value: "0x0", gas: "0x5208", gasPrice: "0x1", input: "0x", type: "0x2", chainId: "0x66eee", v: "0x0", r: "0x1", s: "0x1",
        };
      }
      case "eth_call": {
        const c = params[0] as { from?: string; to: string; data?: string; input?: string };
        return this.run(c.from ?? "0x0000000000000000000000000000000000000000", c.to, (c.data ?? c.input) as Hex, false);
      }
      default: throw new Error(`rpc: unsupported ${method}`);
    }
  }
}

/** Gives the page a wallet that signs as `account` and a chain to read, both backed by `chain`. */
export async function installChain(page: Page, chain: FakeChain, account: string = CUSTOMER) {
  await page.exposeFunction("__chainSend", (tx: { from: string; to: string; data: Hex }) => {
    try { return { hash: chain.send(tx) }; } catch (e) { return { error: { code: (e as { code?: number }).code ?? -32000, message: (e as Error).message } }; }
  });
  await page.addInitScript((fallback) => {
    // Tests switch who is signing by setting sessionStorage.__account, e.g. to the business wallet for the owner page.
    const who = () => sessionStorage.getItem("__account") || fallback;
    const w = window as unknown as { ethereum: unknown; __chainSend: (t: unknown) => Promise<{ hash?: string; error?: { code: number; message: string } }> };
    w.ethereum = {
      request: async ({ method, params }: { method: string; params?: [Record<string, string>] }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [who()];
        if (method === "eth_chainId") return "0x66eee";
        if (method === "wallet_switchEthereumChain") return null;
        if (method === "eth_sendTransaction") {
          const r = await w.__chainSend({ ...params![0], from: who() });
          if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
          return r.hash;
        }
        throw new Error(`wallet: unsupported ${method}`);
      },
    };
  }, account);

  await page.route(/sepolia-rollup\.arbitrum\.io/, async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const answer = (req: { id: number; method: string; params?: unknown[] }) => {
      try { return { jsonrpc: "2.0", id: req.id, result: chain.rpc(req.method, req.params ?? []) }; } catch (e) {
        if (e instanceof Revert) return { jsonrpc: "2.0", id: req.id, error: { code: 3, message: "execution reverted", data: encodeErrorResult({ abi: ABI, errorName: e.errorName as never }) } };
        return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: (e as Error).message } };
      }
    };
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)) });
  });
}
