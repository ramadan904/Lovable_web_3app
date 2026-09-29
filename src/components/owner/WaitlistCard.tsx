import { ListChecks, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SERVICES, ZONES } from "@/lib/business";
import type { State } from "@/lib/model";
import { actions } from "@/lib/store";
import { fmtDay, fmtRelative, fmtStamp, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** A compact view of the waitlist: who's waiting, which opening is out to whom, and how the last gap was filled. */
export function WaitlistCard({ state, now }: { state: State; now: number }) {
  const live = state.waitlist.filter((w) => w.status === "waiting" || w.status === "offered").sort((a, b) => a.createdAt - b.createdAt);
  const recent = state.events.filter((e) => ["cancelled", "released", "backfilled"].includes(e.kind) && e.at <= now).sort((a, b) => b.at - a.at).slice(0, 3);
  const cancel = () => {
    const who = actions.demoCancel();
    if (who) toast.success(`${who} cancelled`, { description: "The slot was offered to the first waitlisted customer whose job fits it." });
    else toast("No booking is far enough ahead to cancel for free. Reset the demo for a fresh week.");
  };
  return (
    <section aria-labelledby="wl-h" className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="wl-h" className="flex items-center gap-2 text-xl font-extrabold"><ListChecks className="size-5 text-fern" aria-hidden="true" /> Waitlist</h2>
          <p className="mt-1 text-sm text-muted-foreground">When someone cancels, the opening goes to the first person here whose job fits, with two hours to claim it.</p>
        </div>
        <Button size="sm" variant="outline" onClick={cancel}><XCircle /> Try it: a customer cancels</Button>
      </div>

      {live.length ? (
        <ul className="mt-4 space-y-2">
          {live.map((w) => (
            <li key={w.id} className={cn("rounded-md border px-3 py-2 text-sm", w.status === "offered" ? "border-sun/50 bg-sun-soft text-sun-ink" : "bg-card")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{w.name}</strong> · {SERVICES[w.service].name} · {ZONES[w.zone].name}</span>
                <span className="chip border-border bg-card text-foreground">{w.status === "offered" ? "Offer out" : "Waiting"}</span>
              </div>
              {w.status === "offered" && w.offer && <p className="mt-1">Offered {fmtDay(w.offer.startMs)} at {fmtTime(w.offer.startMs)}, expires {fmtRelative(now, w.offer.expiresAt)}.</p>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={ListChecks} title="Nobody's waiting" className="mt-4">
          When a day fills up, customers can join the waitlist from the booking page. They'll appear here, first come first served.
        </EmptyState>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <h3 className="eyebrow mb-2">Latest openings</h3>
          <ul className="space-y-1.5 text-sm">
            {recent.map((e) => <li key={e.id}><span className="text-muted-foreground">{fmtStamp(e.at)}</span> · {e.text}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
