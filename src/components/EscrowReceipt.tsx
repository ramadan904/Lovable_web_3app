import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { explorerAddress, explorerTx, type ChainConfig, type OnchainState } from "@/lib/chain";
import { dollars } from "@/lib/business";
import type { Job } from "@/lib/model";
import { readBooking } from "@/lib/wallet";
import { cn } from "@/lib/utils";

const WORDS: Record<OnchainState, string> = {
  none: "Not found on-chain",
  held: "Held in escrow",
  refunded: "Refunded to your wallet",
  kept: "Paid to the business (late cancel or no-show)",
  applied: "Paid to the business as part of the price",
};

/** What the contract says about this booking's deposit, read from the chain, with the transactions to check it. */
export function EscrowReceipt({ job, cfg }: { job: Job; cfg: ChainConfig }) {
  const dep = job.onchain!;
  const [chain, setChain] = useState<OnchainState | null>(null);

  useEffect(() => {
    let live = true;
    readBooking(cfg, dep.id).then((b) => live && setChain(b.state), () => live && setChain(null));
    return () => { live = false; };
  }, [cfg, dep.id, dep.settleTx]);

  // The app has decided the deposit goes back, but the business wallet hasn't sent it yet.
  const waiting = chain === "held" && job.depositState !== "held";
  const label = waiting
    ? job.depositState === "refunded" ? "Refund on its way: waiting for the business wallet to send it" : "Waiting for the business wallet to settle"
    : chain ? WORDS[chain] : "Checking the chain…";

  return (
    <section className="card p-5" aria-labelledby="escrow-h">
      <h2 id="escrow-h" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5 text-fern" aria-hidden="true" /> Your deposit is in escrow</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {dollars(job.depositCents)} in {cfg.symbol} sits in a smart contract on {cfg.chain.name}, not in anyone's account. You can cancel free until 24 hours before and the contract returns it without asking the business. If it's never settled, you can take it back a week after the job.
      </p>
      <p className={cn("mt-3 rounded-md px-3 py-2 text-sm font-semibold", waiting ? "bg-sun-soft text-sun-ink" : "bg-fern-soft text-fern-ink")} role="status">{label}</p>
      <ul className="mt-3 space-y-1 text-sm">
        <li><a className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" href={explorerTx(cfg, dep.depositTx)} target="_blank" rel="noreferrer">Deposit transaction <ExternalLink className="size-3.5" aria-hidden="true" /></a></li>
        {dep.settleTx && <li><a className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" href={explorerTx(cfg, dep.settleTx)} target="_blank" rel="noreferrer">Settlement transaction <ExternalLink className="size-3.5" aria-hidden="true" /></a></li>}
        <li><a className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" href={explorerAddress(cfg, dep.escrow)} target="_blank" rel="noreferrer">The escrow contract <ExternalLink className="size-3.5" aria-hidden="true" /></a></li>
      </ul>
    </section>
  );
}
