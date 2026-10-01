// The browser-wallet side: connect, switch to Arbitrum, and send the escrow's transactions.
// It talks to whatever wallet the browser injects (MetaMask, Rabby, Coinbase Wallet...), with no wallet SDK.
import { createPublicClient, createWalletClient, custom, formatUnits, http, numberToHex, type Address, type Hash, type PublicClient } from "viem";
import { ERC20_ABI, ESCROW_ABI, bookingId, centsToUnits, onchainState, type ChainConfig, type OnchainState, type Settlement } from "./chain";
import type { OnchainDeposit } from "./model";

interface Eip1193 { request(args: { method: string; params?: unknown[] }): Promise<unknown> }

const injected = (): Eip1193 | null => (typeof window === "undefined" ? null : ((window as { ethereum?: Eip1193 }).ethereum ?? null));
export const hasWallet = (): boolean => injected() !== null;

export const publicClient = (cfg: ChainConfig): PublicClient => createPublicClient({ chain: cfg.chain, transport: http() }) as PublicClient;

/** Connects the wallet and makes sure it is on the configured Arbitrum chain, adding it if the wallet doesn't know it. */
export async function connectWallet(cfg: ChainConfig): Promise<Address> {
  const eth = injected();
  if (!eth) throw new Error("No wallet found. Install MetaMask, Rabby or Coinbase Wallet, then try again.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts[0]) throw new Error("Your wallet didn't share an account.");
  const chainId = numberToHex(cfg.chain.id);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: cfg.chain.name,
        nativeCurrency: cfg.chain.nativeCurrency,
        rpcUrls: cfg.chain.rpcUrls.default.http,
        blockExplorerUrls: cfg.chain.blockExplorers ? [cfg.chain.blockExplorers.default.url] : undefined,
      }],
    });
  }
  return accounts[0];
}

const walletFor = (cfg: ChainConfig, account: Address) => createWalletClient({ account, chain: cfg.chain, transport: custom(injected()!) });

async function mined(pub: PublicClient, hash: Hash): Promise<Hash> {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was rejected by the network.");
  return hash;
}

/** Steps the UI can show while a deposit goes through. */
export type PayStep = "connect" | "approve" | "deposit";

/**
 * Pays a booking's deposit into escrow: connect, approve the exact amount if needed, deposit.
 * The deposit is simulated first, so a revert (say a start time that has passed) costs no gas.
 */
export async function payDeposit(
  cfg: ChainConfig,
  b: { code: string; startMs: number; cents: number },
  onStep: (s: PayStep) => void = () => {},
): Promise<OnchainDeposit> {
  onStep("connect");
  const account = await connectWallet(cfg);
  const pub = publicClient(cfg);
  const wallet = walletFor(cfg, account);
  const amount = centsToUnits(b.cents, cfg.decimals);

  const balance = await pub.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "balanceOf", args: [account] });
  if (balance < amount) {
    const need = `${formatUnits(amount, cfg.decimals)} ${cfg.symbol}`;
    throw new Error(`You need ${need} on ${cfg.chain.name}; this wallet has ${formatUnits(balance, cfg.decimals)}.${cfg.chain.testnet ? " Free test USDC: faucet.circle.com." : ""}`);
  }

  const allowance = await pub.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "allowance", args: [account, cfg.escrow] });
  if (allowance < amount) {
    onStep("approve");
    await mined(pub, await wallet.writeContract({ address: cfg.token, abi: ERC20_ABI, functionName: "approve", args: [cfg.escrow, amount] }));
  }

  onStep("deposit");
  const id = bookingId(b.code);
  const { request } = await pub.simulateContract({
    account, address: cfg.escrow, abi: ESCROW_ABI, functionName: "deposit", args: [id, amount, BigInt(Math.floor(b.startMs / 1000))],
  });
  const depositTx = await mined(pub, await wallet.writeContract(request));
  return { id, chainId: cfg.chain.id, escrow: cfg.escrow, customer: account, depositTx, settleTx: null };
}

/** The customer cancels on their own, with no one's permission. Only works until 24 hours before the job. */
export async function cancelFree(cfg: ChainConfig, dep: OnchainDeposit): Promise<Hash> {
  const account = await connectWallet(cfg);
  const pub = publicClient(cfg);
  const { request } = await pub.simulateContract({ account, address: cfg.escrow, abi: ESCROW_ABI, functionName: "cancelFree", args: [dep.id] });
  return mined(pub, await walletFor(cfg, account).writeContract(request));
}

/** Moves the job on-chain so the free-cancel window follows the new time. The contract decides who may: the customer inside their window, or the business wallet, later only. */
export async function rescheduleOnchain(cfg: ChainConfig, dep: OnchainDeposit, newStartMs: number): Promise<Hash> {
  const account = await connectWallet(cfg);
  const pub = publicClient(cfg);
  const { request } = await pub.simulateContract({
    account, address: cfg.escrow, abi: ESCROW_ABI, functionName: "reschedule", args: [dep.id, BigInt(Math.floor(newStartMs / 1000))],
  });
  return mined(pub, await walletFor(cfg, account).writeContract(request));
}

/** The business wallet settles a deposit: refund it, keep it, or complete it (take it as part of the price). */
export async function settleDeposit(cfg: ChainConfig, dep: OnchainDeposit, kind: Settlement): Promise<Hash> {
  const account = await connectWallet(cfg);
  const pub = publicClient(cfg);
  const { request } = await pub.simulateContract({ account, address: cfg.escrow, abi: ESCROW_ABI, functionName: kind, args: [dep.id] });
  return mined(pub, await walletFor(cfg, account).writeContract(request));
}

export interface OnchainBooking { customer: Address; amountUnits: bigint; startMs: number; state: OnchainState }

/** What the contract holds for a booking, read straight from the chain. */
export async function readBooking(cfg: ChainConfig, id: `0x${string}`): Promise<OnchainBooking> {
  const [customer, amountUnits, start, state] = await publicClient(cfg).readContract({ address: cfg.escrow, abi: ESCROW_ABI, functionName: "booking", args: [id] });
  return { customer, amountUnits, startMs: Number(start) * 1000, state: onchainState(state) };
}

/** The chain's own clock (the latest block), which is the one the contract's timing rules use. */
export async function readChainNowMs(cfg: ChainConfig): Promise<number> {
  const block = await publicClient(cfg).getBlock();
  return Number(block.timestamp) * 1000;
}

export async function readOwner(cfg: ChainConfig): Promise<Address> {
  return publicClient(cfg).readContract({ address: cfg.escrow, abi: ESCROW_ABI, functionName: "owner" });
}
