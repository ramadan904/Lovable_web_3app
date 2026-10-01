import { useCallback, useEffect, useState } from "react";
import { Coins, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SERVICES, dollars } from "@/lib/business";
import { explainError, explorerAddress, settleBlocker, settlementFor, shortAddress, type ChainConfig, type Settlement } from "@/lib/chain";
import type { Job, State } from "@/lib/model";
import { actions } from "@/lib/store";
import { fmtDay, fmtTime } from "@/lib/time";
import { connectWallet, hasWallet, readBooking, readOwner, rescheduleOnchain, settleDeposit, type OnchainBooking } from "@/lib/wallet";

const ACTION: Record<Settlement, { label: string; done: string }> = {
  refund: { label: "Refund", done: "Refunded to the customer's wallet." },
  capture: { label: "Keep deposit", done: "Deposit kept." },
  complete: { label: "Take as payment", done: "Deposit collected as part of the price." },
};

/**
 * The owner's side of the escrow: the app decides what should happen to each deposit (rain refund,
 * no-show, job done), and this card is where Dario's wallet makes the money match. The contract has the
 * last word: it will refuse anything its rules don't allow, and the card says why.
 */
export function OnchainDeposits({ state, cfg }: { state: State; cfg: ChainConfig }) {
  const jobs = state.jobs.filter((j) => j.onchain);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [owner, setOwner] = useState<`0x${string}` | null>(null);
  const [chain, setChain] = useState<Record<string, OnchainBooking>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const key = jobs.map((j) => `${j.id}:${j.onchain!.settleTx ?? ""}:${j.startMs}`).join("|");
  useEffect(() => {
    let live = true;
    readOwner(cfg).then((o) => live && setOwner(o), () => {});
    Promise.all(jobs.map((j) => readBooking(cfg, j.onchain!.id).then((b) => [j.id, b] as const, () => null))).then((rows) => {
      if (live) setChain(Object.fromEntries(rows.filter((r): r is readonly [string, OnchainBooking] => r !== null)));
    });
    return () => { live = false; };
  }, [cfg, key, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    try { setAccount(await connectWallet(cfg)); } catch (e) { toast.error(explainError(e)); }
  }, [cfg]);

  const run = async (job: Job, fn: () => Promise<`0x${string}`>, ok: string, record: boolean) => {
    setBusy(job.id);
    try {
      const tx = await fn();
      if (record) actions.recordSettlement(job.id, tx);
      toast.success(ok);
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(explainError(e));
    } finally {
      setBusy(null);
    }
  };

  const settle = (job: Job, kind: Settlement) => {
    const why = settleBlocker(kind, job.startMs, Date.now());
    if (why) return void toast(why);
    void run(job, () => settleDeposit(cfg, job.onchain!, kind), ACTION[kind].done, true);
  };

  const held = jobs.filter((j) => chain[j.id]?.state === "held");
  const heldCents = held.reduce((n, j) => n + j.depositCents, 0);
  const wrongWallet = !!account && !!owner && account.toLowerCase() !== owner.toLowerCase();

  // A deposit needs the owner when the app has decided its fate, or the job moved and the contract's start time lags behind.
  const rows = jobs.flatMap((j) => {
    const c = chain[j.id];
    if (!c || c.state !== "held") return [];
    const kind = settlementFor(j);
    const lag = !kind && c.startMs < j.startMs;
    return kind || lag ? [{ job: j, kind, lag }] : [];
  });

  return (
    <section aria-labelledby="chain-h" className="card mb-10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="chain-h" className="flex items-center gap-2 text-xl font-extrabold"><Coins className="size-5 text-fern" aria-hidden="true" /> Deposits on {cfg.chain.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Customers' {cfg.symbol} deposits are held by the escrow contract, not by you. When a booking is cancelled, rained out, missed or done, settle it here with your business wallet.
            {" "}<a className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" href={explorerAddress(cfg, cfg.escrow)} target="_blank" rel="noreferrer">Contract <ExternalLink className="size-3.5" aria-hidden="true" /></a>
          </p>
        </div>
        {account ? (
          <span className="chip border-border bg-card text-foreground"><Wallet className="size-3.5" aria-hidden="true" /> {shortAddress(account)}</span>
        ) : (
          <Button size="sm" variant="outline" onClick={connect} disabled={!hasWallet()}><Wallet /> {hasWallet() ? "Connect business wallet" : "No wallet found"}</Button>
        )}
      </div>

      {wrongWallet && <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">This isn't the business wallet. The contract only lets {shortAddress(owner!)} settle deposits.</p>}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
        <div className="rounded-md border bg-card px-3 py-2"><dt className="eyebrow">Held in escrow</dt><dd className="text-lg font-extrabold">{dollars(heldCents)}</dd><dd className="text-muted-foreground">{held.length} {held.length === 1 ? "booking" : "bookings"}</dd></div>
        <div className="rounded-md border bg-card px-3 py-2"><dt className="eyebrow">Needs you</dt><dd className="text-lg font-extrabold">{rows.length}</dd><dd className="text-muted-foreground">to settle or sync</dd></div>
      </dl>

      {rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.map(({ job, kind, lag }) => {
            const why = kind ? settleBlocker(kind, job.startMs, Date.now()) : null;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                <span>
                  <strong>{job.customer.name}</strong> · {SERVICES[job.service].name} · {fmtDay(job.startMs)} {fmtTime(job.startMs)}
                  <span className="block text-muted-foreground">
                    {kind === "refund" && `Cancelled or rained out: send back ${dollars(job.depositCents)}.`}
                    {kind === "capture" && `Late cancel or no-show: ${dollars(job.depositCents)} is yours to keep.`}
                    {kind === "complete" && `Job done: ${dollars(job.depositCents)} counts toward the price.`}
                    {lag && "Moved after booking: the contract still has the old time, which holds up the customer's free-cancel window."}
                    {why && <span className="block text-sun-ink">{why}</span>}
                  </span>
                </span>
                {kind ? (
                  <Button size="sm" variant={kind === "refund" ? "default" : "soft"} disabled={busy === job.id || !hasWallet()} onClick={() => settle(job, kind)}>
                    {busy === job.id ? "Confirm in wallet…" : ACTION[kind].label}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy === job.id || !hasWallet()} onClick={() => void run(job, () => rescheduleOnchain(cfg, job.onchain!, job.startMs), "Contract updated to the new time.", false)}>
                    {busy === job.id ? "Confirm in wallet…" : "Sync the time"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Coins} title={jobs.length ? "Nothing to settle" : "No on-chain deposits yet"} className="mt-4">
          {jobs.length ? "Every deposit is either still waiting on its job or already settled." : `When a customer pays their deposit in ${cfg.symbol}, it shows up here.`}
        </EmptyState>
      )}
    </section>
  );
}

